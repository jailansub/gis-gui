# Implementation Plan: Plantation & Tree Analytics Dashboard

## Phase 1: Environment & Infrastructure Setup (Steps A - D)
*Goal: Establish the local development environment and core dependencies.*

* **Step A: Version Control Initialization.** Create a Git repository. Structure the project into two main directories: `/backend` and `/frontend`.
* **Step B: Database Provisioning.** Spin up a local instance of PostgreSQL with the PostGIS extension. (Using a `docker-compose.yml` file is the fastest way to orchestrate the database, pgAdmin, and Redis simultaneously).
* **Step C: Backend Environment.** Initialize a Python virtual environment in the `/backend` folder. Install core dependencies: `fastapi`, `uvicorn`, `sqlalchemy`, `geoalchemy2`, `psycopg2-binary`, `celery`, `redis`, `geopandas`, and `gdal`.
* **Step D: Frontend Environment.** Initialize a React project (using Vite or Next.js) in the `/frontend` folder. Install core UI and mapping libraries: `maplibre-gl`, `react-map-gl`, `tailwindcss`, `axios`, and a charting library like `recharts`.

---

## Phase 2: Database Design & Core API Scaffolding (Steps E - H)
*Goal: Build the data layer and the RESTful endpoints to serve it.*

* **Step E: ORM Modeling.** Write the SQLAlchemy models (`models.py`). Define tables for `Users`, `Projects`, `MapLayers`, and `Trees` (ensuring the `geom` column is defined as a PostGIS `Geometry(Point, 4326)`).
* **Step F: Database Migration.** Use `Alembic` to generate the initial migration script and apply the schema to your local PostGIS database.
* **Step G: CRUD Endpoints.** Write the FastAPI routes (`routers/projects.py`) to handle creating projects, fetching project lists, and retrieving project details.
* **Step H: Analytics Aggregation Endpoints.** Write the SQL/SQLAlchemy queries for `/api/projects/{id}/analytics` to calculate total trees, average height, and health distribution directly on the database server.

---

## Phase 3: The GIS Processing Pipeline (Steps I - M)
*Goal: Build the asynchronous engine that handles the heavy Shapefile and TIF processing without freezing the web server.*

* **Step I: Celery Setup.** Configure the Celery worker to connect to the Redis message broker.
* **Step J: File Upload Handler.** Create the FastAPI endpoint `/api/projects/{id}/upload` to receive the `.zip` or multiple files and save them securely to a temporary local directory. Trigger the Celery task and return a `202 Accepted` response.
* **Step K: Vector Processing (GeoPandas).** Inside the Celery worker task:
    1. Read `Plantation Boundary.shp`, reproject to EPSG:4326, and update the project boundary.
    2. Read `Tree Count_Height.shp` and `Health Analysis_Part 3.shp`.
    3. Perform a Pandas merge on the `ID` column.
    4. Iterate through the merged DataFrame and insert the tree points, `Tree_heigt`, and `Health` classification into the PostGIS `Trees` table.
* **Step L: Raster Processing (GDAL).** Inside the Celery worker task, write a subprocess script that runs `gdal2tiles.py` on `Ortho.tif`, `DTM.tif`, and `DSM.tif` to generate XYZ tile directories.
* **Step M: Spatial API Endpoints.** Create the FastAPI route `/api/projects/{id}/trees` to query the PostGIS `Trees` table and return the data as a GeoJSON FeatureCollection (or Vector Tiles via `ST_AsMVT` if the tree count is massive).

---

## Phase 4: Frontend Development (Steps N - T)
*Goal: Build the user interface and connect it to the backend data.*

* **Step N: Routing & Layout.** Set up React Router. Create the main layouts: The Admin Dashboard (table view) and the Client Portal (Map/Analytics view).
* **Step O: The Admin Uploader.** Build the Drag-and-Drop file upload component. Connect it to the backend upload endpoint and implement a polling mechanism to check the processing status.
* **Step P: Map Initialization.** Create the `ProjectMap.jsx` component. Initialize MapLibre GL JS, setting the starting center and zoom based on the project's boundary coordinates.
* **Step Q: Raster Layer Integration.** Add MapLibre sources and layers for the generated XYZ tiles (Ortho, DTM, DSM). Implement the UI sidebar toggles to switch between them.
* **Step R: Vector Layer & Styling.** Add a GeoJSON source fetching from the `/trees` API. Apply data-driven styling to color the circles based on the `health_status` property and scale their radius based on the `height_m` property.
* **Step S: Interactivity.** Implement MapLibre click events on the tree layer to display a tooltip with the tree's exact height and health data.
* **Step T: Analytics Dashboard.** Build the Analytics tab. Fetch data from the `/analytics` endpoint and render the total counters, the health Donut chart, and the interactive data table.

---

## Phase 5: Testing & Deployment (Steps U - Z)
*Goal: Ensure system stability and push the application to a live server.*

* **Step U: End-to-End Testing.** Upload a complete dataset through the Admin portal and verify that tiles generate correctly, database records match the shapefiles, and the frontend renders everything accurately.
* **Step V: Dockerization.** Write a `Dockerfile` for the FastAPI backend (including GDAL system dependencies) and a `Dockerfile` for the React frontend.
* **Step W: Cloud Provisioning.** Set up a cloud environment (e.g., AWS EC2, DigitalOcean Droplet) and a managed PostgreSQL/PostGIS database instance.
* **Step X: Storage Configuration.** (Optional but Recommended) Refactor the application to store the generated XYZ map tiles in cloud object storage (like AWS S3) rather than the local server disk to save space and reduce costs.
* **Step Y: CI/CD Pipeline.** Set up GitHub Actions to automatically build and deploy new code when you push to the main branch.
* **Step Z: Production Launch.** Secure the application with HTTPS/SSL, finalize user access controls, and go live.
