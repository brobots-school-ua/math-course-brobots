'use client'

import { useState, useMemo } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type SpellId = 'arrows' | 'fireball' | 'blizzard' | 'lightning'

interface SpellDef {
  name: string; emoji: string; cost: number; damage: number; special?: string
}

const SPELLS: Record<SpellId, SpellDef> = {
  arrows:    { name: 'Стріли',       emoji: '🏹', cost: 20,  damage: 70  },
  fireball:  { name: 'Вогняна куля', emoji: '🔥', cost: 55,  damage: 210 },
  blizzard:  { name: 'Крижана буря', emoji: '❄️', cost: 80,  damage: 280, special: 'Ріст армії ÷2 наступний хід' },
  lightning: { name: 'Блискавка',    emoji: '⚡', cost: 110, damage: 420 },
}

const SPELL_ORDER: SpellId[] = ['arrows', 'fireball', 'blizzard', 'lightning']

type Growth = { type: 'linear'; amount: number } | { type: 'exponential'; rate: number }

interface LevelDef {
  id: number; name: string; badge: string; color: string
  story: string
  initialArmy: number
  growth: Growth
  totalBudget: number  // монет на всю гру
  turns: number
  spells: SpellId[]
  growthLabel: string
  formula: string
  hint: string
}

const LEVELS: LevelDef[] = [
  {
    id: 1, name: 'Лінійне вторгнення', badge: '⚔️', color: 'from-blue-800 to-blue-600',
    story: 'Армія марширує рівномірно: +160 солдатів щохода. У тебе 800 монет на всю битву — витрачай з розумом!',
    initialArmy: 1200,
    growth: { type: 'linear', amount: 160 },
    totalBudget: 800,
    turns: 10,
    spells: ['arrows', 'fireball'],
    growthLabel: '+160 / хід',
    formula: 'армія(t) = 1200 + 160×t − сумарна_шкода',
    hint: 'Щоб армія скорочувалась, шкода за хід має бути БІЛЬШЕ за 160. Стріли (70) самі не допоможуть!',
  },
  {
    id: 2, name: 'Прискорення', badge: '🏃', color: 'from-orange-700 to-orange-500',
    story: '+300 на хід! Навіть Вогняна куля не встигає. Але Крижана буря уповільнює ріст — і коштує монет. Плануй!',
    initialArmy: 2000,
    growth: { type: 'linear', amount: 300 },
    totalBudget: 1400,
    turns: 10,
    spells: ['arrows', 'fireball', 'blizzard'],
    growthLabel: '+300 / хід',
    formula: 'армія(t) = 2000 + 300×t − сумарна_шкода',
    hint: 'Крижана буря коштує 80 монет, але наступний хід ріст = +150 замість +300. Рахуй: коли вигідніше її кидати?',
  },
  {
    id: 3, name: 'Показниковий ріст', badge: '💀', color: 'from-red-900 to-red-700',
    story: 'Армія множиться на 1.8 кожен хід. Зволікання = катастрофа. У тебе 1200 монет. Бий на повну з першого ходу!',
    initialArmy: 2000,
    growth: { type: 'exponential', rate: 1.8 },
    totalBudget: 1200,
    turns: 8,
    spells: ['arrows', 'fireball', 'blizzard', 'lightning'],
    growthLabel: '×1.8 / хід',
    formula: 'армія(t) = 2000 × 1.8^t − сумарна_шкода',
    hint: 'Без атаки: 2000 → 3600 → 6480 → 11664... За 4 ходи армія у 10× більша. Потрібна Блискавка кожен хід!',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function applyGrowth(army: number, g: Growth, slow: boolean): number {
  if (army <= 0) return 0
  if (g.type === 'linear') return army + (slow ? Math.floor(g.amount / 2) : g.amount)
  const rate = slow ? 1 + (g.rate - 1) / 2 : g.rate
  return Math.round(army * rate)
}

function growthAmt(army: number, g: Growth, slow: boolean): number {
  return applyGrowth(army, g, slow) - army
}

interface TurnRecord {
  turn: number; armyBefore: number
  quantities: Record<SpellId, number>
  totalCost: number; totalDamage: number
  armyAfterAttack: number; growth: number; armyAfterGrowth: number
  wasSlow: boolean
}

// ─── Formula display ──────────────────────────────────────────────────────────

function buildFormulaParts(quantities: Record<SpellId, number>): { text: string; answer: number } {
  const parts = SPELL_ORDER
    .filter(id => (quantities[id] ?? 0) > 0)
    .map(id => {
      const q = quantities[id]
      const d = SPELLS[id].damage
      return q === 1 ? `${d}` : `${q}×${d}`
    })
  if (parts.length === 0) return { text: '', answer: 0 }
  const answer = SPELL_ORDER.reduce((s, id) => s + (quantities[id] ?? 0) * SPELLS[id].damage, 0)
  return { text: parts.join(' + '), answer }
}

function buildCostParts(quantities: Record<SpellId, number>): { text: string; answer: number } {
  const parts = SPELL_ORDER
    .filter(id => (quantities[id] ?? 0) > 0)
    .map(id => {
      const q = quantities[id]
      const c = SPELLS[id].cost
      return q === 1 ? `${c}` : `${q}×${c}`
    })
  if (parts.length === 0) return { text: '', answer: 0 }
  const answer = SPELL_ORDER.reduce((s, id) => s + (quantities[id] ?? 0) * SPELLS[id].cost, 0)
  return { text: parts.join(' + '), answer }
}

// ─── Projection ───────────────────────────────────────────────────────────────

function buildProjection(
  army: number, growth: Growth, slow: boolean,
  damage: number, costPerTurn: number, budgetLeft: number, turnsLeft: number
): { turn: number; army: number; canAfford: boolean }[] {
  const rows: { turn: number; army: number; canAfford: boolean }[] = []
  let cur = army
  let budget = budgetLeft
  for (let t = 1; t <= turnsLeft && cur > 0; t++) {
    const canAfford = budget >= costPerTurn
    cur = Math.max(0, cur - damage)
    if (cur > 0) cur = applyGrowth(cur, growth, t === 1 ? slow : false)
    budget -= costPerTurn
    rows.push({ turn: t, army: cur, canAfford })
    if (cur <= 0) break
  }
  return rows
}

// ─── Component ────────────────────────────────────────────────────────────────

type Screen = 'levels' | 'game' | 'result'

export default function ArmyGame() {
  const [screen, setScreen] = useState<Screen>('levels')
  const [levelIdx, setLevelIdx] = useState(0)
  const [army, setArmy] = useState(0)
  const [turnsLeft, setTurnsLeft] = useState(0)
  const [budgetLeft, setBudgetLeft] = useState(0)
  const [quantities, setQuantities] = useState<Record<SpellId, number>>({ arrows: 0, fireball: 0, blizzard: 0, lightning: 0 })
  const [history, setHistory] = useState<TurnRecord[]>([])
  const [slowNextTurn, setSlowNextTurn] = useState(false)
  const [hintOpen, setHintOpen] = useState(false)
  const [projOpen, setProjOpen] = useState(false)
  const [dmgInput, setDmgInput] = useState('')
  const [costInput, setCostInput] = useState('')
  const [dmgChecked, setDmgChecked] = useState(false)
  const [costChecked, setCostChecked] = useState(false)
  const [result, setResult] = useState<'won' | 'lost' | null>(null)

  const level = LEVELS[levelIdx]

  function startLevel(idx: number) {
    const lvl = LEVELS[idx]
    setLevelIdx(idx)
    setArmy(lvl.initialArmy)
    setTurnsLeft(lvl.turns)
    setBudgetLeft(lvl.totalBudget)
    setQuantities({ arrows: 0, fireball: 0, blizzard: 0, lightning: 0 })
    setHistory([]); setSlowNextTurn(false); setHintOpen(false); setProjOpen(false)
    setDmgInput(''); setCostInput(''); setDmgChecked(false); setCostChecked(false)
    setResult(null)
    setScreen('game')
  }

  function changeQty(id: SpellId, delta: number) {
    setQuantities(prev => {
      const next = { ...prev, [id]: Math.max(0, Math.min(3, (prev[id] ?? 0) + delta)) }
      return next
    })
    setDmgInput(''); setCostInput(''); setDmgChecked(false); setCostChecked(false)
  }

  const totalCost = useMemo(
    () => SPELL_ORDER.reduce((s, id) => s + (quantities[id] ?? 0) * SPELLS[id].cost, 0),
    [quantities]
  )
  const totalDamage = useMemo(
    () => SPELL_ORDER.reduce((s, id) => s + (quantities[id] ?? 0) * SPELLS[id].damage, 0),
    [quantities]
  )

  const dmgFormula = useMemo(() => buildFormulaParts(quantities), [quantities])
  const costFormula = useMemo(() => buildCostParts(quantities), [quantities])
  const hasSpells = totalDamage > 0

  const dmgCorrect = dmgChecked && parseInt(dmgInput) === dmgFormula.answer
  const costCorrect = costChecked && parseInt(costInput) === costFormula.answer
  const canAttack = hasSpells && dmgCorrect && costCorrect && totalCost <= budgetLeft

  function checkDmg() { setDmgChecked(true) }
  function checkCost() { setCostChecked(true) }

  function attack() {
    if (!canAttack) return
    const afterAttack = Math.max(0, army - totalDamage)
    const usedBlizzard = (quantities.blizzard ?? 0) > 0
    const growth = growthAmt(afterAttack, level.growth, slowNextTurn)
    const afterGrowth = afterAttack > 0 ? afterAttack + growth : 0
    const won = afterAttack === 0

    setHistory(prev => [...prev, {
      turn: level.turns - turnsLeft + 1,
      armyBefore: army, quantities: { ...quantities },
      totalCost, totalDamage,
      armyAfterAttack: afterAttack, growth, armyAfterGrowth: afterGrowth,
      wasSlow: slowNextTurn,
    }])

    if (won) { setArmy(0); setResult('won'); setScreen('result'); return }

    const newTurns = turnsLeft - 1
    if (newTurns === 0) { setArmy(afterGrowth); setResult('lost'); setScreen('result'); return }

    setArmy(afterGrowth)
    setTurnsLeft(newTurns)
    setBudgetLeft(b => b - totalCost)
    setSlowNextTurn(usedBlizzard)
    setQuantities({ arrows: 0, fireball: 0, blizzard: 0, lightning: 0 })
    setDmgInput(''); setCostInput(''); setDmgChecked(false); setCostChecked(false)
  }

  const netPerTurn = totalDamage - growthAmt(Math.max(0, army - totalDamage), level.growth, slowNextTurn)
  const projection = hasSpells
    ? buildProjection(army, level.growth, slowNextTurn, totalDamage, totalCost, budgetLeft, turnsLeft)
    : []

  const currentTurn = level.turns - turnsLeft + 1
  const budgetPct = (budgetLeft / level.totalBudget) * 100
  const score = result === 'won'
    ? Math.round(50 + 30 * (budgetLeft / level.totalBudget) + 20 * ((turnsLeft) / level.turns))
    : 0

  // ── Level select ──────────────────────────────────────────────────────────
  if (screen === 'levels') return (
    <div className="min-h-screen bg-gray-950 p-4 flex flex-col items-center justify-center">
      <div className="max-w-md w-full space-y-4">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🏰</div>
          <h1 className="text-2xl font-bold text-white">Зупини Армію</h1>
          <p className="text-gray-400 text-sm mt-1">Модуль 6 · Лінійні та показникові функції</p>
        </div>
        {LEVELS.map((lvl, i) => (
          <button key={lvl.id} onClick={() => startLevel(i)}
            className={`w-full rounded-2xl p-5 text-left text-white shadow-lg hover:scale-[1.02] transition-transform bg-gradient-to-r ${lvl.color}`}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">{lvl.badge}</span>
              <div>
                <div className="font-bold text-lg">Рівень {lvl.id}: {lvl.name}</div>
                <div className="text-sm opacity-80">{lvl.growthLabel} · {lvl.turns} ходів · 💰 {lvl.totalBudget} монет</div>
              </div>
            </div>
            <p className="text-sm opacity-90">{lvl.story}</p>
          </button>
        ))}
      </div>
    </div>
  )

  // ── Result screen ─────────────────────────────────────────────────────────
  if (screen === 'result') return (
    <div className="min-h-screen bg-gray-950 p-4">
      <div className="max-w-lg mx-auto space-y-4 pt-4">
        <div className={`rounded-2xl p-6 text-center text-white ${result === 'won' ? 'bg-green-800' : 'bg-red-900'}`}>
          <div className="text-5xl mb-3">{result === 'won' ? '🏆' : '💀'}</div>
          <h2 className="text-2xl font-bold">{result === 'won' ? 'Замок врятовано!' : 'Замок захоплено...'}</h2>
          {result === 'won' ? (
            <div className="mt-3 space-y-2">
              <div className="bg-white bg-opacity-20 rounded-xl px-4 py-2 inline-block">
                <span className="text-3xl font-bold">{score}</span><span className="text-lg"> / 100 балів</span>
              </div>
              <p className="text-sm opacity-80">Залишилось монет: {budgetLeft} з {level.totalBudget}</p>
            </div>
          ) : (
            <p className="text-sm mt-2 opacity-80">
              Залишилось {army.toLocaleString('uk')} солдатів і {budgetLeft} монет.<br/>
              Спробуй атакувати сильніше в перших ходах.
            </p>
          )}
        </div>

        {/* Turn log */}
        <div className="bg-gray-800 rounded-2xl p-4">
          <h3 className="text-white font-bold mb-3">📜 Журнал бою</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {history.map(r => {
              const spellLine = SPELL_ORDER
                .filter(id => (r.quantities[id] ?? 0) > 0)
                .map(id => `${r.quantities[id]}×${SPELLS[id].emoji}(${SPELLS[id].damage})`)
                .join(' + ')
              return (
                <div key={r.turn} className="bg-gray-700 rounded-xl p-3 text-sm">
                  <div className="flex justify-between text-gray-300 mb-1">
                    <span className="font-semibold text-white">Хід {r.turn}</span>
                    <span className="text-yellow-300">💰 −{r.totalCost} монет</span>
                  </div>
                  <div className="text-xs text-gray-300 font-mono">
                    <span className="text-gray-400">Шкода: </span>{spellLine} = <strong className="text-red-300">{r.totalDamage}</strong>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {r.armyBefore.toLocaleString()} − {r.totalDamage} = {r.armyAfterAttack.toLocaleString()}
                    {r.armyAfterAttack > 0 && (
                      <span>
                        <span className="text-red-400"> +{r.growth}</span>
                        {r.wasSlow && <span className="text-teal-400"> (❄️÷2)</span>}
                        {' = '}
                        <strong className="text-white">{r.armyAfterGrowth.toLocaleString()}</strong>
                      </span>
                    )}
                    {r.armyAfterAttack === 0 && <span className="text-green-400 font-bold"> → ПЕРЕМОГА 🎉</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Math lesson */}
        <div className="bg-gray-800 rounded-2xl p-4">
          <h3 className="text-white font-bold mb-3">📐 Що треба було знати</h3>
          <div className="text-sm text-gray-300 space-y-2">
            <div className="bg-gray-700 rounded-lg p-2 font-mono text-xs text-gray-200">{level.formula}</div>
            {level.growth.type === 'linear' ? (
              <>
                <p>🔹 <strong className="text-white">Лінійний ріст</strong>: армія збільшується на постійне число кожен хід — це лінійна функція.</p>
                <p>🔹 Щоб перемогти: <strong className="text-yellow-300">шкода &gt; {(level.growth as {type:'linear';amount:number}).amount}</strong> кожен хід (інакше армія росте).</p>
                <p>🔹 Нетто-зменшення = шкода − ріст. Якщо &gt; 0 — ти виграєш.</p>
              </>
            ) : (
              <>
                <p>🔹 <strong className="text-white">Показниковий ріст</strong>: армія множиться на {(level.growth as {type:'exponential';rate:number}).rate} щохода.</p>
                <p>🔹 За 4 ходи без атаки: 2000 × 1.8⁴ ≈ <strong className="text-red-400">{Math.round(2000 * 1.8 ** 4).toLocaleString()} солдатів</strong>.</p>
                <p>🔹 Лінійні атаки не встигають за показниковим ростом — треба бити якомога сильніше <em>з першого ходу</em>.</p>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={() => startLevel(levelIdx)} className="flex-1 bg-blue-600 text-white rounded-2xl py-3 font-semibold hover:bg-blue-700">Повторити</button>
          <button onClick={() => setScreen('levels')} className="flex-1 bg-gray-600 text-white rounded-2xl py-3 font-semibold hover:bg-gray-700">Рівні</button>
        </div>
      </div>
    </div>
  )

  // ── Game screen ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 p-4">
      <div className="max-w-lg mx-auto space-y-3 pb-4">

        {/* Top bar */}
        <div className="flex items-center justify-between">
          <button onClick={() => setScreen('levels')} className="text-gray-400 hover:text-white text-sm">← Рівні</button>
          <span className="text-white font-bold text-sm">{level.badge} {level.name}</span>
          <span className="text-gray-400 text-sm">Хід {currentTurn}/{level.turns}</span>
        </div>

        {/* Status cards */}
        <div className="grid grid-cols-2 gap-3">
          {/* Army */}
          <div className="bg-gray-800 rounded-2xl p-4">
            <div className="text-gray-400 text-xs mb-1">⚔️ АРМІЯ</div>
            <div className="text-red-400 font-bold text-2xl">{army.toLocaleString('uk')}</div>
            <div className="text-xs text-gray-500 mt-1">{level.growthLabel}</div>
            {slowNextTurn && <div className="text-xs text-teal-400 mt-1">❄️ Цей хід ріст ÷2</div>}
          </div>
          {/* Budget */}
          <div className="bg-gray-800 rounded-2xl p-4">
            <div className="text-gray-400 text-xs mb-1">💰 МОНЕТИ</div>
            <div className={`font-bold text-2xl ${budgetLeft < level.totalBudget * 0.3 ? 'text-red-400' : 'text-yellow-300'}`}>
              {budgetLeft}
            </div>
            <div className="w-full bg-gray-700 rounded-full h-1.5 mt-2 overflow-hidden">
              <div className="h-1.5 rounded-full bg-yellow-400 transition-all"
                style={{ width: `${budgetPct}%` }} />
            </div>
            <div className="text-xs text-gray-500 mt-1">з {level.totalBudget} всього</div>
          </div>
        </div>

        {/* Castle road */}
        <div className="bg-gray-800 rounded-xl px-4 py-3">
          <div className="flex items-center gap-1">
            <span className="text-xl shrink-0">⚔️</span>
            <div className="flex-1 flex gap-0.5 mx-2">
              {Array.from({ length: level.turns }, (_, i) => (
                <div key={i} className={`flex-1 h-2 rounded-sm ${
                  i < currentTurn - 1 ? 'bg-red-700' : i === currentTurn - 1 ? 'bg-red-400' : 'bg-gray-700'
                }`} />
              ))}
            </div>
            <span className="text-xl shrink-0">🏰</span>
          </div>
          <div className="text-center text-xs text-gray-500 mt-1">до замку: {turnsLeft} ходів</div>
        </div>

        {/* Spell selection */}
        <div className="bg-gray-800 rounded-2xl p-4">
          <div className="text-gray-300 text-sm font-semibold mb-3">🔮 Вибери заклинання (кількість)</div>
          <div className="space-y-2">
            {level.spells.map(id => {
              const sp = SPELLS[id]
              const qty = quantities[id] ?? 0
              const lineCost = qty * sp.cost
              const lineDmg = qty * sp.damage
              const wouldExceed = totalCost - lineCost + sp.cost > budgetLeft
              return (
                <div key={id} className={`rounded-xl p-3 flex items-center gap-3 ${qty > 0 ? 'bg-gray-600 border border-gray-500' : 'bg-gray-750'}`}
                  style={{ backgroundColor: qty > 0 ? '#374151' : '#1f2937' }}>
                  <span className="text-xl w-7 text-center">{sp.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-semibold">{sp.name}</div>
                    <div className="text-xs text-gray-400">💰 {sp.cost} монет · ⚔️ {sp.damage} шкоди</div>
                    {sp.special && <div className="text-xs text-teal-400">{sp.special}</div>}
                  </div>
                  {/* Qty stepper */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => changeQty(id, -1)} disabled={qty === 0}
                      className="w-7 h-7 rounded-full bg-gray-600 text-white font-bold disabled:opacity-30 hover:bg-gray-500">−</button>
                    <span className="text-white font-bold w-4 text-center">{qty}</span>
                    <button onClick={() => changeQty(id, 1)} disabled={wouldExceed || qty >= 3}
                      className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold disabled:opacity-30 hover:bg-blue-500">+</button>
                  </div>
                  {qty > 0 && (
                    <div className="text-xs text-right shrink-0 w-20">
                      <div className="text-yellow-300">💰 {lineCost}</div>
                      <div className="text-red-300">⚔️ {lineDmg}</div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Manual calculation */}
        {hasSpells && (
          <div className="bg-gray-800 rounded-2xl p-4 space-y-4">
            <div className="text-gray-300 text-sm font-semibold">🧮 Порахуй самостійно</div>

            {/* Damage formula */}
            <div>
              <div className="text-xs text-gray-400 mb-1">Загальна шкода:</div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-white text-sm bg-gray-700 rounded-lg px-2 py-1">
                  {dmgFormula.text} =
                </span>
                <input
                  type="number"
                  value={dmgInput}
                  onChange={e => { setDmgInput(e.target.value); setDmgChecked(false) }}
                  placeholder="?"
                  className={`w-24 rounded-lg px-3 py-1 text-center font-bold bg-gray-700 border-2 outline-none
                    ${dmgChecked
                      ? dmgCorrect ? 'border-green-500 text-green-400' : 'border-red-500 text-red-400'
                      : 'border-gray-600 text-white'}`}
                />
                <button onClick={checkDmg} disabled={!dmgInput}
                  className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-40 hover:bg-blue-500">
                  Перевірити
                </button>
                {dmgChecked && !dmgCorrect && (
                  <span className="text-xs text-red-400">≠ {dmgFormula.answer}</span>
                )}
                {dmgCorrect && <span className="text-xs text-green-400">✓ Вірно!</span>}
              </div>
            </div>

            {/* Cost formula */}
            <div>
              <div className="text-xs text-gray-400 mb-1">Загальна вартість (монети):</div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-white text-sm bg-gray-700 rounded-lg px-2 py-1">
                  {costFormula.text} =
                </span>
                <input
                  type="number"
                  value={costInput}
                  onChange={e => { setCostInput(e.target.value); setCostChecked(false) }}
                  placeholder="?"
                  className={`w-24 rounded-lg px-3 py-1 text-center font-bold bg-gray-700 border-2 outline-none
                    ${costChecked
                      ? costCorrect ? 'border-green-500 text-green-400' : 'border-red-500 text-red-400'
                      : 'border-gray-600 text-white'}`}
                />
                <button onClick={checkCost} disabled={!costInput}
                  className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-40 hover:bg-blue-500">
                  Перевірити
                </button>
                {costChecked && !costCorrect && (
                  <span className="text-xs text-red-400">≠ {costFormula.answer}</span>
                )}
                {costCorrect && <span className="text-xs text-green-400">✓ Вірно!</span>}
              </div>
            </div>

            {/* Net damage indicator */}
            {dmgCorrect && (
              <div className={`rounded-xl px-3 py-2 text-sm ${netPerTurn > 0 ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                {netPerTurn > 0
                  ? `✅ Нетто: −${netPerTurn.toLocaleString()} на хід — армія скорочується`
                  : `⚠️ Нетто: +${Math.abs(netPerTurn).toLocaleString()} — армія ще росте! Атакуй сильніше.`}
              </div>
            )}

            {/* Projection */}
            {dmgCorrect && costCorrect && (
              <div>
                <button onClick={() => setProjOpen(v => !v)}
                  className="text-xs text-blue-400 underline">
                  {projOpen ? '▲ Сховати прогноз' : '📊 Показати прогноз на наступні ходи'}
                </button>
                {projOpen && (
                  <div className="mt-2 bg-gray-700 rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-400 border-b border-gray-600">
                          <th className="px-3 py-2 text-left">Хід</th>
                          <th className="px-3 py-2 text-right">Армія</th>
                          <th className="px-3 py-2 text-right">Монети</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projection.slice(0, 8).map((row, i) => (
                          <tr key={i} className={`border-b border-gray-600 ${!row.canAfford ? 'opacity-40' : ''} ${row.army === 0 ? 'bg-green-900' : ''}`}>
                            <td className="px-3 py-1.5 text-gray-300">{currentTurn + i}</td>
                            <td className={`px-3 py-1.5 text-right font-semibold ${row.army === 0 ? 'text-green-400' : 'text-white'}`}>
                              {row.army === 0 ? '0 🎉 Перемога' : row.army.toLocaleString()}
                            </td>
                            <td className={`px-3 py-1.5 text-right ${!row.canAfford ? 'text-red-400' : 'text-yellow-300'}`}>
                              {row.canAfford ? (budgetLeft - totalCost * (i + 1)).toLocaleString() : '⚠️ нема'}
                            </td>
                          </tr>
                        ))}
                        {projection.length === 0 && (
                          <tr><td colSpan={3} className="px-3 py-2 text-center text-red-400">Армія не вдасться перемогти так</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Attack button */}
            <button onClick={attack} disabled={!canAttack}
              className="w-full bg-red-600 text-white rounded-xl py-3 font-bold text-base
                disabled:opacity-40 hover:bg-red-500 transition-colors">
              {!canAttack
                ? !dmgCorrect || !costCorrect ? '⬆ Спочатку обчисли вірно' : totalCost > budgetLeft ? '💸 Не вистачає монет' : 'Оберіть заклинання'
                : `⚔️ АТАКУВАТИ (−${totalCost} монет)`
              }
            </button>
          </div>
        )}

        {!hasSpells && (
          <p className="text-center text-gray-500 text-sm py-2">Обери заклинання вище</p>
        )}

        {/* Hint */}
        <div className="bg-gray-800 rounded-xl px-4 py-2">
          <button onClick={() => setHintOpen(v => !v)} className="text-xs text-yellow-400">
            💡 {hintOpen ? 'Сховати підказку' : 'Підказка'}
          </button>
          {hintOpen && <p className="text-xs text-yellow-300 mt-1">{level.hint}</p>}
        </div>

        {/* Mini history */}
        {history.length > 0 && (
          <div className="bg-gray-800 rounded-xl p-3">
            <p className="text-xs text-gray-500 mb-2 font-semibold uppercase">Попередні ходи</p>
            <div className="space-y-1">
              {[...history].reverse().slice(0, 4).map(r => (
                <div key={r.turn} className="text-xs flex gap-3 text-gray-400">
                  <span className="text-gray-600 shrink-0">Хід {r.turn}</span>
                  <span>{SPELL_ORDER.filter(id => (r.quantities[id] ?? 0) > 0).map(id => `${r.quantities[id]}×${SPELLS[id].emoji}`).join(' ')}</span>
                  <span className="text-red-400 shrink-0">−{r.totalDamage}</span>
                  <span className="text-yellow-400 shrink-0">💰−{r.totalCost}</span>
                  <span className="text-white shrink-0 ml-auto">→ {r.armyAfterGrowth.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
