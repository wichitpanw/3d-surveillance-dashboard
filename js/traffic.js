// Loads Blender-sculpted vehicles and articulated pedestrians from models/actors.glb
// and animates Thailand left-hand traffic loops & walking strides around QSNCC.
// Exposes window.SiteTraffic = { build(THREE, scene), update(now, dt) }.
(function () {
  const cars = [];
  const serviceCars = [];
  const walkers = [];

  const SERVICE_PTS = [
    [140.0, 260], [140.0, 162], [134.0, 158], [108, 158],
    [-147, 158], [-152, 151], [-152, -118], [-145, -125],
    [131, -125], [140.0, -133], [140.0, -260]
  ];

  const serviceLoop = (() => {
    const segs = [];
    let total = 0;
    for (let i = 0; i < SERVICE_PTS.length - 1; i++) {
      const [x0, z0] = SERVICE_PTS[i];
      const [x1, z1] = SERVICE_PTS[i + 1];
      const len = Math.hypot(x1 - x0, z1 - z0);
      segs.push({ x0, z0, x1, z1, len, start: total });
      total += len;
    }
    return { segs, total };
  })();

  function samplePolyline(dist) {
    const d = ((dist % serviceLoop.total) + serviceLoop.total) % serviceLoop.total;
    for (const s of serviceLoop.segs) {
      if (d <= s.start + s.len) {
        const k = (d - s.start) / (s.len || 1);
        return {
          x: s.x0 + (s.x1 - s.x0) * k,
          z: s.z0 + (s.z1 - s.z0) * k,
          yaw: Math.atan2(s.x1 - s.x0, s.z1 - s.z0)
        };
      }
    }
    return { x: 140, z: 260, yaw: Math.PI };
  }

  function cloneActor(proto, matTints) {
    const obj = proto.clone(true);
    obj.position.set(0, 0, 0);
    obj.rotation.set(0, 0, 0);
    obj.traverse((m) => {
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      const applyTint = (mt) => {
        if (!mt) return mt;
        mt.envMapIntensity = 0.6;
        if (matTints && matTints[mt.name] !== undefined) {
          const c = mt.clone();
          c.color.setHex(matTints[mt.name]);
          return c;
        }
        return mt;
      };
      m.material = Array.isArray(m.material) ? m.material.map(applyTint) : applyTint(m.material);
    });
    return obj;
  }

  function build(THREE, scene) {
    if (!window.LIB?.GLTFLoader) return;
    new window.LIB.GLTFLoader().load(
      'models/actors.glb?v=2',
      (gltf) => {
        const protos = {
          taxi_pink: gltf.scene.getObjectByName('Actor_TaxiPink'),
          taxi_yellow: gltf.scene.getObjectByName('Actor_TaxiYellow'),
          suv: gltf.scene.getObjectByName('Actor_SUV'),
          sedan: gltf.scene.getObjectByName('Actor_Sedan'),
          bus: gltf.scene.getObjectByName('Actor_Bus'),
          person: gltf.scene.getObjectByName('Actor_Person')
        };
        if (!protos.suv || !protos.person) return;

        const root = new THREE.Group();
        root.name = 'SiteTraffic';
        scene.add(root);

        const spawnCar = (kind, hex) => {
          const proto = protos[kind] || protos.sedan;
          const tints = kind === 'bus' ? { M_BusBody: hex } : (kind === 'suv' || kind === 'sedan') ? { M_ActorBody: hex } : null;
          return cloneActor(proto, tints);
        };

        // 1. Ratchadaphisek Rd — Northbound (-z, West carriageway)
        const nbDefs = [
          { x: 139.6, z: 280, v: 9.2,  kind: 'bus',         hex: 0x1e5ca8 },
          { x: 139.6, z: 120, v: 9.2,  kind: 'taxi_pink',   hex: 0xd93878 },
          { x: 139.6, z: -40, v: 9.2,  kind: 'sedan',       hex: 0xd8dde4 },
          { x: 139.6, z: -200, v: 9.2, kind: 'bus',         hex: 0xd96b1c },
          { x: 144.2, z: 220, v: 11.4, kind: 'suv',         hex: 0xf0f2f5 },
          { x: 144.2, z: 60,  v: 11.4, kind: 'taxi_yellow', hex: 0xe2b61c },
          { x: 144.2, z: -100, v: 11.4, kind: 'sedan',      hex: 0x2f3b4c },
          { x: 144.2, z: -260, v: 11.4, kind: 'taxi_pink',  hex: 0xd93878 },
          { x: 149.8, z: 300, v: 14.5, kind: 'sedan',       hex: 0x9aa4b2 },
          { x: 149.8, z: 100, v: 14.5, kind: 'taxi_pink',   hex: 0xd93878 },
          { x: 149.8, z: -120, v: 14.5, kind: 'suv',        hex: 0x202733 },
          { x: 154.2, z: 200, v: 16.5, kind: 'suv',         hex: 0xe8ebf0 },
          { x: 154.2, z: 0,   v: 16.5, kind: 'sedan',       hex: 0x244c80 },
          { x: 154.2, z: -200, v: 16.5, kind: 'taxi_yellow', hex: 0xe2b61c }
        ];
        for (const c of nbDefs) {
          const mesh = spawnCar(c.kind, c.hex);
          mesh.position.set(c.x, 0.12, c.z);
          mesh.rotation.y = Math.PI;
          root.add(mesh);
          cars.push({ mesh, x: c.x, z: c.z, dir: -1, speed: c.v });
        }

        // 2. Ratchadaphisek Rd — Southbound (+z, East carriageway)
        const sbDefs = [
          { x: 160.8, z: -280, v: 16.0, kind: 'suv',         hex: 0x1d2430 },
          { x: 160.8, z: -80,  v: 16.0, kind: 'sedan',       hex: 0xe5e8ed },
          { x: 160.8, z: 120,  v: 16.0, kind: 'taxi_pink',   hex: 0xd93878 },
          { x: 160.8, z: 290,  v: 16.0, kind: 'sedan',       hex: 0x526072 },
          { x: 167.0, z: -220, v: 13.8, kind: 'taxi_yellow', hex: 0xe2b61c },
          { x: 167.0, z: -20,  v: 13.8, kind: 'suv',         hex: 0xf4f5f7 },
          { x: 167.0, z: 180,  v: 13.8, kind: 'sedan',       hex: 0x2f5388 },
          { x: 173.2, z: -300, v: 11.0, kind: 'bus',         hex: 0x1e5ca8 },
          { x: 173.2, z: -130, v: 11.0, kind: 'taxi_pink',   hex: 0xd93878 },
          { x: 173.2, z: 40,   v: 11.0, kind: 'sedan',       hex: 0xb6bec8 },
          { x: 173.2, z: 210,  v: 11.0, kind: 'suv',         hex: 0x3b4452 }
        ];
        for (const c of sbDefs) {
          const mesh = spawnCar(c.kind, c.hex);
          mesh.position.set(c.x, 0.12, c.z);
          mesh.rotation.y = 0;
          root.add(mesh);
          cars.push({ mesh, x: c.x, z: c.z, dir: 1, speed: c.v });
        }

        // 3. Venue service road loop
        const svcDefs = [
          { d: 0.00, kind: 'suv',       hex: 0xf2f4f7 },
          { d: 0.25, kind: 'taxi_pink', hex: 0xd93878 },
          { d: 0.50, kind: 'sedan',     hex: 0x9aa4b2 },
          { d: 0.75, kind: 'sedan',     hex: 0x1e2530 }
        ];
        for (const sc of svcDefs) {
          const mesh = spawnCar(sc.kind, sc.hex);
          root.add(mesh);
          serviceCars.push({ mesh, dist: sc.d * serviceLoop.total, speed: 8.2 });
        }

        // 4. Articulated pedestrians & joggers
        const shirts = [0xf2f2f0, 0x2c5aa0, 0x384454, 0xd44b4b, 0x2c8a66, 0xd9a126, 0x70569c];
        const pants = [0x1c222b, 0x2b3648, 0x45413c, 0x1e2b3c];
        const addWalker = (x0, z0, x1, z1, y, speed, phase0, idx) => {
          const mesh = cloneActor(protos.person, {
            M_PersonShirt: shirts[idx % shirts.length],
            M_PersonPants: pants[idx % pants.length]
          });
          mesh.position.y = y;
          const legL = mesh.getObjectByName('Person_LegL');
          const legR = mesh.getObjectByName('Person_LegR');
          const armL = mesh.getObjectByName('Person_ArmL');
          const armR = mesh.getObjectByName('Person_ArmR');
          root.add(mesh);
          walkers.push({
            mesh, legL, legR, armL, armR,
            x0, z0, x1, z1, y, speed,
            len: Math.hypot(x1 - x0, z1 - z0) || 1,
            progress: phase0 % 1,
            dir: idx % 2 === 0 ? 1 : -1,
            stride: phase0 * 20
          });
        };

        for (let i = 0; i < 10; i++) {
          const laneX = 130.6 + (i % 3) * 1.1;
          addWalker(laneX, -90, laneX, 124, 0.18, 1.35 + (i % 3) * 0.15, i * 0.11, i);
        }
        for (let i = 0; i < 6; i++) {
          const px = 113.5 + (i % 3) * 2.4;
          addWalker(px, -74, px, 90, 0.18, 1.25 + (i % 2) * 0.2, i * 0.17, i + 10);
        }
        for (let i = 0; i < 6; i++) {
          const pz = -147.2 + (i % 2) * 1.5;
          addWalker(-115, pz, 110, pz, 0.22, 1.45, i * 0.16, i + 16);
        }
        for (let i = 0; i < 3; i++) {
          const cx = -11.0 + i * 1.0;
          addWalker(cx, -153, cx, -201, 0.78, 1.3, i * 0.33, i + 22);
        }
        for (let i = 0; i < 3; i++) {
          const jz = -140.4 + (i % 2) * 1.1;
          addWalker(-120, jz, 115, jz, 0.22, 3.1, i * 0.31, i + 25);
        }
      },
      undefined,
      (err) => { console.warn('Could not load models/actors.glb:', err); }
    );
  }

  function update(now, dt) {
    if (!dt) return;
    for (const c of cars) {
      c.z += c.dir * c.speed * dt;
      if (c.dir < 0 && c.z < -340) c.z += 680;
      else if (c.dir > 0 && c.z > 340) c.z -= 680;
      c.mesh.position.z = c.z;
    }
    for (const sc of serviceCars) {
      sc.dist = (sc.dist + sc.speed * dt) % serviceLoop.total;
      const p = samplePolyline(sc.dist);
      sc.mesh.position.set(p.x, 0.12, p.z);
      sc.mesh.rotation.y = p.yaw;
      sc.mesh.visible = p.z > -220 && p.z < 220;
    }
    for (const w of walkers) {
      w.progress += w.dir * (w.speed * dt) / w.len;
      if (w.progress >= 1) { w.progress = 1; w.dir = -1; }
      else if (w.progress <= 0) { w.progress = 0; w.dir = 1; }
      const x = w.x0 + (w.x1 - w.x0) * w.progress;
      const z = w.z0 + (w.z1 - w.z0) * w.progress;
      w.mesh.position.set(x, w.y, z);
      const dx = (w.x1 - w.x0) * w.dir;
      const dz = (w.z1 - w.z0) * w.dir;
      w.mesh.rotation.y = Math.atan2(dx, dz);

      w.stride += w.speed * dt * 4.2;
      const swing = Math.sin(w.stride) * 0.45;
      if (w.legL && w.legR && w.armL && w.armR) {
        w.legL.rotation.x = swing;
        w.legR.rotation.x = -swing;
        w.armL.rotation.x = -swing * 0.75;
        w.armR.rotation.x = swing * 0.75;
      }
    }
  }

  window.SiteTraffic = { build, update };
})();
