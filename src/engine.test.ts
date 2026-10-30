import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createShift, gameReducer, type GameAction } from './engine.ts'
import { LEVELS, cookTimeFor, grillStatus, starsFor, type Difficulty, type GameState, type PerkId } from './game.ts'
import { freshProfile, resumeCheckpoint, settleRun, validProfile } from './storage.ts'

function harness(level = 1, difficulty: Difficulty = 'classic', perk: PerkId = 'patient') {
  let g = createShift(level, difficulty, perk)
  return { get g() { return g }, act(a: GameAction) { g = gameReducer(g, a) }, advance(seconds: number) { for (let t = 0; t < seconds - .0001 && g.phase === 'playing'; t += .1) g = gameReducer(g, { type: 'TICK', delta: .1 }) } }
}
test('meat is cooked before holding; capped burger cannot swallow it', () => {
  const h = harness(); h.act({ type: 'COOK', ingredient: 'beef' }); const id = h.g.grill[0].id
  h.act({ type: 'TAKE', id }); assert.equal(h.g.grill.length, 1)
  h.act({ type: 'ADD', ingredient: 'bun-top' }); h.advance(5.2); h.act({ type: 'TAKE', id })
  assert.equal(h.g.cooked.beef, 1); h.act({ type: 'ADD', ingredient: 'beef' }); assert.equal(h.g.cooked.beef, 1)
  h.act({ type: 'UNDO' }); h.act({ type: 'ADD', ingredient: 'beef' }); assert.equal(h.g.cooked.beef, 0)
  h.act({ type: 'UNDO' }); assert.equal(h.g.cooked.beef, 1)
})
test('cup precision, overflow and capacity are enforced', () => {
  const h = harness(3); h.act({ type: 'POUR_START' }); h.advance(1); h.act({ type: 'POUR_STOP' }); assert.equal(h.g.drinksReady, 0)
  h.act({ type: 'POUR_START' }); h.advance(2.6); h.act({ type: 'POUR_STOP' }); assert.equal(h.g.drinksReady, 1)
  h.act({ type: 'POUR_START' }); h.advance(3.5); assert.equal(h.g.pouring, false); assert.equal(h.g.drinksReady, 1); assert.equal(h.g.waste, 2)
})
test('pause freezes all equipment and patience; restore is safe', () => {
  const h = harness(8); h.act({ type: 'COOK', ingredient: 'beef' }); h.act({ type: 'FRY' }); h.act({ type: 'POUR_START' }); h.advance(1)
  h.act({ type: 'PAUSE' }); const before = JSON.stringify(h.g); h.advance(30); assert.equal(JSON.stringify(h.g), before)
  const saved = JSON.parse(JSON.stringify(h.g)); const restored = resumeCheckpoint(saved); assert.equal(restored.phase, 'paused'); assert.equal(restored.pouring, false)
  h.act({ type: 'RESUME' }); h.advance(.5); assert.ok(h.g.clock > saved.clock)
})
test('stock is finite, replenishes asynchronously, and undo returns ingredients', () => {
  const h = harness(7); const before = h.g.stock.cheese!; h.act({ type: 'ADD', ingredient: 'cheese' }); assert.equal(h.g.stock.cheese, before - 1)
  h.act({ type: 'UNDO' }); assert.equal(h.g.stock.cheese, before)
  h.act({ type: 'RESTOCK' }); h.advance(3); assert.equal(h.g.restocked, 0); h.advance(1.2); assert.equal(h.g.restocked, 1)
})
test('cleaning blocks assembly, resolves dirt, and reduces pressure', () => {
  let g = { ...createShift(8), dirt: 90, stress: 50 }
  g = gameReducer(g, { type: 'CLEAN' }); g = gameReducer(g, { type: 'ADD', ingredient: 'cheese' }); assert.equal(g.stack.length, 1)
  for (let i = 0; i < 4; i++) g = gameReducer(g, { type: 'TICK', delta: 1 })
  assert.equal(g.dirt, 0); assert.ok(g.stress < 50); assert.equal(g.cleaned, 1)
})
test('deterministic arrivals and custom orders; failures have bounded conditions', () => {
  const a = harness(6), b = harness(6); a.advance(14); b.advance(14)
  assert.deepEqual(a.g.orders, b.g.orders); assert.equal(a.g.orders[1].label, '去番茄'); assert.ok(!a.g.orders[1].stack.includes('tomato'))
  const h = harness(1); h.advance(80); assert.equal(h.g.phase, 'results'); assert.notEqual(h.g.reason, 'success')
})

