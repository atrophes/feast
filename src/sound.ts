let audio: AudioContext | null = null
export function sound(kind: 'tap' | 'serve' | 'bad') {
  try {
    audio ??= new AudioContext()
    if (audio.state === 'suspended') void audio.resume()
    const now = audio.currentTime, osc = audio.createOscillator(), gain = audio.createGain()
    osc.connect(gain); gain.connect(audio.destination)
    osc.type = kind === 'bad' ? 'triangle' : 'sine'
    osc.frequency.setValueAtTime(kind === 'serve' ? 620 : kind === 'bad' ? 170 : 340, now)
    if (kind === 'serve') osc.frequency.exponentialRampToValueAtTime(920, now + .1)
    gain.gain.setValueAtTime(.035, now); gain.gain.exponentialRampToValueAtTime(.001, now + .12)
    osc.start(now); osc.stop(now + .15)
  } catch { /* Audio can be unavailable in muted embedded browsers. */ }
}
