export type IngredientId =
  | 'bun-bottom'
  | 'beef'
  | 'chicken'
  | 'cheese'
  | 'lettuce'
  | 'tomato'
  | 'pickle'
  | 'onion'
  | 'burger-sauce'
  | 'spicy-sauce'
  | 'bun-top'

export type CookableId = 'beef' | 'chicken'

export interface Ingredient {
  id: IngredientId
  name: string
  shortName: string
}

export interface Recipe {
  id: string
  name: string
  shortName: string
  stack: IngredientId[]
  reward: number
  unlockDay: number
  accent: string
}

export interface Order {
  id: number
  recipeId: string
  createdAt: number
  expiresAt: number
  reward: number
}

export interface GrillItem {
  id: number
  type: CookableId
  startedAt: number
}

export interface FeedItem {
  id: number
  tone: 'good' | 'bad' | 'neutral'
  text: string
}

export interface GameState {
  phase: 'menu' | 'playing' | 'paused' | 'results'
  day: number
  clock: number
  duration: number
  score: number
  target: number
  combo: number
  bestCombo: number
  served: number
  perfect: number
  missed: number
  mistakes: number
  coinsEarned: number
  orders: Order[]
  selectedOrderId: number | null
  stack: IngredientId[]
  grill: GrillItem[]
  nextOrderAt: number
  nextId: number
  feed: FeedItem[]
}

export interface Profile {
  day: number
  coins: number
  highScore: number
  totalServed: number
  totalPerfect: number
  maxCombo: number
  shiftsWon: number
  unlockedAchievements: string[]
  soundOn: boolean
}

export interface Achievement {
  id: string
  name: string
  description: string
  goal: number
  progress: (profile: Profile) => number
}

export const INGREDIENTS: Record<IngredientId, Ingredient> = {
  'bun-bottom': { id: 'bun-bottom', name: '底层面包', shortName: '底包' },
  beef: { id: 'beef', name: '火烤牛肉饼', shortName: '牛肉' },
  chicken: { id: 'chicken', name: '香脆鸡排', shortName: '鸡排' },
  cheese: { id: 'cheese', name: '切达芝士', shortName: '芝士' },
  lettuce: { id: 'lettuce', name: '鲜脆生菜', shortName: '生菜' },
  tomato: { id: 'tomato', name: '番茄片', shortName: '番茄' },
  pickle: { id: 'pickle', name: '酸黄瓜', shortName: '酸瓜' },
  onion: { id: 'onion', name: '洋葱圈', shortName: '洋葱' },
  'burger-sauce': { id: 'burger-sauce', name: '招牌酱', shortName: '招牌酱' },
  'spicy-sauce': { id: 'spicy-sauce', name: '火辣酱', shortName: '辣酱' },
  'bun-top': { id: 'bun-top', name: '芝麻顶包', shortName: '顶包' },
}

export const RECIPES: Recipe[] = [
  {
    id: 'classic',
    name: '经典芝士牛堡',
    shortName: '经典牛堡',
    stack: ['bun-bottom', 'beef', 'cheese', 'lettuce', 'tomato', 'burger-sauce', 'bun-top'],
    reward: 120,
    unlockDay: 1,
    accent: '#f4b53f',
  },
  {
    id: 'crispy',
    name: '金脆鸡腿堡',
    shortName: '脆鸡堡',
    stack: ['bun-bottom', 'lettuce', 'chicken', 'tomato', 'burger-sauce', 'bun-top'],
    reward: 135,
    unlockDay: 1,
    accent: '#e8752e',
  },
  {
    id: 'double',
    name: '双层霸王牛堡',
    shortName: '双层牛堡',
    stack: ['bun-bottom', 'beef', 'cheese', 'beef', 'pickle', 'onion', 'burger-sauce', 'bun-top'],
    reward: 185,
    unlockDay: 2,
    accent: '#c52f27',
  },
  {
    id: 'spicy',
    name: '烈焰辣鸡堡',
    shortName: '辣鸡堡',
    stack: ['bun-bottom', 'lettuce', 'chicken', 'cheese', 'onion', 'spicy-sauce', 'bun-top'],
    reward: 165,
    unlockDay: 3,
    accent: '#e64b24',
  },
  {
    id: 'china',
    name: '东方炙烤堡',
    shortName: '炙烤堡',
    stack: ['bun-bottom', 'lettuce', 'beef', 'onion', 'tomato', 'spicy-sauce', 'bun-top'],
    reward: 175,
    unlockDay: 4,
    accent: '#d44832',
  },
]

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first', name: '第一单！', description: '完成首份汉堡', goal: 1, progress: (p) => p.totalServed },
  { id: 'combo5', name: '行云流水', description: '达成 5 连单', goal: 5, progress: (p) => p.maxCombo },
  { id: 'serve20', name: '午市主力', description: '累计完成 20 单', goal: 20, progress: (p) => p.totalServed },
  { id: 'perfect10', name: '毫厘不差', description: '累计完成 10 份完美出餐', goal: 10, progress: (p) => p.totalPerfect },
  { id: 'coins500', name: '小有盈余', description: '累计持有 500 金币', goal: 500, progress: (p) => p.coins },
  { id: 'win3', name: '黄金档口', description: '成功通过 3 个营业日', goal: 3, progress: (p) => p.shiftsWon },
  { id: 'serve50', name: '爆堡大师', description: '累计完成 50 单', goal: 50, progress: (p) => p.totalServed },
  { id: 'day5', name: '街区名店', description: '解锁第 5 个营业日', goal: 5, progress: (p) => p.day },
]

