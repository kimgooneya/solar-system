export const QUALITY_PROFILES = {
  high: {
    id: 'high', label: '고화질', targetFps: 60,
    desktopDpr: 1.5, mobileDpr: 1.2, composerDpr: 1.25,
    asteroidCount: 600, asteroidFps: 30, starLayers: 3,
    prominenceCount: 4, plasma: true,
    film: true, rgbShift: true, bloomScale: 1.0
  },
  balanced: {
    id: 'balanced', label: '균형', targetFps: 45,
    desktopDpr: 1.25, mobileDpr: 1.05, composerDpr: 1.0,
    asteroidCount: 350, asteroidFps: 15, starLayers: 2,
    prominenceCount: 3, plasma: true,
    film: false, rgbShift: false, bloomScale: 0.82
  },
  saver: {
    id: 'saver', label: '절전', targetFps: 30,
    desktopDpr: 1.0, mobileDpr: 0.9, composerDpr: 0.85,
    asteroidCount: 150, asteroidFps: 8, starLayers: 1,
    prominenceCount: 0, plasma: false,
    film: false, rgbShift: false, bloomScale: 0.62
  }
};

const PROFILE_ORDER = ['saver', 'balanced', 'high'];
const STORAGE_KEY = 'solar-system-quality-mode';

function readSavedMode(){
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return ['auto', ...PROFILE_ORDER].includes(value) ? value : 'auto';
  } catch {
    return 'auto';
  }
}

function saveMode(mode){
  try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* optional preference */ }
}

export function createPerformanceManager({ reducedMotion = false, onChange } = {}){
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  const highEligible = cores >= 8 && memory >= 8 && innerWidth >= 900;
  let mode = readSavedMode();
  if (reducedMotion && mode === 'auto') mode = 'saver';
  let profileId = mode === 'auto' ? (reducedMotion ? 'saver' : 'balanced') : mode;
  let profile = QUALITY_PROFILES[profileId];
  let lastRenderAt = 0;
  let emaFps = profile.targetFps;
  let lowDuration = 0;
  let highDuration = 0;
  let cooldown = 0;

  function emit(reason){
    profile = QUALITY_PROFILES[profileId];
    onChange?.(profile, { mode, reason, emaFps });
  }

  function setProfile(nextId, reason){
    if (!QUALITY_PROFILES[nextId] || nextId === profileId) return;
    profileId = nextId;
    lowDuration = 0;
    highDuration = 0;
    cooldown = 5;
    emit(reason);
  }

  function setMode(nextMode){
    if (!['auto', ...PROFILE_ORDER].includes(nextMode)) return;
    mode = nextMode;
    saveMode(mode);
    if (mode === 'auto'){
      const initial = reducedMotion ? 'saver'
        : highEligible ? 'high' : 'balanced';
      if (initial === profileId) emit('mode');
      else setProfile(initial, 'mode');
    } else if (mode === profileId) {
      emit('mode');
    } else {
      setProfile(mode, 'mode');
    }
  }

  function shouldRender(now){
    const interval = 1000 / profile.targetFps;
    if (lastRenderAt && now - lastRenderAt < interval) return false;
    if (!lastRenderAt) lastRenderAt = now;
    else lastRenderAt = now - ((now - lastRenderAt) % interval);
    return true;
  }

  function recordFrame(dt){
    if (!Number.isFinite(dt) || dt <= 0) return;
    const fps = Math.min(120, 1 / dt);
    emaFps += (fps - emaFps) * 0.08;
    if (mode !== 'auto') return;

    if (cooldown > 0){
      cooldown = Math.max(0, cooldown - dt);
      return;
    }
    const target = profile.targetFps;
    lowDuration = emaFps < target * 0.78 ? lowDuration + dt : 0;
    highDuration = emaFps > target * 0.96 ? highDuration + dt : 0;
    const index = PROFILE_ORDER.indexOf(profileId);
    if (lowDuration >= 3 && index > 0){
      setProfile(PROFILE_ORDER[index - 1], 'fps-low');
    } else if (highDuration >= 12 && index < PROFILE_ORDER.length - 1){
      const next = PROFILE_ORDER[index + 1];
      if (next !== 'high' || highEligible) setProfile(next, 'fps-high');
      else highDuration = 0;
    }
  }

  function resetClock(now = performance.now()){
    lastRenderAt = now;
    lowDuration = 0;
    highDuration = 0;
  }

  function getState(){
    return {
      mode,
      profile,
      fps: Math.max(0, Math.round(emaFps))
    };
  }

  emit('initial');
  return { shouldRender, recordFrame, resetClock, setMode, getState };
}
