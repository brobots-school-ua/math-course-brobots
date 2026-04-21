'use client'

import { useState, useMemo } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CarDef {
  id: number
  emoji: string
  clientType: string
  durationHours: number  // can be 0.5, 1, 1.5, 2, ...
}

interface LevelDef {
  id: number
  name: string
  badge: string
  color: string
  story: string
  calcPrice: (hours: number) => number
  rateDesc: string
  formulaHint: (hours: number) => string
  targetMoney: number
  penaltyAmount: number
  hint: string
  cars: CarDef[]
}

interface PlacedCar {
  def: CarDef
  lane: number   // 0–2
  depth: number  // 0 = closest to exit, 2 = deepest
  departureHour: number
  price: number
}

// grid[lane][depth], 3 lanes × 3 depths
type Grid = (PlacedCar | null)[][]

interface EventLog {
  icon: string
  text: string
  color: string
}

// ─── Levels ───────────────────────────────────────────────────────────────────

const LEVELS: LevelDef[] = [
  {
    id: 1,
    name: 'Простий день',
    badge: '🅿️',
    color: 'from-blue-700 to-blue-500',
    story: 'Перша зміна! Тариф: 20 грн за кожну годину. Ставь короткострокові машини ближче до виїзду (глибина 0–1), довгострокові — вглиб (глибина 2).',
    calcPrice: (h) => 20 * h,
    rateDesc: '20 грн/год',
    formulaHint: (h) => `20 × ${h} = ?`,
    targetMoney: 220,
    penaltyAmount: 30,
    hint: 'Машина на глибині 1 або 2 заблокована, якщо перед нею (ближче до виїзду) стоїть інша машина в тому ж ряду.',
    cars: [
      { id: 1, emoji: '🚗', clientType: 'Покупець',   durationHours: 2 },
      { id: 2, emoji: '🚙', clientType: 'Офісний',    durationHours: 4 },
      { id: 3, emoji: '🚗', clientType: 'Відвідувач', durationHours: 1 },
      { id: 4, emoji: '🚕', clientType: 'Таксі',      durationHours: 1 },
      { id: 5, emoji: '🚗', clientType: 'Покупець',   durationHours: 3 },
      { id: 6, emoji: '🚙', clientType: 'Лікар',      durationHours: 2 },
    ],
  },
  {
    id: 2,
    name: 'Тарифна сітка',
    badge: '💰',
    color: 'from-emerald-700 to-emerald-500',
    story: 'Новий тариф: перша година = 30 грн, кожні наступні 30 хв = 12 грн. Тривалість може бути нецілою!',
    calcPrice: (h) => {
      if (h <= 1) return 30
      const extra30 = Math.round((h - 1) * 2)  // extra half-hour blocks
      return 30 + extra30 * 12
    },
    rateDesc: '30 грн/1-а год + 12 грн/кожні 30 хв',
    formulaHint: (h) => {
      if (h <= 1) return `30 грн (до 1 год)`
      const extra = Math.round((h - 1) * 2)
      return `30 + ${extra} × 12 = ?`
    },
    targetMoney: 340,
    penaltyAmount: 40,
    hint: 'Формула: 30 + (кількість зайвих пів-годин) × 12. Наприклад, 2.5 год → 3 зайвих пів-год → 30 + 3×12 = 66 грн.',
    cars: [
      { id: 1, emoji: '🚗', clientType: 'Покупець',   durationHours: 1 },
      { id: 2, emoji: '🚙', clientType: 'Офісний',    durationHours: 3 },
      { id: 3, emoji: '🚗', clientType: 'Відвідувач', durationHours: 1.5 },
      { id: 4, emoji: '🚕', clientType: 'Таксі',      durationHours: 0.5 },
      { id: 5, emoji: '🚙', clientType: 'Лікар',      durationHours: 2.5 },
      { id: 6, emoji: '🚗', clientType: 'Покупець',   durationHours: 2 },
      { id: 7, emoji: '🚗', clientType: 'Відвідувач', durationHours: 1 },
    ],
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyGrid(): Grid {
  return [
    [null, null, null],
    [null, null, null],
    [null, null, null],
  ]
}

function isBlocked(grid: Grid, lane: number, depth: number): boolean {
  for (let d = 0; d < depth; d++) {
    if (grid[lane][d] !== null) return true
  }
  return false
}

function blockingCar(grid: Grid, lane: number, depth: number): PlacedCar | null {
  for (let d = 0; d < depth; d++) {
    if (grid[lane][d] !== null) return grid[lane][d]
  }
  return null
}

function formatHours(h: number): string {
  if (h === 0.5) return '30 хв'
  if (h % 1 === 0) return `${h} год`
  const full = Math.floor(h)
  return `${full} год 30 хв`
}

function makeChoices(correct: number): number[] {
  const spread = Math.max(10, Math.round(correct * 0.3))
  const b = correct + spread
  const c = Math.max(0, correct - spread)
  const arr = [correct, b, c === correct ? correct + spread * 2 : c]
  const r = correct % 3
  return [arr[r % 3], arr[(r + 1) % 3], arr[(r + 2) % 3]]
}

const LANE_LABELS = ['A', 'B', 'C']
const DEPTH_LABELS = ['0 — виїзд', '1 — середина', '2 — глибина']

// ─── Component ────────────────────────────────────────────────────────────────

type Screen = 'levels' | 'game' | 'result'
type Phase = 'select_spot' | 'calculate' | 'blocked_warning'

export default function ParkingGame() {
  const [screen, setScreen]         = useState<Screen>('levels')
  const [levelIdx, setLevelIdx]     = useState(0)
  const [grid, setGrid]             = useState<Grid>(emptyGrid())
  const [carQueueIdx, setCarQueueIdx] = useState(0)
  const [gameHour, setGameHour]     = useState(1)
  const [money, setMoney]           = useState(0)
  const [penalties, setPenalties]   = useState(0)
  const [events, setEvents]         = useState<EventLog[]>([])
  const [phase, setPhase]           = useState<Phase>('select_spot')
  const [selectedSpot, setSelectedSpot] = useState<{ lane: number; depth: number } | null>(null)
  const [priceChoice, setPriceChoice]   = useState<number | null>(null)
  const [hintOpen, setHintOpen]     = useState(false)
  const [result, setResult]         = useState<'won' | 'lost' | null>(null)
  const [infoOpen, setInfoOpen]     = useState(false)

  const level = LEVELS[levelIdx]
  const currentCar = carQueueIdx < level.cars.length ? level.cars[carQueueIdx] : null

  function startLevel(idx: number) {
    setLevelIdx(idx)
    setGrid(emptyGrid())
    setCarQueueIdx(0)
    setGameHour(1)
    setMoney(0)
    setPenalties(0)
    setEvents([])
    setPhase('select_spot')
    setSelectedSpot(null)
    setPriceChoice(null)
    setHintOpen(false)
    setResult(null)
    setScreen('game')
  }

  // ── derived ──────────────────────────────────────────────────────────────

  const correctPrice = currentCar ? level.calcPrice(currentCar.durationHours) : 0
  const priceChoices = useMemo(() => makeChoices(correctPrice), [correctPrice])
  const priceCorrect = priceChoice === correctPrice

  const blockingAtSelected = selectedSpot
    ? blockingCar(grid, selectedSpot.lane, selectedSpot.depth)
    : null
  const selectedIsBlocked = !!blockingAtSelected

  // ── actions ───────────────────────────────────────────────────────────────

  function addEvent(icon: string, text: string, color: string) {
    setEvents(prev => [{ icon, text, color }, ...prev].slice(0, 6))
  }

  function handleSpotClick(lane: number, depth: number) {
    if (phase !== 'select_spot' && phase !== 'blocked_warning') return
    if (!currentCar) return
    if (grid[lane][depth] !== null) return  // occupied

    setSelectedSpot({ lane, depth })
    setPriceChoice(null)

    const blocking = blockingCar(grid, lane, depth)
    if (blocking) {
      setPhase('blocked_warning')
    } else {
      setPhase('select_spot')
    }
  }

  function confirmSpot() {
    // move from blocked_warning to calculate
    setPhase('calculate')
  }

  function cancelSpot() {
    setSelectedSpot(null)
    setPhase('select_spot')
  }

  function confirmPlacement() {
    if (!currentCar || !selectedSpot || !priceCorrect) return

    const { lane, depth } = selectedSpot
    const departureHour = gameHour + currentCar.durationHours
    const placed: PlacedCar = { def: currentCar, lane, depth, departureHour, price: correctPrice }

    // place car on grid
    const newGrid = grid.map(l => [...l]) as Grid
    newGrid[lane][depth] = placed
    setGrid(newGrid)

    addEvent('🚗', `${currentCar.emoji} ${currentCar.clientType} → ряд ${LANE_LABELS[lane]}, місце ${depth}. +${correctPrice} грн`, 'text-green-400')
    setMoney(m => m + correctPrice)

    // advance time to next arrival
    const nextHour = gameHour + 1
    let updatedGrid = newGrid
    let penaltyTotal = 0
    const departureEvents: EventLog[] = []

    // check departures up to nextHour
    for (let l = 0; l < 3; l++) {
      for (let d = 0; d < 3; d++) {
        const car = updatedGrid[l][d]
        if (car && car.departureHour <= nextHour) {
          if (isBlocked(updatedGrid, l, d)) {
            // blocked — can't leave, apply penalty
            penaltyTotal += level.penaltyAmount
            departureEvents.push({
              icon: '🔒',
              text: `${car.def.emoji} ${car.def.clientType} заблокований у ряді ${LANE_LABELS[l]}-${d}! Штраф −${level.penaltyAmount} грн`,
              color: 'text-red-400',
            })
          } else {
            // departs successfully
            const copy = updatedGrid.map(row => [...row]) as Grid
            copy[l][d] = null
            updatedGrid = copy
            departureEvents.push({
              icon: '✅',
              text: `${car.def.emoji} ${car.def.clientType} виїхав з ряду ${LANE_LABELS[l]}-${d}`,
              color: 'text-blue-400',
            })
          }
        }
      }
    }

    setGrid(updatedGrid)
    if (penaltyTotal > 0) setPenalties(p => p + penaltyTotal)
    departureEvents.forEach(e => setEvents(prev => [e, ...prev].slice(0, 6)))

    // advance to next car
    const nextIdx = carQueueIdx + 1
    setCarQueueIdx(nextIdx)
    setGameHour(nextHour)
    setSelectedSpot(null)
    setPriceChoice(null)
    setPhase('select_spot')

    // check if game over
    if (nextIdx >= level.cars.length) {
      // all cars placed — flush remaining departures
      setTimeout(() => {
        const finalMoney = money + correctPrice - penaltyTotal
        setResult(finalMoney - penalties - penaltyTotal >= level.targetMoney ? 'won' : 'lost')
        setScreen('result')
      }, 400)
    }
  }

  // ── grid rendering ────────────────────────────────────────────────────────

  function cellStatus(lane: number, depth: number): 'empty' | 'selected' | 'selected-warning' | 'occupied' | 'blocked-occupied' {
    const car = grid[lane][depth]
    if (car) {
      return isBlocked(grid, lane, depth) ? 'blocked-occupied' : 'occupied'
    }
    if (selectedSpot?.lane === lane && selectedSpot?.depth === depth) {
      return selectedIsBlocked ? 'selected-warning' : 'selected'
    }
    return 'empty'
  }

  const netMoney = money - penalties

  // ── Level select ──────────────────────────────────────────────────────────
  if (screen === 'levels') return (
    <div className="min-h-screen bg-gray-950 p-4 flex flex-col items-center justify-center">
      <div className="max-w-md w-full space-y-4">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🅿️</div>
          <h1 className="text-2xl font-bold text-white">Гра «Паркування»</h1>
          <p className="text-gray-400 text-sm mt-1">Пропорції, дробові тарифи, оптимізація розміщення</p>
        </div>
        {LEVELS.map((lvl, i) => (
          <button key={lvl.id} onClick={() => startLevel(i)}
            className={`w-full rounded-2xl p-5 text-left text-white shadow-lg hover:scale-[1.02] transition-transform bg-gradient-to-r ${lvl.color}`}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">{lvl.badge}</span>
              <div>
                <div className="font-bold text-lg">Рівень {lvl.id}: {lvl.name}</div>
                <div className="text-sm opacity-80">{lvl.rateDesc} · ціль: {lvl.targetMoney} грн · {lvl.cars.length} машин</div>
              </div>
            </div>
            <p className="text-sm opacity-90">{lvl.story}</p>
          </button>
        ))}
      </div>
    </div>
  )

  // ── Result ────────────────────────────────────────────────────────────────
  if (screen === 'result') return (
    <div className="min-h-screen bg-gray-950 p-4">
      <div className="max-w-lg mx-auto space-y-4 pt-6">
        <div className={`rounded-2xl p-6 text-center text-white ${result === 'won' ? 'bg-green-800' : 'bg-red-900'}`}>
          <div className="text-5xl mb-3">{result === 'won' ? '🏆' : '😞'}</div>
          <h2 className="text-2xl font-bold">
            {result === 'won' ? 'Зміна пройшла успішно!' : 'Не вдалось виконати план'}
          </h2>
          <div className="mt-3 space-y-1">
            <div className="bg-white rounded-xl px-4 py-2 inline-block">
              <span className="text-3xl font-bold text-black">{netMoney}</span>
              <span className="text-gray-600 text-lg"> / {level.targetMoney} грн</span>
            </div>
            {penalties > 0 && (
              <p className="text-sm opacity-80">Штрафи за блокування: −{penalties} грн</p>
            )}
          </div>
        </div>

        <div className="bg-gray-800 rounded-2xl p-4">
          <h3 className="text-white font-bold mb-3">📋 Журнал зміни</h3>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {events.map((e, i) => (
              <div key={i} className={`text-sm flex gap-2 ${e.color}`}>
                <span>{e.icon}</span><span>{e.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={() => startLevel(levelIdx)} className="flex-1 bg-blue-600 text-white rounded-2xl py-3 font-semibold hover:bg-blue-700">Повторити</button>
          <button onClick={() => setScreen('levels')} className="flex-1 bg-gray-600 text-white rounded-2xl py-3 font-semibold hover:bg-gray-700">Рівні</button>
        </div>
      </div>
    </div>
  )

  // ── Game ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 p-4">
      <div className="max-w-lg mx-auto space-y-3 pb-6">

        {/* Top bar */}
        <div className="flex items-center justify-between">
          <button onClick={() => setScreen('levels')} className="text-gray-400 hover:text-white text-sm">← Рівні</button>
          <span className="text-white font-bold text-sm">{level.badge} {level.name}</span>
          <span className="text-gray-400 text-sm">Год {gameHour} · {level.rateDesc}</span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-gray-800 rounded-xl p-3 text-center">
            <div className="text-yellow-300 font-bold text-lg">{netMoney} грн</div>
            <div className="text-gray-500 text-xs">з {level.targetMoney} грн</div>
            <div className="w-full bg-gray-700 h-1 rounded-full mt-1 overflow-hidden">
              <div className="h-1 bg-yellow-400 rounded-full transition-all" style={{ width: `${Math.min(100, netMoney / level.targetMoney * 100)}%` }} />
            </div>
          </div>
          <div className="bg-gray-800 rounded-xl p-3 text-center">
            <div className="text-white font-bold text-lg">{carQueueIdx + 1}/{level.cars.length}</div>
            <div className="text-gray-500 text-xs">машина</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-3 text-center">
            <div className={`font-bold text-lg ${penalties > 0 ? 'text-red-400' : 'text-gray-400'}`}>−{penalties} грн</div>
            <div className="text-gray-500 text-xs">штрафи</div>
          </div>
        </div>

        {/* Current car */}
        {currentCar && (
          <div className="bg-gray-800 rounded-2xl p-4">
            <div className="text-gray-400 text-xs font-semibold uppercase mb-2">🚦 Нова машина</div>
            <div className="flex items-center gap-4">
              <span className="text-5xl">{currentCar.emoji}</span>
              <div className="flex-1">
                <div className="text-white font-bold text-lg">{currentCar.clientType}</div>
                <div className="text-gray-400 text-sm">Паркується на <span className="text-yellow-300 font-semibold">{formatHours(currentCar.durationHours)}</span></div>
                <div className="text-gray-500 text-xs mt-0.5">Виїзд через {formatHours(currentCar.durationHours)} (год {gameHour + currentCar.durationHours})</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500">вартість</div>
                <div className="text-green-400 font-bold text-xl">{correctPrice} грн</div>
              </div>
            </div>
          </div>
        )}

        {!currentCar && (
          <div className="bg-gray-700 rounded-2xl p-4 text-center text-gray-300">
            Всі машини розставлені! Зміна завершується...
          </div>
        )}

        {/* Parking grid */}
        <div className="bg-gray-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-400 text-xs font-semibold uppercase">Схема паркінгу</span>
            <div className="flex items-center gap-1 text-xs text-green-400 font-semibold">
              <span>← ВИЇЗД (глибина 0)</span>
            </div>
          </div>

          {/* Depth labels */}
          <div className="grid grid-cols-3 gap-2 mb-1 ml-8">
            {['0 — виїзд', '1 — середина', '2 — глибина'].map((l, d) => (
              <div key={d} className="text-center text-xs text-gray-500">{l}</div>
            ))}
          </div>

          {/* Grid rows = lanes */}
          <div className="space-y-2">
            {[0, 1, 2].map(lane => (
              <div key={lane} className="flex items-center gap-2">
                <span className="text-gray-400 font-bold text-sm w-6 text-center">{LANE_LABELS[lane]}</span>
                <div className="grid grid-cols-3 gap-2 flex-1">
                  {[0, 1, 2].map(depth => {
                    const status = cellStatus(lane, depth)
                    const car = grid[lane][depth]

                    const baseStyle = 'rounded-xl p-2 min-h-[64px] flex flex-col items-center justify-center transition-all text-xs'
                    const styles: Record<string, string> = {
                      'empty': 'bg-gray-700 border-2 border-dashed border-gray-600 hover:border-green-500 hover:bg-gray-600 cursor-pointer',
                      'selected': 'bg-green-900 border-2 border-green-400 cursor-pointer shadow-lg shadow-green-900',
                      'selected-warning': 'bg-orange-900 border-2 border-orange-400 cursor-pointer',
                      'occupied': 'bg-gray-700 border-2 border-gray-600',
                      'blocked-occupied': 'bg-red-950 border-2 border-red-800',
                    }

                    return (
                      <div
                        key={depth}
                        className={`${baseStyle} ${styles[status]}`}
                        onClick={() => status === 'empty' || status === 'selected' || status === 'selected-warning'
                          ? handleSpotClick(lane, depth) : undefined}
                      >
                        {car ? (
                          <>
                            <span className="text-2xl leading-none">{car.def.emoji}</span>
                            <span className="text-gray-300 mt-0.5">{car.def.clientType}</span>
                            <span className="text-yellow-300 font-semibold">→год {car.departureHour}</span>
                            {status === 'blocked-occupied' && (
                              <span className="text-red-400 text-xs font-bold">🔒 блок</span>
                            )}
                          </>
                        ) : status === 'selected' ? (
                          <span className="text-green-400 font-bold text-base">✓</span>
                        ) : status === 'selected-warning' ? (
                          <span className="text-orange-400 font-bold">⚠️</span>
                        ) : (
                          <span className="text-gray-600 text-base">+</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Blocking legend */}
          <div className="mt-3 flex gap-3 text-xs text-gray-500 flex-wrap">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-600 inline-block border border-dashed border-gray-500"></span> вільне</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-900 inline-block border border-green-400"></span> вибране</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-700 inline-block border border-gray-600"></span> зайняте</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-950 inline-block border border-red-800"></span> заблоковане</span>
          </div>
        </div>

        {/* Blocking warning */}
        {phase === 'blocked_warning' && selectedSpot && blockingAtSelected && (
          <div className="bg-orange-900 rounded-2xl p-4">
            <div className="text-orange-300 font-bold mb-1">⚠️ Увага: ця машина буде заблокована!</div>
            <p className="text-sm text-orange-200">
              Перед місцем {LANE_LABELS[selectedSpot.lane]}-{selectedSpot.depth} стоїть{' '}
              <strong>{blockingAtSelected.def.emoji} {blockingAtSelected.def.clientType}</strong>{' '}
              (виїзд год {blockingAtSelected.departureHour}). Якщо твоя машина виїжджатиме раніше — отримаєш штраф −{level.penaltyAmount} грн.
            </p>
            <p className="text-xs text-orange-300 mt-1">
              Твоя машина: виїзд год {gameHour + currentCar!.durationHours}.{' '}
              {gameHour + currentCar!.durationHours <= blockingAtSelected.departureHour
                ? '⛔ НЕБЕЗПЕЧНО: виїжджаєш раніше за блокуючу!'
                : '✅ Виїжджаєш пізніше — блокування не буде.'}
            </p>
            <div className="flex gap-2 mt-3">
              <button onClick={confirmSpot} className="flex-1 bg-orange-600 text-white rounded-xl py-2 text-sm font-semibold">Все одно поставити</button>
              <button onClick={cancelSpot} className="flex-1 bg-gray-600 text-white rounded-xl py-2 text-sm">Обрати інше місце</button>
            </div>
          </div>
        )}

        {/* Price calculation */}
        {(phase === 'select_spot' || phase === 'calculate') && selectedSpot && !selectedIsBlocked && currentCar && (
          <div className="bg-gray-800 rounded-2xl p-4 space-y-3">
            <div className="text-white font-semibold text-sm">
              🧮 Порахуй вартість паркування
            </div>
            <div className="bg-gray-700 rounded-xl px-4 py-2 font-mono text-sm text-center text-gray-300">
              {level.formulaHint(currentCar.durationHours)}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {priceChoices.map(opt => {
                const isCorrect = opt === correctPrice
                const isChosen = priceChoice === opt
                let cls = 'bg-gray-700 text-white hover:bg-gray-600'
                if (priceChoice !== null) {
                  if (isCorrect) cls = 'bg-green-700 text-white ring-2 ring-green-400'
                  else if (isChosen) cls = 'bg-red-700 text-white'
                  else cls = 'bg-gray-700 text-gray-500'
                }
                return (
                  <button key={opt} onClick={() => setPriceChoice(opt)}
                    disabled={priceCorrect}
                    className={`py-4 rounded-xl font-bold text-xl transition-all ${cls}`}
                  >
                    {opt} грн
                  </button>
                )
              })}
            </div>
            {priceCorrect && (
              <p className="text-xs text-green-400">✓ Правильно! {currentCar.clientType} платить {correctPrice} грн.</p>
            )}
            {priceChoice !== null && !priceCorrect && (
              <p className="text-xs text-red-400">Не вірно. Порахуй ще раз: {level.formulaHint(currentCar.durationHours)}</p>
            )}
          </div>
        )}

        {/* Confirm button */}
        {currentCar && selectedSpot && phase !== 'blocked_warning' && (
          <button
            onClick={confirmPlacement}
            disabled={!priceCorrect}
            className={`w-full rounded-2xl py-4 font-bold text-base transition-all ${
              priceCorrect
                ? 'bg-green-600 text-white hover:bg-green-500 shadow-lg shadow-green-900'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            {priceCorrect
              ? `✅ Поставити машину → ряд ${LANE_LABELS[selectedSpot.lane]}, глибина ${selectedSpot.depth} (+${correctPrice} грн)`
              : selectedSpot ? '⬆ Порахуй вартість' : '⬆ Обери місце на схемі'}
          </button>
        )}

        {!selectedSpot && currentCar && phase !== 'blocked_warning' && (
          <div className="bg-gray-700 rounded-2xl py-4 text-center text-gray-400 text-sm">
            👆 Тисни на вільне місце у схемі паркінгу вище
          </div>
        )}

        {/* Hint */}
        <div className="bg-gray-800 rounded-xl px-4 py-2">
          <button onClick={() => setHintOpen(v => !v)} className="text-xs text-yellow-400">
            💡 {hintOpen ? 'Сховати підказку' : 'Підказка'}
          </button>
          {hintOpen && <p className="text-xs text-yellow-300 mt-1">{level.hint}</p>}
        </div>

        {/* Recent events */}
        {events.length > 0 && (
          <div className="bg-gray-800 rounded-xl p-3 space-y-1">
            <div className="text-xs text-gray-500 font-semibold uppercase mb-1">Останні події</div>
            {events.slice(0, 3).map((e, i) => (
              <div key={i} className={`text-xs flex gap-2 ${e.color}`}>
                <span>{e.icon}</span><span>{e.text}</span>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
