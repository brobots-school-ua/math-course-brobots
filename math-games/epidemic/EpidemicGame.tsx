'use client'

import { useState, useMemo } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LevelDef {
  id: number; name: string; badge: string; color: string
  story: string
  N: number
  I0: number
  R0: number
  recovery: number
  totalBudget: number
  vaccCost: number
  maxVaccPerTurn: number
  hospitalCap: number
  turns: number
  vaccEff: number
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
    hint: 'Дивись на R_eff: поки він > 1, епідемія росте. Вакцинуй більше людей — S зменшується, R_eff падає!',
  },
  {
    id: 2, name: 'Пандемія', badge: '😷', color: 'from-orange-700 to-orange-500',
    story: '2000 мешканців. R₀=2.5 — вірус набагато заразніший. Одних вакцин може не вистачити: є можливість ввести карантин.',
    N: 2000, I0: 20, R0: 2.5, recovery: 0.25,
    totalBudget: 2000, vaccCost: 2, maxVaccPerTurn: 150,
    hospitalCap: 300, turns: 18, vaccEff: 1.0,
    hasQuarantine: true, quarantineCost: 120,
    hint: 'Карантин знижує R₀ вдвічі на один хід. Використовуй його коли заражених стає небезпечно багато!',
  },
  {
    id: 3, name: 'Суперзбудник', badge: '☣️', color: 'from-red-800 to-red-600',
    story: '5000 мешканців. R₀=4. Але вакцина спрацьовує лише у 80% випадків. Рахуй уважно — помилка коштує дорого.',
    N: 5000, I0: 50, R0: 4, recovery: 0.2,
    totalBudget: 4000, vaccCost: 2, maxVaccPerTurn: 250,
    hospitalCap: 400, turns: 22, vaccEff: 0.8,
    hasQuarantine: true, quarantineCost: 200,
    hint: 'Ефективність 80% = з 100 вакцин реально захищає 80. Порахуй скільки потрібно вакцин щоб захистити X людей.',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcNewInfected(I: number, R0: number, S: number, N: number): number {
  return Math.round(I * R0 * S / N)
}

function calcReff(R0: number, S: number, N: number): number {
  return Math.round(R0 * S / N * 100) / 100
}

function makeChoices(correct: number): number[] {
  const spread = Math.max(2, Math.round(correct * 0.4) + 1)
  const b = correct + spread
  const c = Math.max(0, correct - Math.ceil(spread * 0.65))
  const arr = c === correct ? [correct, b, b + spread] : [correct, b, c]
  // rotate position of correct answer so it's not always first
  const r = correct % 3
  return [arr[r % 3], arr[(r + 1) % 3], arr[(r + 2) % 3]]
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

  const [vaccSlider, setVaccSlider] = useState(0)
  const [quarantine, setQuarantine] = useState(false)
  const [predictionChoice, setPredictionChoice] = useState<number | null>(null)
  const [vaccEffChoice, setVaccEffChoice] = useState<number | null>(null)
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
    setVaccSlider(0)
    setQuarantine(false)
    setPredictionChoice(null)
    setVaccEffChoice(null)
    setHintOpen(false)
  }

  const vaccCount = Math.max(0, Math.min(
    vaccSlider,
    level.maxVaccPerTurn,
    Math.floor(budgetLeft / level.vaccCost),
    pop.S
  ))
  const vaccCostThisTurn = vaccCount * level.vaccCost
  const effectiveImmune = Math.round(vaccCount * level.vaccEff)
  const quarantineCost = quarantine ? level.quarantineCost : 0
  const totalCostThisTurn = vaccCostThisTurn + quarantineCost
  const R0effective = quarantine ? level.R0 / 2 : level.R0

  const newS = pop.S - effectiveImmune
  const newV = pop.V + effectiveImmune
  const expectedNewInfected = calcNewInfected(pop.I, R0effective, newS, level.N)
  const Reff = calcReff(R0effective, newS, level.N)

  const predictionOptions = useMemo(
    () => makeChoices(expectedNewInfected),
    [expectedNewInfected]
  )
  const vaccEffOptions = useMemo(
    () => makeChoices(effectiveImmune),
    [effectiveImmune]
  )

  const predictionCorrect = predictionChoice === expectedNewInfected
  const needVaccEffQ = level.vaccEff < 1 && vaccCount > 0
  const vaccEffCorrect = needVaccEffQ ? vaccEffChoice === effectiveImmune : true
  const canConfirm = predictionCorrect && vaccEffCorrect && totalCostThisTurn <= budgetLeft

  function confirmTurn() {
    if (!canConfirm) return

    const newInfected = expectedNewInfected
    const recovered = Math.round(pop.I * level.recovery)
    const afterI = Math.max(0, pop.I + newInfected - recovered)
    const afterS = Math.max(0, newS - newInfected)
    const afterR = pop.R + recovered
    const after: Pop = { S: afterS, I: afterI, R: afterR, V: newV }
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
  const herdImmunityPct = Math.round((1 - 1 / level.R0) * 100)
  const immunePct = Math.round(((pop.R + pop.V) / level.N) * 100)
  const score = result === 'won'
    ? Math.round(50 + 30 * (budgetLeft / level.totalBudget) + 20 * (turnsLeft / level.turns))
    : 0

  // step numbering
  const step2label = level.hasQuarantine ? 'Крок 2' : null
  const step3num = level.hasQuarantine ? 3 : 2

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
                  R₀={lvl.R0} · {lvl.N.toLocaleString('uk')} людей · 💰{lvl.totalBudget} · {lvl.turns} ходів
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
                  {r.quarantineUsed && <span className="text-blue-400">🔒 карантин · </span>}
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

        <div className="bg-gray-800 rounded-2xl p-4">
          <h3 className="text-white font-bold mb-3">📐 Модель SIR</h3>
          <div className="text-sm text-gray-300 space-y-2">
            <div className="bg-gray-700 rounded-lg p-3 font-mono text-xs space-y-1">
              <p>нові_заражені = I × R₀ × S / N</p>
              <p>R_eff = R₀ × S / N</p>
              <p>поріг імунітету = (1 − 1/R₀) × 100%</p>
            </div>
            <p>🔹 <strong className="text-white">R_eff &gt; 1</strong>: епідемія росте. <strong className="text-white">R_eff &lt; 1</strong>: згасає сама.</p>
            <p>🔹 Для R₀={level.R0} потрібно {herdImmunityPct}% імунних → поріг колективного імунітету.</p>
            {level.vaccEff < 1 && (
              <p>🔹 Ефективність вакцини {level.vaccEff * 100}%: щоб 1000 стали імунними, потрібно {Math.round(1000 / level.vaccEff)} вакцин.</p>
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
          <div className="w-full h-5 rounded-full overflow-hidden flex mb-3">
            <div className="bg-gray-500 transition-all duration-500" style={{ width: `${(pop.S / level.N) * 100}%` }} title="Здорові" />
            <div className="bg-red-500 transition-all duration-500" style={{ width: `${(pop.I / level.N) * 100}%` }} title="Заражені" />
            <div className="bg-green-500 transition-all duration-500" style={{ width: `${(pop.R / level.N) * 100}%` }} title="Одужали" />
            <div className="bg-blue-500 transition-all duration-500" style={{ width: `${(pop.V / level.N) * 100}%` }} title="Вакциновані" />
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
          <div className="bg-gray-800 rounded-xl p-3 text-center">
            <div className="text-gray-400 text-xs mb-1">R_eff</div>
            <div className={`text-xl font-bold ${Reff > 1 ? 'text-red-400' : 'text-green-400'}`}>{Reff}</div>
            <div className="text-xs text-gray-500">{Reff > 1 ? 'росте ↑' : 'згасає ↓'}</div>
          </div>
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
          <div className="bg-gray-800 rounded-xl p-3 text-center">
            <div className="text-gray-400 text-xs mb-1">Імунітет</div>
            <div className={`text-xl font-bold ${immunePct >= herdImmunityPct ? 'text-green-400' : 'text-yellow-400'}`}>
              {immunePct}%
            </div>
            <div className="text-xs text-gray-500">поріг {herdImmunityPct}%</div>
          </div>
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

        {/* ── Step 1: Vaccination slider ────────────────────────────────── */}
        <div className="bg-gray-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-white font-semibold text-sm">
              <span className="bg-blue-600 text-white rounded-full w-5 h-5 inline-flex items-center justify-center text-xs mr-2">1</span>
              💉 Вакцинація
            </span>
            {vaccCount > 0
              ? <span className="text-yellow-300 text-sm font-bold">−{vaccCostThisTurn} монет</span>
              : <span className="text-gray-500 text-xs">перетягни слайдер</span>
            }
          </div>

          <input
            type="range" min={0} max={level.maxVaccPerTurn}
            value={vaccSlider}
            onChange={e => {
              setVaccSlider(+e.target.value)
              setPredictionChoice(null)
              setVaccEffChoice(null)
            }}
            className="w-full accent-blue-500 cursor-pointer"
          />

          <div className="flex justify-between text-xs text-gray-500">
            <span>0</span>
            <span className={`font-semibold ${vaccCount > 0 ? 'text-blue-400' : 'text-gray-500'}`}>
              {vaccCount > 0
                ? level.vaccEff < 1
                  ? `${vaccCount} вакцин → ~${effectiveImmune} імунних (${level.vaccEff * 100}% ефект.)`
                  : `${vaccCount} вакцин → ${effectiveImmune} імунних`
                : 'без вакцинації'
              }
            </span>
            <span>макс {level.maxVaccPerTurn}</span>
          </div>
        </div>

        {/* ── Step 2: Quarantine (optional) ────────────────────────────── */}
        {level.hasQuarantine && (
          <div className="bg-gray-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="bg-blue-600 text-white rounded-full w-5 h-5 inline-flex items-center justify-center text-xs mr-2">2</span>
              <span className="text-white font-semibold text-sm">🔒 Карантин</span>
              <div className="text-xs text-gray-400 mt-0.5 ml-7">
                R₀ {level.R0} → {level.R0 / 2} цей хід · −{level.quarantineCost} монет
              </div>
            </div>
            <button
              onClick={() => {
                setQuarantine(v => !v)
                setPredictionChoice(null)
              }}
              disabled={!quarantine && budgetLeft < quarantineCost + vaccCostThisTurn}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                quarantine
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900'
                  : 'bg-gray-600 text-gray-300 hover:bg-gray-500 disabled:opacity-30'
              }`}
            >
              {quarantine ? '✓ Увімкнено' : 'Увімкнути'}
            </button>
          </div>
        )}

        {/* ── Step 2/3: Vaccine effectiveness question (level 3 only) ──── */}
        {needVaccEffQ && (
          <div className="bg-gray-800 rounded-2xl p-4 space-y-3">
            <div>
              <span className="bg-orange-600 text-white rounded-full w-5 h-5 inline-flex items-center justify-center text-xs mr-2">
                {step3num}
              </span>
              <span className="text-white font-semibold text-sm">🧮 Скільки стануть імунними?</span>
            </div>
            <div className="bg-gray-700 rounded-xl px-4 py-2 font-mono text-sm text-center text-gray-300">
              {vaccCount} вакцин × {level.vaccEff} = ?
            </div>
            <div className="grid grid-cols-3 gap-2">
              {vaccEffOptions.map(opt => {
                const isCorrect = opt === effectiveImmune
                const isChosen = vaccEffChoice === opt
                let cls = 'bg-gray-700 text-white hover:bg-gray-600'
                if (vaccEffChoice !== null) {
                  if (isCorrect) cls = 'bg-green-700 text-white ring-2 ring-green-400'
                  else if (isChosen) cls = 'bg-red-700 text-white'
                  else cls = 'bg-gray-700 text-gray-500'
                }
                return (
                  <button key={opt} onClick={() => setVaccEffChoice(opt)}
                    disabled={vaccEffChoice === effectiveImmune}
                    className={`py-3 rounded-xl font-bold text-lg transition-all ${cls}`}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>
            {vaccEffChoice !== null && vaccEffChoice !== effectiveImmune && (
              <p className="text-xs text-red-400">
                Не зовсім. Спробуй ще раз: {vaccCount} × {level.vaccEff} = {effectiveImmune}
              </p>
            )}
            {vaccEffChoice === effectiveImmune && (
              <p className="text-xs text-green-400">✓ Вірно! {vaccCount} вакцин захистять {effectiveImmune} людей.</p>
            )}
          </div>
        )}

        {/* ── Step N: Predict new infected ─────────────────────────────── */}
        <div className="bg-gray-800 rounded-2xl p-4 space-y-3">
          <div>
            <span className="bg-purple-600 text-white rounded-full w-5 h-5 inline-flex items-center justify-center text-xs mr-2">
              {needVaccEffQ ? step3num + 1 : step3num}
            </span>
            <span className="text-white font-semibold text-sm">🔮 Скільки нових заражених з'явиться?</span>
          </div>

          {/* Formula with values */}
          <div className="bg-gray-700 rounded-xl px-4 py-3 font-mono text-sm text-center">
            <span className="text-gray-400">I × R₀ × S / N = </span>
            <span className="text-red-300">{pop.I}</span>
            <span className="text-gray-400"> × </span>
            <span className="text-orange-300">{R0effective}</span>
            <span className="text-gray-400"> × </span>
            <span className="text-gray-300">{newS}</span>
            <span className="text-gray-400"> / </span>
            <span className="text-gray-300">{level.N}</span>
            <span className="text-gray-400"> = </span>
            <span className="text-yellow-300 font-bold">?</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {predictionOptions.map(opt => {
              const isCorrect = opt === expectedNewInfected
              const isChosen = predictionChoice === opt
              let cls = 'bg-gray-700 text-white hover:bg-gray-600'
              if (predictionChoice !== null) {
                if (isCorrect) cls = 'bg-green-700 text-white ring-2 ring-green-400'
                else if (isChosen) cls = 'bg-red-700 text-white'
                else cls = 'bg-gray-700 text-gray-500'
              }
              return (
                <button key={opt} onClick={() => setPredictionChoice(opt)}
                  disabled={predictionCorrect}
                  className={`py-4 rounded-xl font-bold text-2xl transition-all ${cls}`}
                >
                  {opt}
                </button>
              )
            })}
          </div>

          {predictionChoice !== null && !predictionCorrect && (
            <p className="text-xs text-red-400">
              Не точно. Підказка: {pop.I} × {R0effective} ≈ {(pop.I * R0effective).toFixed(1)}, потім × {newS} / {level.N}
            </p>
          )}
          {predictionCorrect && (
            <div className={`rounded-xl px-3 py-2 text-sm ${Reff > 1 ? 'bg-red-900 text-red-300' : 'bg-green-900 text-green-300'}`}>
              ✓ Вірно! R_eff = <strong>{Reff}</strong>
              {Reff > 1 ? ' — епідемія ще розширюється ↑' : ' — епідемія починає згасати ↓'}
            </div>
          )}
        </div>

        {/* Confirm button */}
        <button
          onClick={confirmTurn}
          disabled={!canConfirm}
          className={`w-full rounded-2xl py-4 font-bold text-base transition-all ${
            canConfirm
              ? 'bg-green-600 text-white hover:bg-green-500 shadow-lg shadow-green-900'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          {canConfirm
            ? `✅ Підтвердити хід (−${totalCostThisTurn} монет)`
            : predictionChoice === null
              ? '⬆ Оберіть відповідь на питання'
              : '⬆ Правильна відповідь — тоді підтвердиш'
          }
        </button>

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
