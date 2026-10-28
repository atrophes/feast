import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  Check,
  ChefHat,
  Coins,
  Crown,
  Flame,
  Lock,
  Medal,
  Pause,
  Play,
  RotateCcw,
  Save,
  Star,
  Target,
  Timer,
  Trash2,
  Trophy,
  Undo2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { BurgerVisual } from './components/BurgerVisual'
import {
  ACHIEVEMENTS,
  DEFAULT_PROFILE,
  INGREDIENTS,
  RECIPES,
  achievementsAfter,
  createShift,
  grillProgress,
  grillStatus,
  makeOrder,
  readProfile,
  recipeById,
  writeProfile,
  type CookableId,
  type GameState,
  type IngredientId,
  type Profile,
} from './game'

type GameAction =
  | { type: 'START'; day: number }
  | { type: 'TICK'; delta: number }
  | { type: 'TOGGLE_PAUSE' }
  | { type: 'ADD'; ingredient: IngredientId }
  | { type: 'UNDO' }
  | { type: 'TRASH' }
  | { type: 'START_COOK'; ingredient: CookableId }
  | { type: 'TAKE_GRILL'; id: number }
  | { type: 'SELECT_ORDER'; id: number }
  | { type: 'SERVE' }
  | { type: 'MENU' }

const initialProfile = readProfile()
const initialShift = { ...createShift(initialProfile.day), phase: 'menu' as const, clock: 0 }
const assetUrl = (path: string) => `${import.meta.env.BASE_URL}${path}`

function sameStack(a: IngredientId[], b: IngredientId[]) {
  return a.length === b.length && a.every((ingredient, index) => ingredient === b[index])
}