export const DEFAULT_PROFILE: Profile = {
  day: 1,
  coins: 0,
  highScore: 0,
  totalServed: 0,
  totalPerfect: 0,
  maxCombo: 0,
  shiftsWon: 0,
  unlockedAchievements: [],
  soundOn: true,
}

export const SHIFT_DURATION = 90

export const targetForDay = (day: number) => 720 + (day - 1) * 155

export const cookTimeFor = (type: CookableId) => (type === 'beef' ? 5.4 : 6.2)

export const grillStatus = (item: GrillItem, clock: number) => {
  const elapsed = clock - item.startedAt
  const cookTime = cookTimeFor(item.type)
  if (elapsed < cookTime) return 'cooking' as const
  if (elapsed < cookTime + 5) return 'ready' as const
  return 'burnt' as const
}

export const grillProgress = (item: GrillItem, clock: number) =>
  Math.min(1, (clock - item.startedAt) / cookTimeFor(item.type))

export const recipeById = (id: string) => RECIPES.find((recipe) => recipe.id === id) ?? RECIPES[0]

export function makeOrder(day: number, id: number, clock: number): Order {
  const pool = RECIPES.filter((recipe) => recipe.unlockDay <= day)
  const recipe = pool[Math.floor(Math.random() * pool.length)]
  const patience = Math.max(22, 36 - (day - 1) * 1.8) + recipe.stack.length * 0.55
  return {
    id,
    recipeId: recipe.id,
    createdAt: clock,
    expiresAt: clock + patience,
    reward: recipe.reward,
  }
}

export function createShift(day: number): GameState {
  const first = makeOrder(day, 1, 0)
  const second = makeOrder(day, 2, 0)
  return {
    phase: 'playing',
    day,
    clock: 0,
    duration: SHIFT_DURATION,
    score: 0,
    target: targetForDay(day),
    combo: 0,
    bestCombo: 0,
    served: 0,
    perfect: 0,
    missed: 0,
    mistakes: 0,
    coinsEarned: 0,
    orders: [first, second],
    selectedOrderId: first.id,
    stack: ['bun-bottom'],
    grill: [],
    nextOrderAt: 9,
    nextId: 3,
    feed: [{ id: 1, tone: 'neutral', text: '开火营业' }],
  }
}

export function readProfile(): Profile {
  try {
    const stored = localStorage.getItem('burger-feast-profile-v1')
    if (!stored) return DEFAULT_PROFILE
    return { ...DEFAULT_PROFILE, ...JSON.parse(stored) }
  } catch {
    return DEFAULT_PROFILE
  }
}

export function writeProfile(profile: Profile) {
  localStorage.setItem('burger-feast-profile-v1', JSON.stringify(profile))
}

export function achievementsAfter(profile: Profile) {
  return ACHIEVEMENTS.filter(
    (achievement) =>
      !profile.unlockedAchievements.includes(achievement.id) && achievement.progress(profile) >= achievement.goal,
  )
}
