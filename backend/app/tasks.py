import os
import glob
import json
import traceback
import subprocess
import logging

import geopandas as gpd
import numpy as np
import pyogrio
from shapely.geometry import mapping
from sqlalchemy.orm import Session

from app.celery_app import celery_app
from app.database import SessionLocal
from app.models import Project, ProjectStatus, Tree, HealthStatus
from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


def _find_shapefile(upload_dir: str, pattern: str) -> str | None:
    """Find a shapefile matching a pattern (case-insensitive)."""
    for f in os.listdir(upload_dir):
        if f.lower().endswith(".shp") and pattern.lower() in f.lower():
            return os.path.join(upload_dir, f)
    return None


def _find_tif(upload_dir: str, pattern: str) -> str | None:
    """Find a TIF file matching a pattern."""
    for f in os.listdir(upload_dir):
        if f.lower().endswith((".tif", ".tiff")) and pattern.lower() in f.lower():
            return os.path.join(upload_dir, f)
    return None


def _normalize_health(value) -> HealthStatus | None:
    """Normalize health classification values from shapefiles."""
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return None
    val = str(value).strip().lower()
    if val in ("healthy", "good", "1", "h"):
        return HealthStatus.HEALTHY
    elif val in ("moderate", "medium", "2", "m", "fair"):
        return HealthStatus.MODERATE
    elif val in ("poor", "bad", "3", "p", "unhealthy"):
        return HealthStatus.POOR
    return None


