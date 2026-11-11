// Tiny procedural audio engine — no external assets, all synthesized.
export class AudioEngine {
  constructor() {
    this.ctx = null
    this.muted = false
    this.started = false
    this.lastFoot = 0
  }
  init() {
    if (this.started) return
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    this.ctx = new AC()
    this.started = true
    this.master = this.ctx.createGain(); this.master.gain.value = .55
    this.comp = this.ctx.createDynamicsCompressor()
    this.comp.threshold.value = -20; this.comp.knee.value = 24; this.comp.ratio.value = 8
    this.master.connect(this.comp); this.comp.connect(this.ctx.destination)
    this.noise = this.makeNoise(2)
    this.startAmbient()
  }
  resume() { if (this.ctx?.state === 'suspended') this.ctx.resume() }
  setMuted(v) { this.muted = v; if (this.master) this.master.gain.setTargetAtTime(v ? 0 : .55, this.ctx.currentTime, .1) }
  makeNoise(seconds) {
    const len = this.ctx.sampleRate * seconds
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    return buf
  }
  startAmbient() {
    const ctx = this.ctx
    const g = ctx.createGain(); g.gain.value = .16; g.connect(this.master)
    this.ambientGain = g
    const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 43.65
    const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = 65.4
    const o3 = ctx.createOscillator(); o3.type = 'sine'; o3.frequency.value = 87.3
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = .06
    const lfoG = ctx.createGain(); lfoG.gain.value = 1.6
    lfo.connect(lfoG); lfoG.connect(o2.frequency)
    const og = ctx.createGain(); og.gain.value = .035
    o1.connect(og); o2.connect(og); o3.connect(og); og.connect(g)
    o1.start(); o2.start(); o3.start(); lfo.start()
    // lava rumble
    const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 110; f.Q.value = 2
    const ng = ctx.createGain(); ng.gain.value = .11
    const nlfo = ctx.createOscillator(); nlfo.frequency.value = .09
    const nlfoG = ctx.createGain(); nlfoG.gain.value = .05
    nlfo.connect(nlfoG); nlfoG.connect(ng.gain)
    src.connect(f); f.connect(ng); ng.connect(g); src.start(); nlfo.start()
    // distant whispering wind
    const src2 = ctx.createBufferSource(); src2.buffer = this.noise; src2.loop = true
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 620; f2.Q.value = .7
    const g2 = ctx.createGain(); g2.gain.value = .014
    src2.connect(f2); f2.connect(g2); g2.connect(g); src2.start()
  }
  tone(freq, dur, type = 'sine', vol = .2, slide = 0, delay = 0) {
    if (!this.ctx || this.muted) return
    const t = this.ctx.currentTime + delay
    const o = this.ctx.createOscillator(); o.type = type
    o.frequency.setValueAtTime(freq, t)
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur)
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .008); g.gain.exponentialRampToValueAtTime(.0001, t + dur)
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + .05)
  }
  burst(dur = .12, vol = .2, freq = 800, type = 'lowpass', delay = 0) {
    if (!this.ctx || this.muted) return
    const t = this.ctx.currentTime + delay
    const src = this.ctx.createBufferSource(); src.buffer = this.noise
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(Math.max(80, freq * .3), t + dur)
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur)
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t); src.stop(t + dur + .02)
  }
  footstep(run = false) {
    if (!this.ctx) return
    const now = this.ctx.currentTime
    if (now - this.lastFoot < .22) return
    this.lastFoot = now
    this.burst(.09, run ? .12 : .07, 380 + Math.random() * 120, 'lowpass')
    this.tone(85 + Math.random() * 15, .09, 'sine', .06)
  }
  jump() { this.tone(190, .18, 'triangle', .09, 140); this.burst(.08, .04, 900) }
  swing() { this.burst(.16, .14, 2600, 'bandpass'); this.tone(320, .13, 'sawtooth', .035, -160) }
  bow() { this.tone(440, .1, 'triangle', .09, -200); this.burst(.07, .08, 1800, 'highpass') }
  magic() { this.tone(620, .3, 'sine', .08, 420); this.tone(930, .22, 'sine', .04, 260, .02) }
  hit() { this.tone(70, .16, 'sine', .22, -30); this.burst(.1, .18, 500, 'lowpass') }
  mine() { this.burst(.06, .1, 1500, 'bandpass'); this.tone(240 + Math.random() * 120, .04, 'square', .03) }
  breakBlock() { this.burst(.2, .16, 900, 'lowpass'); this.tone(120, .18, 'triangle', .07, -60) }
  pickup() { this.tone(660, .08, 'sine', .06); this.tone(990, .1, 'sine', .05, 0, .05) }
  craft() { this.tone(330, .12, 'triangle', .08); this.tone(495, .12, 'triangle', .06, 0, .06); this.tone(660, .18, 'sine', .07, 0, .12) }
  hurt() { this.tone(95, .25, 'sawtooth', .14, -35); this.burst(.14, .13, 300, 'lowpass') }
  bossRoar() {
    this.tone(54, 1.6, 'sawtooth', .22, -16); this.tone(81, 1.2, 'square', .09, -24)
    this.burst(1.4, .16, 240, 'lowpass'); this.tone(41, 1.8, 'sine', .2, 8)
  }
  bossDeath() {
    this.tone(60, 2.4, 'sawtooth', .22, -40); this.burst(2.0, .2, 400, 'lowpass')
    this.tone(220, 1.8, 'sine', .08, 660, .2)
  }
  explosion() { this.burst(.6, .28, 1300, 'lowpass'); this.tone(52, .7, 'sine', .22, -30) }
  event() { this.tone(196, .7, 'triangle', .1); this.tone(293.7, .8, 'triangle', .08, 0, .12); this.tone(392, 1.1, 'sine', .09, 0, .24) }
  levelUp() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, .5, 'triangle', .08, 0, i * .09)) }
  UI() { this.tone(880, .04, 'sine', .025) }
}
