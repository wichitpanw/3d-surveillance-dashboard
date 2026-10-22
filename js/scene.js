// 3D venue: a convention centre modelled in metres, traced on Esri z18 satellite imagery (0.58 m/px)
// and shaped from street-level panoramas and an architectural render. Dimensions are estimates.
// Coordinates: metres, origin at the map pin, +x east (Ratchadaphisek Rd side), +z south, y up;
// the lake is to the north.
// Exposes window.Scene3D = { init, setTheme, setView, highlight, focus, returnHome, onCameraClick, isAlerting }.
(function () {
  const cfg = window.APP_CONFIG;

  const LEVELS = [0, 9, 17.5];      // G, L1, L2 floor heights
  const FLOOR_Y = { G: LEVELS[0], L1: LEVELS[1], L2: LEVELS[2] };
  const PODIUM_H = 8;               // recessed glazed ground floor under the overhanging glass box
  const ROOF_Y = 26;                // top of the glass façade / outer roof
  const HALL_ROOF_Y = 31;           // raised roof over the central exhibition halls

  // Roof-edge outline [x, z, corner radius]: square NW corner, a set-back toward the lakeside NE
  // entrance corner, rounded SE / SW corners and the west loading-yard notch.
  const OUTLINE = [[-132, -108, 8], [-10, -108, 22], [25, -101, 22], [109, -101, 24], [109, 138, 28],
    [-106, 138, 28], [-106, 72, 3], [-132, 72, 3]];
  // Ground-floor glazing line, set back 4 m under the overhang.
  const PODIUM = [[-128, -104, 6], [-10, -104, 20], [25, -97, 20], [105, -97, 21], [105, 134, 25],
    [-102, 134, 25], [-102, 68, 2], [-128, 68, 2]];
  const HALL = { x0: -77, x1: 80, z0: -42, z1: 69 };   // central hall block (raised roof on satellite)
  // Paved forecourt around the building, including the west loading yard.
  const SITE = [[-150, -119, 14], [132, -119, 30], [132, 151, 36], [-150, 151, 20]];

  // One palette per UI theme; every themed material is registered and recoloured by setTheme().
  const PALETTES = {
    light: {
      fog: 0xe3e9f0, ground: 0xc9d3c0, lawn: 0x9cbf86, water: 0x86b5d8, plaza: 0xe6e3dc, road: 0x8d939b,
      roadLine: 0xf4f4f0, roof: 0xefebe4, roofHall: 0xf7f5f1, rib: 0xd5cec3, mech: 0xb6bcc3, solar: 0x2d4a78,
      glass: 0xffffff, tint: 0x40566b, column: 0xf3f3f1, soffit: 0xe9e9e6, fascia: 0xfafaf8,
      slab: 0xe7edf5, room: 0xd6e2f2, server: 0xf7cdd3, serverEdge: 0xe0283d, kitchen: 0xf7e6bd, kitchenEdge: 0xd99a00,
      edge: 0x2f6fd6, leaf: 0x5c9a6a, trunk: 0x7d6b58, gold: 0xd9a52f, pole: 0xd2d6dc, tower: 0xc6cfdc,
      gridMajor: 0xb8c4b0, gridMinor: 0xc2ccba,
      marker: 0x1663e0, critical: 0xe0283d, high: 0xea7410, medium: 0xe3a500,
      hemiSky: 0xffffff, hemiGround: 0xb6c3d6, hemi: 1.25, sun: 1.6
    },
    dark: {
      fog: 0x111a2a, ground: 0x18222f, lawn: 0x1c3328, water: 0x122d47, plaza: 0x2a3446, road: 0x121924,
      roadLine: 0x6f7c8f, roof: 0x3a4a60, roofHall: 0x45566e, rib: 0x2f3d52, mech: 0x2a3648, solar: 0x14284a,
      glass: 0x8ea6c4, tint: 0x0c1520, column: 0x7f8ea3, soffit: 0x283445, fascia: 0x6b7c94,
      slab: 0x22344d, room: 0x243652, server: 0x4b1c27, serverEdge: 0xff4d5e, kitchen: 0x3b3a2a, kitchenEdge: 0xffc93d,
      edge: 0x4fc3ff, leaf: 0x24503d, trunk: 0x3b3b3b, gold: 0xc39328, pole: 0x7d8899, tower: 0x1f2c42,
      gridMajor: 0x24324a, gridMinor: 0x1c283b,
      marker: 0x3fd6ff, critical: 0xff4d5e, high: 0xff9a3d, medium: 0xffc93d,
      hemiSky: 0x9cc8ff, hemiGround: 0x0a1220, hemi: 0.8, sun: 0.9
    }
  };

  let THREE, OrbitControls, CSS2DRenderer, CSS2DObject;
  let container, renderer, labelRenderer, scene, camera, controls, tooltip;
  let hemiLight, sunLight;
  let P = PALETTES.light;
  let homePos, homeTarget;
  let tween = null;
  let returnTimer = null;
  let holdFocus = false;
  let lastUserInput = -Infinity;
  let clickCb = () => {};
  let hoveredId = null;
  let view = 'exterior';

  const themed = [];        // [material, paletteKey] pairs recoloured on theme change
  const glassMats = [];     // façade glass, faded in X-ray view
  let exteriorGroup, xrayGroup;
  const markers = {};
  const pickables = [];
  const ripples = [];
  const raycaster = { obj: null };
  const pointer = { downX: 0, downY: 0 };

  function currentTheme() {
    return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  }

  function init(el) {
    if (!window.LIB) {
      el.querySelector('#sceneLoading').textContent = '3D engine could not load — check the internet connection (Three.js CDN).';
      return false;
    }
    ({ THREE, OrbitControls, CSS2DRenderer, CSS2DObject } = window.LIB);
    container = el;
    tooltip = el.querySelector('#tooltip');
    P = PALETTES[currentTheme()];

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(P.fog, 650, 1500);
    exteriorGroup = new THREE.Group();
    xrayGroup = new THREE.Group();
    scene.add(exteriorGroup, xrayGroup);

    camera = new THREE.PerspectiveCamera(38, 1, 2, 4000);
    homeTarget = new THREE.Vector3(-8, 8, 12);
    homePos = new THREE.Vector3(255, 175, -240);   // from the north-east, over the lake, like the render
    camera.position.copy(homePos);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);

    labelRenderer = new CSS2DRenderer();
    Object.assign(labelRenderer.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
    el.appendChild(labelRenderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(homeTarget);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 50;
    controls.maxDistance = 1100;
    controls.maxPolarAngle = Math.PI * 0.47;
    controls.autoRotateSpeed = 0.35;
    controls.addEventListener('start', () => {
      lastUserInput = performance.now();
      tween = null;
      cancelReturn();
    });

    raycaster.obj = new THREE.Raycaster();

    addLights();
    buildSite();
    buildBuilding();
    buildInterior();
    cfg.cameras.forEach(addCamera);
    setTheme(currentTheme());
    setView(view);

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerleave', () => setHover(null));
    renderer.domElement.addEventListener('pointerdown', (e) => { pointer.downX = e.clientX; pointer.downY = e.clientY; });
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    new ResizeObserver(resize).observe(el);
    resize();
    el.querySelector('#sceneLoading').remove();
    requestAnimationFrame(animate);
    return true;
  }

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    labelRenderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function addLights() {
    hemiLight = new THREE.HemisphereLight(0xffffff, 0x000000, 1);
    scene.add(hemiLight);
    sunLight = new THREE.DirectionalLight(0xfff6e8, 1);
    sunLight.position.set(180, 320, 140);
    sunLight.target.position.set(-10, 0, 15);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    Object.assign(sunLight.shadow.camera, { left: -260, right: 260, top: 260, bottom: -260, near: 50, far: 900 });
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight, sunLight.target);
  }

  function setTheme(name) {
    P = PALETTES[name] || PALETTES.light;
    if (!scene) return;
    scene.fog.color.setHex(P.fog);
    hemiLight.color.setHex(P.hemiSky);
    hemiLight.groundColor.setHex(P.hemiGround);
    hemiLight.intensity = P.hemi;
    sunLight.intensity = P.sun;
    themed.forEach(([m, key]) => m.color.setHex(P[key]));
  }

  // Exterior: the building as it looks from outside. X-ray: glass fades, the roof lifts off and the
  // floor plates, halls and service rooms inside are shown so indoor cameras read in context.
  function setView(next) {
    view = next === 'xray' ? 'xray' : 'exterior';
    if (!scene) return view;
    const xray = view === 'xray';
    exteriorGroup.visible = !xray;
    xrayGroup.visible = xray;
    // CSS2D labels only check their own visibility, not their parent group's
    xrayGroup.traverse((o) => { if (o.isCSS2DObject) o.visible = xray; });
    glassMats.forEach(([m, opaque, faded]) => { m.opacity = xray ? faded : opaque; m.depthWrite = !xray && opaque > 0.9; });
    return view;
  }

  // ---------- Geometry helpers ----------
  function mat(key, opts = {}, Kind = THREE.MeshStandardMaterial) {
    const m = new Kind({ color: P[key], ...opts });
    themed.push([m, key]);
    return m;
  }

  function add(obj, parent = scene, { cast = true, receive = true } = {}) {
    obj.castShadow = cast;
    obj.receiveShadow = receive;
    parent.add(obj);
    return obj;
  }

  function box(w, h, d, material, x, y, z, parent) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    return add(m, parent);
  }

  // Rounded polygon from [x, z, r] corners. Shape space is (x, -z) so rotateX(-90°) lands it on the ground.
  function outlineShape(pts) {
    const s = new THREE.Shape();
    const n = pts.length;
    const toward = (x, z, tx, tz, r) => {
      const dx = tx - x, dz = tz - z, L = Math.hypot(dx, dz), k = Math.min(r, L / 2) / L;
      return [x + dx * k, z + dz * k];
    };
    pts.forEach(([x, z, r], i) => {
      const a = toward(x, z, pts[(i + n - 1) % n][0], pts[(i + n - 1) % n][1], r);
      const b = toward(x, z, pts[(i + 1) % n][0], pts[(i + 1) % n][1], r);
      if (i === 0) s.moveTo(a[0], -a[1]); else s.lineTo(a[0], -a[1]);
      s.quadraticCurveTo(x, -z, b[0], -b[1]);
    });
    s.closePath();
    return s;
  }

  function rectShape(x0, z0, x1, z1) {
    return outlineShape([[x0, z0, 0], [x1, z0, 0], [x1, z1, 0], [x0, z1, 0]]);
  }

  function ringOf(shape, divisions) {
    return shape.getSpacedPoints(divisions).map((p) => ({ x: p.x, z: -p.y }));
  }

  // Push a closed ring outward (+d) or inward (-d) along its 2D normals.
  function offsetRing(ring, d) {
    const n = ring.length - 1;
    return ring.map((p, i) => {
      const a = ring[(i - 1 + n) % n], b = ring[(i + 1) % n];
      const tx = b.x - a.x, tz = b.z - a.z, L = Math.hypot(tx, tz) || 1;
      return { x: p.x + (tz / L) * d, z: p.z - (tx / L) * d };
    });
  }

  // Flat shape lying on the ground plane at height y (optionally following a height function).
  function flat(shape, material, y, parent, heightFn, segments = 12) {
    const g = new THREE.ShapeGeometry(shape, segments);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, heightFn ? heightFn({ x: pos.getX(i), z: pos.getZ(i) }) : y);
    g.computeVertexNormals();
    return add(new THREE.Mesh(g, material), parent, { cast: false });
  }

  // Vertical strip along a ring, from y0 to topFn(p); u runs along the wall in uScale metres.
  function wall(ring, y0, topFn, material, parent, uScale = 6, vScale = 6) {
    const pos = [], uv = [], idx = [];
    let len = 0;
    ring.forEach((p, i) => {
      if (i) len += Math.hypot(p.x - ring[i - 1].x, p.z - ring[i - 1].z);
      const top = typeof topFn === 'function' ? topFn(p) : topFn;
      pos.push(p.x, y0, p.z, p.x, top, p.z);
      uv.push(len / uScale, 0, len / uScale, (top - y0) / vScale);
      if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return add(new THREE.Mesh(g, material), parent);
  }

  function label(text, x, y, z, cls = 'floor-label', parent = scene) {
    const div = document.createElement('div');
    div.className = cls;
    div.textContent = text;
    const obj = new CSS2DObject(div);
    obj.position.set(x, y, z);
    parent.add(obj);
    return obj;
  }

  // Curtain-wall texture: sky-reflecting glass panes with dark mullions (4 × 3 panes per tile).
  function glassTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#5d7f9f'); g.addColorStop(0.55, '#9dbbd6'); g.addColorStop(1, '#d2e3f1');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      ctx.fillStyle = `rgba(255,255,255,${0.04 + rnd() * 0.12})`;
      ctx.fillRect(i * 64, j * 85.33, 64, 85.33);
    }
    ctx.fillStyle = '#34414f';
    for (let i = 0; i <= 4; i++) ctx.fillRect(i * 64 - 2, 0, 4, 256);
    for (let j = 0; j <= 3; j++) ctx.fillRect(0, j * 85.33 - 1.5, 256, 3);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }

  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const smooth = (v) => { v = clamp01(v); return v * v * (3 - 2 * v); };
  // Roofline rises toward the lakeside NE entrance corner, as in the architectural render.
  const roofTop = (p) => ROOF_Y + 4 * smooth((p.x + 60) / 160) * smooth((-p.z - 25) / 75);

  // ---------- Site: roads, lake, plazas, planting, skyline ----------
  function buildSite() {
    const ground = add(new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), mat('ground', { roughness: 1 })), scene, { cast: false });
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;

    // light metric grid (10 m / 50 m) like a site plan
    const half = 600, minor = [], major = [];
    for (let v = -half; v <= half; v += 10) {
      const lines = v % 50 === 0 ? major : minor;
      lines.push(-half, 0, v, half, 0, v, v, 0, -half, v, 0, half);
    }
    [[minor, 'gridMinor', 0.35], [major, 'gridMajor', 0.6]].forEach(([pts, key, op]) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      scene.add(new THREE.LineSegments(geo, mat(key, { transparent: true, opacity: op }, THREE.LineBasicMaterial)));
    });

    const lawn = mat('lawn', { roughness: 1 });
    const plaza = mat('plaza', { roughness: 0.9 });
    const road = mat('road', { roughness: 0.95 });
    const water = mat('water', { roughness: 0.15, metalness: 0.2 });

    // Benjakitti park lawns around the lake, and the lake with its round island pavilion
    flat(outlineShape([[-160, -340, 30], [175, -340, 30], [175, -132, 0], [-160, -132, 0]]), lawn, 0.1);
    flat(outlineShape([[-105, -318, 34], [125, -318, 34], [125, -152, 30], [-105, -152, 30]]), water, 0.3);
    const island = add(new THREE.Mesh(new THREE.CylinderGeometry(30, 30, 1.2, 48), plaza), scene, { cast: false });
    island.position.set(-10, 0.6, -232);
    add(new THREE.Mesh(new THREE.CylinderGeometry(17, 17, 4, 48), mat('fascia')), scene).position.set(-10, 3, -232);
    box(4, 0.8, 50, plaza, -10, 0.4, -180);   // causeway to the island

    // paved forecourt hugging the building
    flat(outlineShape(SITE), plaza, 0.2);

    // Ratchadaphisek Rd (east), service roads north / west / south
    box(40, 0.1, 1200, road, 157, 0.05, 0);
    box(2.2, 0.35, 1200, lawn, 157, 0.18, 0);
    const lineMat = mat('roadLine', {}, THREE.MeshBasicMaterial);
    for (let z = -590; z < 600; z += 12) for (const x of [143, 150, 164, 171]) box(0.25, 0.1, 5, lineMat, x, 0.16, z);
    box(330, 0.1, 13, road, -8, 0.06, -125);
    box(14, 0.1, 300, road, -152, 0.06, 15);
    box(320, 0.1, 13, road, -10, 0.06, 158);

    // east forecourt along the road: flag poles, golden flame sculpture, fountains
    const pole = mat('pole', { metalness: 0.5, roughness: 0.4 });
    const flagColors = [0x2f5aa8, 0xd23a3a, 0xf2f2f2, 0x2f8f5b, 0xf0b429];
    for (let i = 0; i < 18; i++) {
      const z = -88 + i * 3.6;
      const p = add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 13, 8), pole), scene);
      p.position.set(126, 6.5, z);
      const f = add(new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.7), new THREE.MeshStandardMaterial({ color: flagColors[i % 5], side: THREE.DoubleSide })), scene, { cast: false });
      f.position.set(126, 11.8, z + 1.35);
      f.rotation.y = Math.PI / 2;
    }
    const flame = new THREE.LatheGeometry([
      [0, 0], [1.6, 0.4], [2.3, 2.2], [2.2, 4.5], [1.5, 6.6], [0.7, 8.4], [0, 9.6]
    ].map(([r, y]) => new THREE.Vector2(r, y)), 28);
    const gold = mat('gold', { metalness: 0.85, roughness: 0.28 });
    box(11, 1, 7, plaza, 124, 0.5, 18);
    box(2.4, 1.6, 2.4, mat('tint'), 124, 1.8, 18);
    add(new THREE.Mesh(flame, gold), scene).position.set(124, 2.6, 18);
    for (const [z0, z1] of [[-30, -6], [38, 62]]) flat(rectShape(118, z0, 123, z1), water, 0.35);

    // grand stairs stepping down to the curved NE entrance
    for (let k = 0; k < 6; k++) {
      const r = 26 + k * 1.8;
      const step = add(new THREE.Mesh(new THREE.RingGeometry(r, r + 1.8, 40, 1, -Math.PI * 0.05, Math.PI * 0.6), plaza), scene, { cast: false });
      step.rotation.x = -Math.PI / 2;
      step.position.set(109 - 24, 0.3 + k * 0.28, -101 + 24);
    }

    // trees: along the roads, the forecourt edges and around the lake (one instanced mesh each)
    const spots = [];
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let z = -330; z < 330; z += 13) { spots.push([137 + rnd() * 2, z + rnd() * 4]); spots.push([179 + rnd() * 2, z + rnd() * 4]); }
    for (let x = -150; x < 120; x += 14) { spots.push([x + rnd() * 4, -138 - rnd() * 6]); spots.push([x + rnd() * 4, 170 + rnd() * 4]); }
    for (let z = -110; z < 150; z += 14) spots.push([-166 - rnd() * 4, z]);
    for (let i = 0; i < 60; i++) {
      const a = rnd() * Math.PI * 2, r = 1 + rnd() * 0.12;
      spots.push([10 + Math.cos(a) * 140 * r, -235 + Math.sin(a) * 100 * r]);
    }
    const crowns = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), mat('leaf', { roughness: 0.9 }), spots.length);
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.5, 1, 6), mat('trunk'), spots.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3();
    spots.forEach(([x, z], i) => {
      const size = 3.5 + rnd() * 3;
      crowns.setMatrixAt(i, m4.compose(v.set(x, 4 + size * 0.6, z), q, s.set(size, size * 0.8, size)));
      trunks.setMatrixAt(i, m4.compose(v.set(x, 2.2, z), q, s.set(1, 4.4, 1)));
    });
    add(crowns, scene);
    add(trunks, scene);

    // distant Bangkok skyline, faded by fog
    const towerMat = mat('tower', { roughness: 0.8 });
    for (let i = 0; i < 40; i++) {
      const a = -Math.PI * 0.95 + rnd() * Math.PI * 1.3, r = 480 + rnd() * 480;
      const w = 22 + rnd() * 30, h = 40 + rnd() * 170;
      box(w, h, w * (0.7 + rnd() * 0.6), towerMat, Math.cos(a) * r, h / 2, Math.sin(a) * r);
    }
  }

  // ---------- The convention centre ----------
  function buildBuilding() {
    const outline = outlineShape(OUTLINE);
    const ring = ringOf(outline, 520);
    const podiumRing = ringOf(outlineShape(PODIUM), 480);

    // recessed ground floor: dark glazing behind white round columns, soffit of the glass box above
    const tintMat = mat('tint', { roughness: 0.25, metalness: 0.3, transparent: true, opacity: 0.95 });
    glassMats.push([tintMat, 0.95, 0.12]);
    wall(podiumRing, 0, PODIUM_H, tintMat, scene);
    const colMat = mat('column', { roughness: 0.6 });
    const colRing = offsetRing(ring, -1.6);
    let acc = 0;
    colRing.forEach((p, i) => {
      if (!i) return;
      acc += Math.hypot(p.x - colRing[i - 1].x, p.z - colRing[i - 1].z);
      if (acc < 10.5) return;
      acc = 0;
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, PODIUM_H, 14), colMat), scene).position.set(p.x, PODIUM_H / 2, p.z);
    });
    const soffit = flat(outline, mat('soffit', { side: THREE.DoubleSide, roughness: 0.8 }), PODIUM_H, exteriorGroup);
    soffit.receiveShadow = true;

    // the glass box: full-height curtain wall from the soffit to the rising roofline
    const glass = mat('glass', { map: glassTexture(), roughness: 0.18, metalness: 0.35, transparent: true, opacity: 0.97, side: THREE.DoubleSide });
    glassMats.push([glass, 0.97, 0.14]);
    const facade = wall(ring, PODIUM_H, roofTop, glass, scene, 6, 6);
    facade.castShadow = true;

    // white roof edge band and the outer roof (slightly dished toward the raised NE corner)
    const fascia = mat('fascia', { roughness: 0.5, side: THREE.DoubleSide });
    wall(offsetRing(ring, 0.5), ROOF_Y - 1.2, (p) => roofTop(p) + 0.4, fascia, exteriorGroup);
    flat(outline, mat('roof', { roughness: 0.85 }), 0, exteriorGroup, roofTop, 24).castShadow = true;

    // raised central hall roof with a light skylight strip along its north edge
    const hallW = HALL.x1 - HALL.x0, hallD = HALL.z1 - HALL.z0, hx = (HALL.x0 + HALL.x1) / 2, hz = (HALL.z0 + HALL.z1) / 2;
    box(hallW, HALL_ROOF_Y - ROOF_Y, hallD, mat('roofHall', { roughness: 0.8 }), hx, (ROOF_Y + HALL_ROOF_Y) / 2, hz, exteriorGroup);
    box(hallW - 10, 0.4, 5, mat('soffit', { roughness: 0.3 }), hx, HALL_ROOF_Y + 0.2, HALL.z0 + 8, exteriorGroup);

    // mechanical gutter around the hall block, scattered plant boxes
    const mech = mat('mech', { roughness: 0.7 });
    let seed = 3;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (const [x0, z0, x1, z1] of [[HALL.x0 - 2, HALL.z0 - 9, HALL.x1 + 2, HALL.z0], [HALL.x0 - 2, HALL.z1, HALL.x1 + 2, HALL.z1 + 9]]) {
      box(x1 - x0, 0.3, z1 - z0, mech, (x0 + x1) / 2, ROOF_Y + 0.15, (z0 + z1) / 2, exteriorGroup);
      for (let x = x0 + 4; x < x1 - 4; x += 9 + rnd() * 6) box(4 + rnd() * 3, 1.6 + rnd(), 4, mech, x, ROOF_Y + 1, (z0 + z1) / 2, exteriorGroup);
    }
    for (const [x0, x1] of [[-60, -40], [15, 35]]) {
      box(x1 - x0, 0.3, 50, mech, (x0 + x1) / 2, ROOF_Y + 0.15, -78, exteriorGroup);
      for (let z = -100; z < -55; z += 8) box(5 + rnd() * 6, 2 + rnd() * 1.5, 4, mech, (x0 + x1) / 2 + (rnd() - 0.5) * 6, ROOF_Y + 1.2, z, exteriorGroup);
    }
    box(24, 0.3, 125, mech, 95, ROOF_Y + 0.15, 14, exteriorGroup);

    // ribbed hall roofs in the north and south bands
    const rib = mat('rib', { roughness: 0.8 });
    for (let x = -112; x < 95; x += 17.5) if (x < -62 || (x > -38 && x < 13) || x > 37) box(0.9, 0.7, 52, rib, x, ROOF_Y + 0.35, -78, exteriorGroup);
    for (let x = -45; x < 95; x += 17.5) box(0.9, 0.7, 56, rib, x, ROOF_Y + 0.35, 108, exteriorGroup);

    // solar arrays on the west band and the south-west block, cooling towers beside them
    const solar = mat('solar', { roughness: 0.35, metalness: 0.4 });
    for (let c = 0; c < 4; c++) for (let r = 0; r < 10; r++) {
      const p = box(10.5, 0.4, 9, solar, -122 + c * 11.5, ROOF_Y + 0.8, -38 + r * 10.2, exteriorGroup);
      p.rotation.x = -0.12;
    }
    for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) {
      const p = box(10, 0.4, 8.5, solar, -100 + c * 11, ROOF_Y + 0.8, 82 + r * 9.5, exteriorGroup);
      p.rotation.x = -0.12;
    }
    for (let c = 0; c < 2; c++) for (let r = 0; r < 4; r++) {
      const t = add(new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 3.5, 18), mech), exteriorGroup);
      t.position.set(-51 + c * 9, ROOF_Y + 1.75, 82 + r * 8);
    }

    // west loading yard: dock canopy and parked trucks
    box(26, 0.6, 62, mat('soffit'), -119, 7.5, 104);
    for (let i = 0; i < 4; i++) box(3, 3.6, 12, mech, -126 + (i % 2) * 7, 1.8, 84 + i * 13);
  }

  // ---------- Inside (X-ray view) ----------
  function buildInterior() {
    const slabMat = mat('slab', { transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false });
    const edgeMat = mat('edge', { transparent: true, opacity: 0.55 }, THREE.LineBasicMaterial);
    const podium = outlineShape(PODIUM);

    // L1 and L2 wrap around the double-height halls in the middle
    for (const y of LEVELS.slice(1)) {
      const s = outlineShape(PODIUM);
      s.holes.push(rectShape(HALL.x0, HALL.z0, HALL.x1, HALL.z1));
      flat(s, slabMat, y, xrayGroup);
      const pts = ringOf(podium, 300).map((p) => new THREE.Vector3(p.x, y, p.z));
      xrayGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), edgeMat));
    }

    // four exhibition halls on G with partition walls
    const roomMat = mat('room', { transparent: true, opacity: 0.55, depthWrite: false });
    const hallW = (HALL.x1 - HALL.x0) / 4;
    for (let i = 0; i < 4; i++) {
      const x = HALL.x0 + hallW * (i + 0.5), z = (HALL.z0 + HALL.z1) / 2;
      flat(rectShape(HALL.x0 + hallW * i + 1, HALL.z0 + 1, HALL.x0 + hallW * (i + 1) - 1, HALL.z1 - 1), roomMat, 0.2, xrayGroup);
      label(`HALL ${i + 1}`, x, 1.5, z, 'floor-label', xrayGroup);
      if (i) box(0.8, 14, HALL.z1 - HALL.z0, roomMat, HALL.x0 + hallW * i, 7, z, xrayGroup);
    }

    // restricted server room on L2 (west) and the kitchen beside the loading yard on G
    const outlined = (mesh, edgeKey) => {
      const line = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), mat(edgeKey, {}, THREE.LineBasicMaterial));
      line.position.copy(mesh.position);
      xrayGroup.add(line);
    };
    outlined(box(20, 4.5, 22, mat('server', { transparent: true, opacity: 0.8 }), -112, LEVELS[2] + 2.25, -20, xrayGroup), 'serverEdge');
    outlined(box(18, 4.5, 20, mat('kitchen', { transparent: true, opacity: 0.8 }), -92, 2.25, 92, xrayGroup), 'kitchenEdge');

    // floor labels on the east (Ratchadaphisek) face, which the default view looks at
    label('G · LOBBY / EXHIBITION HALLS', 116, 3, 70, 'floor-label', xrayGroup);
    label('L1 · PLENARY / BALLROOM', 116, LEVELS[1] + 3, 70, 'floor-label', xrayGroup);
    label('L2 · MEETING ROOMS', 116, LEVELS[2] + 3, 70, 'floor-label', xrayGroup);
    label('RESTRICTED', -118, LEVELS[2] + 14, -28, 'floor-label restricted', xrayGroup);
  }

  // ---------- Camera markers ----------
  // Markers draw on top of everything so indoor cameras stay visible through the roof.
  function overlay(m) { Object.assign(m, { depthTest: false, depthWrite: false, transparent: true }); return m; }

  function addCamera(cam) {
    const group = new THREE.Group();
    group.position.set(...cam.pos);
    group.renderOrder = 10;

    const head = new THREE.Mesh(new THREE.SphereGeometry(1.8, 20, 16), overlay(new THREE.MeshBasicMaterial({ color: P.marker })));
    const glow = new THREE.Mesh(new THREE.SphereGeometry(4, 20, 16), overlay(new THREE.MeshBasicMaterial({ color: P.marker, opacity: 0.18 })));

    // view cone with its apex at the camera, pointing along cam.look
    const coneH = 18;
    const coneGeo = new THREE.ConeGeometry(9, coneH, 28, 1, true);
    coneGeo.translate(0, -coneH / 2, 0);
    const cone = new THREE.Mesh(coneGeo, overlay(new THREE.MeshBasicMaterial({ color: P.marker, opacity: 0.1, side: THREE.DoubleSide })));
    const dir = new THREE.Vector3(...cam.look).normalize();
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate());
    const coneEdges = new THREE.LineSegments(new THREE.EdgesGeometry(coneGeo, 30), overlay(new THREE.LineBasicMaterial({ color: P.marker, opacity: 0.4 })));
    cone.add(coneEdges);

    // vertical drop line to the floor the camera serves (G / L1 / L2 from the config)
    const floorY = (FLOOR_Y[cam.floor] ?? 0) + 0.3;
    const drop = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, floorY - cam.pos[1], 0)]),
      overlay(new THREE.LineDashedMaterial({ color: P.marker, dashSize: 1, gapSize: 0.8, opacity: 0.7 }))
    );
    drop.computeLineDistances();
    [head, glow, cone, coneEdges, drop].forEach((o) => { o.renderOrder = 10; });

    const div = document.createElement('div');
    div.className = 'cam-label';
    div.innerHTML = `<span class="dot"></span>${cam.id}<span class="alert-text"></span>`;
    const lbl = new CSS2DObject(div);
    lbl.position.set(0, 6, 0);

    group.add(head, glow, cone, drop, lbl);
    scene.add(group);

    head.userData.camId = cam.id;
    glow.userData.camId = cam.id;
    pickables.push(head, glow);

    markers[cam.id] = {
      cam, group, head, glow, cone, coneEdges, drop, div,
      floorY,
      alertUntil: 0,
      severity: 'critical',
      alertText: ''
    };
  }

  function spawnRipple(m) {
    for (let i = 0; i < 3; i++) {
      const mesh = new THREE.Mesh(
        new THREE.RingGeometry(3, 4.2, 48),
        overlay(new THREE.MeshBasicMaterial({ color: P[m.severity], opacity: 0.9, side: THREE.DoubleSide }))
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(m.cam.pos[0], m.floorY + 0.2, m.cam.pos[2]);
      mesh.renderOrder = 9;
      mesh.visible = false;
      scene.add(mesh);
      ripples.push({ mesh, start: performance.now() + i * 550, dur: 1800 });
    }
  }

  // ---------- Public API ----------
  function highlight(camId, event, durationMs = 11000) {
    const m = markers[camId];
    if (!m) return;
    m.alertUntil = performance.now() + durationMs;
    m.severity = P[event.severity] !== undefined ? event.severity : 'critical';
    m.alertText = event.type;
    m.div.querySelector('.alert-text').textContent = event.type;
    m.div.classList.remove('sev-critical', 'sev-high', 'sev-medium');
    m.div.classList.add('sev-' + m.severity);
    spawnRipple(m);
  }

  function isAlerting(camId) {
    const m = markers[camId];
    return !!m && performance.now() < m.alertUntil;
  }

  function tweenTo(pos, target, dur, onDone) {
    tween = {
      start: performance.now(), dur,
      fromPos: camera.position.clone(), toPos: pos.clone(),
      fromT: controls.target.clone(), toT: target.clone(),
      onDone
    };
  }

  // Ease toward a camera. autoReturn: go back to the overview after a short hold.
  // When called for a new event it is skipped if a visitor touched the 3D view recently.
  function focus(camId, { autoReturn = false, fromEvent = false } = {}) {
    const m = markers[camId];
    if (!m || !camera) return;
    if (fromEvent && performance.now() - lastUserInput < 10000) return;
    cancelReturn();
    holdFocus = !autoReturn;
    const target = new THREE.Vector3(...m.cam.pos);
    // approach from the current orbit angle so the move feels like a zoom, not a jump
    const offset = camera.position.clone().sub(controls.target).setY(0).normalize().multiplyScalar(105);
    offset.y = 80;
    tweenTo(target.clone().add(offset), target, 1300, () => {
      if (autoReturn) returnTimer = setTimeout(returnHome, 2600);
    });
  }

  function cancelReturn() {
    clearTimeout(returnTimer);
    returnTimer = null;
  }

  function returnHome() {
    if (!camera) return;
    cancelReturn();
    holdFocus = false;
    // back to the overview distance, keeping the current orbit angle so auto-rotate continues smoothly
    const dir = camera.position.clone().sub(controls.target).setY(0).normalize();
    const flatDist = Math.hypot(homePos.x - homeTarget.x, homePos.z - homeTarget.z);
    const pos = homeTarget.clone().add(dir.multiplyScalar(flatDist)).setY(homePos.y);
    tweenTo(pos, homeTarget, 1600);
  }

  function onCameraClick(cb) { clickCb = cb; }

  // ---------- Interaction ----------
  function pick(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.obj.setFromCamera(v, camera);
    const hit = raycaster.obj.intersectObjects(pickables, false)[0];
    return hit ? hit.object.userData.camId : null;
  }

  function onPointerMove(e) {
    const id = pick(e);
    setHover(id);
    if (id) {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left + 16;
      const y = e.clientY - rect.top + 16;
      tooltip.style.left = Math.min(x, rect.width - 220) + 'px';
      tooltip.style.top = Math.min(y, rect.height - 110) + 'px';
    }
  }

  function setHover(id) {
    if (id === hoveredId) return;
    hoveredId = id;
    container.classList.toggle('hover-cam', !!id);
    if (!id) { tooltip.classList.remove('show'); return; }
    const m = markers[id];
    const alert = isAlerting(id);
    tooltip.innerHTML = `
      <b>${m.cam.id}</b> · ${m.cam.name}
      <div class="tt-row">${m.cam.location} · Floor ${m.cam.floor}</div>
      <div class="tt-status ${alert ? 'alert' : ''}">${alert ? '● ALERT · ' + m.alertText : '● ONLINE · AI analytics on'}</div>
      <div class="tt-row">Click to view</div>`;
    tooltip.classList.add('show');
  }

  function onPointerUp(e) {
    if (Math.hypot(e.clientX - pointer.downX, e.clientY - pointer.downY) > 5) return;
    const id = pick(e);
    if (id) clickCb(id);
  }

  // ---------- Render loop ----------
  function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();

    if (tween) {
      const k = Math.min(1, (now - tween.start) / tween.dur);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      camera.position.lerpVectors(tween.fromPos, tween.toPos, e);
      controls.target.lerpVectors(tween.fromT, tween.toT, e);
      if (k >= 1) {
        const done = tween.onDone;
        tween = null;
        if (done) done();
      }
    }
    controls.autoRotate = !tween && !holdFocus && !returnTimer && now - lastUserInput > 8000;
    controls.update();

    for (const id in markers) {
      const m = markers[id];
      const alert = now < m.alertUntil;
      const color = alert ? P[m.severity] : P.marker;
      m.head.material.color.setHex(color);
      m.glow.material.color.setHex(color);
      m.cone.material.color.setHex(color);
      m.coneEdges.material.color.setHex(color);
      m.drop.material.color.setHex(color);
      const s = alert ? 1 + 0.35 * Math.abs(Math.sin(now * 0.006)) : 1 + 0.08 * Math.sin(now * 0.002);
      m.glow.scale.setScalar(s);
      m.head.scale.setScalar(alert ? 1.25 : 1);
      m.glow.material.opacity = alert ? 0.35 : 0.2;
      m.cone.material.opacity = alert ? 0.24 + 0.1 * Math.sin(now * 0.01) : 0.12;
      m.div.classList.toggle('alert', alert);
    }

    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      const k = (now - r.start) / r.dur;
      if (k < 0) continue;
      if (k >= 1) {
        scene.remove(r.mesh);
        r.mesh.geometry.dispose();
        r.mesh.material.dispose();
        ripples.splice(i, 1);
        continue;
      }
      r.mesh.visible = true;
      r.mesh.scale.setScalar(1 + k * 9);
      r.mesh.material.opacity = 0.9 * (1 - k);
    }

    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }

  window.Scene3D = { init, setTheme, setView, highlight, focus, returnHome, onCameraClick, isAlerting };
})();
