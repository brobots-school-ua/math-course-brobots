'use client'

import { useState, useMemo } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type SpellId = 'arrows' | 'fireball' | 'blizzard' | 'lightning'

interface SpellDef {
  name: string; emoji: string; mana: number; damage: number; special?: string
}

const SPELLS: Record<SpellId, SpellDef> = {
  arrows:    { name: 'Стріли',       emoji: '🏹', mana: 20,  damage: 70  },
  fireball:  { name: 'Вогняна куля', emoji: '🔥', mana: 55,  damage: 210 },
  blizzard:  { name: 'Крижана буря', emoji: '❄️', mana: 80,  damage: 280, special: 'Ріст армії ÷2 наступний хід' },
  lightning: { name: 'Блискавка',    emoji: '⚡', mana: 110, damage: 420 },
}

type Growth = { type: 'linear'; amount: number } | { type: 'exponential'; rate: number }

interface LevelDef {
  id: number; name: string; badge: string; color: string
  story: string
  initialArmy: number
  growth: Growth
  manaPerTurn: number
  turns: number
  spells: SpellId[]
  growthLabel: string
  formula: string
  hint: string
}

const LEVELS: LevelDef[] = [
  {
    id: 1, name: 'Лінійне вторгнення', badge: '⚔️', color: 'bg-blue-600',
    story: 'Армія марширує рівномірно — щохода підходить підкріплення +160 солдатів. Зупини їх за 10 ходів!',
    initialArmy: 1200,
    growth: { type: 'linear', amount: 160 },
    manaPerTurn: 200, turns: 10,
    spells: ['arrows', 'fireball'],
    growthLabel: '+160 солдатів / хід',
    formula: 'армія(t) = 1200 + 160×t − завдана_шкода',
    hint: 'Якщо твоя сумарна шкода за хід < 160 — армія тільки росте. Стріли самі не допоможуть!',
  },
  {
    id: 2, name: 'Прискорення', badge: '🏃', color: 'bg-orange-500',
    story: 'Ворог прискорюється — +300 на хід! Вогняної кулі вже не вистачає. Але Крижана буря уповільнює ріст вдвічі.',
    initialArmy: 2000,
    growth: { type: 'linear', amount: 300 },
    manaPerTurn: 250, turns: 10,
    spells: ['arrows', 'fireball', 'blizzard'],
    growthLabel: '+300 солдатів / хід',
    formula: 'армія(t) = 2000 + 300×t − завдана_шкода',
    hint: 'Після Крижаної бурі ріст наступного ходу = +150. Продумай коли її кидати.',
  },
  {
    id: 3, name: 'Показниковий ріст', badge: '💀', color: 'bg-red-600',
    story: 'Армія подвоюється щохода! Кожен хід зволікання — катастрофа. Дій на повну з першого ходу!',
    initialArmy: 2000,
    growth: { type: 'exponential', rate: 1.8 },
    manaPerTurn: 300, turns: 8,
    spells: ['arrows', 'fireball', 'blizzard', 'lightning'],
    growthLabel: '×1.8 щохода',
    formula: 'армія(t) = 2000 × 1.8^t − завдана_шкода',
    hint: 'Якщо не бити на максимум — армія виросте швидше ніж ти встигнеш. 2000 → 3600 → 6480 → неможливо!',
  },
]

// ─── Math helpers ─────────────────────────────────────────────────────────────

