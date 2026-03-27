export default function LayerController({ layers, setLayers }) {
  const toggleOverlay = (key) => {
    setLayers(prev => ({
      ...prev,
      overlays: {
        ...prev.overlays,
        [key]: !prev.overlays[key]
      }
    }));
  };

  const setBase = (type) => {
    setLayers(prev => ({
      ...prev,
      base: type
    }));
  };

  return (
    <div className="layer-controller">
      <h3 className="layer-controller__title">Map Layers</h3>
      
      <div className="layer-section">
        <h4 className="layer-section__label">Base Map</h4>
        <label className="layer-option">
          <input 
            type="radio" 
            name="base" 
            checked={layers.base === 'ortho'} 
            onChange={() => setBase('ortho')}
          />
          <span>Orthomosaic (Aerial)</span>
        </label>
        <label className="layer-option">
          <input 
            type="radio" 
            name="base" 
            checked={layers.base === 'dtm'} 
            onChange={() => setBase('dtm')}
          />
          <span>DTM (Ground)</span>
        </label>
        <label className="layer-option">
          <input 
            type="radio" 
            name="base" 
            checked={layers.base === 'dsm'} 
            onChange={() => setBase('dsm')}
          />
          <span>DSM (Surface)</span>
        </label>
      </div>

      <div className="layer-section">
        <h4 className="layer-section__label">Overlays</h4>
        <label className="layer-option">
          <input 
            type="checkbox" 
            checked={layers.overlays.boundary} 
            onChange={() => toggleOverlay('boundary')}
          />
          <span>Plantation Boundary</span>
        </label>
        <label className="layer-option">
          <input 
            type="checkbox" 
            checked={layers.overlays.trees} 
            onChange={() => toggleOverlay('trees')}
          />
          <span>Tree Locations</span>
        </label>
        <label className="layer-option">
          <input 
            type="checkbox" 
            checked={layers.overlays.health} 
            onChange={() => toggleOverlay('health')}
          />
          <span>Health Analysis</span>
        </label>
        <label className="layer-option">
          <input 
            type="checkbox" 
            checked={layers.overlays.height} 
            onChange={() => toggleOverlay('height')}
          />
          <span>Height Heatmap</span>
        </label>
      </div>
      
      <div style={{ marginTop: 'var(--space-md)', paddingTop: 'var(--space-md)', borderTop: '1px solid var(--border-subtle)' }}>
        <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
          High-resolution drone data processed with GDAL. Interactive analysis powered by PostGIS.
        </p>
      </div>
    </div>
  );
}
