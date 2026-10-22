# 3D Surveillance Dashboard

Booth demo of an AI video-surveillance dashboard: a 3D venue with 5 cameras, AI event alerts that loop
(Fall, Weapon, Fight, Intrusion, Fire), event clips with an AI bounding box, and a live view per camera.

The 3D venue is modelled in metres after a real convention centre: the outline was traced on Esri satellite
imagery (0.58 m/px) and the façade, roof and forecourt shaped from street-level panoramas and an
architectural render. Heights and interior layout are estimates, not survey data. Switch between the
**Exterior** view and **X-Ray** (floors, halls and indoor cameras) in the 3D panel.

Plain HTML + CSS + JavaScript with [Three.js](https://threejs.org/) from a CDN — no build step.
The page needs an internet connection to load Three.js and the fonts.

## Run

- **GitHub Pages:** Settings → Pages → Deploy from branch `main` / `(root)`.
- **Locally:** serve the folder with any static server, e.g. `python -m http.server 8000`, then open http://localhost:8000.

## Customize

Everything lives in `js/config.js`:

- `cameras` — name, location, floor (`G` / `L1` / `L2`), 3D position in metres, live-view snapshot and the AI analytics
  listed for each camera. Coordinates: +x east, +z south, y up, origin at the building centre.
- `events` — the looped AI events: clip path, severity, description, and when/where the AI box appears
  (`boxAt`, `boxUntil`, `box` or keyframed `track`).
- `intervalMs` — time between events.

Media: `videos/event1.mp4` … `event5.mp4` (event clips) and `snapshots/cam01.jpg` … `cam05.jpg` (live views).

## Booth keys

| Key | Action |
| --- | --- |
| `P` | Pause / resume the event loop |
| `+` / `-` | Speed up / slow down |
| `N` | Trigger the next event now |
| `T` | Light / dark theme |
| `X` | Exterior / X-Ray view |
| `M` | Mute alert sound |
| `F` | Fullscreen |
| `Esc` | Close popup |
