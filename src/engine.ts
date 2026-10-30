import { DIFFICULTIES, INGREDIENTS, grillStatus, levelById, recipeById, sameStack, type CookableId, type Difficulty, type GameState, type IngredientId, type Order, type PerkId } from './game.ts'
export type GameAction =
  | { type: 'TICK'; delta: number } | { type: 'PAUSE' } | { type: 'RESUME' } | { type: 'MENU' }
  | { type: 'ADD'; ingredient: IngredientId } | { type: 'UNDO' } | { type: 'TRASH' }
  | { type: 'COOK'; ingredient: CookableId } | { type: 'TAKE'; id: number } | { type: 'SELECT'; id: number }
  | { type: 'SERVE' } | { type: 'POUR_START' } | { type: 'POUR_STOP' } | { type: 'FRY' } | { type: 'RESTOCK' } | { type: 'CLEAN' }
function orderFor(g: GameState, index: number): Order {
  const level = levelById(g.day), recipe = recipeById(level.recipes[index % level.recipes.length])
  let stack = [...recipe.stack], label = ''
  if (level.custom && index % 3 === 1 && stack.includes('tomato')) { stack = stack.filter(i => i !== 'tomato'); label = '去番茄' }
  else if (level.custom && index % 3 === 2) { stack.splice(stack.length - 2, 0, 'cheese'); label = '加芝士' }
  const vip = level.vip && index % 3 === 1
  const patience = level.patience * DIFFICULTIES[g.difficulty].patience * (vip ? .72 : 1) + (g.perk === 'patient' ? 8 : g.perk === 'tidy' ? -2 : 0)
  return { id: index + 1, recipeId: recipe.id, label, stack, drink: level.drinks && index % 3 !== 1, fries: level.fries && index % 3 !== 0, vip, createdAt: g.clock, expiresAt: g.clock + patience }
}
export function createShift(day: number, difficulty: Difficulty = 'classic', perk: PerkId = 'patient', sessionId = crypto.randomUUID()): GameState {
  const level = levelById(day)
  const stock = Object.fromEntries(Object.keys(INGREDIENTS).map(i => [i, (i === 'beef' || i === 'chicken' ? 4 : 6) + (perk === 'supply' ? 3 : 0)]))
  const g: GameState = { sessionId, phase: 'playing', day: level.id, difficulty, perk, clock: 0, duration: level.duration, score: 0, combo: 0, bestCombo: 0, served: 0, perfect: 0, missed: 0, mistakes: 0, waste: 0, stress: 0, dirt: 0, cleaned: 0, restocked: 0, orders: [], selectedOrderId: 1, spawned: 1, nextOrderAt: level.interval, nextId: 100, stack: ['bun-bottom'], grill: [], cooked: { beef: 0, chicken: 0 }, stock, restockUntil: null, cleanUntil: null, fryingAt: null, friesReady: 0, pouring: false, cup: 0, drinksReady: 0, message: level.tip, messageTone: 'neutral', reason: '' }
  g.orders = [orderFor(g, 0)]
  return g
}
const notice = (g: GameState, message: string, messageTone: GameState['messageTone'] = 'neutral') => ({ ...g, message, messageTone })
const pressure = (g: GameState, amount: number) => Math.min(100, Math.max(0, g.stress + amount * DIFFICULTIES[g.difficulty].pressure))
const soil = (g: GameState, amount: number) => levelById(g.day).cleaning ? Math.min(100, g.dirt + amount * (g.perk === 'tidy' ? .55 : 1)) : 0
const hasStock = (g: GameState, i: IngredientId) => !levelById(g.day).stock || (g.stock[i] ?? 0) > 0
const useStock = (g: GameState, i: IngredientId, amount = -1) => levelById(g.day).stock ? { ...g.stock, [i]: (g.stock[i] ?? 0) + amount } : g.stock
function finishCheck(g: GameState): GameState {
  const level = levelById(g.day)
  if (g.stress >= 100) return { ...g, phase: 'results', reason: '压力达到 100，厨房暂停营业' }
  if (g.missed > level.count - level.required) return { ...g, phase: 'results', reason: '漏单超过本关上限，试试优先处理耐心最少的顾客' }
  if (g.spawned === level.count && g.orders.length === 0) return { ...g, phase: 'results', reason: g.served >= level.required ? 'success' : '完成订单不足' }
  if (g.clock >= g.duration) return { ...g, phase: 'results', reason: g.served >= level.required ? 'success' : '营业时间结束，完成订单不足' }
  return g
}
export function gameReducer(g: GameState, action: GameAction): GameState {
  if (action.type === 'MENU') return { ...g, phase: 'menu', pouring: false }
  if (action.type === 'PAUSE') return g.phase === 'playing' ? { ...g, phase: 'paused', pouring: false, cup: 0 } : g
  if (action.type === 'RESUME') return g.phase === 'paused' ? { ...g, phase: 'playing' } : g
  if (g.phase !== 'playing') return g
  const level = levelById(g.day)
  switch (action.type) {
    case 'TICK': {
      const dt = Math.min(1, Math.max(0, action.delta))
      let n = { ...g, clock: Math.min(g.duration, g.clock + dt) }
      if (n.pouring) {
        n.cup += dt * .34
        if (n.cup >= 1.08) n = { ...notice(n, '饮料溢出了：在绿色区域松手', 'bad'), pouring: false, cup: 0, waste: n.waste + 1, stress: pressure(n, 7), dirt: soil(n, 9) }
      }
      if (n.restockUntil !== null && n.clock >= n.restockUntil) n = { ...notice(n, '补货送达，食材已补满', 'good'), restockUntil: null, restocked: n.restocked + 1, stock: Object.fromEntries(Object.keys(INGREDIENTS).map(i => [i, (i === 'beef' || i === 'chicken' ? 5 : 7) + (n.perk === 'supply' ? 3 : 0)])) }
      if (n.cleanUntil !== null && n.clock >= n.cleanUntil) n = { ...notice(n, '台面焕然一新，压力降低', 'good'), cleanUntil: null, cleaned: n.cleaned + 1, dirt: 0, stress: Math.max(0, n.stress - 18) }
      if (level.cleaning && n.dirt >= 70) n.stress = pressure(n, dt * .9)
      const expired = n.orders.filter(o => o.expiresAt <= n.clock)
      if (expired.length) {
        n = { ...notice(n, `${expired.length} 位顾客离开了，连单中断`, 'bad'), orders: n.orders.filter(o => o.expiresAt > n.clock), missed: n.missed + expired.length, combo: 0, stress: pressure(n, expired.length * 18) }
        if (!n.orders.some(o => o.id === n.selectedOrderId)) n.selectedOrderId = n.orders[0]?.id ?? null
      }
      if (n.spawned < level.count && n.orders.length < 3 && (n.clock >= n.nextOrderAt || n.orders.length === 0)) {
        const order = orderFor(n, n.spawned)
        n.orders = [...n.orders, order]; n.spawned++; n.nextOrderAt = n.clock + level.interval; n.selectedOrderId ??= order.id
      }
      return finishCheck(n)
    }
    case 'SELECT': return g.orders.some(o => o.id === action.id) ? { ...g, selectedOrderId: action.id } : g
    case 'ADD': {
      if (g.cleanUntil !== null) return notice(g, '清洁中，先照看煎台或配餐')
      const i = action.ingredient
      if (i === 'bun-bottom' || g.stack.includes('bun-top') || g.stack.length >= 11) return notice(g, '顶包已盖好，可先撤回顶包再添加')
      if (i === 'beef' || i === 'chicken') return g.cooked[i] <= 0 ? notice(g, '先煎熟肉，再收进保温区') : { ...g, cooked: { ...g.cooked, [i]: g.cooked[i] - 1 }, stack: [...g.stack, i] }
      if (!hasStock(g, i)) return notice(g, '食材用完了，点击补货', 'bad')
      return { ...g, stock: useStock(g, i), stack: [...g.stack, i], dirt: soil(g, 1.5) }
    }
    case 'UNDO': {
      if (g.cleanUntil !== null || g.stack.length <= 1) return g
      const i = g.stack[g.stack.length - 1]
      if ((i === 'beef' || i === 'chicken') && g.cooked.beef + g.cooked.chicken >= 4) return notice(g, '保温区已满，先用掉一份熟肉')
      return { ...g, stack: g.stack.slice(0, -1), cooked: i === 'beef' || i === 'chicken' ? { ...g.cooked, [i]: g.cooked[i] + 1 } : g.cooked, stock: i !== 'beef' && i !== 'chicken' ? useStock(g, i, 1) : g.stock }
    }
    case 'TRASH': return g.stack.length <= 1 || g.cleanUntil !== null ? g : { ...notice(g, '丢弃汉堡，压力增加', 'bad'), stack: ['bun-bottom'], waste: g.waste + 1, stress: pressure(g, 10), combo: 0 }
    case 'COOK': {
      if (g.grill.length >= level.grillSlots) return notice(g, '煎台满了，先收取熟肉')
      if (!hasStock(g, action.ingredient)) return notice(g, '生肉用完了，点击补货', 'bad')
      return { ...g, stock: useStock(g, action.ingredient), grill: [...g.grill, { id: g.nextId, type: action.ingredient, startedAt: g.clock }], nextId: g.nextId + 1, dirt: soil(g, 4) }
    }
    case 'TAKE': {
      const item = g.grill.find(i => i.id === action.id)
      if (!item) return g
      const status = grillStatus(item, g.clock, g.difficulty, g.perk)
      if (status === 'cooking') return notice(g, '还没熟，留意进度条')
      if (status === 'ready' && g.cooked.beef + g.cooked.chicken >= 4) return notice(g, '保温区已满，先用掉熟肉')
      const n = { ...g, grill: g.grill.filter(i => i.id !== item.id) }
      return status === 'burnt' ? { ...notice(n, '清理焦肉，压力 +8', 'bad'), waste: n.waste + 1, stress: pressure(n, 8), combo: 0 } : { ...notice(n, '熟肉放入保温区，点击保温区叠堡', 'good'), cooked: { ...n.cooked, [item.type]: n.cooked[item.type] + 1 } }
    }
    case 'POUR_START': return !level.drinks || g.drinksReady >= 3 || g.pouring ? g : { ...g, pouring: true, cup: 0 }
    case 'POUR_STOP': {
      if (!g.pouring) return g
      return g.cup >= .78 && g.cup <= 1 ? { ...notice(g, '饮料份量刚好，已备入托盘', 'good'), pouring: false, cup: 0, drinksReady: g.drinksReady + 1, dirt: soil(g, 2) } : { ...notice(g, '未到目标线，请重新接杯', 'bad'), pouring: false, cup: 0, waste: g.waste + 1, stress: pressure(g, 5) }
    }
    case 'FRY': {
      if (!level.fries) return g
      if (g.fryingAt === null) return g.friesReady >= 4 ? notice(g, '薯条托盘已满') : { ...g, fryingAt: g.clock, dirt: soil(g, 5) }
      const age = g.clock - g.fryingAt
      if (age < 7) return notice(g, '薯条还在炸制')
      if (age >= 15) return { ...notice(g, '薯条炸过头了', 'bad'), fryingAt: null, waste: g.waste + 1, stress: pressure(g, 8), combo: 0 }
      return { ...notice(g, '金黄出锅，获得 2 份薯条', 'good'), fryingAt: null, friesReady: Math.min(4, g.friesReady + 2) }
    }
    case 'RESTOCK': return !level.stock || g.restockUntil !== null ? g : { ...notice(g, '补货途中，可以继续制作'), restockUntil: g.clock + (g.perk === 'supply' ? 3 : 4) }
    case 'CLEAN': return !level.cleaning || g.cleanUntil !== null ? g : { ...notice(g, '正在清洁，暂时不能叠堡'), cleanUntil: g.clock + (g.perk === 'tidy' ? 2 : 3) }
    case 'SERVE': {
      if (g.cleanUntil !== null) return notice(g, '清洁完成后才能出餐')
      const o = g.orders.find(o => o.id === g.selectedOrderId)
      if (!o) return notice(g, '先选择订单')
      if (!sameStack(g.stack, o.stack)) return { ...notice(g, '配方层次不对，按配方撤回调整', 'bad'), mistakes: g.mistakes + 1, stress: pressure(g, 7), combo: 0 }
      if (o.drink && g.drinksReady < 1) return notice(g, '套餐还缺一杯饮料', 'bad')
      if (o.fries && g.friesReady < 1) return notice(g, '套餐还缺一份薯条', 'bad')
      const perfect = (o.expiresAt - g.clock) / (o.expiresAt - o.createdAt) >= .45, combo = g.combo + 1
      const points = Math.round((recipeById(o.recipeId).reward + (o.drink ? 25 : 0) + (o.fries ? 35 : 0)) * (1 + Math.min(combo - 1, 8) * .1))
      const orders = g.orders.filter(x => x.id !== o.id)
      return finishCheck({ ...notice(g, `${perfect ? '完美套餐' : '出餐成功'} +${points}`, 'good'), orders, selectedOrderId: orders[0]?.id ?? null, stack: ['bun-bottom'], drinksReady: g.drinksReady - (o.drink ? 1 : 0), friesReady: g.friesReady - (o.fries ? 1 : 0), served: g.served + 1, perfect: g.perfect + (perfect ? 1 : 0), score: g.score + points, combo, bestCombo: Math.max(combo, g.bestCombo), stress: Math.max(0, g.stress - 6), dirt: soil(g, 6) })
    }
    default: return g
  }
}
