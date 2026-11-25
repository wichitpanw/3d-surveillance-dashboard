# Workspace Rules — 3D Modeling Standard

## Mandatory Rule: All 3D Models Must Be Sculpted in Blender
Every 3D object, environment structure, streetscape prop, foliage, vehicle, and pedestrian in this project **MUST** be modeled in **Blender** (via Blender MCP) and exported as `.glb` into `models/`.

- **DO NOT** build 3D buildings, roofs, entrances, roads, Jersey barriers, streetlamps, railings, fountains, flagpoles, lakes/islands, trees, palms, vehicles, or human figures procedurally with Three.js primitives (`BoxGeometry`, `CylinderGeometry`, `SphereGeometry`, etc.) inside `js/scene.js`, `js/traffic.js`, or any other JS file.
- Three.js code is strictly responsible for:
  - Loading exported Blender assets (`models/venue.glb`, `models/actors.glb`) via `GLTFLoader`
  - Scene lighting, tone mapping, fog, camera controls, and Light/Dark theme adjustments
  - Routing `Exterior_*` / `ExteriorGlass_*` / `Interior_*` / `Site_*` nodes for **Exterior / X-Ray** toggle
  - Camera markers (`CAM-01`–`CAM-08`), UI labels (`CSS2DObject`), and animating cloned actor transforms/limbs
- Any fallback procedural geometry in `js/scene.js` must remain strictly an offline `file://` CORS fallback only, never the primary asset source.

## Blender Asset Organization & Naming
- **Master `.blend` file:** `QSNCC.blend` at the repository root.
- **`models/venue.glb`:** Exported from `COL_Exterior`, `COL_Interior`, `COL_Entrances`, and `COL_Site`:
  - `Exterior_*` — building shell, fascias, mullions, columns, roofs, solar arrays, HVAC (hidden in X-Ray)
  - `ExteriorGlass_*` — architectural glass curtain walls & skylights (faded in X-Ray)
  - `Interior_*` — floor slabs, hall partitions, escalators, Server Room, Kitchen (shown in X-Ray)
  - `Site_*` — entrances, canopies, Ratchadaphisek Rd, Jersey barriers, streetlamps, crosswalks, MRT structures, flagpoles, golden flame fountain, Benjakitti park lake/promenade/bike track/island, trees, and royal palms (always visible)
- **`models/actors.glb`:** Exported from `COL_Actors`:
  - Vehicles: `Actor_TaxiPink`, `Actor_TaxiYellow`, `Actor_SUV`, `Actor_Sedan`, `Actor_Bus` (reusable tint materials `M_ActorBody`, `M_BusBody`)
  - Pedestrian: `Actor_Person` root with articulated children `Person_Body`, `Person_LegL`, `Person_LegR`, `Person_ArmL`, `Person_ArmR` (reusable tint materials `M_PersonShirt`, `M_PersonPants`)

## Coordinate, Orientation & QA Standard
- **Units:** `1 Blender unit = 1 metre`, `scale = (1, 1, 1)` applied before export.
- **Coordinate mapping (`export_yup=True`):** Three.js `(tx, ty, tz)` corresponds to Blender `(tx, -tz, ty)`.
- **Actor orientation:** Centered at `(0, 0, 0)` with bottom at `Z = 0` and **front facing Blender `-Y`** (which exports to Three.js `+Z` forward).
- **QA Gate:** Always run `blender-asset-qa` (`qa_check.py`) and visually inspect with `look` before exporting `.glb`.