function calcGrowth(army: number, g: Growth, slow: boolean): number {
  if (g.type === 'linear') return slow ? Math.floor(g.amount / 2) : g.amount
  const rate = slow ? 1 + (g.rate - 1) / 2 : g.rate
  return Math.round(army * rate) - army
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ArmyBar({ current, max }: { current: number; max: number }) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100))
  const color = pct > 60 ? 'bg-red-500' : pct > 30 ? 'bg-orange-400' : 'bg-yellow-400'
  return (
    <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
      <div className={`h-4 rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function CastleRoad({ turnsLeft, totalTurns }: { turnsLeft: number; totalTurns: number }) {
  const steps = totalTurns
  const armyStep = totalTurns - turnsLeft
  return (
    <div className="flex items-center gap-1 py-2">
      <span className="text-2xl shrink-0">⚔️</span>
      <div className="flex-1 flex items-center gap-0.5">
        {Array.from({ length: steps }, (_, i) => (
          <div key={i} className={`flex-1 h-2 rounded-sm ${
            i < armyStep ? 'bg-red-400' : i === armyStep ? 'bg-red-600' : 'bg-gray-200'
          }`} />
        ))}
      </div>
      <span className="text-2xl shrink-0">🏰</span>
    </div>
  )
}

interface TurnRecord {
  turn: number; armyBefore: number; spells: SpellId[]
  damage: number; armyAfterAttack: number
  growthAmt: number; armyAfterGrowth: number
  manaUsed: number; wasSlow: boolean; won: boolean
}

// ─── Main game ────────────────────────────────────────────────────────────────

type Screen = 'levels' | 'game' | 'result'

export default function ArmyGame() {
  const [screen, setScreen] = useState<Screen>('levels')
  const [levelIdx, setLevelIdx] = useState(0)
  const [army, setArmy] = useState(0)
  const [turnsLeft, setTurnsLeft] = useState(0)
  const [selectedSpells, setSelectedSpells] = useState<Set<SpellId>>(new Set())
  const [history, setHistory] = useState<TurnRecord[]>([])
  const [slowNextTurn, setSlowNextTurn] = useState(false)
  const [hintOpen, setHintOpen] = useState(false)
  const [result, setResult] = useState<'won' | 'lost' | null>(null)

  const level = LEVELS[levelIdx]

  function startLevel(idx: number) {
    const lvl = LEVELS[idx]
    setLevelIdx(idx)
    setArmy(lvl.initialArmy)
    setTurnsLeft(lvl.turns)
    setSelectedSpells(new Set())
    setHistory([])
    setSlowNextTurn(false)
    setHintOpen(false)
    setResult(null)
    setScreen('game')
  }

  function toggleSpell(id: SpellId) {
    setSelectedSpells(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const manaUsed = useMemo(
    () => [...selectedSpells].reduce((s, id) => s + SPELLS[id].mana, 0),
    [selectedSpells]
  )
  const damage = useMemo(
    () => [...selectedSpells].reduce((s, id) => s + SPELLS[id].damage, 0),
    [selectedSpells]
  )

  function attack() {
    if (selectedSpells.size === 0) return
    const armyBefore = army
    const afterAttack = Math.max(0, army - damage)
    const usedBlizzard = selectedSpells.has('blizzard')
    const growthAmt = calcGrowth(afterAttack, level.growth, slowNextTurn)
    const afterGrowth = afterAttack > 0 ? afterAttack + growthAmt : 0
    const won = afterAttack === 0

    const record: TurnRecord = {
      turn: level.turns - turnsLeft + 1,
      armyBefore, spells: [...selectedSpells],
      damage, armyAfterAttack: afterAttack,
      growthAmt, armyAfterGrowth: afterGrowth,
      manaUsed, wasSlow: slowNextTurn, won,
    }

    setHistory(prev => [...prev, record])

    if (won) {
      setArmy(0)
      setResult('won')
      setScreen('result')
      return
    }

    const newTurns = turnsLeft - 1
    if (newTurns === 0) {
      setArmy(afterGrowth)
      setResult('lost')
      setScreen('result')
      return
    }

    setArmy(afterGrowth)
    setTurnsLeft(newTurns)
    setSlowNextTurn(usedBlizzard)
    setSelectedSpells(new Set())
  }

  // Score
  const turnsUsed = history.length
  const score = result === 'won'
    ? Math.round(60 + 25 * ((level.turns - turnsUsed) / level.turns) + 15 * (levelIdx / 2))
    : 0

  // ── Level select ──────────────────────────────────────────────────────────
  if (screen === 'levels') return (
    <div className="min-h-screen bg-gray-900 p-4 flex flex-col items-center justify-center">
      <div className="max-w-md w-full space-y-4">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🏰</div>
          <h1 className="text-2xl font-bold text-white">Зупини Армію</h1>
          <p className="text-gray-400 text-sm mt-1">Модуль 6 · Лінійні та показникові функції</p>
        </div>
        {LEVELS.map((lvl, i) => (
          <button key={lvl.id} onClick={() => startLevel(i)}
            className={`w-full rounded-2xl p-4 text-left text-white shadow-lg hover:scale-105 transition-transform ${lvl.color}`}
          >
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl">{lvl.badge}</span>
              <div>
                <div className="font-bold">Рівень {lvl.id}: {lvl.name}</div>
                <div className="text-sm opacity-80">{lvl.growthLabel} · {lvl.turns} ходів · {lvl.manaPerTurn} мани/хід</div>
              </div>
            </div>
            <p className="text-sm opacity-90 mt-2">{lvl.story}</p>
          </button>
        ))}
      </div>
    </div>
  )

  // ── Result ────────────────────────────────────────────────────────────────
  if (screen === 'result') return (
    <div className="min-h-screen bg-gray-900 p-4">
      <div className="max-w-lg mx-auto space-y-4">
        <div className={`rounded-2xl p-6 text-center text-white ${result === 'won' ? 'bg-green-700' : 'bg-red-800'}`}>
          <div className="text-5xl mb-3">{result === 'won' ? '🏆' : '💀'}</div>
          <h2 className="text-2xl font-bold">
            {result === 'won' ? 'Замок врятовано!' : 'Замок захоплено...'}
          </h2>
          {result === 'won' && (
            <div className="mt-3 bg-white bg-opacity-20 rounded-xl px-4 py-2 inline-block">
              <span className="text-3xl font-bold">{score}</span>
              <span className="text-lg"> / 100 балів</span>
            </div>
          )}
          {result === 'lost' && (
            <p className="text-sm mt-2 opacity-80">
              Залишилось {army.toLocaleString('uk')} солдатів.
              Спробуй більше шкоди щохода!
            </p>
          )}
        </div>

        {/* Turn-by-turn breakdown */}
        <div className="bg-gray-800 rounded-2xl p-4">
          <h3 className="text-white font-bold mb-3">📜 Хід бою</h3>
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {history.map(r => (
              <div key={r.turn} className={`rounded-xl p-3 text-sm ${r.won ? 'bg-green-900' : 'bg-gray-700'}`}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-gray-300 font-semibold">Хід {r.turn}</span>
                  <span className="text-gray-400">🔋 {r.manaUsed}/{level.manaPerTurn} мани</span>
                </div>
                <div className="text-white">
                  ⚔️ {r.spells.map(s => SPELLS[s].emoji).join(' ')} → шкода: <strong>−{r.damage}</strong>
                  {r.wasSlow && <span className="text-teal-400 text-xs ml-1">(крижана: ріст ÷2)</span>}
                </div>
                <div className="text-gray-300 text-xs mt-1">
                  {r.armyBefore.toLocaleString('uk')} − {r.damage} = {r.armyAfterAttack.toLocaleString('uk')}
                  {!r.won && (
                    <>
                      <span className="text-red-400">
                        {level.growth.type === 'linear' ? ` + ${r.growthAmt}` : ` × (${level.growth.type === 'exponential' ? level.growth.rate : '?'} → +${r.growthAmt})`}
                      </span>
                      {' = '}
                      <strong className="text-white">{r.armyAfterGrowth.toLocaleString('uk')}</strong>
                    </>
                  )}
                  {r.won && <span className="text-green-400 font-bold"> → 0 ✓ ПЕРЕМОГА!</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Math explanation */}
        <div className="bg-gray-800 rounded-2xl p-4">
          <h3 className="text-white font-bold mb-3">📐 Математика рівня</h3>
          <div className="text-sm text-gray-300 space-y-2">
            <div className="bg-gray-700 rounded-lg p-3 font-mono text-xs">
              {level.formula}
            </div>
            {level.growth.type === 'linear' ? (
              <>
                <p>🔹 <strong className="text-white">Лінійна функція</strong>: щохода армія зростає на однакове число.</p>
                <p>🔹 Щоб перемогти, твоя шкода за хід повинна бути <strong className="text-yellow-400">більша за {(level.growth as {type:'linear';amount:number}).amount}</strong>.</p>
                <p>🔹 Нетто-зменшення = шкода − ріст. Якщо воно &gt; 0, ти перемагаєш.</p>
              </>
            ) : (
              <>
                <p>🔹 <strong className="text-white">Показникова функція</strong>: армія множиться на {(level.growth as {type:'exponential';rate:number}).rate} щохода.</p>
                <p>🔹 Через 4 ходи без атаки: 2000 × 1.8⁴ = <strong className="text-red-400">{Math.round(2000 * 1.8 ** 4).toLocaleString('uk')}</strong> солдатів!</p>
                <p>🔹 Показниковий ріст обганяє будь-які лінійні атаки. Треба бити якомога раніше й сильніше.</p>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={() => startLevel(levelIdx)}
            className="flex-1 bg-blue-600 text-white rounded-2xl py-3 font-semibold hover:bg-blue-700">
            Повторити рівень
          </button>
          <button onClick={() => setScreen('levels')}
            className="flex-1 bg-gray-600 text-white rounded-2xl py-3 font-semibold hover:bg-gray-700">
            Вибрати рівень
          </button>
        </div>
      </div>
    </div>
  )

  // ── Game screen ───────────────────────────────────────────────────────────
  const currentTurn = level.turns - turnsLeft + 1
  const maxArmy = level.initialArmy * (level.growth.type === 'linear' ? 3 : 5)
  const netDamage = damage - (slowNextTurn
    ? calcGrowth(army - damage, level.growth, true)
    : calcGrowth(army - damage, level.growth, false))

  return (
    <div className="min-h-screen bg-gray-900 p-4 pb-4">
      <div className="max-w-lg mx-auto space-y-3">

        {/* Header */}
        <div className="flex items-center justify-between">
          <button onClick={() => setScreen('levels')} className="text-gray-400 hover:text-white text-sm">
            ← Рівні
          </button>
          <div className="text-center">
            <span className="text-white font-bold">{level.badge} Рівень {level.id}: {level.name}</span>
          </div>
          <div className="text-gray-400 text-sm">Хід {currentTurn}/{level.turns}</div>
        </div>

        {/* Castle road */}
        <div className="bg-gray-800 rounded-2xl p-4">
          <CastleRoad turnsLeft={turnsLeft} totalTurns={level.turns} />
          <div className="text-center text-xs text-gray-400 mt-1">
            До замку: {turnsLeft} {turnsLeft === 1 ? 'хід' : turnsLeft < 5 ? 'ходи' : 'ходів'}
          </div>
        </div>

        {/* Army status */}
        <div className="bg-gray-800 rounded-2xl p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-300 text-sm font-semibold">⚔️ АРМІЯ</span>
            <span className="text-red-400 font-bold text-xl">{army.toLocaleString('uk')}</span>
          </div>
          <ArmyBar current={army} max={maxArmy} />
          <div className="flex justify-between mt-2 text-xs">
            <span className="text-gray-500">Ріст: <span className="text-red-400 font-semibold">{level.growthLabel}</span></span>
            {slowNextTurn && <span className="text-teal-400">❄️ Цей хід ріст ÷2!</span>}
          </div>
          {/* Formula */}
          <div className="mt-2 bg-gray-700 rounded-lg px-3 py-1.5 text-xs font-mono text-gray-300">
            {level.formula}
          </div>
        </div>

        {/* Hint */}
        <div className="bg-gray-800 rounded-xl px-4 py-2">
          <button onClick={() => setHintOpen(v => !v)} className="text-xs text-yellow-400">
            💡 {hintOpen ? 'Сховати підказку' : 'Підказка'}
          </button>
          {hintOpen && <p className="text-xs text-yellow-300 mt-1">{level.hint}</p>}
        </div>

        {/* Spell selection */}
        <div className="bg-gray-800 rounded-2xl p-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-gray-300 text-sm font-semibold">🔮 ЗАКЛИНАННЯ</span>
            <span className="text-sm">
              <span className={manaUsed > level.manaPerTurn ? 'text-red-400 font-bold' : 'text-blue-400'}>
                {manaUsed}
              </span>
              <span className="text-gray-500"> / {level.manaPerTurn} мани</span>
            </span>
          </div>

          {/* Mana bar */}
          <div className="w-full bg-gray-700 rounded-full h-2 mb-3 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all ${manaUsed > level.manaPerTurn ? 'bg-red-500' : 'bg-blue-500'}`}
              style={{ width: `${Math.min(100, (manaUsed / level.manaPerTurn) * 100)}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {level.spells.map(id => {
              const sp = SPELLS[id]
              const sel = selectedSpells.has(id)
              const wouldExceed = !sel && manaUsed + sp.mana > level.manaPerTurn
              return (
                <button key={id} onClick={() => toggleSpell(id)}
                  disabled={wouldExceed}
                  className={`rounded-xl p-3 text-left border-2 transition-all ${
                    sel
                      ? 'bg-blue-700 border-blue-400 text-white'
                      : wouldExceed
                      ? 'bg-gray-750 border-gray-700 text-gray-600 cursor-not-allowed'
                      : 'bg-gray-700 border-gray-600 text-gray-200 hover:border-gray-400'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{sp.emoji}</span>
                    <span className="font-semibold text-sm">{sp.name}</span>
                    {sel && <span className="ml-auto text-xs bg-blue-500 px-1.5 py-0.5 rounded-full">✓</span>}
                  </div>
                  <div className="text-xs flex gap-3">
                    <span className="text-blue-300">🔋 {sp.mana} мани</span>
                    <span className="text-red-300">⚔️ −{sp.damage}</span>
                  </div>
                  {sp.special && <div className="text-xs text-teal-300 mt-1">❄️ {sp.special}</div>}
                </button>
              )
            })}
          </div>
        </div>

        {/* Attack preview + button */}
        {selectedSpells.size > 0 && (
          <div className="bg-gray-800 rounded-2xl p-4">
            <div className="text-sm text-gray-300 space-y-1 mb-3">
              <div className="flex justify-between">
                <span>Шкода цього ходу</span>
                <span className="text-red-400 font-bold">−{damage.toLocaleString('uk')}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Армія після атаки</span>
                <span className="text-white">{Math.max(0, army - damage).toLocaleString('uk')}</span>
              </div>
              {army - damage > 0 && (
                <div className="flex justify-between text-xs">
                  <span className={slowNextTurn ? 'text-teal-400' : 'text-gray-500'}>
                    + ріст {slowNextTurn ? '(÷2!)' : ''}
                  </span>
                  <span className="text-red-400">
                    +{calcGrowth(Math.max(0, army - damage), level.growth, slowNextTurn).toLocaleString('uk')}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t border-gray-700 pt-1">
                <span className="text-gray-400">Армія наступного ходу</span>
                <span className={netDamage >= 0 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                  {Math.max(0, army - damage) > 0
                    ? (army - damage + calcGrowth(Math.max(0, army - damage), level.growth, slowNextTurn)).toLocaleString('uk')
                    : '0 🎉'}
                </span>
              </div>
              {army - damage > 0 && (
                <div className={`text-xs text-center py-1 rounded-lg ${netDamage > 0 ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                  {netDamage > 0
                    ? `✅ Нетто: −${netDamage.toLocaleString('uk')} — армія скорочується`
                    : `⚠️ Нетто: +${Math.abs(netDamage).toLocaleString('uk')} — армія ще росте!`}
                </div>
              )}
            </div>
            <button onClick={attack}
              disabled={manaUsed > level.manaPerTurn}
              className="w-full bg-red-600 text-white rounded-xl py-3 font-bold text-base
                disabled:opacity-40 hover:bg-red-700 transition-colors"
            >
              ⚔️ АТАКУВАТИ ({[...selectedSpells].map(s => SPELLS[s].emoji).join('')})
            </button>
          </div>
        )}

        {selectedSpells.size === 0 && (
          <div className="text-center text-gray-500 text-sm py-2">
            Обери заклинання вище щоб атакувати
          </div>
        )}

        {/* Mini history */}
        {history.length > 0 && (
          <div className="bg-gray-800 rounded-2xl p-3">
            <p className="text-xs text-gray-500 mb-2 font-semibold">ІСТОРІЯ ХОДІВ</p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {[...history].reverse().map(r => (
                <div key={r.turn} className="text-xs text-gray-400 flex gap-3">
                  <span className="text-gray-600">Хід {r.turn}</span>
                  <span>{r.spells.map(s => SPELLS[s].emoji).join('')} −{r.damage}</span>
                  <span className="text-red-400">→ {r.armyAfterGrowth.toLocaleString('uk')}</span>
                  {r.wasSlow && <span className="text-teal-400">❄️</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
