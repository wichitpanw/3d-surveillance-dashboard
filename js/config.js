// Demo configuration — edit names, positions, timing and video paths here.
// 3D positions are in metres from the map pin at the building's centre: x = east (+) / west (−),
// y = height, z = south (+) / north (−, the lake side). Floors: G = 0 m, L1 = 9 m, L2 = 17.5 m, roof ≈ 26 m.
// The building spans roughly x −132…+109 and z −108…+138; the main curved entrance is the north-east corner.
window.APP_CONFIG = {
  intervalMs: 10000,      // time between events at speed 1x
  firstEventMs: 2500,     // delay before the first event after page load
  maxCards: 20,           // cards kept in the Event Alert list

  // model = 3D marker: 'dome' (ceiling mount; pos = just under the ceiling, plate top at pos.y + 1.2 m) or 'bullet'.
  // mount (bullet only) = [nx, nz] outward normal of the wall it is fixed to (wall face 3.55 m behind pos),
  //   or 'ceiling' to hang it from a ceiling / soffit 2.75 m above pos. The body turns on its joint toward look.
  cameras: [
    // ceiling dome in the curved glass lobby at the north-east entrance (ceiling ≈ 8.6 m, under the L1 slab)
    { id: 'CAM-01', name: 'Lobby Overview',      location: 'Main Lobby',               floor: 'G',  pos: [86, 7.4, -78],    look: [-0.6, -0.8, 0.5],     model: 'dome' },
    // bullet on the lobby glazing just north of the entrance canopy, under the overhang, looking down the stair terrace
    { id: 'CAM-02', name: 'Entrance Gate',       location: 'Main Entrance',            floor: 'G',  pos: [107.3, 5, -87.1], look: [0.51, -0.29, -0.81],  model: 'bullet', mount: [0.91, -0.41] },
    // bullet high on the partition wall between Halls B and C (x ≈ 1.5), looking west across Hall B
    { id: 'CAM-03', name: 'Exhibition Hall B',   location: 'Exhibition Hall',          floor: 'G',  pos: [-2.45, 10, 13],   look: [-0.84, -0.54, 0],     model: 'bullet', mount: [-1, 0] },
    // ceiling dome in the L2 west corridor, outside the restricted server-room door (ceiling ≈ 22.5 m)
    { id: 'CAM-04', name: 'Server Room Door',    location: 'Restricted · Server Rm',   floor: 'L2', pos: [-98, 21.3, -20],  look: [-0.5, -1, 0.1],       model: 'dome' },
    // bullet on the west podium wall (x = −102) under the overhang, covering the loading dock beside the kitchen
    { id: 'CAM-05', name: 'Kitchen & Dock',      location: 'Loading Dock / Kitchen',   floor: 'G',  pos: [-105.55, 5, 96],  look: [-0.6, -0.7, 0.2],     model: 'bullet', mount: [-1, 0] },
    // bullet hung from the overhang soffit (8 m) on the east colonnade, looking south along the walkway by the no-smoking sign
    { id: 'CAM-06', name: 'Entrance Walkway',    location: 'East Walkway',             floor: 'G',  pos: [107, 5.25, -48],  look: [-0.2, -0.7, 0.6],     model: 'bullet', mount: 'ceiling' },
    // bullet mounted on the north face of the south-gate parking sign tower (z = 166.9), covering the South Gate / Ratchada junction
    { id: 'CAM-07', name: 'South Gate Junction', location: 'South Gate / Ratchada Rd', floor: 'G',  pos: [112, 4.1, 163.35], look: [0.75, -0.35, -0.55], model: 'bullet', mount: [0, -1] },
    // bullet hung from the east overhang soffit (8 m) near the SE corner, overlooking the SE drop-off red-white no-parking kerb
    { id: 'CAM-08', name: 'SE Drop-off Curb',    location: 'No-Parking Zone · SE',     floor: 'G',  pos: [107, 5.25, 106],  look: [0.5, -0.5, 0.7],      model: 'bullet', mount: 'ceiling' }
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
      video: 'videos/event2.mp4?v=2', confidence: [91, 98], box: [33.5, 37, 13.5, 53], boxAt: 3.1,
      track: [[3.1, 33.5, 37, 13.5, 53], [3.5, 33, 37.5, 13.5, 53.5], [4.0, 32.5, 39.5, 13, 53.5],
              [4.5, 30.5, 40.5, 14, 56], [5.0, 28, 41.5, 14.5, 58], [5.5, 24, 43.5, 15.5, 56.5],
              [6.0, 23, 45, 14.5, 55], [6.5, 21, 47, 14, 53], [7.0, 15.5, 48.5, 17.5, 51.5],
              [7.5, 12.5, 51, 17.5, 49], [8.0, 10, 52.5, 16, 47.5], [8.5, 7, 54.5, 15, 45.5],
              [9.0, 0.5, 56.5, 20, 43.5], [9.5, 0.5, 59, 17, 41], [9.9, 0, 68, 15, 32]],
      desc: 'A person in the entrance lobby drew a handgun from their waistband and visitors are fleeing the area. Security lockdown and police notification recommended.'
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
    },
    {
      key: 'smoking', type: 'Smoking Detection', target: 'Cigarette', camId: 'CAM-06', severity: 'medium',
      video: 'videos/event6.mp4', confidence: [87, 96], box: [53, 24, 19, 76], boxAt: 4.3,
      desc: 'A person was detected lighting and smoking a cigarette in a no-smoking area beside the building entrance. Staff reminder recommended.'
    },
    {
      key: 'collision', type: 'Vehicle Collision', target: 'Vehicle Crash', camId: 'CAM-07', severity: 'critical',
      video: 'videos/event7.mp4', confidence: [91, 97], box: [19, 40, 50, 27], boxAt: 3.4,
      track: [[3.4, 17, 40, 50, 25], [4.0, 19, 40, 50, 27]],
      desc: 'A vehicle collision was detected at the South Gate junction off Ratchadaphisek Road. Traffic lanes are partially blocked — emergency response and security dispatch recommended.'
    },
    {
      key: 'parking', type: 'Illegal Parking', target: 'Parked Vehicle', camId: 'CAM-08', severity: 'medium',
      video: 'videos/event8.mp4', confidence: [89, 96], box: [36, 42, 19, 27], boxAt: 4.5,
      desc: 'A vehicle has stopped and remained parked inside the red-white no-parking zone at the SE drop-off lane. Security warning or traffic marshal dispatch recommended.'
    }
  ]
};
