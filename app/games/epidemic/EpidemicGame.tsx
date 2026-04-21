'use client'

import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'

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
    totalBudget: 4000, vaccCost: 2, maxVaccPerTurn: 150,
    hospitalCap: 600, turns: 18, vaccEff: 1.0,
    hasQuarantine: true, quarantineCost: 120,
    hint: 'Карантин знижує R₀ вдвічі на один хід. Використовуй його коли заражених стає небезпечно багато!',
  },
  {
    id: 3, name: 'Суперзбудник', badge: '☣️', color: 'from-red-800 to-red-600',
    story: '3000 мешканців. R₀=2.5, але вакцина спрацьовує лише у 80% випадків. Потрібно значно більше вакцин щоб досягти того ж результату!',
    N: 3000, I0: 30, R0: 2.5, recovery: 0.25,
    totalBudget: 5000, vaccCost: 2, maxVaccPerTurn: 200,
    hospitalCap: 800, turns: 22, vaccEff: 0.8,
    hasQuarantine: true, quarantineCost: 150,
    hint: 'Ефективність 80% = з 100 вакцин реально захищає 80. Щоб вийти на поріг колективного імунітету 60%, потрібно вакцинувати 75% людей!',
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

// ─── Info Panel ───────────────────────────────────────────────────────────────

function InfoPanel({ level, onClose }: { level: LevelDef; onClose: () => void }) {
  const [tab, setTab] = useState<'sir' | 'formulas' | 'strategies'>('sir')
  const herdPct = Math.round((1 - 1 / level.R0) * 100)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-end sm:items-center justify-center p-2">
      <div className="bg-gray-900 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 shrink-0">
          <h2 className="text-white font-bold text-lg">📖 Довідник</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700 shrink-0">
          {([
            { key: 'sir', label: 'SIR модель' },
            { key: 'formulas', label: 'Формули' },
            { key: 'strategies', label: 'Стратегії' },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-4 space-y-4 text-sm text-gray-300">

          {tab === 'sir' && <>
            <p className="text-white font-semibold">Що таке SIR модель?</p>
            <p>SIR — це математична модель епідемії. Вона ділить всіх людей на 3 групи:</p>

            <div className="space-y-2">
              {[
                { dot: 'bg-gray-400', letter: 'S', full: 'Susceptible — Вразливі', desc: 'Здорові люди, які ще не мають імунітету. Можуть заразитись.' },
                { dot: 'bg-red-500', letter: 'I', full: 'Infected — Заражені', desc: 'Хворі люди, які розповсюджують вірус.' },
                { dot: 'bg-green-500', letter: 'R', full: 'Recovered — Одужали', desc: 'Перехворіли і мають імунітет. Більше не заразяться.' },
              ].map(g => (
                <div key={g.letter} className="bg-gray-800 rounded-xl p-3 flex gap-3">
                  <span className={`w-3 h-3 rounded-full ${g.dot} mt-0.5 shrink-0`} />
                  <div>
                    <span className="text-white font-bold">{g.letter}</span>
                    <span className="text-gray-400 text-xs"> · {g.full}</span>
                    <p className="text-gray-400 text-xs mt-0.5">{g.desc}</p>
                  </div>
                </div>
              ))}
              <div className="bg-blue-900 rounded-xl p-3 flex gap-3">
                <span className="w-3 h-3 rounded-full bg-blue-500 mt-0.5 shrink-0" />
                <div>
                  <span className="text-white font-bold">V</span>
                  <span className="text-gray-400 text-xs"> · Vaccinated — Вакциновані</span>
                  <p className="text-gray-400 text-xs mt-0.5">Захищені вакциною. Також не заразяться.</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-3">
              <p className="text-white font-semibold mb-1">R₀ = {level.R0} — що це означає?</p>
              <p className="text-gray-400 text-xs">
                Базове число відтворення: скільки людей заразить <strong className="text-white">одна хвора людина</strong> у повністю вразливій популяції.
              </p>
              <p className="text-gray-400 text-xs mt-1">
                R₀ = {level.R0} означає: кожен хворий заражає в середньому <strong className="text-white">{level.R0} людини</strong>.
              </p>
              {level.R0 <= 1.5 && <p className="text-yellow-300 text-xs mt-1">Для порівняння: сезонний грип ≈ 1.3, кір ≈ 15</p>}
              {level.R0 > 1.5 && level.R0 <= 3 && <p className="text-yellow-300 text-xs mt-1">Для порівняння: COVID-19 ≈ 2.5–3, грип ≈ 1.3</p>}
              {level.R0 > 3 && <p className="text-yellow-300 text-xs mt-1">Для порівняння: кір ≈ 12–18, це дуже заразний вірус!</p>}
            </div>
          </>}

          {tab === 'formulas' && <>
            <p className="text-white font-semibold">Основні формули</p>

            <div className="bg-gray-800 rounded-xl p-3 space-y-2">
              <p className="text-blue-300 font-mono text-xs font-bold">Нові заражені за хід:</p>
              <p className="font-mono text-white text-sm">нові = I × R₀ × S / N</p>
              <div className="text-xs text-gray-400 space-y-0.5 mt-1">
                <p><span className="text-red-300">I</span> — скільки зараз хворих</p>
                <p><span className="text-orange-300">R₀</span> — заразність вірусу</p>
                <p><span className="text-gray-300">S</span> — скільки вразливих (можуть заразитись)</p>
                <p><span className="text-gray-300">N</span> — загальна кількість людей</p>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Логіка: хворий зустрічає R₀ людей, але заражає тільки тих, хто вразливий (S/N частка).
              </p>
            </div>

            <div className="bg-gray-800 rounded-xl p-3 space-y-2">
              <p className="text-purple-300 font-mono text-xs font-bold">Ефективне R (R_eff):</p>
              <p className="font-mono text-white text-sm">R_eff = R₀ × S / N</p>
              <div className="text-xs text-gray-400 space-y-0.5 mt-1">
                <p className="text-red-400">R_eff &gt; 1 → епідемія росте 📈</p>
                <p className="text-green-400">R_eff &lt; 1 → епідемія гасне 📉</p>
                <p className="text-blue-400">R_eff = 1 → кількість хворих стабільна</p>
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-3 space-y-2">
              <p className="text-green-300 font-mono text-xs font-bold">Поріг колективного імунітету:</p>
              <p className="font-mono text-white text-sm">поріг = (1 − 1/R₀) × 100%</p>
              <p className="text-xs text-gray-400 mt-1">
                Для R₀={level.R0}: потрібно <strong className="text-green-300">{herdPct}%</strong> імунних щоб епідемія почала гаснути сама.
              </p>
              {level.vaccEff < 1 && (
                <p className="text-xs text-orange-400 mt-1">
                  ⚠️ При ефективності вакцини {level.vaccEff * 100}% потрібно вакцинувати {Math.round(herdPct / level.vaccEff)}% людей.
                </p>
              )}
            </div>
          </>}

          {tab === 'strategies' && <>
            <p className="text-white font-semibold">Як перемогти?</p>

            <div className="space-y-3">
              <div className="bg-blue-900 rounded-xl p-3">
                <p className="text-blue-300 font-semibold text-sm mb-1">💉 Стратегія вакцинації</p>
                <p className="text-xs text-gray-300">
                  Вакцина переводить людей з групи S (вразливі) до V (захищені). Чим менше S — тим менший R_eff.
                </p>
                <p className="text-xs text-yellow-300 mt-1">
                  Ціль: довести R_eff нижче 1. Тоді кожен хід заражених стає менше.
                </p>
              </div>

              {level.hasQuarantine && (
                <div className="bg-purple-900 rounded-xl p-3">
                  <p className="text-purple-300 font-semibold text-sm mb-1">🔒 Стратегія карантину</p>
                  <p className="text-xs text-gray-300">
                    Карантин знижує R₀ вдвічі на один хід. Люди менше контактують — менше заражень.
                  </p>
                  <p className="text-xs text-yellow-300 mt-1">
                    Коли використовувати: коли лікарня переповнюється і потрібно терміново збити хвилю.
                  </p>
                </div>
              )}

              <div className="bg-gray-800 rounded-xl p-3">
                <p className="text-white font-semibold text-sm mb-1">⚖️ Оптимальна стратегія</p>
                <ol className="text-xs text-gray-300 space-y-1 list-decimal list-inside">
                  <li>Перші ходи — максимум вакцин, поки грошей вистачає</li>
                  <li>Слідкуй за лікарнею — якщо &gt;70%, вводь карантин</li>
                  <li>Коли R_eff &lt; 1 — можна вакцинувати менше, економ гроші</li>
                  <li>Не витрачай весь бюджет одразу — може знадобитись карантин</li>
                </ol>
              </div>

              <div className="bg-gray-800 rounded-xl p-3">
                <p className="text-white font-semibold text-sm mb-2">🎯 Показники рівня {level.id}</p>
                <div className="text-xs space-y-1 text-gray-300">
                  <div className="flex justify-between"><span>R₀ вірусу:</span><span className="text-orange-300">{level.R0}</span></div>
                  <div className="flex justify-between"><span>Поріг імунітету:</span><span className="text-green-300">{herdPct}%</span></div>
                  <div className="flex justify-between"><span>Місткість лікарні:</span><span className="text-white">{level.hospitalCap} ліжок</span></div>
                  <div className="flex justify-between"><span>Бюджет:</span><span className="text-yellow-300">{level.totalBudget} монет</span></div>
                  {level.vaccEff < 1 && <div className="flex justify-between"><span>Ефективність вакцини:</span><span className="text-orange-300">{level.vaccEff * 100}%</span></div>}
                </div>
              </div>
            </div>
          </>}
        </div>
      </div>
    </div>
  )
}

// ─── Post-game Report ─────────────────────────────────────────────────────────

function PostGameReport({
  history, level, result, finalBudget,
}: {
  history: TurnRecord[]
  level: LevelDef
  result: 'won_perfect' | 'won' | 'lost_hospital' | null
  finalBudget: number
}) {
  if (history.length === 0) return null

  const totalVaccines = history.reduce((s, r) => s + r.vaccinesGiven, 0)
  const totalImmune   = history.reduce((s, r) => s + r.effectiveImmune, 0)
  const quarantineTurns = history.filter(r => r.quarantineUsed).length
  const maxHospitalTurn = history.reduce((best, r) => r.hospitalPct > best.hospitalPct ? r : best, history[0])
  const peakITurn = history.reduce((best, r) => r.after.I > best.after.I ? r : best, history[0])

  // turns where Reff > 1 (epidemic still growing)
  const reffAbove1 = history.filter(r => {
    const S = r.before.S - r.effectiveImmune
    const reff = r.R0used * S / level.N
    return reff > 1
  })
  const firstReffBelow1 = history.find(r => {
    const S = r.before.S - r.effectiveImmune
    return r.R0used * S / level.N <= 1
  })

  // missed max vaccination: turns where budget was available but vaccinated < max
  const missedTurns = history.filter(r =>
    r.vaccinesGiven < level.maxVaccPerTurn &&
    r.vaccinesGiven < r.before.S &&
    r.cost < level.vaccCost * level.maxVaccPerTurn + (r.quarantineUsed ? level.quarantineCost : 0) + level.vaccCost
  )

  const budgetSpent = level.totalBudget - finalBudget
  const budgetEffPct = Math.round(budgetSpent / level.totalBudget * 100)

  // ── generate reflection tasks ─────────────────────────────────────────────
  const tasks: { q: string; hint: string }[] = []

  if (reffAbove1.length > 0) {
    const t = reffAbove1[reffAbove1.length - 1]
    const S = t.before.S - t.effectiveImmune
    const reff = Math.round(t.R0used * S / level.N * 100) / 100
    tasks.push({
      q: `На ході ${t.turn} R_eff = ${reff} (> 1). Скільки вакцин потрібно було дати, щоб R_eff впав нижче 1?`,
      hint: `R_eff < 1 коли S/N < 1/R₀ = ${(1/level.R0).toFixed(2)}. Тобто S має бути < ${Math.round(level.N / level.R0)}. Тоді: потрібно вакцинувати S − ${Math.round(level.N / level.R0)} = ${Math.max(0, t.before.S - Math.round(level.N / level.R0))} людей.`,
    })
  }

  if (peakITurn) {
    tasks.push({
      q: `Пік заражених: ${peakITurn.after.I} на ході ${peakITurn.turn}. Якби ти вакцинував на 20 людей більше щоразу до цього ходу — скільки б заражених було в піку?`,
      hint: `Більше вакцин → менше S → менший R_eff → менше нових заражених кожен хід. Ефект накопичується! Навіть +20 вакцин/хід × ${peakITurn.turn} ходів = ${20 * peakITurn.turn} менше вразливих.`,
    })
  }

  if (level.hasQuarantine && quarantineTurns === 0) {
    const dangerTurn = history.find(r => r.hospitalPct > 40)
    if (dangerTurn) {
      const R0half = level.R0 / 2
      const S = dangerTurn.before.S - dangerTurn.effectiveImmune
      const newIWithQ = Math.round(dangerTurn.before.I * R0half * S / level.N)
      tasks.push({
        q: `Ти не використовував карантин жодного разу! На ході ${dangerTurn.turn} було ${dangerTurn.newInfected} нових заражених. Скільки б їх було з карантином?`,
        hint: `З карантином R₀ ÷ 2 = ${R0half}. Нові заражені = ${dangerTurn.before.I} × ${R0half} × ${S} / ${level.N} ≈ ${newIWithQ}. Різниця: ${dangerTurn.newInfected - newIWithQ} менше!`,
      })
    }
  } else if (level.hasQuarantine && quarantineTurns > 0 && finalBudget > level.quarantineCost * 2) {
    tasks.push({
      q: `Залишилось ${finalBudget} монет невитрачених (вистачило б ще на ${Math.floor(finalBudget / level.quarantineCost)} ходів карантину або ${Math.floor(finalBudget / level.vaccCost)} вакцин). Як би це змінило результат?`,
      hint: `${Math.floor(finalBudget / level.vaccCost)} вакцин × ${level.vaccEff * 100}% ефект = ще ${Math.round(finalBudget / level.vaccCost * level.vaccEff)} імунних. R_eff знизився б ще більше.`,
    })
  }

  if (tasks.length < 2 && missedTurns.length > 0) {
    tasks.push({
      q: `На ходах ${missedTurns.map(r => r.turn).join(', ')} ти вакцинував менше максимуму. Чому важливо вакцинувати якомога більше на початку?`,
      hint: `Кожна вакцина на ранніх ходах зменшує S — через це R_eff падає, і зростання епідемії сповільнюється. Ефект "compound": менше нових заражених → менше наступного ходу → ...`,
    })
  }

  // ── what went well / what to improve ──────────────────────────────────────
  const goods: string[] = []
  const bads: string[] = []

  if (firstReffBelow1 && firstReffBelow1.turn <= Math.ceil(level.turns * 0.4))
    goods.push(`R_eff впав нижче 1 вже на ході ${firstReffBelow1.turn} — швидкий контроль!`)
  else if (firstReffBelow1)
    bads.push(`R_eff впав нижче 1 тільки на ході ${firstReffBelow1.turn} (з ${level.turns}). Швидша вакцинація скоротила б цей час.`)

  if (maxHospitalTurn.hospitalPct < 50)
    goods.push(`Лікарня ніколи не перевищувала 50% (макс: ${maxHospitalTurn.hospitalPct.toFixed(0)}% на ході ${maxHospitalTurn.turn}).`)
  else if (maxHospitalTurn.hospitalPct > 80)
    bads.push(`Небезпечний момент: лікарня досягла ${maxHospitalTurn.hospitalPct.toFixed(0)}% на ході ${maxHospitalTurn.turn}!`)

  if (totalImmune > level.N * (level.vaccEff < 1 ? 0.5 : 0.4))
    goods.push(`Вакциновано ${totalImmune} людей (${Math.round(totalImmune/level.N*100)}% населення) — хороше охоплення!`)
  else
    bads.push(`Вакциновано лише ${totalImmune} людей (${Math.round(totalImmune/level.N*100)}% населення). Більше вакцин = швидший контроль.`)

  if (level.hasQuarantine && quarantineTurns > 0)
    goods.push(`Використав карантин ${quarantineTurns} рази — це знизило пік заражень.`)

  if (budgetEffPct < 60 && result !== 'won_perfect')
    bads.push(`Використано лише ${budgetEffPct}% бюджету. Зайві монети нічого не дають — вклади їх у вакцини!`)

  if (result === 'won_perfect')
    goods.push(`Ідеальний результат: заражених 0!`)

  return (
    <div className="space-y-3">
      {/* Stats */}
      <div className="bg-gray-800 rounded-2xl p-4">
        <h3 className="text-white font-bold mb-3">📊 Статистика гри</h3>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          {[
            { label: 'Вакцин дано', val: totalVaccines, color: 'text-blue-400' },
            { label: 'Стали імунними', val: totalImmune, color: 'text-green-400' },
            { label: 'Карантин ходів', val: quarantineTurns, color: 'text-purple-400' },
            { label: 'Пік заражених', val: peakITurn.after.I, color: 'text-red-400' },
            { label: 'Макс. лікарня', val: `${maxHospitalTurn.hospitalPct.toFixed(0)}%`, color: maxHospitalTurn.hospitalPct > 80 ? 'text-red-400' : 'text-orange-300' },
            { label: 'Бюджет витрачено', val: `${budgetEffPct}%`, color: budgetEffPct < 60 ? 'text-yellow-400' : 'text-gray-300' },
          ].map(s => (
            <div key={s.label} className="bg-gray-700 rounded-xl py-2">
              <div className={`font-bold text-base ${s.color}`}>{s.val}</div>
              <div className="text-gray-500 leading-tight mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Good / Bad */}
      {(goods.length > 0 || bads.length > 0) && (
        <div className="bg-gray-800 rounded-2xl p-4 space-y-2">
          <h3 className="text-white font-bold mb-1">🔍 Аналіз стратегії</h3>
          {goods.map((g, i) => (
            <div key={i} className="flex gap-2 text-sm">
              <span className="text-green-400 shrink-0">✅</span>
              <span className="text-gray-300">{g}</span>
            </div>
          ))}
          {bads.map((b, i) => (
            <div key={i} className="flex gap-2 text-sm">
              <span className="text-yellow-400 shrink-0">⚠️</span>
              <span className="text-gray-300">{b}</span>
            </div>
          ))}
        </div>
      )}

      {/* Reflection tasks */}
      {tasks.length > 0 && (
        <div className="bg-gray-800 rounded-2xl p-4 space-y-3">
          <h3 className="text-white font-bold">🧮 Завдання для роздумів</h3>
          {tasks.map((t, i) => (
            <ReflectionTask key={i} num={i + 1} question={t.q} hint={t.hint} />
          ))}
        </div>
      )}
    </div>
  )
}

function ReflectionTask({ num, question, hint }: { num: number; question: string; hint: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-gray-700 rounded-xl p-3">
      <div className="flex gap-2 mb-1">
        <span className="bg-purple-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">{num}</span>
        <p className="text-sm text-white">{question}</p>
      </div>
      <button onClick={() => setOpen(v => !v)} className="text-xs text-purple-400 ml-7">
        {open ? '▲ сховати підказку' : '▼ показати підказку'}
      </button>
      {open && <p className="text-xs text-purple-200 mt-1 ml-7">{hint}</p>}
    </div>
  )
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
  const [infoOpen, setInfoOpen] = useState(false)
  const [lastTurnMsg, setLastTurnMsg] = useState<string | null>(null)

  const [vaccSlider, setVaccSlider] = useState(0)
  const [quarantine, setQuarantine] = useState(false)
  const [predictionChoice, setPredictionChoice] = useState<number | null>(null)
  const [vaccEffChoice, setVaccEffChoice] = useState<number | null>(null)
  const [result, setResult] = useState<'won_perfect' | 'won' | 'lost_hospital' | null>(null)

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
    setLastTurnMsg(null)
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

  // Preview: what R_eff will be after this turn's vaccines
  const previewReff = calcReff(R0effective, newS, level.N)

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

    // Status message for next turn
    if (hospitalPct > 80) setLastTurnMsg('🚨 Небезпечно! Лікарня переповнюється.')
    else if (Reff < 1) setLastTurnMsg('📉 Відмінно! Епідемія починає гаснути.')
    else if (newInfected < pop.I) setLastTurnMsg('✅ Хороший хід — приріст сповільнюється.')
    else setLastTurnMsg('⚠️ Епідемія ще розширюється. Більше вакцин!')

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
      setPop(after); setResult('lost_hospital'); setScreen('result'); return
    }
    if (afterI === 0) {
      setPop(after); setBudgetLeft(b => b - totalCostThisTurn); setResult('won_perfect'); setScreen('result'); return
    }
    const newTurns = turnsLeft - 1
    if (newTurns === 0) {
      setPop(after); setBudgetLeft(b => b - totalCostThisTurn); setResult('won'); setScreen('result'); return
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

  const chartData = useMemo(() => {
    const toRow = (turn: number, s: Pop, hospPct: number) => ({
      turn,
      S: Math.round(s.S / level.N * 100),
      I: Math.round(s.I / level.N * 100),
      R: Math.round(s.R / level.N * 100),
      V: Math.round(s.V / level.N * 100),
      Лікарня: Math.round(hospPct),
    })
    const rows = [toRow(0, { S: level.N - level.I0, I: level.I0, R: 0, V: 0 }, (level.I0 / level.hospitalCap) * 100)]
    for (const r of history) rows.push(toRow(r.turn, r.after, r.hospitalPct))
    // fill remaining turns with nulls so X-axis always spans full game
    const lastTurn = rows[rows.length - 1].turn
    for (let t = lastTurn + 1; t <= level.turns; t++) {
      rows.push({ turn: t, S: null as unknown as number, I: null as unknown as number, R: null as unknown as number, V: null as unknown as number, Лікарня: null as unknown as number })
    }
    return rows
  }, [history, level])
  const score = (result === 'won' || result === 'won_perfect')
    ? Math.round(
        (result === 'won_perfect' ? 60 : 40)
        + 25 * (budgetLeft / level.totalBudget)
        + (result === 'won_perfect' ? 15 * (turnsLeft / level.turns) : 0)
      )
    : 0

  const step3num = level.hasQuarantine ? 3 : 2
  const needVaccEffStep = needVaccEffQ

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
        <div className={`rounded-2xl p-6 text-center text-white ${result === 'lost_hospital' ? 'bg-red-900' : 'bg-green-800'}`}>
          <div className="text-5xl mb-3">
            {result === 'won_perfect' ? '🏆' : result === 'won' ? '🏥' : '🚑'}
          </div>
          <h2 className="text-2xl font-bold">
            {result === 'won_perfect' ? 'Ідеально! Епідемію ліквідовано!' : result === 'won' ? 'Епідемію взято під контроль!' : 'Лікарня переповнена!'}
          </h2>
          {result !== 'lost_hospital' ? (
            <div className="mt-3 space-y-1">
              <div className="bg-white rounded-xl px-4 py-2 inline-block">
                <span className="text-3xl font-bold text-black">{score}</span><span className="text-lg text-gray-700"> / 100</span>
              </div>
              <p className="text-sm opacity-80">
                {result === 'won_perfect'
                  ? `Заражених: 0! Залишилось ${budgetLeft} монет і ${turnsLeft} ходів`
                  : `Пережили всі ходи, залишилось ${pop.I} хворих і ${budgetLeft} монет`}
              </p>
              {result === 'won' && <p className="text-xs opacity-60 mt-1">Спробуй краще — ціль зменшити заражених до 0!</p>}
            </div>
          ) : (
            <p className="text-sm mt-2 opacity-80">
              {`${pop.I.toLocaleString()} заражених — лікарня може прийняти лише ${level.hospitalCap}`}
            </p>
          )}
        </div>

        <PostGameReport
          history={history}
          level={level}
          result={result}
          finalBudget={budgetLeft}
        />

        <div className="bg-gray-800 rounded-2xl p-4">
          <h3 className="text-white font-bold mb-3">📐 Підсумок: модель SIR</h3>
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
      {infoOpen && <InfoPanel level={level} onClose={() => setInfoOpen(false)} />}

      <div className="max-w-lg mx-auto space-y-3 pb-6">

        {/* Top bar */}
        <div className="flex items-center justify-between">
          <button onClick={() => setScreen('levels')} className="text-gray-400 hover:text-white text-sm">← Рівні</button>
          <span className="text-white font-bold text-sm">{level.badge} {level.name}</span>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">Хід {currentTurn}/{level.turns}</span>
            <button
              onClick={() => setInfoOpen(true)}
              className="bg-gray-700 hover:bg-gray-600 text-white rounded-lg px-2 py-1 text-xs font-medium transition-colors"
            >
              📖 Довідник
            </button>
          </div>
        </div>

        {/* Status message from last turn */}
        {lastTurnMsg && (
          <div className={`rounded-xl px-4 py-2 text-sm font-medium ${
            lastTurnMsg.startsWith('🚨') ? 'bg-red-900 text-red-300' :
            lastTurnMsg.startsWith('📉') ? 'bg-green-900 text-green-300' :
            lastTurnMsg.startsWith('✅') ? 'bg-blue-900 text-blue-300' :
            'bg-yellow-900 text-yellow-300'
          }`}>
            {lastTurnMsg}
          </div>
        )}

        {/* Population stacked bar */}
        <div className="bg-gray-800 rounded-2xl p-4">
          <div className="flex justify-between text-gray-400 text-xs font-semibold mb-2 uppercase">
            <span>Населення: {level.N.toLocaleString('uk')}</span>
            <span>Хід {currentTurn}/{level.turns}</span>
          </div>
          <div className="w-full h-4 rounded-full overflow-hidden flex mb-2">
            <div className="bg-gray-500 transition-all duration-500" style={{ width: `${(pop.S / level.N) * 100}%` }} />
            <div className="bg-red-500 transition-all duration-500" style={{ width: `${(pop.I / level.N) * 100}%` }} />
            <div className="bg-green-500 transition-all duration-500" style={{ width: `${(pop.R / level.N) * 100}%` }} />
            <div className="bg-blue-500 transition-all duration-500" style={{ width: `${(pop.V / level.N) * 100}%` }} />
          </div>
          <div className="grid grid-cols-4 gap-1 text-center text-xs">
            {[
              { label: 'Вразливі', key: 'S', val: pop.S, color: 'text-gray-300', dot: 'bg-gray-500' },
              { label: 'Заражені', key: 'I', val: pop.I, color: 'text-red-400', dot: 'bg-red-500' },
              { label: 'Одужали', key: 'R', val: pop.R, color: 'text-green-400', dot: 'bg-green-500' },
              { label: 'Вакцин.', key: 'V', val: pop.V, color: 'text-blue-400', dot: 'bg-blue-500' },
            ].map(g => (
              <div key={g.key}>
                <div className={`font-bold ${g.color}`}>{g.val.toLocaleString()}</div>
                <div className="flex items-center justify-center gap-1 mt-0.5">
                  <span className={`w-2 h-2 rounded-full ${g.dot}`} />
                  <span className="text-gray-500">{g.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chart */}
        {chartData.length > 1 && (
          <div className="bg-gray-800 rounded-2xl p-4">
            <div className="text-gray-400 text-xs font-semibold mb-2 uppercase">📈 Динаміка епідемії (% від населення)</div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="turn" tick={{ fill: '#6b7280', fontSize: 10 }} label={{ value: 'хід', position: 'insideRight', offset: 10, fill: '#6b7280', fontSize: 10 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} unit="%" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#9ca3af' }}
                  formatter={(val, name) => [`${val}%`, name as string]}
                  labelFormatter={(l) => `Хід ${l}`}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                <ReferenceLine y={herdImmunityPct} stroke="#4ade80" strokeDasharray="4 2" label={{ value: `поріг ${herdImmunityPct}%`, fill: '#4ade80', fontSize: 9, position: 'insideTopLeft' }} />
                <Line type="monotone" dataKey="S" name="Вразливі" stroke="#9ca3af" dot={false} strokeWidth={1.5} />
                <Line type="monotone" dataKey="I" name="Заражені" stroke="#ef4444" dot={{ r: 3, fill: '#ef4444' }} strokeWidth={2} />
                <Line type="monotone" dataKey="R" name="Одужали" stroke="#22c55e" dot={false} strokeWidth={1.5} />
                <Line type="monotone" dataKey="V" name="Вакцин." stroke="#3b82f6" dot={false} strokeWidth={1.5} />
                <Line type="monotone" dataKey="Лікарня" name="Лікарня %" stroke="#f97316" dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

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

        {/* ── Step 1: Vaccination slider ──────────────────────────────────── */}
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

          {/* R_eff preview */}
          {vaccCount > 0 && (
            <div className={`rounded-lg px-3 py-1.5 text-xs flex items-center gap-2 ${
              previewReff < Reff ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-400'
            }`}>
              <span>R_eff після вакцинації:</span>
              <span className="font-bold">{previewReff}</span>
              {previewReff < calcReff(level.R0, pop.S, level.N) && (
                <span className="text-green-400">↓ було {calcReff(level.R0, pop.S, level.N)}</span>
              )}
            </div>
          )}
        </div>

        {/* ── Step 2: Quarantine (optional) ──────────────────────────────── */}
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
              onClick={() => { setQuarantine(v => !v); setPredictionChoice(null) }}
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

        {/* ── Vaccine effectiveness question (level 3) ────────────────────── */}
        {needVaccEffStep && (
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
              <p className="text-xs text-red-400">Не зовсім. Спробуй ще раз: {vaccCount} × {level.vaccEff} = {effectiveImmune}</p>
            )}
            {vaccEffChoice === effectiveImmune && (
              <p className="text-xs text-green-400">✓ Вірно! {vaccCount} вакцин захистять {effectiveImmune} людей.</p>
            )}
          </div>
        )}

        {/* ── Predict new infected ────────────────────────────────────────── */}
        <div className="bg-gray-800 rounded-2xl p-4 space-y-3">
          <div>
            <span className="bg-purple-600 text-white rounded-full w-5 h-5 inline-flex items-center justify-center text-xs mr-2">
              {needVaccEffStep ? step3num + 1 : step3num}
            </span>
            <span className="text-white font-semibold text-sm">🔮 Скільки нових заражених з'явиться?</span>
          </div>

          {/* Variable legend above formula */}
          <div className="grid grid-cols-4 gap-1 text-center text-xs mb-1">
            {[
              { label: 'I заражені', val: pop.I, color: 'text-red-300', bg: 'bg-red-950' },
              { label: 'R₀ вірус', val: R0effective, color: 'text-orange-300', bg: 'bg-orange-950' },
              { label: 'S вразливі', val: newS, color: 'text-gray-200', bg: 'bg-gray-700' },
              { label: 'N населення', val: level.N, color: 'text-gray-400', bg: 'bg-gray-700' },
            ].map(v => (
              <div key={v.label} className={`${v.bg} rounded-lg py-1.5`}>
                <div className={`font-bold text-sm ${v.color}`}>{v.val.toLocaleString()}</div>
                <div className="text-gray-500 text-xs leading-tight">{v.label}</div>
              </div>
            ))}
          </div>
          <div className="bg-gray-700 rounded-xl px-4 py-3 font-mono text-sm text-center">
            <span className="text-red-300">{pop.I}</span>
            <span className="text-gray-400"> × </span>
            <span className="text-orange-300">{R0effective}</span>
            <span className="text-gray-400"> × </span>
            <span className="text-gray-200">{newS}</span>
            <span className="text-gray-400"> / </span>
            <span className="text-gray-400">{level.N}</span>
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