@celery_app.task(bind=True, name="process_project_files")
def process_project_files(self, project_id: str):
    """
    Main processing pipeline:
    1. Read & process shapefiles (boundary, trees, health)
    2. Merge tree height + health data
    3. Insert into PostGIS
    4. Generate XYZ tiles from rasters
    """
    db: Session = SessionLocal()
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            logger.error(f"Project {project_id} not found")
            return

        upload_dir = os.path.join(settings.UPLOAD_DIR, project_id)
        if not os.path.exists(upload_dir):
            raise FileNotFoundError(f"Upload directory not found: {upload_dir}")

        logger.info(f"Processing project {project_id} from {upload_dir}")
        logger.info(f"Files in upload dir: {os.listdir(upload_dir)}")

        # ── Step 1: Process Plantation Boundary ──────────────────
        boundary_shp = _find_shapefile(upload_dir, "boundary")
        if boundary_shp:
            try:
                logger.info(f"Processing boundary: {boundary_shp}")
                gdf_boundary = gpd.read_file(boundary_shp)
            except Exception as e:
                raise Exception(f"Failed to read Boundary shapefile. Ensure all parts (.dbf, .shx, .prj) are uploaded. Error: {e}")

            # Reproject to EPSG:4326 if needed
            if gdf_boundary.crs and gdf_boundary.crs.to_epsg() != 4326:
                gdf_boundary = gdf_boundary.to_crs(epsg=4326)

            # Store as GeoJSON
            boundary_geojson = gdf_boundary.to_json()
            project.boundary_geojson = boundary_geojson

            # Calculate area in hectares (reproject to a metric CRS)
            try:
                gdf_metric = gdf_boundary.to_crs(epsg=3857)
                area_m2 = gdf_metric.geometry.area.sum()
                project.area_hectares = round(area_m2 / 10000, 2)
            except Exception as e:
                logger.warning(f"Could not calculate area: {e}")

        # ── Step 2: Process Tree Height Data ─────────────────────
        tree_shp = _find_shapefile(upload_dir, "tree")
        if not tree_shp:
            tree_shp = _find_shapefile(upload_dir, "height")

        gdf_trees = None
        if tree_shp:
            try:
                logger.info(f"Processing trees: {tree_shp}")
                gdf_trees = gpd.read_file(tree_shp)
                if gdf_trees.crs and gdf_trees.crs.to_epsg() != 4326:
                    gdf_trees = gdf_trees.to_crs(epsg=4326)
            except Exception as e:
                raise Exception(f"Failed to read Tree Inventory shapefile. Ensure all parts (.dbf, .shx, .prj) are uploaded. Error: {e}")

        # ── Step 3: Process Health Data ──────────────────────────
        health_shp = _find_shapefile(upload_dir, "health")
        gdf_health = None
        if health_shp:
            try:
                logger.info(f"Processing health: {health_shp}")
                gdf_health = gpd.read_file(health_shp)
                if gdf_health.crs and gdf_health.crs.to_epsg() != 4326:
                    gdf_health = gdf_health.to_crs(epsg=4326)
            except Exception as e:
                raise Exception(f"Failed to read Health Data shapefile. Ensure all parts (.dbf, .shx, .prj) are uploaded. Error: {e}")

        # ── Step 4: Merge & Insert Trees ─────────────────────────
        if gdf_trees is not None:
            # Clean up old trees for this project
            db.query(Tree).filter(Tree.project_id == project_id).delete()

            # Try to find common ID column for merge
            tree_cols = [c.lower() for c in gdf_trees.columns]
            id_col_tree = None
            for candidate in ["id", "fid", "tree_id", "objectid"]:
                if candidate in tree_cols:
                    id_col_tree = gdf_trees.columns[tree_cols.index(candidate)]
                    break

            # Find height column
            height_col = None
            for candidate in ["tree_heigt", "tree_height", "height", "height_m", "z", "apex_height"]:
                if candidate in tree_cols:
                    height_col = gdf_trees.columns[tree_cols.index(candidate)]
                    break

            # Merge with health data if both exist
            merged = gdf_trees.copy()
            health_col_name = None

            if gdf_health is not None:
                health_cols = [c.lower() for c in gdf_health.columns]
                # Find ID column in health shapefile
                id_col_health = None
                for candidate in ["id", "fid", "tree_id", "objectid"]:
                    if candidate in health_cols:
                        id_col_health = gdf_health.columns[health_cols.index(candidate)]
                        break

                # Find health classification column
                for candidate in ["health", "classification", "class", "status", "gridcode", "health_score"]:
                    if candidate in health_cols:
                        health_col_name = gdf_health.columns[health_cols.index(candidate)]
                        break

                if id_col_tree and id_col_health and health_col_name:
                    # Merge on ID column
                    health_data = gdf_health[[id_col_health, health_col_name]].copy()
                    health_data = health_data.rename(columns={id_col_health: id_col_tree})
                    merged = merged.merge(health_data, on=id_col_tree, how="left")
                elif health_col_name:
                    # If no ID column, try spatial join
                    try:
                        merged = gpd.sjoin_nearest(gdf_trees, gdf_health[[health_col_name, "geometry"]], how="left")
                    except Exception:
                        pass

            # Insert trees into database
            tree_records = []
            for idx, row in merged.iterrows():
                geom = row.geometry
                lat = geom.y
                lon = geom.x

                height = None
                if height_col and height_col in merged.columns:
                    h = row[height_col]
                    if h is not None and not (isinstance(h, float) and np.isnan(h)):
                        height = round(float(h), 2)

                health = None
                if health_col_name and health_col_name in merged.columns:
                    health = _normalize_health(row[health_col_name])

                tree_index = idx + 1
                if id_col_tree and id_col_tree in merged.columns:
                    try:
                        tree_index = int(row[id_col_tree])
                    except (ValueError, TypeError):
                        tree_index = idx + 1

                tree = Tree(
                    project_id=project_id,
                    tree_index=tree_index,
                    latitude=lat,
                    longitude=lon,
                    height_m=height,
                    health_status=health,
                    geom=f"SRID=4326;POINT({lon} {lat})",
                )
                tree_records.append(tree)

            db.bulk_save_objects(tree_records)
            logger.info(f"Inserted {len(tree_records)} trees")

        # ── Step 5: Generate Raster Tiles ────────────────────────
        tiles_base = os.path.join(settings.TILES_DIR, project_id)
        os.makedirs(tiles_base, exist_ok=True)

        for raster_type in ["ortho", "dtm", "dsm"]:
            tif_file = _find_tif(upload_dir, raster_type)
            if tif_file:
                logger.info(f"Generating tiles for {raster_type}: {tif_file}")
                output_dir = os.path.join(tiles_base, raster_type)
                os.makedirs(output_dir, exist_ok=True)

                try:
                    # First reproject to Web Mercator if needed
                    reprojected = tif_file.replace(".tif", "_3857.tif")
                    subprocess.run(
                        [
                            "gdalwarp",
                            "-overwrite",
                            "-t_srs", "EPSG:3857",
                            "-r", "bilinear",
                            "-co", "COMPRESS=LZW",
                            "-dstalpha",
                            tif_file,
                            reprojected,
                        ],
                        check=True,
                        capture_output=True,
                        text=True,
                    )

                    # Pre-process for gdal2tiles (standard gdal2tiles requires Byte for PNG tiles)
                    # If it's not ortho (which is usually already 8-bit RGB), scale it
                    tile_input = reprojected
                    if raster_type in ["dtm", "dsm"]:
                        byte_vrt = reprojected.replace(".tif", ".vrt")
                        subprocess.run(
                            [
                                "gdal_translate",
                                "-of", "VRT",
                                "-ot", "Byte",
                                "-scale", # Auto-scale full range to 0-255
                                reprojected,
                                byte_vrt,
                            ],
                            check=True,
                            capture_output=True,
                            text=True,
                        )
                        tile_input = byte_vrt

                    # Generate tiles
                    subprocess.run(
                        [
                            "gdal2tiles.py",
                            "--xyz",
                            "-z", "2-22",
                            "-w", "none",
                            "-r", "bilinear",
                            "--processes=2",
                            tile_input,
                            output_dir,
                        ],
                        check=True,
                        capture_output=True,
                        text=True,
                    )

                    # Cleanup reprojected file
                    if os.path.exists(reprojected):
                        os.remove(reprojected)

                    logger.info(f"Tiles generated for {raster_type}")
                except subprocess.CalledProcessError as e:
                    logger.error(f"Tile generation failed for {raster_type}: {e.stderr}")
                except Exception as e:
                    logger.error(f"Error processing {raster_type}: {e}")

        # ── Done ─────────────────────────────────────────────────
        project.status = ProjectStatus.READY
        project.processing_error = None
        db.commit()
        logger.info(f"Project {project_id} processing complete")

    except Exception as e:
        logger.error(f"Processing failed for {project_id}: {traceback.format_exc()}")
        try:
            project = db.query(Project).filter(Project.id == project_id).first()
            if project:
                project.status = ProjectStatus.ERROR
                project.processing_error = str(e)
                db.commit()
        except Exception:
            pass
    finally:
        db.close()
