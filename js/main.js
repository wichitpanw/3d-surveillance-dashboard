// Wires the 3D scene, the event loop, the Event Alert cards and the video modal together.
(function () {
  const cfg = window.APP_CONFIG;
  const $ = (s) => document.querySelector(s);
  const camById = Object.fromEntries(cfg.cameras.map((c) => [c.id, c]));

  const ICONS = {
    fall: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="17" cy="5" r="2"/><path d="m15 9-5 3-4-1M10 12l2 5-4 3M12 17l6 1M3 21h18"/></svg>',
    weapon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M2 7h18l1 3h-8l-1 2h-3l-2 7H4l2-7H2z"/><path d="M12 10v2"/></svg>',
    fight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="6" cy="5" r="2"/><circle cx="18" cy="5" r="2"/><path d="M6 8v6l-2 6M6 14l2 6M18 8v6l2 6M18 14l-2 6M6 10l5 1M18 10l-5 1"/><path d="m11 9 2 4M13 9l-2 4"/></svg>',
    intrusion: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5z"/><path d="M12 8v4M12 16h.01"/></svg>',
    fire: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 2-8 1.5 1 2.5 2.5 3 4 .5-3 1-5 1-8z"/><path d="M12 22a3 3 0 0 1-3-3c0-2 3-4 3-4s3 2 3 4a3 3 0 0 1-3 3z"/></svg>'
  };
  const PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';

  const state = {
    instances: [],              // newest first
    seq: 1000 + Math.floor(Math.random() * 400),
    muted: false,
    current: null               // instance open in the modal
  };

  // ---------- Helpers ----------
  const pad = (n) => String(n).padStart(2, '0');
  const hms = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const rand = ([a, b]) => +(a + Math.random() * (b - a)).toFixed(1);

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('show'), 1600);
  }

  // ---------- Alert sound (Web Audio, no files) ----------
  let audioCtx = null;
  function beep(severity) {
    if (state.muted) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const tones = severity === 'critical' ? [880, 660, 880, 660] : severity === 'high' ? [740, 560] : [620];
      tones.forEach((f, i) => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        const t0 = audioCtx.currentTime + i * 0.16;
        o.type = 'sine';
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
        o.connect(g).connect(audioCtx.destination);
        o.start(t0);
        o.stop(t0 + 0.15);
      });
    } catch (e) { /* audio is optional */ }
  }

  // ---------- Camera strip under the 3D view ----------
  function buildCamStrip() {
    const strip = $('#camStrip');
    cfg.cameras.forEach((c) => {
      const b = document.createElement('button');
      b.className = 'cam-chip';
      b.dataset.cam = c.id;
      b.title = `Open live view · ${c.name}`;
      b.innerHTML = `
        <span class="chip-thumb"><img src="${c.snapshot}" alt="" loading="lazy" /><span class="chip-live">LIVE</span></span>
        <div><div class="chip-id"><span class="chip-dot"></span>${c.id}</div><div class="chip-loc">${c.location}</div></div>`;
      b.addEventListener('click', () => openLive(c.id));
      strip.appendChild(b);
    });
    setInterval(() => {
      strip.querySelectorAll('.cam-chip').forEach((b) => {
        b.classList.toggle('alert', !!window.Scene3D?.isAlerting(b.dataset.cam));
      });
    }, 300);
  }

  // ---------- Cards ----------
  function renderCard(inst) {
    const { def, cam } = inst;
    const el = document.createElement('article');
    el.className = `card sev-${def.severity} is-new`;
    el.dataset.id = inst.id;
    el.innerHTML = `
      <div class="thumb">
        <div class="thumb-fallback">${ICONS[def.key] || ''}</div>
        <video muted preload="metadata" playsinline src="${def.video}#t=1"></video>
        <div class="play">${PLAY}</div>
        <span class="rec">${cam.id}</span>
      </div>
      <div class="card-body">
        <div class="card-row">
          <span class="type-icon">${ICONS[def.key] || ''}</span>
          <h3>${def.type}</h3>
          <span class="badge-new">NEW</span>
        </div>
        <div class="card-meta"><b>${cam.id}</b> · ${cam.location} · ${cam.floor}</div>
        <div class="card-foot">
          <span class="sev-tag">${def.severity.toUpperCase()}</span>
          <span class="conf-tag">AI ${inst.conf}%</span>
          <time>${hms(inst.time)}</time>
        </div>
      </div>`;

    const thumb = el.querySelector('.thumb');
    const v = thumb.querySelector('video');
    v.addEventListener('loadeddata', () => thumb.classList.add('has-video'));
    v.addEventListener('error', () => v.remove());

    el.addEventListener('click', () => openModal(inst));
    inst.el = el;

    const list = $('#eventList');
    $('#emptyState')?.remove();
    list.prepend(el);
    list.scrollTo({ top: 0, behavior: 'smooth' });

    // "NEW" fades into a normal unacknowledged card after a while
    setTimeout(() => {
      el.classList.remove('is-new');
      if (inst.status === 'new') el.querySelector('.badge-new')?.remove();
    }, 7000);
  }

  function refreshCard(inst) {
    const el = inst.el;
    if (!el) return;
    el.classList.toggle('is-ack', inst.status !== 'new');
    el.classList.remove('is-new');
    el.querySelector('.badge-new')?.remove();
    let badge = el.querySelector('.badge-state');
    if (inst.status !== 'new') {
      if (!badge) {
        badge = document.createElement('span');
        el.querySelector('.card-row').appendChild(badge);
      }
      badge.className = `badge-state ${inst.status}`;
      badge.textContent = inst.status === 'dispatched' ? 'DISPATCHED' : 'ACK';
    }
  }

  function trimList() {
    while (state.instances.length > cfg.maxCards) {
      const old = state.instances.pop();
      old.el?.remove();
    }
  }

  // ---------- New event from the loop ----------
  function onEvent(def) {
    const cam = camById[def.camId];
    const inst = {
      id: 'EVT-' + ++state.seq,
      def, cam,
      time: new Date(),
      conf: rand(def.confidence),
      status: 'new',
      log: []
    };
    inst.log.push(['AI detected ' + def.target.toLowerCase(), inst.time]);
    inst.log.push(['Alert sent to control room', new Date(inst.time.getTime() + 400)]);

    state.instances.unshift(inst);
    renderCard(inst);
    trimList();
    beep(def.severity);

    window.Scene3D?.highlight(def.camId, def);
    if (!state.current) window.Scene3D?.focus(def.camId, { autoReturn: true, fromEvent: true });
  }

  // ---------- Camera click (3D marker or chip) ----------
  function onCameraClick(camId) {
    const latest = state.instances.find((i) => i.def.camId === camId);
    if (latest) {
      openModal(latest);
    } else {
      window.Scene3D?.focus(camId, { autoReturn: true });
      toast(`${camId} · no events yet`);
    }
  }

  // ---------- Modal ----------
  const modal = $('#modal');
  const video = $('#mVideo');
  const player = document.querySelector('.player');
  let noiseRaf = null;
  let hudTimer = null;

  function openModal(inst) {
    const { def, cam } = inst;
    state.current = inst;
    document.querySelectorAll('.card.is-selected').forEach((c) => c.classList.remove('is-selected'));
    inst.el?.classList.add('is-selected');

    const box = $('.modal-box');
    box.className = `modal-box sev-${def.severity}`;
    $('#mIcon').innerHTML = ICONS[def.key] || '';
    $('#mTitle').textContent = def.type;
    $('#mSub').textContent = `${cam.id} · ${cam.name} · ${cam.location}`;
    $('#mSev').textContent = def.severity.toUpperCase();
    $('#mCamId').textContent = cam.id;
    $('#mHudLoc').textContent = `${cam.location} · ${cam.floor}`;

    const [x, y, w, h] = boxAtTime(def, 0);
    Object.assign($('#mBox').style, { left: x + '%', top: y + '%', width: w + '%', height: h + '%' });
    // start hidden when the clip has a detection time; skip the fade so the box doesn't flash on open
    const bbox = $('#mBox');
    bbox.style.transition = 'none';
    bbox.classList.toggle('off', (def.boxAt || 0) > 0);
    void bbox.offsetWidth;
    bbox.style.transition = '';
    $('#mBoxLabel').textContent = `${def.target} ${inst.conf}%`;

    $('#dId').textContent = inst.id;
    $('#dCam').textContent = `${cam.id} · ${cam.name}`;
    $('#dLoc').textContent = `${cam.location} (${cam.floor})`;
    $('#dTime').textContent = `${hms(inst.time)} · ${inst.time.toLocaleDateString('en-GB')}`;
    $('#dConf').textContent = inst.conf + '%';
    $('#dConfBar').style.width = '0';
    requestAnimationFrame(() => requestAnimationFrame(() => { $('#dConfBar').style.width = inst.conf + '%'; }));
    $('#dDesc').textContent = def.desc;
    renderDetailsState(inst);

    // video, or an animated "simulated feed" if the file is missing
    player.classList.remove('no-video');
    video.src = def.video;
    video.play().catch(() => {});
    cancelAnimationFrame(boxRaf);
    boxRaf = requestAnimationFrame(updateBox);

    clearInterval(hudTimer);
    const tick = () => { $('#mHudTime').textContent = `${new Date().toLocaleDateString('en-GB')} ${hms(new Date())}`; };
    tick();
    hudTimer = setInterval(tick, 1000);

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    window.Scene3D?.highlight(cam.id, def, 4000);
    window.Scene3D?.focus(cam.id, { autoReturn: false });
  }

  function closeModal() {
    if (!state.current) return;
    state.current = null;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.querySelectorAll('.card.is-selected').forEach((c) => c.classList.remove('is-selected'));
    video.pause();
    video.removeAttribute('src');
    video.load();
    stopNoise();
    cancelAnimationFrame(boxRaf);
    clearInterval(hudTimer);
    window.Scene3D?.returnHome();
  }

  function renderDetailsState(inst) {
    const labels = { new: 'NEW · Awaiting action', ack: 'ACKNOWLEDGED', dispatched: 'SECURITY DISPATCHED' };
    $('#dStatus').innerHTML = `<span class="status-pill ${inst.status}">${labels[inst.status]}</span>`;
    $('#dTimeline').innerHTML = inst.log
      .map(([text, t]) => `<li class="done">${text}<time>${hms(t)}</time></li>`)
      .join('') + (inst.status === 'new' ? '<li>Waiting for operator…</li>' : '');
    $('#bAck').disabled = inst.status !== 'new';
    $('#bDispatch').disabled = inst.status === 'dispatched';
  }

  function setStatus(status, logText) {
    const inst = state.current;
    if (!inst) return;
    inst.status = status;
    inst.log.push([logText, new Date()]);
    renderDetailsState(inst);
    refreshCard(inst);
    toast(`${inst.id} · ${logText}`);
  }

  // The AI box shows up at the moment of detection (boxAt), hides again when the subject leaves (boxUntil)
  // or the clip loops, and follows the subject between the def.track keyframes.
  let boxRaf = null;

  function boxAtTime(def, t) {
    const track = def.track;
    if (!track) return def.box;
    if (t <= track[0][0]) return track[0].slice(1);
    for (let i = 1; i < track.length; i++) {
      const [t1, ...b1] = track[i];
      if (t <= t1) {
        const [t0, ...b0] = track[i - 1];
        const k = (t - t0) / (t1 - t0);
        return b0.map((v, j) => v + (b1[j] - v) * k);
      }
    }
    return track[track.length - 1].slice(1);
  }

  function updateBox() {
    const def = state.current?.def;
    if (!def) return;
    const bbox = $('#mBox');
    if (player.classList.contains('no-video')) {
      bbox.classList.remove('off');
    } else {
      const t = video.currentTime;
      const visible = t >= (def.boxAt || 0) && (!def.boxUntil || t < def.boxUntil);
      bbox.classList.toggle('off', !visible);
      const [x, y, w, h] = boxAtTime(def, t);
      Object.assign(bbox.style, { left: x + '%', top: y + '%', width: w + '%', height: h + '%' });
    }
    boxRaf = requestAnimationFrame(updateBox);
  }

  video.addEventListener('error', () => {
    if (!state.current || !video.getAttribute('src')) return;
    player.classList.add('no-video');
    $('#mBox').classList.remove('off');
    startNoise();
  });

  function startNoise() {
    const canvas = $('#mNoise');
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(canvas.width, canvas.height);
    let frame = 0;
    const draw = () => {
      const d = img.data;
      const band = (frame * 3) % canvas.height;
      for (let y = 0; y < canvas.height; y++) {
        const boost = Math.abs(y - band) < 6 ? 40 : 0;
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4;
          const v = (Math.random() * 70 + 15 + boost) | 0;
          d[i] = v * 0.8; d[i + 1] = v * 0.95; d[i + 2] = v; d[i + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      frame++;
      noiseRaf = requestAnimationFrame(draw);
    };
    stopNoise();
    draw();
  }

  function stopNoise() {
    if (noiseRaf) cancelAnimationFrame(noiseRaf);
    noiseRaf = null;
  }

  $('#mClose').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  $('#bAck').addEventListener('click', () => setStatus('ack', 'Acknowledged by operator'));
  $('#bDispatch').addEventListener('click', () => setStatus('dispatched', 'Security team dispatched'));

  // ---------- Live view (camera chips) ----------
  const liveModal = $('#liveModal');
  let liveCam = null;
  let liveTimer = null;

  function renderLiveState() {
    const cam = camById[liveCam];
    const alerting = window.Scene3D?.isAlerting(cam.id);
    const latest = state.instances.find((i) => i.def.camId === cam.id);
    $('#lStatus').innerHTML = alerting && latest
      ? `<span class="status-pill new">ALERT · ${latest.def.type.toUpperCase()}</span>`
      : '<span class="status-pill ack">ONLINE · RECORDING</span>';
    $('#lHudTime').textContent = `${new Date().toLocaleDateString('en-GB')} ${hms(new Date())}`;

    const recent = state.instances.filter((i) => i.def.camId === cam.id).slice(0, 4);
    const list = $('#lRecent');
    list.innerHTML = recent.length ? '' : '<li class="recent-empty">No events from this camera yet.</li>';
    recent.forEach((inst) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <button class="recent-item sev-${inst.def.severity}">
          <span class="type-icon">${ICONS[inst.def.key] || ''}</span>
          <span class="recent-name">${inst.def.type}</span>
          <span class="recent-state">${inst.status === 'new' ? 'NEW' : inst.status === 'ack' ? 'ACK' : 'DISPATCHED'}</span>
          <time>${hms(inst.time)}</time>
        </button>`;
      li.querySelector('button').addEventListener('click', () => { closeLive(false); openModal(inst); });
      list.appendChild(li);
    });
  }

  function openLive(camId) {
    const cam = camById[camId];
    if (!cam) return;
    liveCam = camId;
    $('#lTitle').textContent = `${cam.id} · ${cam.name}`;
    $('#lSub').textContent = `${cam.location} · Floor ${cam.floor}`;
    $('#lImg').src = cam.snapshot;
    $('#lImg').alt = `Live view from ${cam.id}, ${cam.location}`;
    $('#lCamId').textContent = cam.id;
    $('#lHudLoc').textContent = `${cam.location} · ${cam.floor}`;
    $('#lCam').textContent = `${cam.id} · ${cam.name}`;
    $('#lLoc').textContent = `${cam.location} (${cam.floor})`;
    $('#lAnalytics').innerHTML = (cam.analytics || []).map((a) => `<span class="analytic"><span class="pulse-dot"></span>${a}</span>`).join('');
    renderLiveState();
    clearInterval(liveTimer);
    liveTimer = setInterval(renderLiveState, 1000);

    liveModal.classList.add('open');
    liveModal.setAttribute('aria-hidden', 'false');
    window.Scene3D?.focus(camId, { autoReturn: false });
  }

  // returnHome = false when the event modal opens straight after, so the 3D view stays on that camera
  function closeLive(returnHome = true) {
    if (!liveCam) return;
    liveCam = null;
    clearInterval(liveTimer);
    liveModal.classList.remove('open');
    liveModal.setAttribute('aria-hidden', 'true');
    if (returnHome) window.Scene3D?.returnHome();
  }

  $('#lClose').addEventListener('click', () => closeLive());
  liveModal.addEventListener('click', (e) => { if (e.target === liveModal) closeLive(); });

  // ---------- Booth controls (keyboard only) ----------
  function toggleMute() {
    state.muted = !state.muted;
    toast(state.muted ? 'Sound off' : 'Sound on');
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.()?.catch(() => toast('Fullscreen is not available here'));
  }

  function toggleTheme() {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('sentinel-theme', next); } catch (e) { /* remembering is optional */ }
  }

  // keep the 3D scene in step with the page theme, whoever changes it (our button or the host viewer)
  new MutationObserver(() => {
    window.Scene3D?.setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // Hidden booth-operator keys: P pause, +/- speed, N next event, F fullscreen, M mute, T theme, Esc close
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') { closeModal(); closeLive(); }
    else if (k === 'f') toggleFullscreen();
    else if (k === 'm') toggleMute();
    else if (k === 't') toggleTheme();
    else if (k === 'p') toast(EventEngine.toggle() ? 'Event loop paused' : 'Event loop resumed');
    else if (k === '+' || k === '=') toast(`Speed ${EventEngine.setSpeed(1)}x`);
    else if (k === '-' || k === '_') toast(`Speed ${EventEngine.setSpeed(-1)}x`);
    else if (k === 'n') EventEngine.triggerNext();
  });

  // ---------- Boot ----------
  buildCamStrip();

  if (window.Scene3D.init($('#scene'))) window.Scene3D.onCameraClick(onCameraClick);
  EventEngine.onEvent(onEvent);
  EventEngine.start();
})();
