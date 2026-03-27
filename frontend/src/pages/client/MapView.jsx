import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import api from '../../api/client';
import LayerController from '../../components/LayerController';

export default function MapView({ project }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [layers, setLayers] = useState({
    base: 'ortho',
    overlays: {
      boundary: true,
      trees: true,
      health: false,
      height: false
    }
  });

  useEffect(() => {
    if (!mapContainer.current || !project) return;

    // Load boundary to get initial view
    const boundary = project.boundary_geojson ? JSON.parse(project.boundary_geojson) : null;
    let center = [0, 0];
    let zoom = 2;

    if (boundary && boundary.features && boundary.features.length > 0) {
      // Very simple centroid calculation for fitBounds alternative
      const coords = boundary.features[0].geometry.coordinates[0];
      const lngs = coords.map(c => c[0]);
      const lats = coords.map(c => c[1]);
      center = [
        (Math.min(...lngs) + Math.max(...lngs)) / 2,
        (Math.min(...lats) + Math.max(...lats)) / 2
      ];
      zoom = 15;
    }

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm': {
            type: 'raster',
            tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap Contributors'
          }
        },
        layers: [
          {
            id: 'osm',
            type: 'raster',
            source: 'osm',
            minzoom: 0,
            maxzoom: 19
          }
        ]
      },
      center: center,
      zoom: zoom,
      antialias: true
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      setupSourcesAndLayers();
    });

    return () => {
      if (map.current) {
        map.current.remove();
      }
    };
  }, [project?.id]);

  const [heightRange, setHeightRange] = useState({ min: 0, max: 15 });

  const setupSourcesAndLayers = () => {
    if (!map.current || !project) return;

    const projectId = project.id;
    const baseUrl = window.location.origin;

    // Raster Sources (Ortho, DTM, DSM)
    ['ortho', 'dtm', 'dsm'].forEach(type => {
      map.current.addSource(type, {
        type: 'raster',
        tiles: [`${baseUrl}/tiles/${projectId}/${type}/{z}/{x}/{y}.png`],
        tileSize: 256,
        scheme: 'xyz',
        minzoom: 2,
        maxzoom: 22
      });

      map.current.addLayer({
        id: `${type}-layer`,
        type: 'raster',
        source: type,
        layout: {
          'visibility': layers.base === type ? 'visible' : 'none'
        }
      });
    });

    // Boundary Source - Added AFTER rasters to ensure it's on top
    if (project.boundary_geojson) {
      map.current.addSource('boundary', {
        type: 'geojson',
        data: JSON.parse(project.boundary_geojson)
      });

      map.current.addLayer({
        id: 'boundary-line',
        type: 'line',
        source: 'boundary',
        paint: {
          'line-color': '#00ffff', // Bright Cyan for "pop"
          'line-width': 4,        // Thicker line
          'line-opacity': 0.9
        },
        layout: {
          'visibility': layers.overlays.boundary ? 'visible' : 'none'
        }
      });
    }

    // Trees Source - Fetch manually to include auth token
    async function addTrees() {
      try {
        const response = await api.get(`/projects/${projectId}/trees`);
        if (map.current) {
          const treeData = response.data;
          
          // Calculate dynamic height range
          if (treeData && treeData.features && treeData.features.length > 0) {
            const heights = treeData.features
              .map(f => f.properties.height_m)
              .filter(h => h !== null && h !== undefined);
            
            if (heights.length > 0) {
              const min = Math.min(...heights);
              const max = Math.max(...heights);
              setHeightRange({ min, max });
              
              map.current.addSource('trees', {
                type: 'geojson',
                data: treeData
              });
              
              setupTreeLayers({ min, max });
            }
          }
        }
      } catch (err) {
        console.error('Failed to load tree data', err);
      }
    }
    
    addTrees();
  };

  const setupTreeLayers = (range) => {
    if (!map.current) return;
    const { min, max } = range;

    // Tree Point Layer (Default)
    map.current.addLayer({
      id: 'trees-point',
      type: 'circle',
      source: 'trees',
      paint: {
        'circle-radius': 4,
        'circle-color': '#ffffff',
        'circle-stroke-width': 1,
        'circle-stroke-color': '#000000'
      },
      layout: {
        'visibility': layers.overlays.trees && !layers.overlays.health && !layers.overlays.height ? 'visible' : 'none'
      }
    });

    // Tree Health Layer
    map.current.addLayer({
      id: 'trees-health',
      type: 'circle',
      source: 'trees',
      paint: {
        'circle-radius': 6,
        'circle-color': [
          'match',
          ['get', 'health_status'],
          'Healthy', '#22c55e',
          'Moderate', '#eab308',
          'Poor', '#ef4444',
          '#64748b'
        ],
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#000000'
      },
      layout: {
        'visibility': layers.overlays.health ? 'visible' : 'none'
      }
    });

    // Tree Height Layer (Size and Color Heatmap) - DYNAMIC COLORS
    const delta = max - min;
    map.current.addLayer({
      id: 'trees-height',
      type: 'circle',
      source: 'trees',
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['get', 'height_m'],
          min, 8,
          min + delta * 0.5, 12,
          max, 18
        ],
        'circle-color': [
          'interpolate',
          ['linear'],
          ['get', 'height_m'],
          min, '#ffff00',                // Yellow
          min + delta * 0.15, '#ffcc00',   // Orange yellow
          min + delta * 0.30, '#ff8c00',   // Orange
          min + delta * 0.45, '#e91e63',   // Pink
          min + delta * 0.60, '#d81b60',   // Magenta
          min + delta * 0.75, '#8e24aa',   // Purple
          min + delta * 0.90, '#3f51b5',   // Indigo
          max, '#1a237e'                  // Dark Blue
        ],
        'circle-opacity': 0.85,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#000000'
      },
      layout: {
        'visibility': layers.overlays.height ? 'visible' : 'none'
      }
    });

    // Click behavior
    map.current.on('click', 'trees-point', handleTreeClick);
    map.current.on('click', 'trees-health', handleTreeClick);
    map.current.on('click', 'trees-height', handleTreeClick);

    // Hover effect
    const layersToHover = ['trees-point', 'trees-health', 'trees-height'];
    map.current.on('mouseenter', layersToHover, () => {
      map.current.getCanvas().style.cursor = 'pointer';
    });
    map.current.on('mouseleave', layersToHover, () => {
      map.current.getCanvas().style.cursor = '';
    });
  };

  const handleTreeClick = (e) => {
    const features = map.current.queryRenderedFeatures(e.point, {
      layers: ['trees-point', 'trees-health', 'trees-height']
    });

    if (!features.length) return;

    const tree = features[0].properties;
    
    new maplibregl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(`
        <div class="tree-popup">
          <div class="tree-popup__header">
            <span class="tree-popup__id">Tree #${tree.tree_index}</span>
          </div>
          <div class="tree-popup__row">
            <span class="tree-popup__label">Height</span>
            <span class="tree-popup__value">${tree.height_m}m</span>
          </div>
          <div class="tree-popup__row">
            <span class="tree-popup__label">Health</span>
            <span class="tree-popup__value">${tree.health_status || 'N/A'}</span>
          </div>
          <div class="tree-popup__row">
            <span class="tree-popup__label">Location</span>
            <span class="tree-popup__value" style="font-size: 10px">
              ${Number(tree.latitude).toFixed(6)}, ${Number(tree.longitude).toFixed(6)}
            </span>
          </div>
        </div>
      `)
      .addTo(map.current);
  };

  // Switch base layer
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;
    
    ['ortho', 'dtm', 'dsm'].forEach(type => {
      if (map.current.getLayer(`${type}-layer`)) {
        map.current.setLayoutProperty(`${type}-layer`, 'visibility', layers.base === type ? 'visible' : 'none');
      }
    });
  }, [layers.base]);

  // Switch overlays
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;
    
    if (map.current.getLayer('boundary-line')) {
      map.current.setLayoutProperty('boundary-line', 'visibility', layers.overlays.boundary ? 'visible' : 'none');
    }

    const showBasic = layers.overlays.trees && !layers.overlays.health && !layers.overlays.height;
    if (map.current.getLayer('trees-point')) {
      map.current.setLayoutProperty('trees-point', 'visibility', showBasic ? 'visible' : 'none');
    }
    if (map.current.getLayer('trees-health')) {
      map.current.setLayoutProperty('trees-health', 'visibility', layers.overlays.health ? 'visible' : 'none');
    }
    if (map.current.getLayer('trees-height')) {
      map.current.setLayoutProperty('trees-height', 'visibility', layers.overlays.height ? 'visible' : 'none');
    }
  }, [layers.overlays]);

  return (
    <div className="map-container" style={{ position: 'relative' }}>
      <div ref={mapContainer} className="map-canvas" />
      <LayerController layers={layers} setLayers={setLayers} />
      
      {layers.overlays.height && (
        <div className="map-legend">
          <div className="map-legend__title">Tree Height (m)</div>
          <div className="map-legend__gradient">
            <div className="map-legend__bar" />
            <div className="map-legend__labels">
              <span>{heightRange.max.toFixed(1)}+</span>
              <span>{(heightRange.min + (heightRange.max - heightRange.min) * 0.85).toFixed(1)}</span>
              <span>{(heightRange.min + (heightRange.max - heightRange.min) * 0.71).toFixed(1)}</span>
              <span>{(heightRange.min + (heightRange.max - heightRange.min) * 0.57).toFixed(1)}</span>
              <span>{(heightRange.min + (heightRange.max - heightRange.min) * 0.42).toFixed(1)}</span>
              <span>{(heightRange.min + (heightRange.max - heightRange.min) * 0.28).toFixed(1)}</span>
              <span>{(heightRange.min + (heightRange.max - heightRange.min) * 0.14).toFixed(1)}</span>
              <span>{heightRange.min.toFixed(1)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
