// 3D venue: a fictional 3-floor convention hall built from primitives, with 5 camera markers.
// Exposes window.Scene3D = { init, setTheme, highlight, focus, returnHome, onCameraClick, isAlerting }.
(function () {
  const cfg = window.APP_CONFIG;
  const FLOOR_H = 4;
  const W = 32, D = 20;

  // One palette per UI theme; every themed material is registered below and recoloured by setTheme().
  const PALETTES = {
    light: {
      fog: 0xe8edf4, ground: 0xe2e8f0, gridMajor: 0xbccadc, gridMinor: 0xd3dce8,
      plaza: 0xd4dde9, stripe: 0xffffff,
      glass: 0x9cc3f0, glassOpacity: 0.16, slab: 0xf4f7fb, roof: 0xc6d4e8,
      edge: 0x2f6fd6, edgeStrong: 0x1f5cc4,
      solid: 0xa9b9cf, booth: 0x78a3e6, room: 0xd8e4f4,
      kitchen: 0xf7e8c2, kitchenEdge: 0xd99a00, server: 0xf9d3d8, serverEdge: 0xe0283d, rack: 0x56657d,
      leaf: 0x6bb38f, trunk: 0x8d7c69,
      marker: 0x1663e0,
      critical: 0xe0283d, high: 0xea7410, medium: 0xe3a500,
      hemiSky: 0xffffff, hemiGround: 0xb6c3d6, hemi: 1.35, sun: 1.0
    },
    dark: {
      fog: 0x111a2a, ground: 0x131d2e, gridMajor: 0x2c4061, gridMinor: 0x1c2b43,
      plaza: 0x1a273c, stripe: 0x3d5679,
      glass: 0x5fb4ff, glassOpacity: 0.09, slab: 0x1e2c44, roof: 0x273953,
      edge: 0x4fc3ff, edgeStrong: 0x7fd3ff,
      solid: 0x2c415f, booth: 0x2f6199, room: 0x243652,
      kitchen: 0x3b3a2a, kitchenEdge: 0xffc93d, server: 0x4b1c27, serverEdge: 0xff4d5e, rack: 0x0e1621,
      leaf: 0x2b7a5f, trunk: 0x3b3b3b,
      marker: 0x3fd6ff,
      critical: 0xff4d5e, high: 0xff9a3d, medium: 0xffc93d,
      hemiSky: 0x9cc8ff, hemiGround: 0x0a1220, hemi: 0.95, sun: 1.1
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

  const themed = [];      // [material, paletteKey] pairs recoloured on theme change
  const markers = {};     // camId -> marker state
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
    scene.fog = new THREE.Fog(P.fog, 80, 170);

    camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
    homePos = new THREE.Vector3(44, 34, 50);
    homeTarget = new THREE.Vector3(0, 4, 0);
    camera.position.copy(homePos);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);

    labelRenderer = new CSS2DRenderer();
    Object.assign(labelRenderer.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
    el.appendChild(labelRenderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(homeTarget);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 12;
    controls.maxDistance = 120;
    controls.maxPolarAngle = Math.PI * 0.47;
    controls.autoRotateSpeed = 0.6;
    controls.addEventListener('start', () => {
      lastUserInput = performance.now();
      tween = null;
      cancelReturn();
    });

    raycaster.obj = new THREE.Raycaster();

    addLights();
    buildVenue();
    cfg.cameras.forEach(addCamera);
    setTheme(currentTheme());

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
    sunLight = new THREE.DirectionalLight(0xffffff, 1);
    sunLight.position.set(30, 50, 25);
    scene.add(sunLight);
    const rim = new THREE.DirectionalLight(0x8ab8ff, 0.4);
    rim.position.set(-40, 20, -30);
    scene.add(rim);
  }

  function setTheme(name) {
    P = PALETTES[name] || PALETTES.light;
    if (!scene) return;
    scene.fog.color.setHex(P.fog);
    hemiLight.color.setHex(P.hemiSky);
    hemiLight.groundColor.setHex(P.hemiGround);
    hemiLight.intensity = P.hemi;
    sunLight.intensity = P.sun;
    themed.forEach(([mat, key]) => mat.color.setHex(P[key]));
    themed.filter(([, key]) => key === 'glass').forEach(([mat]) => { mat.opacity = P.glassOpacity; });
  }

  // ---------- Venue geometry ----------
  function mat(key, opts = {}, Kind = THREE.MeshStandardMaterial) {
    const m = new Kind({ color: P[key], ...opts });
    themed.push([m, key]);
    return m;
  }

  function box(w, h, d, material, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    scene.add(m);
    return m;
  }

  function edges(mesh, key, opacity) {
    const line = new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry),
      mat(key, { transparent: true, opacity }, THREE.LineBasicMaterial)
    );
    line.position.copy(mesh.position);
    line.rotation.copy(mesh.rotation);
    scene.add(line);
    return line;
  }

  function label(text, x, y, z, cls = 'floor-label') {
    const div = document.createElement('div');
    div.className = cls;
    div.textContent = text;
    const obj = new CSS2DObject(div);
    obj.position.set(x, y, z);
    scene.add(obj);
    return obj;
  }

  function buildVenue() {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), mat('ground', { roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    scene.add(ground);
    // floor grid: minor lines every 2 units, major every 10 (built by hand so both colours can be themed)
    const half = 80, minor = [], major = [];
    for (let v = -half; v <= half; v += 2) {
      const lines = v % 10 === 0 ? major : minor;
      lines.push(-half, 0, v, half, 0, v, v, 0, -half, v, 0, half);
    }
    [[minor, 'gridMinor'], [major, 'gridMajor']].forEach(([pts, key]) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      scene.add(new THREE.LineSegments(geo, mat(key, { transparent: true, opacity: 0.8 }, THREE.LineBasicMaterial)));
    });

    const glass = mat('glass', { transparent: true, opacity: P.glassOpacity, depthWrite: false, side: THREE.DoubleSide, roughness: 0.1, metalness: 0.2 });
    const slabMat = mat('slab', { transparent: true, opacity: 0.95, roughness: 0.85 });
    const solidMat = mat('solid', { roughness: 0.7 });
    const plazaMat = mat('plaza', { roughness: 1 });
    const roofMat = mat('roof', { transparent: true, opacity: 0.6, depthWrite: false, roughness: 0.6 });

    // plaza, driveway and parking
    box(44, 0.1, 16, plazaMat, 0, 0.05, 20);
    const stripeMat = mat('stripe', {}, THREE.MeshBasicMaterial);
    for (let i = 0; i < 9; i++) box(0.15, 0.12, 4, stripeMat, -28 + i * 3, 0.06, 24);
    box(10, 0.1, 28, plazaMat, -26, 0.05, 6);

    // floors: slab + glass shell per level
    for (let f = 0; f < 3; f++) {
      const y = f * FLOOR_H;
      const slab = box(W, 0.35, D, slabMat, 0, y + 0.17, 0);
      edges(slab, 'edge', 0.45);
      const shell = box(W, FLOOR_H - 0.35, D, glass, 0, y + FLOOR_H / 2 + 0.17, 0);
      edges(shell, 'edge', 0.6);
    }

    // floating roof canopy
    const roof = box(W + 4, 0.5, D + 4, roofMat, 0, 3 * FLOOR_H + 0.6, 0);
    edges(roof, 'edgeStrong', 0.75);

    // glass atrium at the front entrance (half cylinder)
    const atrium = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 2 * FLOOR_H, 32, 1, true, -Math.PI / 2, Math.PI), glass);
    atrium.position.set(0, FLOOR_H, D / 2);
    scene.add(atrium);
    edges(atrium, 'edge', 0.3);
    const atriumTop = new THREE.Mesh(new THREE.CircleGeometry(4, 32, 0, Math.PI), roofMat);
    atriumTop.rotation.x = -Math.PI / 2;
    atriumTop.position.set(0, 2 * FLOOR_H, D / 2);
    scene.add(atriumTop);

    // L1: reception desk, lobby columns, kitchen and dock
    box(6, 1.1, 1.4, solidMat, -7, 0.9, 1);
    for (let i = 0; i < 4; i++) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, FLOOR_H, 12), solidMat);
      c.position.set(-12 + i * 4, FLOOR_H / 2, 6);
      scene.add(c);
    }
    const kitchen = box(9, 2.4, 7, mat('kitchen', { transparent: true, opacity: 0.7 }), 11, 1.5, -6);
    edges(kitchen, 'kitchenEdge', 0.8);
    // delivery trucks outside the dock
    box(3, 2.6, 7, solidMat, 9, 1.3, -15);
    box(3, 2.6, 7, solidMat, 13.5, 1.3, -15);

    // L2: exhibition booths grid
    const boothMat = mat('booth', { roughness: 0.6 });
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 5; c++) {
        const b = box(2.6, 1.1, 2.6, boothMat, -10 + c * 5, FLOOR_H + 0.9, -5 + r * 5);
        edges(b, 'edgeStrong', 0.45);
      }
    }

    // L3: conference rooms + restricted server room
    const roomMat = mat('room', { transparent: true, opacity: 0.7 });
    for (let i = 0; i < 3; i++) {
      const r = box(7, 2.8, 6, roomMat, 2 + i * 7.5, 2 * FLOOR_H + 1.6, -5);
      edges(r, 'edge', 0.5);
    }
    const serverRoom = box(8, 2.8, 8, mat('server', { transparent: true, opacity: 0.7 }), -11, 2 * FLOOR_H + 1.6, -5);
    edges(serverRoom, 'serverEdge', 0.9);
    const rackMat = mat('rack', { roughness: 0.5 });
    for (let i = 0; i < 3; i++) box(0.8, 2.2, 5, rackMat, -13.5 + i * 2.4, 2 * FLOOR_H + 1.3, -5);

    // trees around the plaza
    const leaf = mat('leaf', { roughness: 0.8 });
    const trunk = mat('trunk');
    [[-18, 15], [-12, 26], [12, 26], [18, 15], [22, 6], [-22, -6], [24, -4], [-6, 27], [6, 27]].forEach(([x, z]) => {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.2, 6), trunk);
      t.position.set(x, 0.6, z);
      const c = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.6, 8), leaf);
      c.position.set(x, 2.3, z);
      scene.add(t, c);
    });

    // floor labels on the left edge
    label('L1 · LOBBY / KITCHEN', -W / 2 - 1, 1.2, D / 2);
    label('L2 · EXHIBITION HALL', -W / 2 - 1, FLOOR_H + 1.2, D / 2);
    label('L3 · CONFERENCE', -W / 2 - 1, 2 * FLOOR_H + 1.2, D / 2);
    label('RESTRICTED', -11, 2 * FLOOR_H + 3.6, -5, 'floor-label restricted');
  }

  // ---------- Camera markers ----------
  function addCamera(cam) {
    const group = new THREE.Group();
    group.position.set(...cam.pos);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 16), new THREE.MeshBasicMaterial({ color: P.marker }));
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 20, 16),
      new THREE.MeshBasicMaterial({ color: P.marker, transparent: true, opacity: 0.18, depthWrite: false })
    );

    // view cone with its apex at the camera, pointing along cam.look
    const coneH = 5;
    const coneGeo = new THREE.ConeGeometry(2.6, coneH, 28, 1, true);
    coneGeo.translate(0, -coneH / 2, 0);
    const cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: P.marker, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide }));
    const dir = new THREE.Vector3(...cam.look).normalize();
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate());
    const coneEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(coneGeo, 30),
      new THREE.LineBasicMaterial({ color: P.marker, transparent: true, opacity: 0.4 })
    );
    cone.add(coneEdges);

    // vertical drop line to the floor so the camera reads clearly in 3D
    const floorY = Math.floor(cam.pos[1] / FLOOR_H) * FLOOR_H + 0.4;
    const drop = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, floorY - cam.pos[1], 0)]),
      new THREE.LineDashedMaterial({ color: P.marker, dashSize: 0.25, gapSize: 0.2, transparent: true, opacity: 0.6 })
    );
    drop.computeLineDistances();

    const div = document.createElement('div');
    div.className = 'cam-label';
    div.innerHTML = `<span class="dot"></span>${cam.id}<span class="alert-text"></span>`;
    const lbl = new CSS2DObject(div);
    lbl.position.set(0, 1.4, 0);

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
        new THREE.RingGeometry(0.6, 0.85, 48),
        new THREE.MeshBasicMaterial({ color: P[m.severity], transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(m.cam.pos[0], m.floorY + 0.05, m.cam.pos[2]);
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
    const offset = camera.position.clone().sub(controls.target).setY(0).normalize().multiplyScalar(24);
    offset.y = 18;
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
    // return to the overview distance but keep the current orbit angle so auto-rotate continues smoothly
    const dir = camera.position.clone().sub(controls.target).setY(0).normalize();
    const flat = Math.hypot(homePos.x - homeTarget.x, homePos.z - homeTarget.z);
    const pos = homeTarget.clone().add(dir.multiplyScalar(flat)).setY(homePos.y);
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

  window.Scene3D = { init, setTheme, highlight, focus, returnHome, onCameraClick, isAlerting };
})();
