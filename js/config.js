// Demo configuration — edit names, positions, timing and video paths here.
// 3D positions are in metres from the map pin at the building's centre: x = east (+) / west (−),
// y = height, z = south (+) / north (−, the lake side). Floors: G = 0 m, L1 = 9 m, L2 = 17.5 m, roof ≈ 26 m.
// The building spans roughly x −132…+109 and z −108…+138; the main curved entrance is the north-east corner.
window.APP_CONFIG = {
  intervalMs: 10000,      // time between events at speed 1x
  firstEventMs: 2500,     // delay before the first event after page load
  maxCards: 20,           // cards kept in the Event Alert list

  // snapshot = still shown as the camera's live view (a calm frame from its clip); analytics = AI models listed for it.
  cameras: [
    // inside the curved glass lobby at the north-east entrance
    { id: 'CAM-01', name: 'Lobby Overview',      location: 'Main Lobby',             floor: 'G',  pos: [86, 7, -78],    look: [-0.6, -0.8, 0.5],
      snapshot: 'snapshots/cam01.jpg', analytics: ['Fall Detection', 'People Counting', 'Loitering'] },
    // on the forecourt pole facing the entrance stairs
    { id: 'CAM-02', name: 'Entrance Gate',       location: 'Main Entrance',          floor: 'G',  pos: [122, 9, -116],  look: [-0.7, -0.5, 0.6],
      snapshot: 'snapshots/cam02.jpg', analytics: ['Weapon Detection', 'Face Match', 'People Counting'] },
    // high in the exhibition halls in the middle of the building
    { id: 'CAM-03', name: 'Exhibition Hall B',   location: 'Exhibition Hall',        floor: 'G',  pos: [-12, 14, 12],   look: [0.3, -1, 0.3],
      snapshot: 'snapshots/cam03.jpg', analytics: ['Fight Detection', 'Crowd Density', 'Abandoned Object'] },
    // L2 west wing, outside the restricted server room
    { id: 'CAM-04', name: 'Server Room Door',    location: 'Restricted · Server Rm', floor: 'L2', pos: [-98, 21, -20],  look: [-0.5, -1, 0.1],
      snapshot: 'snapshots/cam04.jpg', analytics: ['Intrusion', 'Line Crossing', 'Tailgating'] },
    // west loading yard, covering the dock and the kitchen door
    { id: 'CAM-05', name: 'Kitchen & Dock',      location: 'Loading Dock / Kitchen', floor: 'G',  pos: [-108, 7, 96],   look: [-0.6, -0.7, 0.2],
      snapshot: 'snapshots/cam05.jpg', analytics: ['Fire & Smoke', 'PPE Check', 'Vehicle Dwell'] }
  ],

  // The loop plays these in order and starts over after the last one.
  // box = AI bounding box on the video, in % of the frame (x, y, w, h).
  // boxAt = second in the clip when the box appears (the moment the AI "detects" it); omit to show it all the time.
  // boxUntil = second when the box disappears again (e.g. the subject leaves the frame).
  // track = optional keyframes [second, x, y, w, h] so the box follows a moving subject (used instead of box).
  events: [
    {
      key: 'fall', type: 'Fall Detection', target: 'Person', camId: 'CAM-01', severity: 'medium',
      video: 'videos/event1.mp4', confidence: [88, 95], box: [38, 62, 28, 30], boxAt: 3.8,
      desc: 'A person was detected falling near the lobby reception and has remained on the floor for over 10 seconds. Possible injury — medical check recommended.'
    },
    {
      key: 'weapon', type: 'Weapon Detection', target: 'Firearm', camId: 'CAM-02', severity: 'critical',
      video: 'videos/event2.mp4', confidence: [91, 98], box: [41, 31, 16, 60], boxAt: 4.5, boxUntil: 8.3,
      track: [[4.5, 41, 31, 16, 60], [5.5, 42, 32, 14, 58], [6.25, 43, 33, 13, 64], [7, 36, 36, 16, 64], [7.75, 33, 40, 14, 60]],
      desc: 'A handgun-shaped object was identified in the hand of a visitor approaching the main entrance gate. Security lockdown protocol suggested.'
    },
    {
      key: 'fight', type: 'Fight Detection', target: 'Aggression', camId: 'CAM-03', severity: 'high',
      video: 'videos/event3.mp4', confidence: [86, 94], box: [36, 30, 25, 58], boxAt: 1.8,
      desc: 'Aggressive physical contact between two or more people detected in Exhibition Hall B. Crowd is gathering around the area.'
    },
    {
      key: 'intrusion', type: 'Intrusion', target: 'Person', camId: 'CAM-04', severity: 'high',
      video: 'videos/event4.mp4', confidence: [93, 99], box: [18, 26, 17, 72], boxAt: 2.6,
      track: [[2.6, 18, 26, 17, 72], [4, 22, 24, 18, 76], [5, 24, 24, 19, 75], [6, 31, 24, 23, 75], [7, 41, 22, 16, 78],
              [8, 40, 24, 20, 75], [9, 31, 22, 12, 78], [10, 25, 22, 21, 78]],
      desc: 'Unauthorized person entered the restricted server-room zone without a valid access badge. Zone is armed outside of maintenance hours.'
    },
    {
      key: 'fire', type: 'Fire Detection', target: 'Fire / Smoke', camId: 'CAM-05', severity: 'critical',
      video: 'videos/event5.mp4', confidence: [90, 97], box: [42, 42, 12, 29], boxAt: 1,
      track: [[1, 42, 42, 12, 29], [2, 40, 34, 10, 38], [3, 37, 27, 18, 48], [4, 39, 12, 13, 62], [5, 37, 32, 17, 40],
              [6, 37, 32, 15, 40], [7, 33, 30, 21, 42], [8, 24, 32, 38, 40], [9, 24, 36, 37, 39], [10, 24, 36, 38, 40]],
      desc: 'Open flame and rising smoke detected in the kitchen area next to the loading dock. Fire alarm escalation and evacuation of the zone recommended.'
    }
  ]
};
