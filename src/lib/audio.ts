// ─── Web Audio beeps (shared by all timers) ─────────────────────────────────

let audioCtx: AudioContext | null = null

export const getAudioCtx = (): AudioContext => {
  if (!audioCtx) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

export const playBeep = (freq = 440, duration = 0.1, vol = 0.1) => {
  try {
    const ctx = getAudioCtx()
    const schedule = () => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime)
      gain.gain.setValueAtTime(vol, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + duration)
    }
    // resume() is async; wait for the context to be running before scheduling
    if (ctx.state !== 'running') {
      ctx.resume().then(schedule).catch(e => console.error('Audio resume failed:', e))
    } else {
      schedule()
    }
  } catch (e) {
    console.error('Audio play failed:', e)
  }
}
