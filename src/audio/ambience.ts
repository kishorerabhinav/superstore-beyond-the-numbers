/**
 * Synthesised atmosphere (no audio files): a soft store room-tone, a slow warm pad, and a filtered "air" swell on camera moves.
 * Muted by default; starts only after the user turns sound on (browser autoplay rules).
 */
let ctx: AudioContext | null = null, master: GainNode | null = null, pad: OscillatorNode[] = [], noise: AudioBufferSourceNode | null = null;

export function setSound(on: boolean) {
  if (on) start(); else stop();
}
function start() {
  const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext; if (!C) return;
  ctx ??= new C(); if (ctx.state === "suspended") void ctx.resume();
  if (master) return;
  master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination); master.gain.setTargetAtTime(0.06, ctx.currentTime, 1.5);
  // room tone: brown-ish noise through a low-pass
  const buf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate), d = buf.getChannelData(0); let last = 0;
  for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
  noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 420; const ng = ctx.createGain(); ng.gain.value = 0.55;
  noise.connect(lp).connect(ng).connect(master); noise.start();
  // pad: an open fifth chord, gently detuned
  const pf = ctx.createBiquadFilter(); pf.type = "lowpass"; pf.frequency.value = 900; const pg = ctx.createGain(); pg.gain.value = 0.16; pf.connect(pg).connect(master);
  pad = [110, 164.81, 220, 277.18].map((f, i) => { const o = ctx!.createOscillator(); o.type = i % 2 ? "triangle" : "sine"; o.frequency.value = f; o.detune.value = (i - 1.5) * 4; o.connect(pf); o.start(); return o; });
}
function stop() {
  if (!ctx || !master) return; const m = master, p = pad, n = noise;
  m.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
  setTimeout(() => { p.forEach(o => o.stop()); n?.stop(); m.disconnect(); }, 1200);
  master = null; pad = []; noise = null;
}
/** A soft filtered swell, played on department transitions. */
export function whoosh() {
  if (!ctx || !master) return;
  const len = 1.4, buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / d.length);
  const src = ctx.createBufferSource(); src.buffer = buf; const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 0.8;
  bp.frequency.setValueAtTime(300, ctx.currentTime); bp.frequency.exponentialRampToValueAtTime(1600, ctx.currentTime + len * 0.6); bp.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + len);
  const g = ctx.createGain(); g.gain.value = 0.22; src.connect(bp).connect(g).connect(master); src.start();
}
