// 샘플 없이 오실레이터로 피아노에 가까운 소리를 낸다.

let ctx = null;
let master = null;
let current = null;

function audio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function strike(midi, when, dur, level = 0.22) {
  const ac = audio();
  const freq = 440 * 2 ** ((midi - 69) / 12);
  const env = ac.createGain();
  const decay = Math.min(2.4, 0.5 + 180 / freq);
  const end = when + Math.max(dur, 0.08) + 0.12;
  env.gain.setValueAtTime(0.0001, when);
  env.gain.exponentialRampToValueAtTime(level, when + 0.006);
  env.gain.exponentialRampToValueAtTime(Math.max(level * 0.25, 0.001), when + decay * 0.5);
  env.gain.setValueAtTime(Math.max(level * 0.25, 0.001), Math.max(end - 0.11, when + 0.01));
  env.gain.exponentialRampToValueAtTime(0.0001, end);
  env.connect(master);
  const voices = [];
  for (const [ratio, type, amp] of [[1, 'triangle', 1], [2, 'sine', 0.28], [3, 'sine', 0.08]]) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq * ratio;
    g.gain.value = amp;
    osc.connect(g).connect(env);
    osc.start(when);
    osc.stop(end + 0.02);
    voices.push(osc);
  }
  return { voices, env };
}

export function playPitch(midi) {
  strike(midi, audio().currentTime + 0.01, 0.6, 0.3);
}

export function stopPlayback() {
  if (!current) return;
  const { timer, raf, voices, onEnd } = current;
  clearInterval(timer);
  cancelAnimationFrame(raf);
  for (const v of voices) {
    try { v.env.gain.cancelScheduledValues(0); v.env.gain.value = 0.0001; v.voices.forEach((o) => o.stop()); } catch { /* 이미 끝난 음 */ }
  }
  current = null;
  onEnd?.();
}

export const isPlaying = () => !!current;

// from~to 마디를 재생한다. onNote/onOff로 화면 강조, mute로 한 손 끄기.
export function playRange(score, from, to, { speed = 1, mute = {}, onStart, onOff, onMeasure, onEnd } = {}) {
  stopPlayback();
  const events = score.events.filter((e) => e.m >= from && e.m <= to);
  if (!events.length) { onEnd?.(); return; }
  const ac = audio();
  const t0 = events[0].t;
  const begin = ac.currentTime + 0.12;
  const at = (e) => begin + (e.t - t0) / speed;
  const lastEnd = Math.max(...events.map((e) => at(e) + e.dur / speed));
  const state = { voices: [], onEnd, timer: 0, raf: 0 };
  current = state;
  let i = 0;
  const pump = () => {
    const horizon = ac.currentTime + 0.3;
    while (i < events.length && at(events[i]) < horizon) {
      const e = events[i++];
      if (!mute[e.hand]) state.voices.push(strike(e.midi, at(e), e.dur / speed));
    }
    if (state.voices.length > 200) state.voices.splice(0, 100);
  };
  pump();
  state.timer = setInterval(pump, 80);

  let shown = 0;
  const active = [];
  let lastMeasure = -1;
  const tick = () => {
    if (current !== state) return;
    const now = ac.currentTime;
    while (shown < events.length && at(events[shown]) <= now) {
      const e = events[shown++];
      onStart?.(e);
      active.push(e);
      if (e.m !== lastMeasure) { lastMeasure = e.m; onMeasure?.(e.m); }
    }
    for (let k = active.length - 1; k >= 0; k--) {
      if (at(active[k]) + active[k].dur / speed <= now) { onOff?.(active[k]); active.splice(k, 1); }
    }
    if (now > lastEnd + 0.1) {
      for (const e of active) onOff?.(e);
      clearInterval(state.timer);
      current = null;
      onEnd?.();
      return;
    }
    state.raf = requestAnimationFrame(tick);
  };
  state.raf = requestAnimationFrame(tick);
}