function addFeed(state: GameState, text: string, tone: 'good' | 'bad' | 'neutral') {
  return [{ id: state.nextId + Math.round(state.clock * 100), text, tone }, ...state.feed].slice(0, 2)
}

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START':
      return createShift(action.day)
    case 'MENU':
      return { ...state, phase: 'menu' }
    case 'TOGGLE_PAUSE':
      if (state.phase === 'playing') return { ...state, phase: 'paused' }
      if (state.phase === 'paused') return { ...state, phase: 'playing' }
      return state
    case 'TICK': {
      if (state.phase !== 'playing') return state
      const clock = Math.min(state.duration, state.clock + action.delta)
      const expired = state.orders.filter((order) => order.expiresAt <= clock)
      let orders = state.orders.filter((order) => order.expiresAt > clock)
      let selectedOrderId = state.selectedOrderId
      let feed = state.feed
      let combo = state.combo
      if (expired.length) {
        combo = 0
        feed = addFeed(state, expired.length > 1 ? `${expired.length} 单超时` : '顾客等急了', 'bad')
        if (expired.some((order) => order.id === selectedOrderId)) selectedOrderId = orders[0]?.id ?? null
      }

      let nextOrderAt = state.nextOrderAt
      let nextId = state.nextId
      const maxOrders = state.day >= 5 ? 4 : 3
      if (clock >= nextOrderAt && orders.length < maxOrders && clock < state.duration - 7) {
        const order = makeOrder(state.day, nextId, clock)
        orders = [...orders, order]
        selectedOrderId ??= order.id
        nextId += 1
        nextOrderAt = clock + Math.max(6.2, 10.3 - state.day * 0.45) + Math.random() * 1.8
      } else if (clock >= nextOrderAt && orders.length >= maxOrders) {
        nextOrderAt = clock + 1.2
      }

      return {
        ...state,
        phase: clock >= state.duration ? 'results' : state.phase,
        clock,
        orders,
        selectedOrderId,
        nextOrderAt,
        nextId,
        feed,
        combo,
        missed: state.missed + expired.length,
      }
    }
    case 'ADD': {
      if (state.phase !== 'playing' || state.stack.includes('bun-top') || state.stack.length >= 10) return state
      return { ...state, stack: [...state.stack, action.ingredient] }
    }
    case 'UNDO': {
      if (state.phase !== 'playing' || state.stack.length <= 1) return state
      return { ...state, stack: state.stack.slice(0, -1) }
    }
    case 'TRASH': {
      if (state.phase !== 'playing' || state.stack.length <= 1) return state
      return {
        ...state,
        stack: ['bun-bottom'],
        combo: 0,
        mistakes: state.mistakes + 1,
        score: Math.max(0, state.score - 20),
        feed: addFeed(state, '食材浪费 -20', 'bad'),
      }
    }
    case 'START_COOK': {
      if (state.phase !== 'playing' || state.grill.length >= 3) return state
      return {
        ...state,
        grill: [...state.grill, { id: state.nextId, type: action.ingredient, startedAt: state.clock }],
        nextId: state.nextId + 1,
      }
    }
    case 'TAKE_GRILL': {
      if (state.phase !== 'playing') return state
      const item = state.grill.find((grillItem) => grillItem.id === action.id)
      if (!item) return state
      const status = grillStatus(item, state.clock)
      if (status === 'cooking') return { ...state, feed: addFeed(state, '还差一点火候', 'neutral') }
      const grill = state.grill.filter((grillItem) => grillItem.id !== item.id)
      if (status === 'burnt') {
        return {
          ...state,
          grill,
          combo: 0,
          mistakes: state.mistakes + 1,
          score: Math.max(0, state.score - 30),
          feed: addFeed(state, '肉饼焦了 -30', 'bad'),
        }
      }
      if (state.stack.includes('bun-top') || state.stack.length >= 10) return { ...state, grill }
      return { ...state, grill, stack: [...state.stack, item.type], feed: addFeed(state, '火候正好', 'good') }
    }
    case 'SELECT_ORDER':
      return state.orders.some((order) => order.id === action.id) ? { ...state, selectedOrderId: action.id } : state
    case 'SERVE': {
      if (state.phase !== 'playing') return state
      const order = state.orders.find((item) => item.id === state.selectedOrderId)
      if (!order) return { ...state, feed: addFeed(state, '先选一张订单', 'neutral') }
      const recipe = recipeById(order.recipeId)
      if (!sameStack(state.stack, recipe.stack)) {
        return {
          ...state,
          combo: 0,
          mistakes: state.mistakes + 1,
          score: Math.max(0, state.score - 35),
          feed: addFeed(state, '配方不对 -35', 'bad'),
        }
      }
      const patience = Math.max(0, (order.expiresAt - state.clock) / (order.expiresAt - order.createdAt))
      const isPerfect = patience >= 0.66
      const nextCombo = state.combo + 1
      const multiplier = 1 + Math.min(nextCombo - 1, 8) * 0.1
      const points = Math.round(order.reward * (0.72 + patience * 0.28) * multiplier)
      const orders = state.orders.filter((item) => item.id !== order.id)
      return {
        ...state,
        orders,
        selectedOrderId: orders[0]?.id ?? null,
        stack: ['bun-bottom'],
        score: state.score + points,
        coinsEarned: state.coinsEarned + Math.max(8, Math.round(points / 11)),
        combo: nextCombo,
        bestCombo: Math.max(state.bestCombo, nextCombo),
        served: state.served + 1,
        perfect: state.perfect + (isPerfect ? 1 : 0),
        feed: addFeed(state, `${isPerfect ? '完美出餐' : '出餐成功'} +${points}`, 'good'),
      }
    }
    default:
      return state
  }
}

function playSound(kind: 'tap' | 'good' | 'bad', enabled: boolean) {
  if (!enabled) return
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) return
  const context = new AudioContextClass()
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.type = kind === 'bad' ? 'sawtooth' : 'sine'
  oscillator.frequency.setValueAtTime(kind === 'good' ? 620 : kind === 'bad' ? 170 : 360, context.currentTime)
  if (kind === 'good') oscillator.frequency.exponentialRampToValueAtTime(920, context.currentTime + 0.1)
  gain.gain.setValueAtTime(0.045, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.16)
  oscillator.start()
  oscillator.stop(context.currentTime + 0.16)
  oscillator.addEventListener('ended', () => context.close())
}

const directIngredients: IngredientId[] = [
  'lettuce',
  'cheese',
  'tomato',
  'pickle',
  'onion',
  'burger-sauce',
  'spicy-sauce',
  'bun-top',
]

