import { ACHIEVEMENTS, LEVELS, levelById, starsFor, type GameState, type Profile } from './game.ts'
const PREFIX = 'burger-feast-player-v2:'
export function freshProfile(id = 'guest', name = '实习主厨'): Profile {
  return { id, name, color: '#cf2d26', day: 1, coins: 0, highScore: 0, totalServed: 0, totalPerfect: 0, maxCombo: 0, shiftsWon: 0, unlockedAchievements: [], soundOn: true, levels: {}, settledRuns: [], checkpoint: null, updatedAt: 0 }
}
export function validProfile(value: unknown, id: string): Profile | null {
  if (!value || typeof value !== 'object') return null
  const p = value as Profile
  if (p.id !== id || !Number.isFinite(p.day) || p.day < 1 || p.day > LEVELS.length || typeof p.name !== 'string' || !Number.isFinite(p.coins) || !p.levels || !Array.isArray(p.settledRuns) || !Array.isArray(p.unlockedAchievements)) return null
  if (p.checkpoint && (!p.checkpoint.sessionId || !Array.isArray(p.checkpoint.orders) || !Array.isArray(p.checkpoint.stack) || !p.checkpoint.cooked || !Number.isFinite(p.checkpoint.clock))) return null
  return { ...freshProfile(id), ...p }
}
export function readProfile(id = 'guest', name?: string): Profile {
  try {
    const raw = localStorage.getItem(`${PREFIX}${id}`)
    if (raw) return validProfile(JSON.parse(raw), id) ?? freshProfile(id, name)
    if (id === 'guest') {
      const old = localStorage.getItem('burger-feast-profile-v1')
      if (old) {
        const p = JSON.parse(old)
        // Old difficulty was unbounded, so retain earned statistics and open chapter one.
        return { ...freshProfile(), name: '老朋友', coins: Math.max(0, Number(p.coins) || 0), highScore: Math.max(0, Number(p.highScore) || 0), totalServed: Math.max(0, Number(p.totalServed) || 0), totalPerfect: Math.max(0, Number(p.totalPerfect) || 0), maxCombo: Math.max(0, Number(p.maxCombo) || 0), soundOn: p.soundOn !== false, day: Math.min(4, Math.max(1, Number(p.day) || 1)), updatedAt: Date.now() }
      }
    }
  } catch { /* Keep the existing stored value intact if it cannot be read. */ }
  return freshProfile(id, name)
}
export function writeProfile(profile: Profile): boolean {
  try { localStorage.setItem(`${PREFIX}${profile.id}`, JSON.stringify(profile)); return true } catch { return false }
}
export function resumeCheckpoint(g: GameState): GameState { return { ...g, phase: 'paused', pouring: false, cup: 0 } }
export function settleRun(profile: Profile, g: GameState): Profile {
  if (g.phase !== 'results' || profile.settledRuns.includes(g.sessionId)) return profile
  const stars = starsFor(g), level = levelById(g.day), old = profile.levels[g.day]
  const bonus = Math.round(g.served * 4 * (g.perk === 'supply' ? .9 : 1))
  const next: Profile = {
    ...profile, day: stars ? Math.max(profile.day, Math.min(LEVELS.length, g.day + 1)) : profile.day,
    coins: profile.coins + bonus + (stars ? (old ? 8 : level.reward) : 0), highScore: Math.max(profile.highScore, g.score),
    totalServed: profile.totalServed + g.served, totalPerfect: profile.totalPerfect + g.perfect, maxCombo: Math.max(profile.maxCombo, g.bestCombo),
    shiftsWon: profile.shiftsWon + (stars ? 1 : 0), settledRuns: [...profile.settledRuns, g.sessionId], checkpoint: null, updatedAt: Date.now(),
    levels: stars ? { ...profile.levels, [g.day]: { stars: Math.max(old?.stars ?? 0, stars), score: Math.max(old?.score ?? 0, g.score), bestTime: Math.min(old?.bestTime ?? Infinity, g.clock), clears: (old?.clears ?? 0) + 1, difficulty: g.difficulty } } : profile.levels,
  }
  next.unlockedAchievements = [...new Set([...next.unlockedAchievements, ...ACHIEVEMENTS.filter(a => a.progress(next) >= a.goal).map(a => a.id)])]
  return next
}
