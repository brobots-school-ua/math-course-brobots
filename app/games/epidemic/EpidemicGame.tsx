'use client'

import { useState, useMemo } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LevelDef {
  id: number; name: string; badge: string; color: string
  story: string
  N: number           // загальне населення
  I0: number          // початок: заражені
  R0: number          // базове число відтворення
  recovery: number    // частка одужання за хід (0.25 = 25%/хід)
  totalBudget: number
  vaccCost: number    // монет за 1 вакцину
  maxVaccPerTurn: number
  hospitalCap: number
  turns: number
  vaccEff: number     // ефективність вакцини (0–1)
  hasQuarantine: boolean
  quarantineCost: number
  hint: string
}

const LEVELS: LevelDef[] = [
  {
    id: 1, name: 'Спалах', badge: '🤧', color: 'from-yellow-700 to-yellow-500',
    story: 'У місті 500 мешканців. Виявлено 5 заражених вірусом із R₀=1.5. Зупини епідемію вакцинацією — поки лікарня не переповнена!',
    N: 500, I0: 5, R0: 1.5, recovery: 0.3,
    totalBudget: 600, vaccCost: 2, maxVaccPerTurn: 60,
    hospitalCap: 120, turns: 15, vaccEff: 1.0,
    hasQuarantine: false, quarantineCost: 0,
    hint: 'Чи встигає лікарня прийняти всіх? Що станеться якщо I × R₀ > I?',
  },
  {
    id: 2, name: 'Пандемія', badge: '😷', color: 'from-orange-700 to-orange-500',
    story: '2000 мешканців. R₀=2.5 — вірус набагато заразніший. Одних вакцин може не вистачити: є можливість ввести карантин.',
    N: 2000, I0: 20, R0: 2.5, recovery: 0.25,
    totalBudget: 2000, vaccCost: 2, maxVaccPerTurn: 150,
    hospitalCap: 300, turns: 18, vaccEff: 1.0,
    hasQuarantine: true, quarantineCost: 120,
    hint: 'Карантин знижує R₀ вдвічі на один хід. Коли вигідно його вводити?',
  },
  {
    id: 3, name: 'Суперзбудник', badge: '☣️', color: 'from-red-800 to-red-600',
    story: '5000 мешканців. R₀=4. Але вакцина спрацьовує лише у 80% випадків. Рахуй уважно — помилка коштує дорого.',
    N: 5000, I0: 50, R0: 4, recovery: 0.2,
    totalBudget: 4000, vaccCost: 2, maxVaccPerTurn: 250,
    hospitalCap: 400, turns: 22, vaccEff: 0.8,
    hasQuarantine: true, quarantineCost: 200,
    hint: 'Скільки людей реально стануть імунними якщо дати 100 вакцин при ефективності 80%?',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcNewInfected(I: number, R0: number, S: number, N: number): number {
  return Math.round(I * R0 * S / N)
}

function calcReff(R0: number, S: number, N: number): number {
  return Math.round(R0 * S / N * 100) / 100
}

interface Pop { S: number; I: number; R: number; V: number }

interface TurnRecord {
  turn: number
  before: Pop
  vaccinesGiven: number
  effectiveImmune: number
  quarantineUsed: boolean
  R0used: number
  newInfected: number
  recovered: number
  after: Pop
  cost: number
  hospitalPct: number
}

// ─── Component ────────────────────────────────────────────────────────────────

type Screen = 'levels' | 'game' | 'result'

export default function EpidemicGame() {
  const [screen, setScreen] = useState<Screen>('levels')
  const [levelIdx, setLevelIdx] = useState(0)
  const [pop, setPop] = useState<Pop>({ S: 0, I: 0, R: 0, V: 0 })
  const [turnsLeft, setTurnsLeft] = useState(0)
  const [budgetLeft, setBudgetLeft] = useState(0)
  const [history, setHistory] = useState<TurnRecord[]>([])
  const [hintOpen, setHintOpen] = useState(false)

  // Player inputs this turn
  const [vaccInput, setVaccInput] = useState('')
  const [quarantine, setQuarantine] = useState(false)

  // Manual calculation fields
  const [calcI, setCalcI] = useState('')
  const [calcR0, setCalcR0] = useState('')
  const [calcS, setCalcS] = useState('')
  const [calcN, setCalcN] = useState('')
  const [calcResult, setCalcResult] = useState('')
  const [calcChecked, setCalcChecked] = useState(false)

  // Level 3 extra: vaccine effectiveness calculation
  const [calcVaccEff, setCalcVaccEff] = useState('')
  const [calcVaccEffChecked, setCalcVaccEffChecked] = useState(false)

  const [result, setResult] = useState<'won' | 'lost_hospital' | 'lost_time' | null>(null)

  const level = LEVELS[levelIdx]

  function startLevel(idx: number) {
    const lvl = LEVELS[idx]
    setLevelIdx(idx)
    setPop({ S: lvl.N - lvl.I0, I: lvl.I0, R: 0, V: 0 })
    setTurnsLeft(lvl.turns)
    setBudgetLeft(lvl.totalBudget)
    setHistory([])
    resetInputs()
    setResult(null)
    setScreen('game')
  }

  function resetInputs() {
    setVaccInput('')
    setQuarantine(false)
    setCalcI(''); setCalcR0(''); setCalcS(''); setCalcN(''); setCalcResult('')
    setCalcChecked(false)
    setCalcVaccEff(''); setCalcVaccEffChecked(false)
    setHintOpen(false)
  }

  const vaccCount = Math.max(0, Math.min(
    parseInt(vaccInput) || 0,
    level.maxVaccPerTurn,
    Math.floor(budgetLeft / level.vaccCost),
    pop.S
  ))
  const vaccCostThisTurn = vaccCount * level.vaccCost
  const effectiveImmune = Math.round(vaccCount * level.vaccEff)
  const quarantineCost = quarantine ? level.quarantineCost : 0
  const totalCostThisTurn = vaccCostThisTurn + quarantineCost
  const R0effective = quarantine ? level.R0 / 2 : level.R0

  // New S after vaccination (before infection spread)
  const newS = pop.S - effectiveImmune
  const newV = pop.V + effectiveImmune
  const expectedNewInfected = calcNewInfected(pop.I, R0effective, newS, level.N)
  const Reff = calcReff(R0effective, newS, level.N)

  // Manual calc validation (tolerance ±1 for rounding)
  const formulaFilled = calcI && calcR0 && calcS && calcN && calcResult
  const formulaCorrect = formulaFilled &&
    Math.abs(parseInt(calcResult) - expectedNewInfected) <= 1 &&
    parseInt(calcI) === pop.I &&
    parseFloat(calcR0) === R0effective &&
    parseInt(calcS) === newS &&
    parseInt(calcN) === level.N

  const vaccEffFilled = level.vaccEff < 1 ? !!calcVaccEff : true
  const vaccEffCorrect = level.vaccEff < 1
    ? calcVaccEffChecked && Math.abs(parseInt(calcVaccEff) - effectiveImmune) <= 1
    : true

  const canConfirm = formulaCorrect && vaccEffCorrect && totalCostThisTurn <= budgetLeft

  function confirmTurn() {
    if (!canConfirm) return

    const newInfected = expectedNewInfected
    const recovered = Math.round(pop.I * level.recovery)
    const afterI = Math.max(0, pop.I + newInfected - recovered)
    const afterS = Math.max(0, newS - newInfected)
    const afterR = pop.R + recovered
    const afterV = newV
    const after: Pop = { S: afterS, I: afterI, R: afterR, V: afterV }
    const hospitalPct = (afterI / level.hospitalCap) * 100

    setHistory(prev => [...prev, {
      turn: level.turns - turnsLeft + 1,
      before: { ...pop },
      vaccinesGiven: vaccCount,
      effectiveImmune,
      quarantineUsed: quarantine,
      R0used: R0effective,
      newInfected,
      recovered,
      after,
      cost: totalCostThisTurn,
      hospitalPct,
    }])

    if (afterI > level.hospitalCap) {
      setPop(after)
      setResult('lost_hospital')
      setScreen('result')
      return
    }

    if (afterI === 0) {
      setPop(after)
      setBudgetLeft(b => b - totalCostThisTurn)
      setResult('won')
      setScreen('result')
      return
    }

    const newTurns = turnsLeft - 1
    if (newTurns === 0) {
      setPop(after)
      setResult('lost_time')
      setScreen('result')
      return
    }

    setPop(after)
    setTurnsLeft(newTurns)
    setBudgetLeft(b => b - totalCostThisTurn)
    resetInputs()
  }

  const currentTurn = level.turns - turnsLeft + 1
  const budgetPct = (budgetLeft / level.totalBudget) * 100
  const hospitalPct = (pop.I / level.hospitalCap) * 100

  const score = result === 'won'
    ? Math.round(50 + 30 * (budgetLeft / level.totalBudget) + 20 * (turnsLeft / level.turns))
    : 0

  // ── Level select ──────────────────────────────────────────────────────────
  if (screen === 'levels') return (
    <div className="min-h-screen bg-gray-950 p-4 flex flex-col items-center justify-center">
      <div className="max-w-md w-full space-y-4">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🦠</div>
          <h1 className="text-2xl font-bold text-white">Гра «Епідемія»</h1>
          <p className="text-gray-400 text-sm mt-1">Модуль 6–8 · Показниковий ріст, відсотки, SIR-модель</p>
        </div>
        {LEVELS.map((lvl, i) => (
          <button key={lvl.id} onClick={() => startLevel(i)}
            className={`w-full rounded-2xl p-5 text-left text-white shadow-lg hover:scale-[1.02] transition-transform bg-gradient-to-r ${lvl.color}`}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">{lvl.badge}</span>
              <div>
                <div className="font-bold text-lg">Рівень {lvl.id}: {lvl.name}</div>
                <div className="text-sm opacity-80">
                  R₀={lvl.R0} · {lvl.N.toLocaleString('uk')} людей · 💰{lvl.totalBudget} монет · {lvl.turns} ходів
                  {lvl.vaccEff < 1 && ` · вакцина ${lvl.vaccEff * 100}%`}
                </div>
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
      <div className="max-w-lg mx-auto space-y-4 pt-4">
        <div className={`rounded-2xl p-6 text-center text-white ${result === 'won' ? 'bg-green-800' : 'bg-red-900'}`}>
          <div className="text-5xl mb-3">{result === 'won' ? '🏥' : result === 'lost_hospital' ? '🚑' : '⏰'}</div>
          <h2 className="text-2xl font-bold">
            {result === 'won' ? 'Епідемію зупинено!' : result === 'lost_hospital' ? 'Лікарня переповнена!' : 'Час вийшов...'}
          </h2>
          {result === 'won' ? (
            <div className="mt-3 space-y-1">
              <div className="bg-white bg-opacity-20 rounded-xl px-4 py-2 inline-block">
                <span className="text-3xl font-bold">{score}</span><span className="text-lg"> / 100</span>
              </div>
              <p className="text-sm opacity-80">Залишилось {budgetLeft} монет і {turnsLeft} ходів</p>
            </div>
          ) : (
            <p className="text-sm mt-2 opacity-80">
              {result === 'lost_hospital'
                ? `${pop.I.toLocaleString()} заражених — лікарня може прийняти лише ${level.hospitalCap}`
                : `Залишилось ${pop.I.toLocaleString()} заражених — не встигли`}
            </p>
          )}
        </div>

        {/* Turn log */}
        <div className="bg-gray-800 rounded-2xl p-4">
          <h3 className="text-white font-bold mb-3">📋 Журнал епідемії</h3>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {history.map(r => (
              <div key={r.turn} className={`rounded-xl p-3 text-xs ${r.hospitalPct > 80 ? 'bg-red-900' : 'bg-gray-700'}`}>
                <div className="flex justify-between text-gray-300 mb-1">
                  <span className="font-semibold text-white">Хід {r.turn}</span>
                  <span className="text-yellow-300">💰−{r.cost}</span>
                </div>
                <div className="text-gray-300">
                  {r.vaccinesGiven > 0 && <span>💉 {r.vaccinesGiven} вакцин → {r.effectiveImmune} імунних · </span>}
                  {r.quarantineUsed && <span className="text-blue-400">🔒 карантин (R₀÷2) · </span>}
                  <span className="text-red-400">+{r.newInfected} заражених</span>
                  <span className="text-green-400"> −{r.recovered} одужали</span>
                </div>
                <div className="text-gray-400 mt-0.5">
                  I: {r.before.I} → <strong className="text-white">{r.after.I}</strong>
                  <span className="ml-2 text-gray-500">🏥 {r.hospitalPct.toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Math lesson */}
        <div className="bg-gray-800 rounded-2xl p-4">
          <h3 className="text-white font-bold mb-3">📐 Модель SIR</h3>
          <div className="text-sm text-gray-300 space-y-2">
            <div className="bg-gray-700 rounded-lg p-3 font-mono text-xs space-y-1">
              <p>нові_заражені = I × R₀ × S / N</p>
              <p>R_eff = R₀ × S / N</p>
              <p>поріг імунітету = (1 − 1/R₀) × 100%</p>
            </div>
            <p>🔹 <strong className="text-white">R_eff &gt; 1</strong>: епідемія росте. <strong className="text-white">R_eff &lt; 1</strong>: згасає сама.</p>
            <p>🔹 Для R₀={level.R0} потрібно {Math.round((1 - 1/level.R0) * 100)}% імунних → поріг колективного імунітету.</p>
            {level.vaccEff < 1 && (
              <p>🔹 Ефективність вакцини {level.vaccEff*100}%: щоб 1000 стали імунними, потрібно {Math.round(1000/level.vaccEff)} вакцин.</p>
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
  const herdImmunityPct = Math.round((1 - 1 / level.R0) * 100)
  const immunePct = Math.round(((pop.R + pop.V) / level.N) * 100)

  return (
    <div className="min-h-screen bg-gray-950 p-4">
      <div className="max-w-lg mx-auto space-y-3 pb-6">

        {/* Top bar */}
        <div className="flex items-center justify-between">
          <button onClick={() => setScreen('levels')} className="text-gray-400 hover:text-white text-sm">← Рівні</button>
          <span className="text-white font-bold text-sm">{level.badge} {level.name}</span>
          <span className="text-gray-400 text-sm">Хід {currentTurn}/{level.turns}</span>
        </div>

        {/* Population bars */}
        <div className="bg-gray-800 rounded-2xl p-4">
          <div className="text-gray-400 text-xs font-semibold mb-3 uppercase">Населення: {level.N.toLocaleString('uk')}</div>
          {/* Stacked bar */}
          <div className="w-full h-5 rounded-full overflow-hidden flex mb-3">
            <div className="bg-gray-500 transition-all" style={{ width: `${(pop.S / level.N) * 100}%` }} title="Здорові" />
            <div className="bg-red-500 transition-all" style={{ width: `${(pop.I / level.N) * 100}%` }} title="Заражені" />
            <div className="bg-green-500 transition-all" style={{ width: `${(pop.R / level.N) * 100}%` }} title="Одужали" />
            <div className="bg-blue-500 transition-all" style={{ width: `${(pop.V / level.N) * 100}%` }} title="Вакциновані" />
          </div>
          <div className="grid grid-cols-4 gap-1 text-center text-xs">
            {[
              { label: 'Здорові', val: pop.S, color: 'text-gray-300', dot: 'bg-gray-500' },
              { label: 'Заражені', val: pop.I, color: 'text-red-400', dot: 'bg-red-500' },
              { label: 'Одужали', val: pop.R, color: 'text-green-400', dot: 'bg-green-500' },
              { label: 'Вакцин.', val: pop.V, color: 'text-blue-400', dot: 'bg-blue-500' },
            ].map(g => (
              <div key={g.label}>
                <div className={`font-bold text-base ${g.color}`}>{g.val.toLocaleString()}</div>
                <div className="flex items-center justify-center gap-1 mt-0.5">
                  <span className={`w-2 h-2 rounded-full ${g.dot}`} />
                  <span className="text-gray-500">{g.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Key indicators */}
        <div className="grid grid-cols-3 gap-2">
          {/* R_eff */}
          <div className="bg-gray-800 rounded-xl p-3 text-center">
            <div className="text-gray-400 text-xs mb-1">R_eff</div>
            <div className={`text-xl font-bold ${Reff > 1 ? 'text-red-400' : 'text-green-400'}`}>{Reff}</div>
            <div className="text-xs text-gray-500">{Reff > 1 ? 'росте ↑' : 'згасає ↓'}</div>
          </div>
          {/* Hospital */}
          <div className="bg-gray-800 rounded-xl p-3 text-center">
            <div className="text-gray-400 text-xs mb-1">🏥 Лікарня</div>
            <div className={`text-xl font-bold ${hospitalPct > 80 ? 'text-red-400' : hospitalPct > 50 ? 'text-orange-400' : 'text-white'}`}>
              {pop.I}/{level.hospitalCap}
            </div>
            <div className="w-full bg-gray-700 rounded-full h-1 mt-1 overflow-hidden">
              <div className={`h-1 rounded-full transition-all ${hospitalPct > 80 ? 'bg-red-500' : 'bg-orange-400'}`}
                style={{ width: `${Math.min(100, hospitalPct)}%` }} />
            </div>
          </div>
          {/* Herd immunity */}
          <div className="bg-gray-800 rounded-xl p-3 text-center">
            <div className="text-gray-400 text-xs mb-1">Імунітет</div>
            <div className={`text-xl font-bold ${immunePct >= herdImmunityPct ? 'text-green-400' : 'text-yellow-400'}`}>
              {immunePct}%
            </div>
            <div className="text-xs text-gray-500">поріг {herdImmunityPct}%</div>
          </div>
        </div>

        {/* Formula — always visible */}
        <div className="bg-gray-800 rounded-xl px-4 py-2 font-mono text-xs text-gray-300">
          <span className="text-gray-500">формула: </span>нові_заражені = I × R₀ × S / N
        </div>

        {/* Budget */}
        <div className="bg-gray-800 rounded-xl px-4 py-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">💰 Монети</span>
            <span className={`font-bold ${budgetLeft < level.totalBudget * 0.2 ? 'text-red-400' : 'text-yellow-300'}`}>
              {budgetLeft} / {level.totalBudget}
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-1.5 mt-1 overflow-hidden">
            <div className="h-1.5 rounded-full bg-yellow-400 transition-all" style={{ width: `${budgetPct}%` }} />
          </div>
        </div>

        {/* Actions */}
        <div className="bg-gray-800 rounded-2xl p-4 space-y-4">
          <div className="text-gray-300 text-sm font-semibold">🎯 Дії цього ходу</div>

          {/* Vaccination */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">
              💉 Вакцинувати людей (макс {level.maxVaccPerTurn}/хід, по {level.vaccCost} монети)
              {level.vaccEff < 1 && <span className="text-orange-400"> · ефективність {level.vaccEff * 100}%</span>}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number" min="0" max={level.maxVaccPerTurn}
                value={vaccInput}
                onChange={e => setVaccInput(e.target.value)}
                placeholder="0"
                className="w-24 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-center outline-none focus:border-blue-500"
              />
              {vaccCount > 0 && (
                <div className="text-xs space-y-0.5">
                  <div className="text-yellow-300">💰 −{vaccCostThisTurn} монет</div>
                  {level.vaccEff < 1
                    ? <div className="text-blue-400">{vaccCount} вакцин → {effectiveImmune} імунних ({level.vaccEff * 100}%)</div>
                    : <div className="text-blue-400">→ {effectiveImmune} нових імунних</div>}
                </div>
              )}
            </div>
          </div>

          {/* Vaccine effectiveness calc (level 3) */}
          {level.vaccEff < 1 && vaccCount > 0 && (
            <div className="bg-gray-700 rounded-xl p-3">
              <div className="text-xs text-gray-400 mb-2">Обчисли: скільки реально стануть імунними?</div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-white text-sm">{vaccCount} × {level.vaccEff} =</span>
                <input
                  type="number"
                  value={calcVaccEff}
                  onChange={e => { setCalcVaccEff(e.target.value); setCalcVaccEffChecked(false) }}
                  placeholder="?"
                  className={`w-20 rounded-lg px-2 py-1 text-center font-bold bg-gray-800 border-2 outline-none ${
                    calcVaccEffChecked
                      ? vaccEffCorrect ? 'border-green-500 text-green-400' : 'border-red-500 text-red-400'
                      : 'border-gray-600 text-white'
                  }`}
                />
                <button onClick={() => setCalcVaccEffChecked(true)} disabled={!calcVaccEff}
                  className="text-xs bg-blue-600 text-white px-2 py-1 rounded-lg disabled:opacity-40">
                  Перевірити
                </button>
                {calcVaccEffChecked && !vaccEffCorrect && <span className="text-xs text-red-400">≠ {effectiveImmune}</span>}
                {vaccEffCorrect && <span className="text-xs text-green-400">✓</span>}
              </div>
            </div>
          )}

          {/* Quarantine */}
          {level.hasQuarantine && (
            <div className="flex items-center justify-between bg-gray-700 rounded-xl px-4 py-3">
              <div>
                <div className="text-sm text-white font-semibold">🔒 Карантин</div>
                <div className="text-xs text-gray-400">R₀ {level.R0} → {level.R0 / 2} цей хід · коштує {level.quarantineCost} монет</div>
              </div>
              <button
                onClick={() => setQuarantine(v => !v)}
                disabled={!quarantine && budgetLeft < quarantineCost + vaccCostThisTurn}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  quarantine ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500 disabled:opacity-30'
                }`}
              >
                {quarantine ? '✓ Увімкнено' : 'Увімкнути'}
              </button>
            </div>
          )}
        </div>

        {/* Manual calculation */}
        <div className="bg-gray-800 rounded-2xl p-4">
          <div className="text-gray-300 text-sm font-semibold mb-3">🧮 Обчисли нових заражених вручну</div>
          <div className="text-xs text-gray-400 mb-3 font-mono">
            нові_заражені = I × R₀ × S / N
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            {[
              { label: 'I (заражені)', state: calcI, set: setCalcI, correct: parseInt(calcI) === pop.I, hint: `${pop.I}` },
              { label: `R₀${quarantine ? ' (÷2!)' : ''}`, state: calcR0, set: setCalcR0, correct: parseFloat(calcR0) === R0effective, hint: `${R0effective}` },
              { label: 'S (здорові)', state: calcS, set: setCalcS, correct: parseInt(calcS) === newS, hint: `${newS}` },
              { label: 'N (населення)', state: calcN, set: setCalcN, correct: parseInt(calcN) === level.N, hint: `${level.N}` },
            ].map(f => (
              <div key={f.label}>
                <label className="text-xs text-gray-500 block mb-1">{f.label}</label>
                <input
                  type="number"
                  value={f.state}
                  onChange={e => { f.set(e.target.value); setCalcChecked(false) }}
                  placeholder="?"
                  className={`w-full rounded-lg px-3 py-2 text-center font-bold bg-gray-700 border-2 outline-none text-sm ${
                    f.state ? f.correct ? 'border-green-500 text-green-400' : 'border-red-500 text-red-400' : 'border-gray-600 text-white'
                  }`}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 mb-3">
            <span className="text-gray-400 text-sm">= </span>
            <input
              type="number"
              value={calcResult}
              onChange={e => { setCalcResult(e.target.value); setCalcChecked(false) }}
              placeholder="результат"
              className={`flex-1 rounded-lg px-3 py-2 text-center font-bold bg-gray-700 border-2 outline-none ${
                calcChecked
                  ? formulaCorrect ? 'border-green-500 text-green-300' : 'border-red-500 text-red-400'
                  : 'border-gray-600 text-white'
              }`}
            />
            <button
              onClick={() => setCalcChecked(true)}
              disabled={!formulaFilled}
              className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm disabled:opacity-40 hover:bg-blue-500"
            >
              Перевірити
            </button>
          </div>

          {calcChecked && !formulaCorrect && (
            <div className="text-xs text-red-400 mb-2">
              Перевір значення — чи правильно вписав усі 4 числа?
            </div>
          )}
          {formulaCorrect && (
            <div className="text-xs text-green-400 mb-2">
              ✓ Вірно! {pop.I} × {R0effective} × {newS} / {level.N} = {expectedNewInfected}
            </div>
          )}

          {/* R_eff note */}
          {formulaCorrect && (
            <div className={`rounded-xl px-3 py-2 text-sm ${Reff > 1 ? 'bg-red-900 text-red-300' : 'bg-green-900 text-green-300'}`}>
              R_eff = {level.R0}{quarantine ? '/2' : ''} × {newS}/{level.N} = <strong>{Reff}</strong>
              {Reff > 1 ? ' — епідемія ще розширюється ↑' : ' — епідемія починає згасати ↓'}
            </div>
          )}

          <button
            onClick={confirmTurn}
            disabled={!canConfirm}
            className="w-full mt-3 bg-green-700 text-white rounded-xl py-3 font-bold text-base
              disabled:opacity-40 hover:bg-green-600 transition-colors"
          >
            {!canConfirm
              ? !formulaCorrect ? '⬆ Заповни формулу вірно' : '⬆ Перевір усі поля'
              : `✅ Підтвердити хід (−${totalCostThisTurn} монет)`}
          </button>
        </div>

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
                <div key={r.turn} className="text-xs flex gap-2 text-gray-400 items-center">
                  <span className="text-gray-600 shrink-0">Хід {r.turn}</span>
                  {r.vaccinesGiven > 0 && <span className="text-blue-400">💉{r.effectiveImmune}</span>}
                  {r.quarantineUsed && <span className="text-blue-300">🔒</span>}
                  <span className="text-red-400">+{r.newInfected}🦠</span>
                  <span className="text-green-400">−{r.recovered}✓</span>
                  <span className="text-white ml-auto">I={r.after.I}</span>
                  <span className={`shrink-0 ${r.hospitalPct > 80 ? 'text-red-400' : 'text-gray-500'}`}>
                    🏥{r.hospitalPct.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
