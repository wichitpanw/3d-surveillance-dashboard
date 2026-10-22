# 3D Surveillance Dashboard

Booth demo of an AI video-surveillance dashboard: a 3D venue with 5 cameras, AI event alerts that loop
(Fall, Weapon, Fight, Intrusion, Fire), event clips with an AI bounding box, and a live view per camera.

Plain HTML + CSS + JavaScript with [Three.js](https://threejs.org/) from a CDN — no build step.
The page needs an internet connection to load Three.js and the fonts.

## Run

- **GitHub Pages:** Settings → Pages → Deploy from branch `main` / `(root)`.
- **Locally:** serve the folder with any static server, e.g. `python -m http.server 8000`, then open http://localhost:8000.

## Customize

Everything lives in `js/config.js`:

- `cameras` — name, location, 3D position, live-view snapshot and the AI analytics listed for each camera.
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
| `M` | Mute alert sound |
| `F` | Fullscreen |
| `Esc` | Close popup |