function App() {
  const [profile, setProfile] = useState<Profile>(initialProfile)
  const [game, dispatch] = useReducer(gameReducer, initialShift)
  const [achievementOpen, setAchievementOpen] = useState(false)
  const [recipeOpen, setRecipeOpen] = useState(false)
  const [newAchievements, setNewAchievements] = useState<string[]>([])
  const processedShiftRef = useRef<string | null>(null)
  const pass = game.score >= game.target
  const activeOrder = game.orders.find((order) => order.id === game.selectedOrderId) ?? null

  useEffect(() => {
    if (game.phase !== 'playing') return
    const id = window.setInterval(() => dispatch({ type: 'TICK', delta: 0.1 }), 100)
    return () => window.clearInterval(id)
  }, [game.phase])

  useEffect(() => {
    if (game.phase === 'playing' && game.clock < 0.2) processedShiftRef.current = null
  }, [game.phase, game.clock])

  useEffect(() => {
    if (game.phase !== 'results') return
    const shiftKey = `${game.day}-${game.clock}-${game.score}`
    if (processedShiftRef.current === shiftKey) return
    processedShiftRef.current = shiftKey
    setProfile((current) => {
      const next: Profile = {
        ...current,
        day: pass ? Math.max(current.day, game.day + 1) : current.day,
        coins: current.coins + game.coinsEarned,
        highScore: Math.max(current.highScore, game.score),
        totalServed: current.totalServed + game.served,
        totalPerfect: current.totalPerfect + game.perfect,
        maxCombo: Math.max(current.maxCombo, game.bestCombo),
        shiftsWon: current.shiftsWon + (pass ? 1 : 0),
      }
      const unlocked = achievementsAfter(next)
      next.unlockedAchievements = [...next.unlockedAchievements, ...unlocked.map((item) => item.id)]
      setNewAchievements(unlocked.map((item) => item.id))
      writeProfile(next)
      return next
    })
  }, [game.phase, game.day, game.clock, game.score, game.coinsEarned, game.served, game.perfect, game.bestCombo, pass])

  useEffect(() => writeProfile(profile), [profile])

  const remaining = Math.max(0, Math.ceil(game.duration - game.clock))
  const unlockedRecipeCount = RECIPES.filter((recipe) => recipe.unlockDay <= profile.day).length
  const progressToTarget = Math.min(100, (game.score / game.target) * 100)

  const handleIngredient = (ingredient: IngredientId) => {
    playSound('tap', profile.soundOn)
    dispatch({ type: 'ADD', ingredient })
  }

  const startCook = (ingredient: CookableId) => {
    playSound('tap', profile.soundOn)
    dispatch({ type: 'START_COOK', ingredient })
  }

  const takeGrill = (id: number) => {
    const item = game.grill.find((grillItem) => grillItem.id === id)
    if (item) playSound(grillStatus(item, game.clock) === 'ready' ? 'good' : 'bad', profile.soundOn)
    dispatch({ type: 'TAKE_GRILL', id })
  }

  const serve = () => {
    const recipe = activeOrder ? recipeById(activeOrder.recipeId) : null
    const correct = recipe ? sameStack(game.stack, recipe.stack) : false
    playSound(correct ? 'good' : 'bad', profile.soundOn)
    dispatch({ type: 'SERVE' })
  }

  const resetProgress = () => {
    const reset = { ...DEFAULT_PROFILE, soundOn: profile.soundOn }
    setProfile(reset)
    writeProfile(reset)
    dispatch({ type: 'MENU' })
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <img src={assetUrl('burger-mark.svg')} alt="" />
          <div>
            <strong>爆堡厨房</strong>
            <span>BURGER FEAST</span>
          </div>
        </div>

        <div className="shift-score" aria-label="本局分数">
          <Target size={17} />
          <b>{game.score}</b>
          <span>/ {game.target}</span>
          <i style={{ '--score-progress': `${progressToTarget}%` } as React.CSSProperties} />
        </div>

        <div className="topbar-actions">
          <div className="currency"><Coins size={16} /> {profile.coins + (game.phase === 'playing' ? game.coinsEarned : 0)}</div>
          <button className="icon-button" onClick={() => setRecipeOpen(true)} aria-label="配方本" title="配方本"><BookOpen /></button>
          <button className="icon-button" onClick={() => setAchievementOpen(true)} aria-label="成就" title="成就"><Trophy /></button>
          <button
            className="icon-button"
            onClick={() => setProfile((current) => ({ ...current, soundOn: !current.soundOn }))}
            aria-label={profile.soundOn ? '关闭声音' : '开启声音'}
            title={profile.soundOn ? '关闭声音' : '开启声音'}
          >
            {profile.soundOn ? <Volume2 /> : <VolumeX />}
          </button>
          {(game.phase === 'playing' || game.phase === 'paused') && (
            <button className="icon-button" onClick={() => dispatch({ type: 'TOGGLE_PAUSE' })} aria-label="暂停" title="暂停">
              {game.phase === 'paused' ? <Play /> : <Pause />}
            </button>
          )}
        </div>
      </header>

      <main className="game-area">
        <section className="order-rail" aria-label="订单队列">
          <div className="rail-label">
            <span>订单</span>
            <small>{game.orders.length}/{game.day >= 5 ? 4 : 3}</small>
          </div>
          <div className="order-list">
            {game.orders.map((order) => {
              const recipe = recipeById(order.recipeId)
              const patience = Math.max(0, Math.min(1, (order.expiresAt - game.clock) / (order.expiresAt - order.createdAt)))
              return (
                <button
                  className={`order-ticket ${order.id === game.selectedOrderId ? 'is-selected' : ''} ${patience < 0.28 ? 'is-urgent' : ''}`}
                  key={order.id}
                  onClick={() => dispatch({ type: 'SELECT_ORDER', id: order.id })}
                  style={{ '--ticket-accent': recipe.accent } as React.CSSProperties}
                >
                  <div className="ticket-number">#{String(order.id).padStart(2, '0')}</div>
                  <BurgerVisual stack={recipe.stack} compact />
                  <div className="ticket-copy">
                    <strong>{recipe.shortName}</strong>
                    <span>{recipe.stack.slice(1, -1).map((item) => INGREDIENTS[item].shortName).join(' · ')}</span>
                  </div>
                  <div className="patience"><i style={{ width: `${patience * 100}%` }} /></div>
                  {order.id === game.selectedOrderId && <Check className="selected-check" size={16} />}
                </button>
              )
            })}
            {!game.orders.length && <div className="orders-empty"><Timer />等待新订单</div>}
          </div>
          <div className={`shift-timer ${remaining <= 15 ? 'is-urgent' : ''}`}>
            <Timer size={19} />
            <b>{String(Math.floor(remaining / 60)).padStart(2, '0')}:{String(remaining % 60).padStart(2, '0')}</b>
          </div>
        </section>

        <div className="kitchen-grid">
          <section className="ingredient-station panel-surface">
            <div className="station-heading">
              <div><ChefHat size={18} /><strong>备料台</strong></div>
              <span>DAY {game.day}</span>
            </div>
            <div className="ingredient-grid">
              <button className="ingredient-button raw-beef" onClick={() => startCook('beef')} disabled={game.grill.length >= 3 || game.phase !== 'playing'}>
                <span className="ingredient-art art-beef" />
                <b>牛肉饼</b><small>需煎制</small>
              </button>
              <button className="ingredient-button raw-chicken" onClick={() => startCook('chicken')} disabled={game.grill.length >= 3 || game.phase !== 'playing'}>
                <span className="ingredient-art art-chicken" />
                <b>鸡排</b><small>需煎制</small>
              </button>
              {directIngredients.map((ingredient) => (
                <button
                  className={`ingredient-button ingredient-${ingredient}`}
                  key={ingredient}
                  onClick={() => handleIngredient(ingredient)}
                  disabled={game.phase !== 'playing'}
                >
                  <span className={`ingredient-art art-${ingredient}`} />
                  <b>{INGREDIENTS[ingredient].shortName}</b>
                </button>
              ))}
            </div>
          </section>

          <section className="assembly-station panel-surface">
            <div className="station-heading">
              <div><Star size={18} /><strong>装配台</strong></div>
              <span>{activeOrder ? `#${String(activeOrder.id).padStart(2, '0')}` : '待单'}</span>
            </div>
            <div className="prep-counter">
              <div className="feed-stack" aria-live="polite">
                {game.feed.map((item) => <span className={`feed-${item.tone}`} key={item.id}>{item.text}</span>)}
              </div>
              <div className="burger-stage">
                <div className="heat-shimmer" />
                <BurgerVisual stack={game.stack} />
                <div className="plate"><span /></div>
              </div>
              <div className="stack-readout">
                {game.stack.slice(1).length ? game.stack.slice(1).map((item) => INGREDIENTS[item].shortName).join(' / ') : '底包已就位'}
              </div>
            </div>
            <div className="assembly-actions">
              <button className="secondary-button" onClick={() => dispatch({ type: 'UNDO' })} disabled={game.stack.length <= 1}><Undo2 />撤回</button>
              <button className="secondary-button danger" onClick={() => dispatch({ type: 'TRASH' })} disabled={game.stack.length <= 1}><Trash2 />丢弃</button>
              <button className="serve-button" onClick={serve} disabled={!activeOrder}><Check />出餐</button>
            </div>
          </section>

          <section className="grill-station panel-surface">
            <div className="station-heading">
              <div><Flame size={18} /><strong>火烤区</strong></div>
              <span>{game.grill.length}/3</span>
            </div>
            <div className="grill-deck">
              <div className="grill-lines" />
              {[0, 1, 2].map((slot) => {
                const item = game.grill[slot]
                if (!item) return <div className="grill-slot is-empty" key={slot}><span>空闲</span></div>
                const status = grillStatus(item, game.clock)
                const progress = grillProgress(item, game.clock)
                return (
                  <button className={`grill-slot has-food status-${status}`} key={item.id} onClick={() => takeGrill(item.id)}>
                    <span className={`grill-food grill-${item.type}`} />
                    <b>{status === 'cooking' ? '煎制中' : status === 'ready' ? '正好！' : '焦了'}</b>
                    <i><span style={{ width: `${status === 'cooking' ? progress * 100 : 100}%` }} /></i>
                  </button>
                )
              })}
            </div>
            <div className="combo-panel">
              <div>
                <Flame size={22} />
                <span>连单</span>
                <b>x{game.combo}</b>
              </div>
              <div>
                <Crown size={22} />
                <span>最佳</span>
                <b>x{Math.max(game.bestCombo, profile.maxCombo)}</b>
              </div>
            </div>
            <div className="day-progress">
              <div><span>今日目标</span><b>{game.score} / {game.target}</b></div>
              <i><span style={{ width: `${progressToTarget}%` }} /></i>
            </div>
          </section>
        </div>
      </main>

      {game.phase === 'menu' && (
        <div className="screen-overlay menu-overlay">
          <section className="menu-sheet">
            <div className="menu-emblem"><img src={assetUrl('app-icon.svg')} alt="爆堡厨房" /></div>
            <p className="eyebrow">BURGER FEAST · 街区 {profile.day}</p>
            <h1>爆堡厨房</h1>
            <div className="profile-strip">
              <div><span>营业日</span><b>{profile.day}</b></div>
              <div><span>金币</span><b>{profile.coins}</b></div>
              <div><span>最高分</span><b>{profile.highScore}</b></div>
              <div><span>配方</span><b>{unlockedRecipeCount}/{RECIPES.length}</b></div>
            </div>
            <button className="primary-button" onClick={() => dispatch({ type: 'START', day: profile.day })}>
              <Play fill="currentColor" />{profile.highScore ? '继续营业' : '开始营业'}<ArrowRight />
            </button>
            <div className="menu-subactions">
              <button onClick={() => setRecipeOpen(true)}><BookOpen />配方本</button>
              <button onClick={() => setAchievementOpen(true)}><Trophy />成就 {profile.unlockedAchievements.length}/{ACHIEVEMENTS.length}</button>
              {profile.highScore > 0 && <button onClick={resetProgress}><RotateCcw />重置进度</button>}
            </div>
            <div className="save-note"><Save size={14} />进度已自动保存</div>
          </section>
        </div>
      )}

      {game.phase === 'paused' && (
        <div className="screen-overlay pause-overlay">
          <section className="pause-sheet">
            <Pause size={34} />
            <h2>暂停营业</h2>
            <button className="primary-button" onClick={() => dispatch({ type: 'TOGGLE_PAUSE' })}><Play fill="currentColor" />继续</button>
            <button className="text-button" onClick={() => dispatch({ type: 'MENU' })}>返回主菜单</button>
          </section>
        </div>
      )}

      {game.phase === 'results' && (
        <div className="screen-overlay result-overlay">
          <section className={`result-sheet ${pass ? 'is-pass' : 'is-fail'}`}>
            <div className="result-medal">{pass ? <Medal /> : <RotateCcw />}</div>
            <p className="eyebrow">DAY {game.day} · 营业结束</p>
            <h2>{pass ? '今日目标达成' : '还差一点火候'}</h2>
            <div className="result-score"><span>营业得分</span><b>{game.score}</b><small>目标 {game.target}</small></div>
            <div className="result-stats">
              <div><span>完成</span><b>{game.served}</b></div>
              <div><span>完美</span><b>{game.perfect}</b></div>
              <div><span>最佳连单</span><b>x{game.bestCombo}</b></div>
              <div><span>收入</span><b>+{game.coinsEarned}</b></div>
            </div>
            {newAchievements.length > 0 && (
              <div className="achievement-unlock"><Trophy />解锁成就：{newAchievements.map((id) => ACHIEVEMENTS.find((item) => item.id === id)?.name).join('、')}</div>
            )}
            <button className="primary-button" onClick={() => dispatch({ type: 'START', day: pass ? game.day + 1 : game.day })}>
              {pass ? '下一营业日' : '重新挑战'}<ArrowRight />
            </button>
            <button className="text-button" onClick={() => dispatch({ type: 'MENU' })}>返回主菜单</button>
          </section>
        </div>
      )}

      {achievementOpen && (
        <div className="screen-overlay modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && setAchievementOpen(false)}>
          <section className="collection-sheet">
            <div className="modal-heading"><div><Trophy /><div><span>COLLECTION</span><h2>成就奖章</h2></div></div><button className="icon-button" onClick={() => setAchievementOpen(false)} aria-label="关闭"><X /></button></div>
            <div className="achievement-grid">
              {ACHIEVEMENTS.map((achievement) => {
                const unlocked = profile.unlockedAchievements.includes(achievement.id)
                const progress = Math.min(achievement.goal, achievement.progress(profile))
                return (
                  <article className={`achievement-card ${unlocked ? 'is-unlocked' : ''}`} key={achievement.id}>
                    <div className="achievement-badge">{unlocked ? <Trophy /> : <Lock />}</div>
                    <div><strong>{achievement.name}</strong><p>{achievement.description}</p><span>{progress} / {achievement.goal}</span></div>
                    <i><span style={{ width: `${(progress / achievement.goal) * 100}%` }} /></i>
                  </article>
                )
              })}
            </div>
          </section>
        </div>
      )}

      {recipeOpen && (
        <div className="screen-overlay modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && setRecipeOpen(false)}>
          <section className="collection-sheet recipe-sheet">
            <div className="modal-heading"><div><BookOpen /><div><span>KITCHEN BOOK</span><h2>汉堡配方</h2></div></div><button className="icon-button" onClick={() => setRecipeOpen(false)} aria-label="关闭"><X /></button></div>
            <div className="recipe-grid">
              {RECIPES.map((recipe) => {
                const unlocked = recipe.unlockDay <= profile.day
                return (
                  <article className={`recipe-card ${unlocked ? '' : 'is-locked'}`} key={recipe.id}>
                    <div className="recipe-visual"><BurgerVisual stack={recipe.stack} /></div>
                    <div className="recipe-copy">
                      <span>{unlocked ? `DAY ${recipe.unlockDay}` : <><Lock size={12} /> DAY {recipe.unlockDay}</>}</span>
                      <strong>{unlocked ? recipe.name : '尚未解锁'}</strong>
                      <p>{unlocked ? recipe.stack.slice(1, -1).map((item) => INGREDIENTS[item].shortName).join(' · ') : '通过更多营业日后解锁'}</p>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

export default App
