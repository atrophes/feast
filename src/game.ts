export type IngredientId = 'bun-bottom' | 'beef' | 'chicken' | 'cheese' | 'lettuce' | 'tomato' | 'pickle' | 'onion' | 'burger-sauce' | 'spicy-sauce' | 'bun-top'
export type CookableId = 'beef' | 'chicken'
export type Difficulty = 'classic' | 'hot' | 'chef'
export type PerkId = 'patient' | 'grill' | 'supply' | 'tidy'
export interface Recipe { id: string; name: string; shortName: string; stack: IngredientId[]; reward: number; unlockDay: number; accent: string }
export interface Level {
  id: number; chapter: string; name: string; subtitle: string; description: string; tip: string
  recipes: string[]; count: number; required: number; duration: number; interval: number; patience: number
  drinks: boolean; fries: boolean; custom: boolean; cleaning: boolean; stock: boolean; vip: boolean
  grillSlots: number; perfectGoal: number; reward: number
}
export interface Order { id: number; recipeId: string; label: string; stack: IngredientId[]; drink: boolean; fries: boolean; vip: boolean; createdAt: number; expiresAt: number }
export interface GrillItem { id: number; type: CookableId; startedAt: number }
export interface GameState {
  sessionId: string; phase: 'menu' | 'playing' | 'paused' | 'results'; day: number; difficulty: Difficulty; perk: PerkId
  clock: number; duration: number; score: number; combo: number; bestCombo: number; served: number; perfect: number
  missed: number; mistakes: number; waste: number; stress: number; dirt: number; cleaned: number; restocked: number
  orders: Order[]; selectedOrderId: number | null; spawned: number; nextOrderAt: number; nextId: number
  stack: IngredientId[]; grill: GrillItem[]; cooked: Record<CookableId, number>; stock: Partial<Record<IngredientId, number>>
  restockUntil: number | null; cleanUntil: number | null; fryingAt: number | null; friesReady: number
  pouring: boolean; cup: number; drinksReady: number; message: string; messageTone: 'good' | 'bad' | 'neutral'; reason: string
}
export interface LevelRecord { stars: number; score: number; bestTime: number; clears: number; difficulty: Difficulty }
export interface Profile {
  id: string; name: string; color: string; day: number; coins: number; highScore: number; totalServed: number
  totalPerfect: number; maxCombo: number; shiftsWon: number; unlockedAchievements: string[]; soundOn: boolean
  levels: Record<number, LevelRecord>; settledRuns: string[]; checkpoint: GameState | null; updatedAt: number
}
export interface PlayerBook { version: 2; activeId: string; players: Profile[] }
export interface Achievement { id: string; name: string; description: string; goal: number; progress: (p: Profile) => number }
export const INGREDIENTS: Record<IngredientId, { name: string; shortName: string }> = {
  'bun-bottom': { name: '底层面包', shortName: '底包' }, beef: { name: '火烤牛肉饼', shortName: '牛肉' },
  chicken: { name: '香脆鸡排', shortName: '鸡排' }, cheese: { name: '切达芝士', shortName: '芝士' },
  lettuce: { name: '鲜脆生菜', shortName: '生菜' }, tomato: { name: '番茄片', shortName: '番茄' },
  pickle: { name: '酸黄瓜', shortName: '酸瓜' }, onion: { name: '洋葱圈', shortName: '洋葱' },
  'burger-sauce': { name: '招牌酱', shortName: '招牌酱' }, 'spicy-sauce': { name: '火辣酱', shortName: '辣酱' },
  'bun-top': { name: '芝麻顶包', shortName: '顶包' },
}
export const RECIPES: Recipe[] = [
  { id: 'classic', name: '经典芝士牛堡', shortName: '经典牛堡', stack: ['bun-bottom', 'beef', 'cheese', 'lettuce', 'tomato', 'burger-sauce', 'bun-top'], reward: 120, unlockDay: 1, accent: '#f4b53f' },
  { id: 'crispy', name: '金脆鸡腿堡', shortName: '脆鸡堡', stack: ['bun-bottom', 'lettuce', 'chicken', 'tomato', 'burger-sauce', 'bun-top'], reward: 135, unlockDay: 2, accent: '#e8752e' },
  { id: 'double', name: '双层霸王牛堡', shortName: '双层牛堡', stack: ['bun-bottom', 'beef', 'cheese', 'beef', 'pickle', 'onion', 'burger-sauce', 'bun-top'], reward: 185, unlockDay: 5, accent: '#c52f27' },
  { id: 'spicy', name: '烈焰辣鸡堡', shortName: '辣鸡堡', stack: ['bun-bottom', 'lettuce', 'chicken', 'cheese', 'onion', 'spicy-sauce', 'bun-top'], reward: 165, unlockDay: 6, accent: '#e64b24' },
  { id: 'china', name: '东方炙烤堡', shortName: '炙烤堡', stack: ['bun-bottom', 'lettuce', 'beef', 'onion', 'tomato', 'spicy-sauce', 'bun-top'], reward: 175, unlockDay: 9, accent: '#d44832' },
]
const base = { drinks: false, fries: false, custom: false, cleaning: false, stock: false, vip: false, grillSlots: 2 }
export const LEVELS: Level[] = [
  { ...base, id: 1, chapter: '街角初开', name: '第一份热爱', subtitle: '认识你的厨房', description: '完成 2 份经典牛堡。先煎肉、再叠堡，熟悉最基础的动线。', tip: '点生肉开始煎制 → 点熟肉收进保温区 → 从保温区取肉叠堡。', recipes: ['classic'], count: 2, required: 2, duration: 90, interval: 18, patience: 65, perfectGoal: 1, reward: 45 },
  { ...base, id: 2, chapter: '街角初开', name: '双线开火', subtitle: '两种肉，两种顺序', description: '牛堡与鸡堡交替到店。鸡堡先铺生菜，两块煎台可以并行备餐。', tip: '保温区最多收纳 4 块熟肉；可以提前煎肉，盖顶包后仍能撤回调整。', recipes: ['crispy', 'classic'], count: 3, required: 3, duration: 100, interval: 16, patience: 57, perfectGoal: 2, reward: 55 },
  { ...base, id: 3, chapter: '街角初开', name: '给快乐加冰', subtitle: '解锁精确接饮料', description: '套餐增加饮料。按住接饮料，在绿色目标区松开，合格的一杯自动进入托盘。', tip: '目标是 78%—100%；太少无法出杯，过满会溢出。接好后才可出套餐。', recipes: ['classic', 'crispy'], drinks: true, count: 4, required: 3, duration: 110, interval: 15, patience: 52, perfectGoal: 2, reward: 65 },
  { ...base, id: 4, chapter: '街角初开', name: '午市小考', subtitle: '第一场高峰', description: '5 组顾客，最多允许漏 1 单。决定先服务谁，争取连续出餐。', tip: '顾客顺序在重试时保持相同，可以根据上次经验安排备料。', recipes: ['crispy', 'classic'], drinks: true, count: 5, required: 4, duration: 115, interval: 12, patience: 45, perfectGoal: 3, reward: 80 },
  { ...base, id: 5, chapter: '烟火巷口', name: '金黄搭档', subtitle: '解锁批量炸薯条', description: '双层牛堡加入菜单。每锅薯条产出 2 份，炸好后及时起锅。', tip: '薯条炸 7 秒，15 秒后变焦。煎肉时同时炸薯条，配齐套餐再出餐。', recipes: ['double', 'classic', 'crispy'], drinks: true, fries: true, count: 5, required: 4, duration: 125, interval: 13, patience: 48, perfectGoal: 3, reward: 90 },
  { ...base, id: 6, chapter: '烟火巷口', name: '各有所爱', subtitle: '解锁顾客定制', description: '有顾客不要番茄，也有人要求加芝士。下方配方以本单要求为准。', tip: '注意订单上的“去番茄 / 加芝士”，不能直接照着图鉴出餐。', recipes: ['spicy', 'classic', 'crispy'], drinks: true, fries: true, custom: true, count: 6, required: 5, duration: 135, interval: 12, patience: 44, perfectGoal: 3, reward: 100 },
  { ...base, id: 7, chapter: '烟火巷口', name: '备料有数', subtitle: '解锁库存与补货', description: '食材不再无限。补货需要 4 秒，期间可以继续做汉堡。', tip: '在库存用尽前安排补货；熟肉可以在保温区周转，不必立即叠进汉堡。', recipes: ['double', 'crispy', 'classic'], drinks: true, fries: true, stock: true, count: 6, required: 5, duration: 140, interval: 11, patience: 43, perfectGoal: 3, reward: 110 },
  { ...base, id: 8, chapter: '烟火巷口', name: '一尘不染', subtitle: '解锁清洁与压力管理', description: '脏污超过 70 后持续积累压力。清洁需要 3 秒，期间暂停装配。', tip: '在等待煎炸时清洁；出餐降低压力，漏单、浪费增加压力。', recipes: ['spicy', 'double', 'crispy'], drinks: true, fries: true, custom: true, stock: true, cleaning: true, count: 7, required: 6, duration: 150, interval: 10, patience: 42, perfectGoal: 4, reward: 125 },
  { ...base, id: 9, chapter: '不夜食堂', name: '急客来访', subtitle: '优先级的抉择', description: '东方炙烤堡上线。急客的耐心更少，切换订单优先处理他们。', tip: '提前准备熟肉和配餐，给红色急客订单留出空间。', recipes: ['china', 'spicy', 'classic'], drinks: true, fries: true, custom: true, stock: true, cleaning: true, vip: true, grillSlots: 3, count: 7, required: 6, duration: 150, interval: 10, patience: 43, perfectGoal: 4, reward: 135 },
  { ...base, id: 10, chapter: '不夜食堂', name: '高峰协奏', subtitle: '所有工位同时运转', description: '8 单交错到店，考验汉堡、饮料、薯条和清洁之间的排程。', tip: '预备配餐可以缓解高峰，注意每个工位都有容量上限。', recipes: ['double', 'china', 'crispy', 'spicy'], drinks: true, fries: true, custom: true, stock: true, cleaning: true, vip: true, grillSlots: 3, count: 8, required: 7, duration: 165, interval: 9, patience: 40, perfectGoal: 5, reward: 150 },
  { ...base, id: 11, chapter: '不夜食堂', name: '小店大订单', subtitle: '有限空间，精准调度', description: '只有两块煎台，双层堡与定制套餐频繁出现，提前备肉更重要。', tip: '开局能力会改变经营方式；按自己的节奏选择耐心、猛火或周转。', recipes: ['double', 'spicy', 'china'], drinks: true, fries: true, custom: true, stock: true, cleaning: true, vip: true, count: 8, required: 7, duration: 170, interval: 9, patience: 39, perfectGoal: 5, reward: 165 },
  { ...base, id: 12, chapter: '不夜食堂', name: '爆堡之夜', subtitle: '主厨的最终考验', description: '10 单完整菜单，允许漏 1 单。串联备料、并行加工、精准接杯与压力控制。', tip: '重试不扣金币，订单顺序固定。先拿一星，再优化动线冲击三星。', recipes: ['double', 'china', 'spicy', 'crispy', 'classic'], drinks: true, fries: true, custom: true, stock: true, cleaning: true, vip: true, grillSlots: 3, count: 10, required: 9, duration: 190, interval: 9, patience: 38, perfectGoal: 6, reward: 200 },
]
export const DIFFICULTIES = {
  classic: { name: '标准', description: '逐步熟练，有余地调整', patience: 1, burnWindow: 7, pressure: 1 },
  hot: { name: '热辣', description: '耐心 −15%，压力 +15%', patience: .85, burnWindow: 5, pressure: 1.15 },
  chef: { name: '主厨', description: '耐心 −28%，压力 +30%', patience: .72, burnWindow: 4, pressure: 1.3 },
}
export const PERKS: { id: PerkId; name: string; icon: string; description: string; cost: string }[] = [
  { id: 'patient', name: '耐心贴', icon: '♡', description: '顾客耐心 +8 秒', cost: '设备保持原速' },
  { id: 'grill', name: '猛火灶', icon: '♨', description: '煎肉时间缩短 30%', cost: '熟后容错少 2 秒' },
  { id: 'supply', name: '周转箱', icon: '▣', description: '库存 +3，补货快 1 秒', cost: '额外金币减少 10%' },
  { id: 'tidy', name: '整洁达人', icon: '✦', description: '脏污 −45%，清洁快 1 秒', cost: '顾客耐心少 2 秒' },
]
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first', name: '第一单！', description: '累计完成首份汉堡', goal: 1, progress: p => p.totalServed },
  { id: 'combo5', name: '行云流水', description: '达成 5 连单', goal: 5, progress: p => p.maxCombo },
  { id: 'serve20', name: '午市主力', description: '累计完成 20 单', goal: 20, progress: p => p.totalServed },
  { id: 'perfect10', name: '毫厘不差', description: '累计完成 10 份完美套餐', goal: 10, progress: p => p.totalPerfect },
  { id: 'star12', name: '街角之星', description: '获得 12 颗关卡星星', goal: 12, progress: p => Object.values(p.levels).reduce((n, l) => n + l.stars, 0) },
  { id: 'chapter2', name: '烟火人家', description: '解锁第 5 关', goal: 5, progress: p => p.day },
  { id: 'serve50', name: '爆堡大师', description: '累计完成 50 单', goal: 50, progress: p => p.totalServed },
  { id: 'finish', name: '不夜主厨', description: '完成最终关', goal: 1, progress: p => p.levels[12]?.clears ?? 0 },
]
export const recipeById = (id: string) => RECIPES.find(r => r.id === id) ?? RECIPES[0]
export const levelById = (id: number) => LEVELS.find(l => l.id === id) ?? LEVELS[0]
export const cookTimeFor = (type: CookableId, perk: PerkId = 'patient') => (type === 'beef' ? 5 : 6) * (perk === 'grill' ? .7 : 1)
export function grillStatus(item: GrillItem, clock: number, difficulty: Difficulty = 'classic', perk: PerkId = 'patient') {
  const elapsed = clock - item.startedAt
  if (elapsed < cookTimeFor(item.type, perk)) return 'cooking'
  if (elapsed < cookTimeFor(item.type, perk) + DIFFICULTIES[difficulty].burnWindow - (perk === 'grill' ? 2 : 0)) return 'ready'
  return 'burnt'
}
export const grillProgress = (item: GrillItem, clock: number, perk: PerkId = 'patient') => Math.min(1, (clock - item.startedAt) / cookTimeFor(item.type, perk))
export const sameStack = (a: IngredientId[], b: IngredientId[]) => a.length === b.length && a.every((x, i) => x === b[i])
export const starsFor = (g: GameState) => {
  if (g.served < levelById(g.day).required || g.reason !== 'success') return 0
  return 1 + (g.perfect >= levelById(g.day).perfectGoal ? 1 : 0) + (g.missed === 0 && g.mistakes === 0 && g.waste === 0 ? 1 : 0)
}
export const totalStars = (p: Profile) => Object.values(p.levels).reduce((n, r) => n + r.stars, 0)