// Simulates real reducer actions with 180ms taps, 100ms observation and actual equipment wait times.
// No order, stock, timer, or ready-state is injected into the state.
function playLevel(level: number, difficulty: Difficulty, perk: PerkId): GameState {
  const h = harness(level, difficulty, perk)
  const tap = (a: GameAction) => { h.act(a); h.advance(.2) }
  for (let step = 0; step < 10000 && h.g.phase === 'playing'; step++) {
    const g = h.g, config = LEVELS[level - 1], order = g.orders.find(o => o.id === g.selectedOrderId)
    const ready = g.grill.find(i => grillStatus(i, g.clock, difficulty, perk) !== 'cooking')
    if (ready) { tap({ type: 'TAKE', id: ready.id }); continue }
    if (g.pouring) { if (g.cup >= .84) tap({ type: 'POUR_STOP' }); else h.advance(.1); continue }
    if (g.fryingAt !== null && g.clock - g.fryingAt >= 7) { tap({ type: 'FRY' }); continue }
    if (config.cleaning && g.dirt > 55 && g.cleanUntil === null && g.stack.length <= 1) { tap({ type: 'CLEAN' }); continue }
    if (!order) { h.advance(.1); continue }
    const needed = order.stack.slice(g.stack.length)
    const shortage = needed.some(i => (i === 'beef' || i === 'chicken') ? g.cooked[i] === 0 && !g.grill.some(x => x.type === i) && (g.stock[i] ?? 0) === 0 : (g.stock[i] ?? 0) === 0)
    if (config.stock && shortage && g.restockUntil === null) { tap({ type: 'RESTOCK' }); continue }
    const meat = needed.find(i => (i === 'beef' || i === 'chicken') && needed.filter(x => x === i).length > g.cooked[i] + g.grill.filter(x => x.type === i).length)
    if ((meat === 'beef' || meat === 'chicken') && g.grill.length < config.grillSlots && (!config.stock || (g.stock[meat] ?? 0) > 0)) { tap({ type: 'COOK', ingredient: meat }); continue }
    if (order.fries && g.friesReady === 0 && g.fryingAt === null) { tap({ type: 'FRY' }); continue }
    if (order.drink && g.drinksReady === 0) { tap({ type: 'POUR_START' }); continue }
    if (g.cleanUntil !== null) { h.advance(.1); continue }
    const next = needed[0]
    if (next && ((next !== 'beef' && next !== 'chicken' && (!config.stock || (g.stock[next] ?? 0) > 0)) || ((next === 'beef' || next === 'chicken') && g.cooked[next] > 0))) { tap({ type: 'ADD', ingredient: next }); continue }
    if (!next && (!order.drink || g.drinksReady > 0) && (!order.fries || g.friesReady > 0)) { tap({ type: 'SERVE' }); continue }
    h.advance(.1)
  }
  return h.g
}
for (const difficulty of ['classic', 'hot', 'chef'] as Difficulty[]) {
  test(`all 12 levels are solvable with actual production at ${difficulty} difficulty`, () => {
    for (const level of LEVELS) {
      const g = playLevel(level.id, difficulty, 'patient')
      assert.equal(g.reason, 'success', `level ${level.id}: ${g.reason} (${g.served}/${level.required}, ${g.clock}s)`)
      assert.ok(starsFor(g) >= 1)
    }
  })
}
test('all four perks can complete the final level', () => {
  for (const perk of ['patient', 'grill', 'supply', 'tidy'] as PerkId[]) {
    const g = playLevel(12, 'classic', perk); assert.equal(g.reason, 'success', `${perk}: ${g.reason}`)
    assert.ok(cookTimeFor('beef', perk) > 0)
  }
})
test('settlement is idempotent and isolates players; stars do not regress on replay', () => {
  const g = playLevel(1, 'classic', 'patient'), p = freshProfile('one', '甲'), q = freshProfile('two', '乙')
  const settled = settleRun(p, g), again = settleRun(settled, g)
  assert.deepEqual(settled, again); assert.equal(settled.day, 2); assert.equal(q.day, 1); assert.equal(settled.levels[1].stars, 3)
  const replay = { ...g, sessionId: 'replay', perfect: 0, mistakes: 1 }
  const replayed = settleRun(settled, replay); assert.equal(replayed.levels[1].stars, 3); assert.equal(replayed.levels[1].clears, 2)
  assert.equal(validProfile(settled, 'two'), null)
})
