// Event loop engine: plays APP_CONFIG.events in order and starts over, forever.
// Exposes window.EventEngine = { start, onEvent, toggle, isPaused, setSpeed, getSpeed, triggerNext }.
(function () {
  const cfg = window.APP_CONFIG;
  const SPEEDS = [0.5, 1, 2, 4];

  let index = 0;
  let timer = null;
  let paused = false;
  let speedIdx = 1;
  const listeners = [];

  function schedule(ms) {
    clearTimeout(timer);
    if (paused) return;
    // a little jitter so it does not feel mechanical
    const jitter = 0.8 + Math.random() * 0.4;
    timer = setTimeout(fire, (ms ?? cfg.intervalMs * jitter) / SPEEDS[speedIdx]);
  }

  function fire() {
    const def = cfg.events[index];
    index = (index + 1) % cfg.events.length;
    listeners.forEach((fn) => fn(def));
    schedule();
  }

  window.EventEngine = {
    start() { schedule(cfg.firstEventMs); },
    onEvent(fn) { listeners.push(fn); },
    toggle() {
      paused = !paused;
      if (paused) clearTimeout(timer);
      else schedule();
      return paused;
    },
    isPaused: () => paused,
    setSpeed(step) {
      speedIdx = Math.max(0, Math.min(SPEEDS.length - 1, speedIdx + step));
      schedule();
      return SPEEDS[speedIdx];
    },
    getSpeed: () => SPEEDS[speedIdx],
    triggerNext() { clearTimeout(timer); fire(); }
  };
})();
