# Product Specification: Plantation & Tree Analytics Dashboard

## 1. Executive Summary
A dual-portal web application designed to host, manage, and visualize high-resolution forestry and plantation data. The platform allows administrators to upload processed aerial imagery and vector data, which is then processed into web-optimized formats. Clients can log in to an interactive map viewer to explore orthomosaics, surface models, and detailed tree-level analytics (height and health) without needing specialized desktop GIS software.

## 2. Global Website Elements (Always Visible)
No matter where a user is in the application, these elements persist to anchor the navigation.

* **Top Navigation Bar:**
    * **Brand/Logo:** Left-aligned. Clicking it returns the user to their respective home dashboard.
    * **Project Selector:** A dropdown menu in the center (for Clients) to quickly switch between different plantation sites without going back to a main menu.
    * **View Toggle:** A prominent pill-shaped toggle switch in the center: **[ Map View | Analytics View ]**.
    * **User Profile:** Right-aligned. Shows the logged-in user's name, role (Admin/Client), and a "Log Out" button.

---

## 3. The Admin Workspace (Engine Room)
This portal is strictly for users with Administrator privileges. Its primary function is data intake and project management.

### 3.1 The Admin Dashboard (Home)
* **Overview Metrics:** Top widgets showing "Total Active Projects," "Processing Jobs," and "System Health."
* **Project List Table:** A clean, sortable table displaying all projects.
    * **Columns:** Project ID, Project Name, Assigned Client, Upload Date, and Status Badge.
    * **Status Badges:** Color-coded indicators: "Uploading" (Blue), "Processing" (Yellow), "Ready" (Green), "Error" (Red).
    * **Actions:** Buttons to Edit, Delete, or View the project.
* **"Create New Project" Button:** A prominent call-to-action button that launches the Setup Wizard.

### 3.2 The Project Setup Wizard (Step-by-Step)
* **Step 1: Details:** Input fields for Project Name, Location, and selecting a Client from a dropdown to assign viewing rights.
* **Step 2: File Upload Zone:** A large drag-and-drop area. The system will strictly validate and only accept the required files: `Plantation Boundary.shp`, `Health Analysis.shp`, `Tree Count_Height.shp`, `Ortho.tif`, `DTM.tif`, and `DSM.tif`.
* **Step 3: Processing Monitor:** Once uploaded, the admin sees a real-time progress bar. The backend automatically converts the heavy `.tif` files into web tiles and merges the `Tree_heigt` and `Health` shapefile data into the PostGIS database.

---

## 4. The Client Portal: Map View (Visual Exploration)
When a client logs in, they are immediately immersed in the Map View of their latest project. This is a full-screen, interactive geographic interface.

### 4.1 The Map Canvas
* **Functionality:** Fills the entire browser window below the top navigation. Users can smoothly pan, zoom, and tilt the perspective.
* **Initialization:** The map automatically centers and zooms to fit the exact boundaries of the `Plantation Boundary` layer.

### 4.2 The Layer Controller (Left Sidebar)
A semi-transparent, floating panel on the left side of the screen. Users can stack and switch data layers here.

* **Base Maps (Radio Buttons - Select One):**
    * **Orthomosaic:** The true-color, high-resolution drone imagery.
    * **DTM (Digital Terrain Model):** Displays the bare earth elevation using a color gradient.
    * **DSM (Digital Surface Model):** Displays the top-surface elevation, including tree canopies.
* **Data Overlays (Checkboxes - Select Multiple):**
    * **Plantation Boundary:** Toggles a thick, high-contrast outline of the property line.
    * **Tree Locations:** Toggles the individual tree points. 
    * **Health Overlay:** Colors the tree points based on the shapefile data: Green for 'Healthy', Yellow for 'Moderate', and Red for 'Poor'.
    * **Height Heatmap:** Adjusts the size or color of the tree points based on their `Tree_heigt` value.

### 4.3 Interactive Tree Inspector
* **Function:** If the "Tree Locations" layer is active, clicking on any specific tree point freezes the map and opens a sleek tooltip popup pointing directly at the tree.
* **Data Displayed:**
    * Tree ID
    * Exact Height (meters)
    * Health Classification
    * Latitude & Longitude

---

## 5. The Client Portal: Analytics View (Data & Insights)
Clicking the toggle in the top navigation flips the screen from the map to a clean, white-background dashboard focused entirely on statistics and charts.

### 5.1 Key Performance Indicators (Top Row)
Four distinct widget cards summarizing the entire plantation:
1.  **Total Trees:** The absolute count extracted from the database.
2.  **Average Canopy Height:** A calculated average of all trees.
3.  **Overall Health Score:** The percentage of trees classified as 'Healthy'.
4.  **Plantation Area:** The total calculated area within the boundary.

### 5.2 Data Visualizations (Middle Row)
* **Tree Health Breakdown (Donut Chart):** Visually displays the proportion of the plantation that is 'Healthy', 'Moderate', or 'Poor'. Hovering over a slice shows the exact number of trees in that category.
* **Tree Height Distribution (Histogram Bar Chart):** Groups the trees into height ranges (e.g., 0-2m, 2-4m, 4-6m+) based on the `Tree_heigt` data, showing the volume of trees in each bracket.

### 5.3 Master Tree Inventory (Bottom Row)
A comprehensive data table displaying every single tree in the project.

| Tree ID | Height (m) | Health Status | Coordinates | Action |
| :--- | :--- | :--- | :--- | :--- |
| 1 | 4.93 | Moderate | 1870288.31, 39.415154 | `[Locate on Map]` |
| 5 | 6.56 | Poor | 1870279.83, 39.733546 | `[Locate on Map]` |

* **Functionality:** The table is searchable (by ID) and filterable (e.g., "Show me only 'Poor' health trees").
* **Cross-Navigation:** Clicking the `[Locate on Map]` button next to any tree immediately flips the user back to the Map View, automatically panning and zooming to center on that specific tree.

---

## 6. The A-to-Z User Flow Summary

1.  **Intake:** Admin logs into the secure portal.
2.  **Creation:** Admin creates a new project and assigns it to a Client.
3.  **Processing:** Admin uploads the required Shapefiles and TIFs. The server processes these asynchronously in the background.
4.  **Delivery:** The Client logs in to their dashboard.
5.  **Exploration:** The Client views the map, toggles the Ortho and DTM layers, and turns on the Health Overlay to visually spot stressed areas in the plantation.
6.  **Inspection:** The Client clicks on a specific cluster of yellow/red trees to inspect their exact heights and health status.
7.  **Analysis:** The Client switches to the Analytics View to see the macro-level health breakdown and reviews the master inventory table.
