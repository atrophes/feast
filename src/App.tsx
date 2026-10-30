import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Check, ChefHat, CircleHelp, Cloud, Coins, Coffee, Flame, Lock, LogOut, Pause, Play, RotateCcw, Save, Sparkles, SprayCan, Star, Timer, Trash2, Trophy, Undo2, UserRound, Volume2, VolumeX, X, PackagePlus } from 'lucide-react'
import { BurgerVisual } from './components/BurgerVisual'
import { ACHIEVEMENTS, DIFFICULTIES, INGREDIENTS, LEVELS, PERKS, RECIPES, grillProgress, grillStatus, levelById, recipeById, starsFor, totalStars, type Difficulty, type GameState, type IngredientId, type PerkId } from './game'
import { createShift, gameReducer, type GameAction } from './engine'
import { readProfile, resumeCheckpoint, settleRun, validProfile, writeProfile } from './storage'
import { cloud, cloudError } from './cloud'
import { usePlayer } from './usePlayer'
import { sound } from './sound'

const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`
const previewLevel = import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('previewLevel')) : 0
function Stars({ count = 0 }: { count?: number }) { return <span className="stars">{[1, 2, 3].map(n => <Star key={n} size={15} fill={n <= count ? 'currentColor' : 'none'} className={n <= count ? 'lit' : ''} />)}</span> }
function Modal({ title, eyebrow, children, close }: { title: string; eyebrow?: string; children: ReactNode; close: () => void }) {
  return <div className="screen-overlay modal-overlay"><section className="collection-sheet" role="dialog" aria-modal="true" aria-label={title}><div className="modal-heading"><div><ChefHat /><div><span>{eyebrow ?? 'BURGER FEAST'}</span><h2>{title}</h2></div></div><button className="icon-button" onClick={close} aria-label="关闭"><X /></button></div>{children}</section></div>
}
function App() {
  const player = usePlayer()
  const { profile, setProfile, user, ready, status, conflict } = player
  const [game, setGame] = useState<GameState | null>(() => previewLevel >= 1 && previewLevel <= 12 ? createShift(previewLevel) : null)
  const [panel, setPanel] = useState<'account' | 'recipes' | 'achievements' | 'help' | null>(null)
  const [selected, setSelected] = useState(1)
  const [difficulty, setDifficulty] = useState<Difficulty>('classic')
  const [perk, setPerk] = useState<PerkId>('patient')
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [name, setName] = useState('')
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login'), [authMessage, setAuthMessage] = useState(''), [authBusy, setAuthBusy] = useState(false)
  const [saveWarning, setSaveWarning] = useState('')
  const [importedSave, setImportedSave] = useState<ReturnType<typeof validProfile>>(null)
  const [briefing, setBriefing] = useState(false)
  const gameRef = useRef(game), profileRef = useRef(profile), lastSaved = useRef(0), previousUser = useRef(profile.id)
  gameRef.current = game; profileRef.current = profile
  const playing = game?.phase === 'playing', results = game?.phase === 'results'
  const level = levelById(game?.day ?? selected), chosenLevel = levelById(selected)
  const activeOrder = game?.orders.find(o => o.id === game.selectedOrderId)
  const usedIngredients = [...new Set((game ? level.recipes : chosenLevel.recipes).flatMap(id => recipeById(id).stack))].filter(i => i !== 'bun-bottom')
  const act = (action: GameAction) => {
    if (profileRef.current.soundOn && ['ADD', 'COOK', 'TAKE', 'FRY', 'SERVE'].includes(action.type)) sound(action.type === 'SERVE' ? 'serve' : 'tap')
    setGame(g => g ? gameReducer(g, action) : g)
  }

  useEffect(() => {
    if (previousUser.current !== profile.id) { previousUser.current = profile.id; setGame(null); setSelected(profile.day); setBriefing(false) }
  }, [profile.id, profile.day])
  useEffect(() => {
    if (!playing) return
    let last = performance.now()
    const timer = window.setInterval(() => { const now = performance.now(); const delta = (now - last) / 1000; last = now; act({ type: 'TICK', delta }) }, 50)
    return () => clearInterval(timer)
  }, [playing])
  useEffect(() => {
    const pause = () => { if (document.hidden) act({ type: 'PAUSE' }) }
    const release = () => act({ type: 'POUR_STOP' })
    const pagehide = () => {
      const g = gameRef.current, p = profileRef.current
      if (!previewLevel && g && ['playing', 'paused'].includes(g.phase)) writeProfile({ ...p, checkpoint: resumeCheckpoint(g), updatedAt: Date.now() })
    }
    document.addEventListener('visibilitychange', pause)
    window.addEventListener('blur', pause); window.addEventListener('pagehide', pagehide)
    window.addEventListener('pointerup', release); window.addEventListener('pointercancel', release)
    return () => { document.removeEventListener('visibilitychange', pause); window.removeEventListener('blur', pause); window.removeEventListener('pagehide', pagehide); window.removeEventListener('pointerup', release); window.removeEventListener('pointercancel', release) }
  }, [])
  useEffect(() => {
    if (!game || !ready || previewLevel) return
    if (game.phase === 'results') { setProfile(p => settleRun(p, game)); return }
    if (!['playing', 'paused'].includes(game.phase)) return
    if (game.phase === 'playing' && Date.now() - lastSaved.current < 900) return
    lastSaved.current = Date.now()
    setProfile(p => ({ ...p, checkpoint: resumeCheckpoint(game), updatedAt: Date.now() }))
  }, [game, ready, setProfile])
  useEffect(() => { if (conflict) act({ type: 'PAUSE' }) }, [conflict])

  function openPanel(next: typeof panel) { if (playing) act({ type: 'PAUSE' }); setPanel(next) }
  function start() { if (!ready || selected > profile.day) return; setGame(createShift(selected, difficulty, perk)); setBriefing(false); lastSaved.current = 0 }
  function home() {
    if (game && ['playing', 'paused'].includes(game.phase)) setProfile(p => ({ ...p, checkpoint: resumeCheckpoint(game), updatedAt: Date.now() }))
    setGame(null); setBriefing(false); void player.sync()
  }
  async function authenticate(event: React.FormEvent) {
    event.preventDefault(); if (!cloud) return
    setAuthBusy(true); setAuthMessage('')
    try {
      if (authMode === 'login') {
        const { error } = await cloud.auth.signInWithPassword({ email: email.trim(), password }); if (error) throw error
        setPassword(''); setPanel(null)
      } else {
        const { data, error } = await cloud.auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim() || email.split('@')[0] }, emailRedirectTo: new URL(import.meta.env.BASE_URL, location.href).href } })
        if (error) throw error
        setPassword(''); if (data.session) setPanel(null); else setAuthMessage('注册邮件已发送，请到邮箱确认后再登录。')
      }
    } catch (e) { setAuthMessage(cloudError(e)) } finally { setAuthBusy(false) }
  }
  const stars = game ? starsFor(game) : 0
  const timeLeft = game ? Math.ceil(game.duration - game.clock) : 0
  const nextIngredient = activeOrder && game ? activeOrder.stack[game.stack.length] : undefined
  const matchPrefix = game && activeOrder ? game.stack.every((i, idx) => i === activeOrder.stack[idx]) : true
  const saveText = player.storageError ? '本机空间不足，存档失败' : status

  return <div className={`app-shell v2 ${game ? 'in-game' : 'in-lobby'}`}>
    <header className="topbar">
      <button className="brand-lockup" onClick={home} aria-label="返回关卡地图"><img src={asset('burger-mark.svg')} alt="" /><div><strong>爆堡厨房</strong><span>BURGER FEAST · CHAPTERS</span></div></button>
      <div className="header-location">{game ? <><span>{level.chapter}</span><b>{String(game.day).padStart(2, '0')} / {level.name}</b></> : <><span>你的街区，你的经营节奏</span><b>从街角小店，走向不夜食堂</b></>}</div>
      <div className="topbar-actions">
        <div className="currency"><Coins size={16} />{profile.coins}</div>
        <button className="icon-button" aria-label="帮助" onClick={() => openPanel('help')}><CircleHelp /></button>
        <button className="icon-button sound" aria-label={profile.soundOn ? '关闭声音' : '开启声音'} onClick={() => setProfile(p => ({ ...p, soundOn: !p.soundOn, updatedAt: Date.now() }))}>{profile.soundOn ? <Volume2 /> : <VolumeX />}</button>
        <button className="player-button" onClick={() => openPanel('account')}><UserRound size={16} /><span>{user ? profile.name : '游客主厨'}</span>{user && <Cloud size={14} />}</button>
        {game && !results && <button className="icon-button" aria-label="暂停" onClick={() => act({ type: 'PAUSE' })}><Pause /></button>}
      </div>
    </header>

    {!game && <main className="lobby">
      <section className="lobby-intro"><div><p className="eyebrow">YOUR LITTLE BURGER EMPIRE</p><h1>今天，也要热气腾腾。</h1><p>煎烤、叠堡、接杯、炸物。把忙碌经营成自己的节奏。</p></div><div className="lobby-burger"><BurgerVisual stack={RECIPES[0].stack} /><span>MADE WITH HEART</span></div></section>
      <div className="lobby-summary"><span><Star size={16} />{totalStars(profile)} / 36 星</span><span><Check size={16} />{Object.keys(profile.levels).length} / 12 关</span><button onClick={() => setPanel('achievements')}><Trophy size={16} />奖章 {profile.unlockedAchievements.length}/8</button><button onClick={() => setPanel('recipes')}><BookOpen size={16} />配方本</button><button className={`sync-state ${user ? 'connected' : ''}`} onClick={() => setPanel('account')}><Save size={14} />{saveText}</button></div>
      {!ready && <div className="connection-banner">正在读取账号进度，请稍候…</div>}
      {profile.checkpoint && <div className="resume-banner"><div><Play size={24} /><div><b>厨房为你保留了位置</b><span>第 {profile.checkpoint.day} 关 · 已完成 {profile.checkpoint.served} 单 · 剩余 {Math.ceil(profile.checkpoint.duration - profile.checkpoint.clock)} 秒</span></div></div><button disabled={!ready} onClick={() => { setGame(resumeCheckpoint(profile.checkpoint!)); setBriefing(false) }}>继续本局<ArrowRight size={17} /></button></div>}
      <div className="campaign-layout"><section className="chapter-list" aria-label="关卡地图">
        {[0, 1, 2].map(ch => <div className="chapter" key={ch}><div className="chapter-title"><span>CHAPTER 0{ch + 1}</span><h2>{LEVELS[ch * 4].chapter}</h2><small>{ch === 0 ? '熟悉动线 · 精准接杯' : ch === 1 ? '套餐组合 · 资源管理' : '急客高峰 · 全面经营'}</small></div><div className="level-grid">{LEVELS.slice(ch * 4, ch * 4 + 4).map(l => {
          const locked = l.id > profile.day
          return <button key={l.id} className={`level-card ${selected === l.id ? 'is-active' : ''} ${locked ? 'is-locked' : ''}`} disabled={locked || !ready} onClick={() => { setSelected(l.id); setBriefing(true) }} aria-label={`第${l.id}关 ${l.name}${locked ? ' 未解锁' : ''}`}><span className="level-number">{locked ? <Lock size={20} /> : String(l.id).padStart(2, '0')}</span><strong>{l.name}</strong><small>{l.subtitle}</small><Stars count={profile.levels[l.id]?.stars} /></button>
        })}</div></div>)}
      </section><aside className="level-detail"><span className="eyebrow">LEVEL {String(selected).padStart(2, '0')}</span><h2>{chosenLevel.name}</h2><p>{chosenLevel.description}</p><div className="goal-list"><span><Check />完成 {chosenLevel.required} / {chosenLevel.count} 单</span><span><Timer />{chosenLevel.duration} 秒营业时间</span><span><Star />完美套餐 ≥ {chosenLevel.perfectGoal} 份获加星</span><span><Sparkles />零漏单、错单、浪费获加星</span></div><p className="detail-tip">{chosenLevel.tip}</p><button className="primary-button" disabled={!ready} onClick={() => setBriefing(true)}>选择开局能力<ArrowRight /></button></aside></div>
      <p className="lobby-footnote">一星即可解锁下一关 · 失败可免费重试 · 关卡与进行中的营业都会自动保存</p>
    </main>}

    {game && <main className="game-area">
      <section className="shift-dashboard"><div><b>{game.served}<small> / {level.required} 单</small></b><span>完成目标</span></div><div><b className={game.missed ? 'red' : ''}>{game.missed}<small> / {level.count - level.required}</small></b><span>漏单 / 允许</span></div><div><b>×{game.combo}</b><span>连续出餐</span></div><div className="stress-block"><span>厨房压力 <b>{Math.round(game.stress)}%</b></span><div className="meter"><i style={{ width: `${game.stress}%` }} /></div></div><div className={`time-block ${timeLeft <= 15 ? 'red' : ''}`}><Timer size={18} /><b>{String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}</b></div></section>
      <section className="order-rail" aria-label="订单队列"><div className="rail-label"><span>取餐口</span><small>已到 {game.spawned}/{level.count}</small></div><div className="order-list">{game.orders.map(o => {
        const recipe = recipeById(o.recipeId), patience = Math.max(0, (o.expiresAt - game.clock) / (o.expiresAt - o.createdAt))
        return <button className={`order-ticket ${o.id === game.selectedOrderId ? 'is-selected' : ''} ${patience < .25 ? 'is-urgent' : ''}`} key={o.id} onClick={() => act({ type: 'SELECT', id: o.id })} style={{ '--ticket-accent': recipe.accent } as CSSProperties}><span className="ticket-number">#{String(o.id).padStart(2, '0')}</span><BurgerVisual stack={o.stack} compact /><div className="ticket-copy"><strong>{recipe.shortName}{o.vip && <em>急客</em>}</strong><span className="order-sides">{o.drink ? '饮料' : '单堡'}{o.fries && ' ＋ 薯条'} {o.label && <em>{o.label}</em>}</span><small>{Math.ceil(o.expiresAt - game.clock)} 秒</small></div><div className="patience"><i style={{ width: `${patience * 100}%` }} /></div>{o.id === game.selectedOrderId && <Check className="selected-check" size={16} />}</button>
      })}{!game.orders.length && <div className="orders-empty">下一位顾客即将到店…</div>}</div></section>

      <div className="kitchen-grid">
        <section className="ingredient-station panel-surface"><div className="station-heading"><div><ChefHat size={18} /><strong>备料台</strong></div><span>{level.stock ? '留意库存' : '不限量供应'}</span></div><div className="ingredient-grid">{usedIngredients.filter(i => i !== 'beef' && i !== 'chicken').map(i => <button key={i} aria-label={`添加${INGREDIENTS[i].shortName}`} className={`ingredient-button ${nextIngredient === i && matchPrefix ? 'is-next' : ''}`} disabled={!playing || game.cleanUntil !== null || (level.stock && (game.stock[i] ?? 0) <= 0)} onClick={() => act({ type: 'ADD', ingredient: i })}><span className={`ingredient-art art-${i}`} /><b>{INGREDIENTS[i].shortName}</b>{level.stock && <small>余 {game.stock[i]}</small>}</button>)}</div>{level.stock && <button className="restock-button" disabled={!playing || game.restockUntil !== null} onClick={() => act({ type: 'RESTOCK' })}><PackagePlus size={17} />{game.restockUntil === null ? '补满食材 · 4 秒' : `配送中 ${Math.ceil(game.restockUntil - game.clock)} 秒`}</button>}</section>

        <section className="assembly-station panel-surface"><div className="station-heading"><div><Star size={18} /><strong>装配台</strong></div><span>{activeOrder ? `订单 #${String(activeOrder.id).padStart(2, '0')}` : '待单'}</span></div>
          <div className="prep-counter"><div className={`game-notice tone-${game.messageTone}`} role="status">{game.message}</div><div className="burger-stage"><BurgerVisual stack={game.stack} /><div className="plate"><span /></div></div>{game.cleanUntil !== null && <div className="cleaning-cover"><SprayCan /><b>清洁中 {Math.ceil(game.cleanUntil - game.clock)} 秒</b></div>}</div>
          <div className="recipe-guide"><span>{!matchPrefix ? '配方有误，可撤回调整' : '从左到右，按层叠加'}</span><div>{activeOrder?.stack.map((i, n) => <span className={`${n < game.stack.length ? (game.stack[n] === i ? 'done' : 'wrong') : ''} ${n === game.stack.length ? 'current' : ''}`} key={n}>{n < game.stack.length && game.stack[n] === i ? <Check size={10} /> : <small>{n + 1}</small>}{INGREDIENTS[i].shortName}</span>)}</div></div>
          <div className="assembly-actions"><button className="secondary-button" aria-label="撤回" onClick={() => act({ type: 'UNDO' })} disabled={!playing || game.stack.length <= 1}><Undo2 />撤回</button><button className="secondary-button danger" aria-label="丢弃" onClick={() => act({ type: 'TRASH' })} disabled={!playing || game.stack.length <= 1}><Trash2 />丢弃</button><button className="serve-button" onClick={() => act({ type: 'SERVE' })} disabled={!playing || !activeOrder}><Check />整单出餐</button></div>
        </section>

        <section className="equipment-station panel-surface"><div className="station-heading"><div><Flame size={18} /><strong>热厨与保温区</strong></div><span>{level.grillSlots} 块煎台</span></div><div className="raw-buttons">{(['beef', 'chicken'] as const).filter(i => usedIngredients.includes(i)).map(i => <button key={i} disabled={!playing || game.grill.length >= level.grillSlots || (level.stock && (game.stock[i] ?? 0) <= 0)} onClick={() => act({ type: 'COOK', ingredient: i })}><span className={`ingredient-art art-${i}`} /><b>煎{INGREDIENTS[i].shortName}</b><small>{level.stock ? `余 ${game.stock[i]}` : '点击下锅'}</small></button>)}</div>
          <div className="grill-deck"><div className="grill-lines" />{Array.from({ length: level.grillSlots }, (_, idx) => {
            const item = game.grill[idx]
            if (!item) return <div className="grill-slot is-empty" key={`empty-${idx}`}>煎台空闲</div>
            const state = grillStatus(item, game.clock, game.difficulty, game.perk)
            return <button key={item.id} className={`grill-slot has-food status-${state}`} aria-label={`${INGREDIENTS[item.type].shortName}${state === 'ready' ? '已熟收取' : state === 'burnt' ? '焦了清理' : '煎制中'}`} disabled={!playing} onClick={() => act({ type: 'TAKE', id: item.id })}><span className={`grill-food grill-${item.type}`} /><b>{state === 'cooking' ? '煎制中' : state === 'ready' ? '已熟 · 收取' : '焦了 · 清理'}</b><i><span style={{ width: `${grillProgress(item, game.clock, game.perk) * 100}%` }} /></i></button>
          })}</div>
          <div className="holding"><span>保温区 <small>点击熟肉叠堡 · 容量 4</small></span><div>{(['beef', 'chicken'] as const).filter(i => usedIngredients.includes(i)).map(i => <button key={i} onClick={() => act({ type: 'ADD', ingredient: i })} disabled={!playing || game.cooked[i] === 0 || game.cleanUntil !== null}><Flame size={15} />熟{INGREDIENTS[i].shortName}<b>×{game.cooked[i]}</b></button>)}</div></div>
          {level.cleaning && <div className="clean-control"><span>脏污 {Math.round(game.dirt)}%<i className="meter"><i style={{ width: `${game.dirt}%` }} /></i></span><button disabled={!playing || game.cleanUntil !== null} onClick={() => act({ type: 'CLEAN' })}><SprayCan size={15} />清洁</button></div>}
        </section>

        {(level.drinks || level.fries) && <section className="side-station panel-surface"><div className="station-heading"><div><Coffee size={18} /><strong>套餐配餐</strong></div><span>备好后自动随单出餐</span></div><div className="side-machines">
          {level.drinks && <div className="drink-machine"><div className="machine-label"><span>精确接杯</span><b>已备 {game.drinksReady}/3 杯</b></div><div className="cup-area"><div className="drink-cup"><div className="cup-target" /><div className="cup-liquid" style={{ height: `${Math.min(100, game.cup * 100)}%` }} /><span>{Math.round(game.cup * 100)}%</span></div><div><b className={game.cup >= .78 && game.cup <= 1 ? 'ready-text' : ''}>{game.pouring ? game.cup >= .78 ? '现在松手！' : '正在接杯…' : '78%—100%'}</b><small>绿色区域松手</small></div></div><button className={`pour-button ${game.pouring ? 'pouring' : ''}`} disabled={!playing || game.drinksReady >= 3} onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); act({ type: 'POUR_START' }) }} onPointerUp={() => act({ type: 'POUR_STOP' })} onPointerCancel={() => act({ type: 'POUR_STOP' })} onKeyDown={e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); act({ type: 'POUR_START' }) } }} onKeyUp={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); act({ type: 'POUR_STOP' }) } }}>按住接饮料</button></div>}
          {level.fries && <div className="fries-machine"><div className="machine-label"><span>黄金炸物</span><b>已备 {game.friesReady}/4 份</b></div><div className="fries-art"><span /><span /><span /><span /><span /></div><b>{game.fryingAt === null ? '每锅 2 份' : game.clock - game.fryingAt >= 15 ? '过火了！' : game.clock - game.fryingAt >= 7 ? '金黄！及时起锅' : `${Math.ceil(7 - (game.clock - game.fryingAt))} 秒后起锅`}</b><button className={game.fryingAt !== null && game.clock - game.fryingAt >= 7 ? 'ready-fry' : ''} disabled={!playing || (game.fryingAt === null && game.friesReady >= 4)} onClick={() => act({ type: 'FRY' })}>{game.fryingAt === null ? '开始炸薯条' : game.clock - game.fryingAt >= 15 ? '清理焦薯条' : '起锅'}</button></div>}
        </div></section>}
      </div>
      <footer className="game-status"><span>{DIFFICULTIES[game.difficulty].name} · {PERKS.find(p => p.id === game.perk)?.name}</span><span><Save size={12} />{saveText}</span><button onClick={() => openPanel('help')}>操作说明</button></footer>
    </main>}

    {briefing && !game && <Modal title={chosenLevel.name} eyebrow={`第 ${selected} 关 · ${chosenLevel.subtitle}`} close={() => setBriefing(false)}><p className="brief-description">{chosenLevel.description}</p><div className="brief-goals"><span>完成 <b>{chosenLevel.required}/{chosenLevel.count}</b> 单</span><span>限时 <b>{chosenLevel.duration}s</b></span><span>首通 <b>+{chosenLevel.reward} 金币</b></span></div><h3 className="section-label">选择挑战强度</h3><div className="difficulty-options">{(Object.keys(DIFFICULTIES) as Difficulty[]).map(d => <button key={d} className={difficulty === d ? 'selected' : ''} onClick={() => setDifficulty(d)}><b>{DIFFICULTIES[d].name}</b><small>{DIFFICULTIES[d].description}</small></button>)}</div><h3 className="section-label">带上一项开局能力</h3><div className="perk-options">{PERKS.map(p => <button key={p.id} className={perk === p.id ? 'selected' : ''} onClick={() => setPerk(p.id)}><span>{p.icon}</span><b>{p.name}</b><small>{p.description}</small><em>{p.cost}</em>{perk === p.id && <Check size={14} />}</button>)}</div>{profile.checkpoint && <p className="inline-note">开始新关卡会替换当前未完成的营业存档。</p>}<button className="primary-button" disabled={!ready} onClick={start}><Play size={18} />开门营业<ArrowRight /></button></Modal>}

    {game?.phase === 'paused' && !panel && !conflict && <div className="screen-overlay"><section className="pause-sheet"><Pause size={32} /><h2>厨房暂时打烊</h2><p className="inline-note">计时、顾客耐心和设备全部暂停。<br />本局进度已保存，可以稍后继续。</p><button className="primary-button" disabled={!ready} onClick={() => act({ type: 'RESUME' })}><Play />继续营业</button><button className="text-button" onClick={home}>保存并返回关卡地图</button></section></div>}
    {results && game && <div className="screen-overlay"><section className={`result-sheet ${stars ? 'is-pass' : 'is-fail'}`}><span className="eyebrow">LEVEL {game.day} · {level.name}</span><h2>{stars ? game.day === 12 ? '整条街都在为你喝彩' : '又一份热爱，送达。' : '调整动线，再来一局。'}</h2><Stars count={stars} /><p className="result-reason">{stars ? '已解锁下一关，随时可以回来挑战三星' : game.reason}</p><div className="result-stats"><div><span>完成</span><b>{game.served}/{level.required}</b></div><div><span>完美</span><b>{game.perfect}</b></div><div><span>最高连单</span><b>×{game.bestCombo}</b></div><div><span>得分</span><b>{game.score}</b></div></div><div className="star-checklist"><span><Check />达成出餐目标</span><span className={game.perfect >= level.perfectGoal ? 'earned' : ''}><Star />完美套餐 {game.perfect}/{level.perfectGoal}</span><span className={game.missed + game.mistakes + game.waste === 0 ? 'earned' : ''}><Star />零漏单 / 错单 / 浪费</span></div><p className="detail-tip">{level.tip}</p><button className="primary-button" onClick={() => { setSelected(stars ? Math.min(12, game.day + 1) : game.day); setGame(null); setBriefing(true) }}>{stars && game.day < 12 ? '前往下一关' : '再次挑战'}<ArrowRight /></button><button className="text-button" onClick={home}>返回关卡地图</button></section></div>}

    {panel === 'account' && <Modal title={user ? '我的主厨档案' : '让热爱，随你同行'} eyebrow="PLAYER & CLOUD SAVE" close={() => setPanel(null)}>
      <div className="account-status"><UserRound size={28} /><div><b>{user ? profile.name : '游客主厨'}</b><span>{user?.email ?? '当前进度保存在这台设备'}</span></div><span className="account-stars"><Star size={14} />{totalStars(profile)}</span></div>
      <p className="cloud-state"><Cloud size={16} />{saveText}</p>
      {!cloud && <div className="setup-pending"><Cloud size={30} /><h3>跨设备云存档即将开通</h3><p>管理员尚未连接云端服务。现在可以以游客身份游玩，进度保存在本机；账号登录与自动同步将在开通后启用。</p><p>请不要清除浏览器数据。也可以下载备份，保留当前进度。</p></div>}
      {cloud && !user && <form className="auth-form" onSubmit={authenticate}><div className="auth-tabs"><button type="button" className={authMode === 'login' ? 'active' : ''} onClick={() => setAuthMode('login')}>登录</button><button type="button" className={authMode === 'register' ? 'active' : ''} onClick={() => setAuthMode('register')}>注册</button></div>{authMode === 'register' && <label>主厨昵称<input value={name} maxLength={20} onChange={e => setName(e.target.value)} autoComplete="nickname" placeholder="你的小店主理人" /></label>}<label>邮箱<input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" /></label><label>密码<input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} placeholder="至少 8 位" /></label><button className="primary-button" disabled={authBusy}>{authBusy ? '请稍候…' : authMode === 'login' ? '登录并读取云存档' : '注册主厨账号'}</button><p className="inline-note">每个账号独立保存关卡、星级、成就与进行中的营业。</p></form>}
      {authMessage && <p role="status" className="auth-message">{authMessage}</p>}
      {user && <div className="account-actions"><button onClick={() => void player.sync()}><Cloud />立即同步</button>{profile.totalServed === 0 && <button onClick={() => { const guest = readProfile(); setProfile(p => ({ ...guest, id: p.id, name: p.name, updatedAt: Date.now() })); setGame(null); setAuthMessage('游客进度已复制到当前账号，原游客档案仍保留。') }}><Save />导入本机游客进度</button>}<button onClick={async () => { await player.signOut(); setPanel(null); setGame(null) }}><LogOut />退出账号</button></div>}
      <div className="backup-actions"><button onClick={() => { const blob = new Blob([JSON.stringify({ version: 2, profile }, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `feast-save-${profile.id.slice(0, 8)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); setSaveWarning('备份已下载，请妥善保管。') }}><Save size={15} />下载本机备份</button>{saveWarning && <span>{saveWarning}</span>}</div>
      <label className="import-save">读取备份文件<input type="file" accept="application/json,.json" onChange={async e => { const f = e.target.files?.[0]; if (!f) return; try { if (f.size > 2000000) throw new Error('备份文件过大'); const data = JSON.parse(await f.text()); const p = data.version === 2 ? validProfile(data.profile, profile.id) : null; if (!p) throw new Error('文件不是当前玩家的有效存档，请先登录对应账号'); setImportedSave(p); setSaveWarning('') } catch (err) { setSaveWarning(cloudError(err)) } e.target.value = '' }} /></label>
      {importedSave && <div className="import-preview"><p>备份：第 {importedSave.day} 关 · {totalStars(importedSave)} 星。替换后将同步至当前账号，现有进度会被覆盖。</p><button onClick={() => { setProfile({ ...importedSave, updatedAt: Date.now() }); setImportedSave(null); setGame(null); setSaveWarning('备份已恢复。') }}>导入并替换当前进度</button><button onClick={() => setImportedSave(null)}>取消</button></div>}
    </Modal>}
    {panel === 'recipes' && <Modal title="汉堡配方本" eyebrow="KITCHEN BOOK" close={() => setPanel(null)}><div className="recipe-grid">{RECIPES.map(r => <article className={`recipe-card ${r.unlockDay > profile.day ? 'is-locked' : ''}`} key={r.id}><div className="recipe-visual"><BurgerVisual stack={r.stack} /></div><div className="recipe-copy"><span>第 {r.unlockDay} 关解锁</span><strong>{r.name}</strong><p>{r.stack.map(i => INGREDIENTS[i].shortName).join(' → ')}</p></div></article>)}</div><p className="inline-note">定制订单的层次可能与标准配方不同，请以订单引导为准。</p></Modal>}
    {panel === 'achievements' && <Modal title="主厨奖章" eyebrow={`${profile.name} · ${profile.unlockedAchievements.length} / 8`} close={() => setPanel(null)}><div className="achievement-grid">{ACHIEVEMENTS.map(a => { const unlocked = profile.unlockedAchievements.includes(a.id), n = Math.min(a.goal, a.progress(profile)); return <article key={a.id} className={`achievement-card ${unlocked ? 'is-unlocked' : ''}`}><div className="achievement-badge">{unlocked ? <Trophy /> : <Lock />}</div><div><strong>{a.name}</strong><p>{a.description}</p><span>{n}/{a.goal}</span></div><i><span style={{ width: `${n / a.goal * 100}%` }} /></i></article> })}</div></Modal>}
    {panel === 'help' && <Modal title="忙得有条不紊" eyebrow="HOW TO PLAY" close={() => setPanel(null)}><div className="help-grid"><article><Flame /><h3>先加工，再装配</h3><p>生肉点击下锅，绿色状态及时收取。熟肉进入保温区，再点击加入汉堡；保温区最多 4 块。</p></article><article><BookOpen /><h3>看订单，按层叠堡</h3><p>下方配方从左到右为制作顺序。错误可免费撤回；注意加芝士、去番茄等定制要求。</p></article><article><Coffee /><h3>整单配齐再出餐</h3><p>按住饮料按钮，在 78%—100% 松开。薯条 7 秒炸好，15 秒变焦，每锅 2 份。配餐自动随汉堡交付。</p></article><article><SprayCan /><h3>管理厨房的节奏</h3><p>第 7 关开始要补货，第 8 关开始要清洁。脏污 ≥70 会增加压力；压力满 100 或漏单超限会失败。</p></article><article><Star /><h3>一星通关，三星精通</h3><p>完成规定订单即可过关。达到完美出餐数量、全程零漏单错单浪费，各额外获得一星。</p></article><article><Save /><h3>离开也能接着玩</h3><p>自动保存本局，切换到其他页面会暂停。账号开通后可跨设备同步，冲突时自行选择保留的进度。</p></article></div></Modal>}
    {conflict && <div className="screen-overlay modal-overlay"><section className="collection-sheet conflict-sheet"><span className="eyebrow">SAVE CONFLICT</span><h2>另一台设备也有新进度</h2><p>厨房已暂停。请选择保留哪一份，这会替换当前账号的云存档。</p><div><button onClick={() => { player.resolve('local'); setGame(null) }}><Save /><strong>保留这台设备</strong><span>解锁第 {profile.day} 关 · {totalStars(profile)} 星</span></button><button onClick={() => { player.resolve('remote'); setGame(null) }}><Cloud /><strong>使用云端进度</strong><span>解锁第 {conflict.profile.day} 关 · {totalStars(conflict.profile)} 星</span></button></div></section></div>}
  </div>
}
export default App
