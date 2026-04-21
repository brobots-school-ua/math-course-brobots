'use client'

import { useState } from 'react'

// ─── Data types ───────────────────────────────────────────────────────────────

interface Step {
  label: string
  question: string
  formula: string
  answer: number
  options: number[]
  unit: string
  successNote?: string
}

interface Project {
  id: number
  clientName: string
  clientEmoji: string
  request: string
  details: string
  yarnColor: string   // tailwind bg class
  yarnName: string
  steps: Step[]
  doneText: string
}

interface KnittingLevel {
  id: number
  name: string
  item: string
  emoji: string
  bg: string          // gradient classes
  theoryTitle: string
  theoryConcept: string
  theoryFormula: string
  theoryExample: string
  projects: Project[]
}

// ─── All levels & projects ────────────────────────────────────────────────────

const LEVELS: KnittingLevel[] = [
  // ── Level 1: Шарф (Gauge) ──────────────────────────────────────────────────
  {
    id: 1,
    name: 'Шарф',
    item: 'шарф',
    emoji: '🧣',
    bg: 'from-rose-700 to-rose-500',
    theoryTitle: 'Калібрування (Gauge)',
    theoryConcept:
      'Перш ніж в\'язати, майстриня робить невеликий зразок (10×10 см) і рахує петлі. '
    + 'Ця щільність називається gauge. Знаючи її, можна розрахувати скільки петель набрати для будь-якої ширини.',
    theoryFormula: 'петлі = ширина × петель_у_зразку / 10',
    theoryExample: 'Зразок: 20 петель = 10 см. Потрібна ширина 30 см → 30 × 20 / 10 = 60 петель',
    projects: [
      {
        id: 1, clientName: 'Оленка', clientEmoji: '👧',
        request: 'Хочу ніжний рожевий шарфик, 30 см завширшки',
        details: 'Зразок пряжі: 20 петель = 10 см',
        yarnColor: 'bg-pink-400', yarnName: 'Рожева',
        steps: [
          { label: 'Крок 1 — розрахуй кількість петель для набору',
            question: 'Ширина 30 см, зразок 20 петель/10 см. Скільки петель набрати?',
            formula: '30 × 20 / 10 = ?', answer: 60, options: [40, 60, 80], unit: 'петель',
            successNote: 'Набираємо 60 петель і починаємо в\'язати!' },
        ],
        doneText: 'Рожевий шарфик для Оленки готовий 🎀',
      },
      {
        id: 2, clientName: 'Бабуся Ніна', clientEmoji: '👵',
        request: 'Теплий шарф 25 см, пряжа товстіша',
        details: 'Зразок пряжі: 16 петель = 10 см',
        yarnColor: 'bg-amber-500', yarnName: 'Золотиста',
        steps: [
          { label: 'Крок 1 — розрахуй кількість петель',
            question: 'Ширина 25 см, зразок 16 петель/10 см. Скільки петель набрати?',
            formula: '25 × 16 / 10 = ?', answer: 40, options: [32, 40, 48], unit: 'петель',
            successNote: 'Набираємо 40 петель — товста пряжа, тому петель менше!' },
        ],
        doneText: 'Теплий шарф для бабусі Ніни готовий 🍂',
      },
      {
        id: 3, clientName: 'Маринка', clientEmoji: '👩',
        request: 'Широкий шарф-бактус 40 см, тонка пряжа',
        details: 'Зразок пряжі: 18 петель = 10 см',
        yarnColor: 'bg-violet-500', yarnName: 'Лавандова',
        steps: [
          { label: 'Крок 1 — розрахуй кількість петель',
            question: 'Ширина 40 см, зразок 18 петель/10 см. Скільки петель набрати?',
            formula: '40 × 18 / 10 = ?', answer: 72, options: [60, 72, 80], unit: 'петель',
            successNote: 'Набираємо 72 петлі для широкого шарфа!' },
        ],
        doneText: 'Лавандовий бактус для Маринки готовий 💜',
      },
    ],
  },

  // ── Level 2: Подушка (Pattern repeat) ─────────────────────────────────────
  {
    id: 2,
    name: 'Подушка з узором',
    item: 'подушку',
    emoji: '🛋️',
    bg: 'from-teal-700 to-teal-500',
    theoryTitle: 'Повтор узору',
    theoryConcept:
      'Більшість узорів — це мотив у N петель, який повторюється. '
    + 'Щоб узор "вийшов рівно" без обрізаних мотивів, загальна кількість петель має ділитися на N без остачі.',
    theoryFormula: 'петлі ÷ мотив = ціле число (остача = 0)',
    theoryExample: '58 петель, мотив 8 → 58 ÷ 8 = 7 (остача 2) ✗ → підбираємо: 7×8=56 або 8×8=64',
    projects: [
      {
        id: 1, clientName: 'Дарина', clientEmoji: '👩‍🎨',
        request: 'Подушка з ромбовим узором, 60 петель',
        details: 'Мотив ромба: 6 петель. Чи підходить 60 петель?',
        yarnColor: 'bg-teal-400', yarnName: 'Морська',
        steps: [
          { label: 'Крок 1 — скільки повних повторів вміщується?',
            question: '60 петель, мотив 6 петель. Скільки разів мотив повторюється?',
            formula: '60 ÷ 6 = ?', answer: 10, options: [8, 10, 12], unit: 'разів',
            successNote: '10 повних повторів — рівно!' },
          { label: 'Крок 2 — перевірка остачі',
            question: 'Яка остача від ділення? (0 означає — підходить)',
            formula: '60 = 6 × 10 + ?', answer: 0, options: [0, 2, 4], unit: '',
            successNote: 'Остача 0 → 60 петель ідеально підходять для цього узору ✓' },
        ],
        doneText: 'Подушка з ромбами для Дарини готова 💎',
      },
      {
        id: 2, clientName: 'Соломія', clientEmoji: '👱‍♀️',
        request: 'Подушка з узором "коса", набрано 58 петель',
        details: 'Мотив коси: 8 петель. Чи ділиться 58 на 8?',
        yarnColor: 'bg-cyan-400', yarnName: 'Блакитна',
        steps: [
          { label: 'Крок 1 — скільки повних повторів?',
            question: '58 петель, мотив 8. Скільки повних мотивів входить?',
            formula: '58 ÷ 8 = ? (ціла частина)', answer: 7, options: [6, 7, 8], unit: 'повторів',
            successNote: '7 повних повторів, але є остача…' },
          { label: 'Крок 2 — підбери правильну кількість',
            question: '7×8=56 (на 2 менше) або 8×8=64 (на 6 більше). Яке число ближче до 58?',
            formula: '58 − 56 = 2,   64 − 58 = 6   →   ?', answer: 56, options: [48, 56, 64], unit: 'петель',
            successNote: 'Коригуємо до 56 петель — мотив буде рівним!' },
        ],
        doneText: 'Подушка з косою для Соломії готова 🌊',
      },
      {
        id: 3, clientName: 'Тетяна', clientEmoji: '🧑‍🦰',
        request: 'Подушка зі сніжинками, обрахували 70 петель',
        details: 'Мотив сніжинки: 9 петель. Підходить?',
        yarnColor: 'bg-blue-300', yarnName: 'Сніжна',
        steps: [
          { label: 'Крок 1 — скільки повних повторів?',
            question: '70 петель, мотив 9. Скільки повних мотивів входить?',
            formula: '70 ÷ 9 = ? (ціла частина)', answer: 7, options: [6, 7, 8], unit: 'повторів',
            successNote: '7 повних повторів = 63 петлі, але нам треба ще перевірити…' },
          { label: 'Крок 2 — підбери найближче кратне число',
            question: '7×9=63 (різниця 7) або 8×9=72 (різниця 2). Яке число підходить краще?',
            formula: '70 − 63 = 7,   72 − 70 = 2   →   ?', answer: 72, options: [63, 70, 72], unit: 'петель',
            successNote: 'Коригуємо до 72 петель — різниця лише 2!' },
        ],
        doneText: 'Сніжна подушка для Тетяни готова ❄️',
      },
    ],
  },

  // ── Level 3: Шапка (Arithmetic decreases) ─────────────────────────────────
  {
    id: 3,
    name: 'Шапка',
    item: 'шапку',
    emoji: '🧢',
    bg: 'from-purple-700 to-purple-500',
    theoryTitle: 'Убавки та арифметична прогресія',
    theoryConcept:
      'Верхівка шапки ("кругла") формується рівномірними убавками: шапка ділиться на N секцій, '
    + 'і в кожному ряді зменшується на 1 петлю з кожної секції. '
    + 'Це арифметична прогресія: 90 → 81 → 72 → … → 9 → 0.',
    theoryFormula: 'кількість рядів убавки = початкові петлі ÷ кількість секцій',
    theoryExample: '90 петель, 9 секцій → зменшення 9/ряд → 90 ÷ 9 = 10 рядів до закриття',
    projects: [
      {
        id: 1, clientName: 'Надійка', clientEmoji: '👧',
        request: 'Дитяча шапочка — обхват голови 50 см',
        details: '90 петель по колу, 9 секцій для убавки',
        yarnColor: 'bg-pink-300', yarnName: 'Ніжно-рожева',
        steps: [
          { label: 'Крок 1 — по скільки петель убавляємо щоразу?',
            question: 'Шапка має 9 секцій. По скільки петель зменшується кожен ряд?',
            formula: 'убавок/ряд = 1 × 9 секцій = ?', answer: 9, options: [6, 9, 12], unit: 'петель/ряд',
            successNote: 'Кожен ряд: −9 петель (по одній з кожної секції)' },
          { label: 'Крок 2 — скільки рядів убавки потрібно?',
            question: 'Починаємо з 90 петель, зменшуємо по 9. Скільки рядів?',
            formula: '90 ÷ 9 = ?', answer: 10, options: [8, 10, 12], unit: 'рядів',
            successNote: 'Прогресія: 90→81→72→63→54→45→36→27→18→9→0. Рівно 10 рядів!' },
        ],
        doneText: 'Рожева шапочка для Надійки готова 🌸',
      },
      {
        id: 2, clientName: 'Віктор', clientEmoji: '🧑',
        request: 'Чоловіча шапка — обхват 58 см',
        details: '80 петель по колу, 8 секцій для убавки',
        yarnColor: 'bg-gray-400', yarnName: 'Сіра',
        steps: [
          { label: 'Крок 1 — по скільки петель убавляємо?',
            question: 'Шапка має 8 секцій. По скільки петель зменшується кожен ряд?',
            formula: '1 × 8 = ?', answer: 8, options: [6, 8, 10], unit: 'петель/ряд',
            successNote: 'Кожен ряд: −8 петель' },
          { label: 'Крок 2 — скільки рядів убавки?',
            question: '80 петель, зменшуємо по 8. Скільки рядів убавки?',
            formula: '80 ÷ 8 = ?', answer: 10, options: [8, 10, 12], unit: 'рядів',
            successNote: 'Прогресія: 80→72→…→8→0. Рівно 10 рядів!' },
        ],
        doneText: 'Сіра чоловіча шапка для Віктора готова 🎩',
      },
      {
        id: 3, clientName: 'Іванко', clientEmoji: '👦',
        request: 'Підліткова шапка з помпоном',
        details: '72 петлі по колу, 6 секцій для убавки',
        yarnColor: 'bg-orange-400', yarnName: 'Помаранчева',
        steps: [
          { label: 'Крок 1 — убавок за ряд?',
            question: 'Шапка має 6 секцій. По скільки петель убавляємо щоразу?',
            formula: '1 × 6 = ?', answer: 6, options: [4, 6, 8], unit: 'петель/ряд',
            successNote: 'Кожен ряд: −6 петель' },
          { label: 'Крок 2 — скільки рядів убавки?',
            question: '72 петлі, по 6 кожного ряду. Скільки рядів до закриття?',
            formula: '72 ÷ 6 = ?', answer: 12, options: [10, 12, 14], unit: 'рядів',
            successNote: 'Прогресія: 72→66→60→…→6→0. Рівно 12 рядів!' },
        ],
        doneText: 'Помаранчева шапка з помпоном для Іванка готова 🎃',
      },
    ],
  },

  // ── Level 4: Митенки (Combined: gauge + gusset) ────────────────────────────
  {
    id: 4,
    name: 'Митенки',
    item: 'митенки',
    emoji: '🧤',
    bg: 'from-emerald-700 to-emerald-500',
    theoryTitle: 'Комплексний розрахунок: долоня + великий палець',
    theoryConcept:
      'Митенки складніші за шарф: спочатку рахуємо петлі для долоні (як у рівні 1), '
    + 'а потім розраховуємо "клин великого пальця" — прибавки, які формують виступ для пальця. '
    + 'Кожні 2 ряди додаємо 2 петлі, поки не наберемо потрібну кількість.',
    theoryFormula: 'рядів прибавки = петель для пальця ÷ 2',
    theoryExample: 'Палець: 14 петель → 14 ÷ 2 = 7 рядів прибавки (кожні 2 ряди +2 петлі)',
    projects: [
      {
        id: 1, clientName: 'Аня', clientEmoji: '👧',
        request: 'Ніжні митенки для маленьких рук',
        details: 'Обхват долоні 20 см, зразок 20 петель/10 см. Великий палець: 12 петель.',
        yarnColor: 'bg-rose-300', yarnName: 'Персикова',
        steps: [
          { label: 'Крок 1 — петлі для долоні',
            question: 'Обхват 20 см, зразок 20 петель/10 см. Скільки петель набрати?',
            formula: '20 × 20 / 10 = ?', answer: 40, options: [32, 40, 48], unit: 'петель',
            successNote: '40 петель — основа митенки!' },
          { label: 'Крок 2 — рядів прибавки для великого пальця',
            question: 'Для великого пальця потрібно 12 петель. +2 петлі кожні 2 ряди. Скільки разів прибавляємо?',
            formula: '12 ÷ 2 = ?', answer: 6, options: [4, 6, 8], unit: 'прибавок',
            successNote: '6 разів по +2 петлі = 12 петель для пальця ✓' },
        ],
        doneText: 'Персикові митенки для Ані готові 🌸',
      },
      {
        id: 2, clientName: 'Катруся', clientEmoji: '🧑‍🦱',
        request: 'Класичні вовняні митенки',
        details: 'Обхват долоні 22 см, зразок 20 петель/10 см. Великий палець: 16 петель.',
        yarnColor: 'bg-emerald-400', yarnName: 'Смарагдова',
        steps: [
          { label: 'Крок 1 — петлі для долоні',
            question: 'Обхват 22 см, зразок 20 петель/10 см. Скільки петель набрати?',
            formula: '22 × 20 / 10 = ?', answer: 44, options: [40, 44, 48], unit: 'петель',
            successNote: '44 петлі — трохи більша рука!' },
          { label: 'Крок 2 — рядів прибавки для великого пальця',
            question: 'Потрібно 16 петель для пальця. +2 кожні 2 ряди. Скільки прибавок?',
            formula: '16 ÷ 2 = ?', answer: 8, options: [6, 8, 10], unit: 'прибавок',
            successNote: '8 прибавок × 2 петлі = 16 петель ✓' },
        ],
        doneText: 'Смарагдові митенки для Катрусі готові 💚',
      },
      {
        id: 3, clientName: 'Пані Ірина', clientEmoji: '👩‍💼',
        request: 'Елегантні офісні митенки, тонка пряжа',
        details: 'Обхват долоні 24 см, зразок 18 петель/10 см. Великий палець: 14 петель.',
        yarnColor: 'bg-indigo-400', yarnName: 'Темно-синя',
        steps: [
          { label: 'Крок 1 — петлі для долоні',
            question: 'Обхват 24 см, зразок 18 петель/10 см. Скільки петель набрати?',
            formula: '24 × 18 / 10 = ?', answer: 44, options: [40, 44, 48], unit: 'петель',
            successNote: '43.2 → округлюємо до 44 (парне число зручніше для митенок)' },
          { label: 'Крок 2 — рядів прибавки для великого пальця',
            question: 'Потрібно 14 петель для пальця. Скільки прибавок по +2?',
            formula: '14 ÷ 2 = ?', answer: 7, options: [5, 7, 9], unit: 'прибавок',
            successNote: '7 прибавок × 2 петлі = 14 петель для пальця ✓' },
        ],
        doneText: 'Елегантні митенки для пані Ірини готові 💙',
      },
    ],
  },
]

// ─── Knitting visual ──────────────────────────────────────────────────────────

function KnittingVisual({
  yarnColor, totalSteps, completedSteps, levelEmoji,
}: {
  yarnColor: string; totalSteps: number; completedSteps: number; levelEmoji: string
}) {
  const pct = totalSteps > 0 ? completedSteps / totalSteps : 0
  const rows = 8
  const filledRows = Math.round(pct * rows)

  return (
    <div className="flex items-center gap-4">
      {/* Yarn ball */}
      <div className="text-4xl shrink-0">{completedSteps === totalSteps && totalSteps > 0 ? levelEmoji : '🧶'}</div>

      {/* Knitting grid */}
      <div className="flex-1">
        <div className="rounded-xl overflow-hidden border border-gray-600" style={{ height: 64 }}>
          <div className="h-full flex flex-col-reverse">
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i}
                className={`flex-1 transition-all duration-500 ${
                  i < filledRows
                    ? `${yarnColor} opacity-90`
                    : 'bg-gray-700'
                }`}
              >
                {i < filledRows && (
                  <div className="h-full w-full opacity-30"
                    style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(0,0,0,0.15) 4px, rgba(0,0,0,0.15) 5px)' }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-between mt-1 text-xs text-gray-500">
          <span>{completedSteps === totalSteps && totalSteps > 0 ? '✓ Готово!' : `${completedSteps}/${totalSteps} кроків`}</span>
          <span>{Math.round(pct * 100)}%</span>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type Screen = 'levels' | 'game' | 'result'

export default function KnittingGame() {
  const [screen, setScreen]       = useState<Screen>('levels')
  const [levelIdx, setLevelIdx]   = useState(0)
  const [projIdx, setProjIdx]     = useState(0)
  const [stepIdx, setStepIdx]     = useState(0)
  const [showTheory, setShowTheory] = useState(true)
  const [chosen, setChosen]       = useState<number | null>(null)
  const [score, setScore]         = useState(0)
  const [totalAnswers, setTotalAnswers] = useState(0)
  const [completedSteps, setCompletedSteps] = useState(0)
  const [hintOpen, setHintOpen]   = useState(false)
  const [projectDone, setProjectDone] = useState(false)

  const level   = LEVELS[levelIdx]
  const project = level.projects[projIdx]
  const step    = project.steps[stepIdx]

  // total steps in this project (for visual)
  const totalStepsInProject = project.steps.length

  function startLevel(idx: number) {
    setLevelIdx(idx)
    setProjIdx(0)
    setStepIdx(0)
    setShowTheory(true)
    setChosen(null)
    setScore(0)
    setTotalAnswers(0)
    setCompletedSteps(0)
    setHintOpen(false)
    setProjectDone(false)
    setScreen('game')
  }

  function handleChoice(v: number) {
    if (chosen === step.answer) return   // already correct
    setChosen(v)
    setTotalAnswers(t => t + 1)
    if (v === step.answer) {
      setScore(s => s + 1)
      setCompletedSteps(c => c + 1)
    }
  }

  function nextStep() {
    const isLastStep = stepIdx === project.steps.length - 1
    if (isLastStep) {
      setProjectDone(true)
    } else {
      setStepIdx(s => s + 1)
      setChosen(null)
      setHintOpen(false)
    }
  }

  function nextProject() {
    const isLastProject = projIdx === level.projects.length - 1
    if (isLastProject) {
      setScreen('result')
    } else {
      setProjIdx(p => p + 1)
      setStepIdx(0)
      setChosen(null)
      setCompletedSteps(0)
      setHintOpen(false)
      setProjectDone(false)
    }
  }

  // ── Level select ────────────────────────────────────────────────────────────
  if (screen === 'levels') return (
    <div className="min-h-screen bg-gray-950 p-4 flex flex-col items-center justify-center">
      <div className="max-w-md w-full space-y-4">
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">🧶</div>
          <h1 className="text-2xl font-bold text-white">Гра «Майстриня»</h1>
          <p className="text-gray-400 text-sm mt-1">Калібрування · Повтор узору · Прогресії · Комбінований розрахунок</p>
        </div>

        {LEVELS.map((lvl, i) => (
          <button key={lvl.id} onClick={() => startLevel(i)}
            className={`w-full rounded-2xl p-4 text-left text-white shadow-lg hover:scale-[1.02] transition-transform bg-gradient-to-r ${lvl.bg}`}>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{lvl.emoji}</span>
              <div className="flex-1">
                <div className="font-bold text-base">Рівень {lvl.id}: {lvl.name}</div>
                <div className="text-sm opacity-80">{lvl.projects.length} замовлення · {lvl.theoryTitle}</div>
              </div>
              <span className="text-2xl opacity-60">→</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )

  // ── Result ──────────────────────────────────────────────────────────────────
  if (screen === 'result') return (
    <div className="min-h-screen bg-gray-950 p-4 flex items-center justify-center">
      <div className="max-w-md w-full space-y-4">
        <div className="bg-green-800 rounded-2xl p-6 text-center text-white">
          <div className="text-5xl mb-3">🏆</div>
          <h2 className="text-2xl font-bold">Всі замовлення виконано!</h2>
          <div className="mt-3">
            <div className="bg-white rounded-xl px-4 py-2 inline-block">
              <span className="text-3xl font-bold text-black">{score}</span>
              <span className="text-gray-500 text-lg"> / {totalAnswers} відповідей</span>
            </div>
            <p className="text-sm opacity-70 mt-2">
              Правильних з першої спроби: {score} з {totalAnswers}
            </p>
          </div>
        </div>
        <button onClick={() => setScreen('levels')}
          className="w-full bg-gray-700 text-white rounded-2xl py-3 font-semibold hover:bg-gray-600">
          ← Вибрати інший рівень
        </button>
      </div>
    </div>
  )

  // ── Game ────────────────────────────────────────────────────────────────────

  // Theory screen
  if (showTheory) return (
    <div className="min-h-screen bg-gray-950 p-4">
      <div className="max-w-lg mx-auto space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setScreen('levels')} className="text-gray-400 hover:text-white text-sm">← Рівні</button>
          <span className="text-white font-bold">{level.emoji} {level.name}</span>
          <span className="text-gray-600 text-sm">теорія</span>
        </div>

        <div className={`rounded-2xl p-5 text-white bg-gradient-to-br ${level.bg}`}>
          <div className="text-2xl mb-2">📖 {level.theoryTitle}</div>
          <p className="text-sm opacity-90 leading-relaxed">{level.theoryConcept}</p>
        </div>

        <div className="bg-gray-800 rounded-2xl p-4 space-y-3">
          <div className="text-white font-semibold">Формула:</div>
          <div className="bg-gray-700 rounded-xl px-4 py-3 font-mono text-sm text-center text-yellow-300">
            {level.theoryFormula}
          </div>
          <div className="text-white font-semibold">Приклад:</div>
          <div className="bg-gray-700 rounded-xl px-4 py-3 text-sm text-gray-200">
            {level.theoryExample}
          </div>
        </div>

        <button
          onClick={() => setShowTheory(false)}
          className={`w-full rounded-2xl py-4 font-bold text-white text-base bg-gradient-to-r ${level.bg} hover:opacity-90`}
        >
          До замовлень →
        </button>
      </div>
    </div>
  )

  // Project done screen
  if (projectDone) return (
    <div className="min-h-screen bg-gray-950 p-4">
      <div className="max-w-lg mx-auto space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setScreen('levels')} className="text-gray-400 text-sm">← Рівні</button>
          <span className="text-white font-bold">{level.emoji} {level.name}</span>
          <span className="text-gray-400 text-sm">{projIdx + 1}/{level.projects.length}</span>
        </div>

        <div className="bg-green-800 rounded-2xl p-6 text-center text-white">
          <div className="text-5xl mb-3">{level.emoji}</div>
          <h2 className="text-lg font-bold">{project.doneText}</h2>
          <div className={`w-16 h-16 mx-auto mt-4 rounded-full ${project.yarnColor} flex items-center justify-center text-2xl`}>
            ✓
          </div>
        </div>

        <button
          onClick={nextProject}
          className={`w-full rounded-2xl py-4 font-bold text-white text-base bg-gradient-to-r ${level.bg}`}
        >
          {projIdx + 1 < level.projects.length
            ? `Наступне замовлення (${projIdx + 2}/${level.projects.length}) →`
            : '🏁 Завершити рівень'}
        </button>
      </div>
    </div>
  )

  // Main game screen
  return (
    <div className="min-h-screen bg-gray-950 p-4">
      <div className="max-w-lg mx-auto space-y-3 pb-6 pt-2">

        {/* Top bar */}
        <div className="flex items-center justify-between">
          <button onClick={() => setScreen('levels')} className="text-gray-400 hover:text-white text-sm">← Рівні</button>
          <span className="text-white font-bold text-sm">{level.emoji} {level.name}</span>
          <span className="text-gray-400 text-sm">Замовлення {projIdx + 1}/{level.projects.length}</span>
        </div>

        {/* Client card */}
        <div className="bg-gray-800 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-4xl">{project.clientEmoji}</span>
            <div className="flex-1">
              <div className="text-white font-bold">{project.clientName}</div>
              <div className="text-gray-300 text-sm italic">"{project.request}"</div>
              <div className="text-gray-400 text-xs mt-1">{project.details}</div>
            </div>
            <div className={`w-8 h-8 rounded-full ${project.yarnColor} shrink-0 mt-1`} title={project.yarnName} />
          </div>

          {/* Knitting visual */}
          <div className="mt-3 pt-3 border-t border-gray-700">
            <KnittingVisual
              yarnColor={project.yarnColor}
              totalSteps={totalStepsInProject}
              completedSteps={completedSteps}
              levelEmoji={level.emoji}
            />
          </div>
        </div>

        {/* Step progress */}
        {project.steps.length > 1 && (
          <div className="flex gap-2">
            {project.steps.map((_, i) => (
              <div key={i} className={`flex-1 h-1.5 rounded-full transition-all ${
                i < stepIdx ? 'bg-green-500' :
                i === stepIdx ? 'bg-yellow-400' :
                'bg-gray-700'
              }`} />
            ))}
          </div>
        )}

        {/* Calculation card */}
        <div className="bg-gray-800 rounded-2xl p-4 space-y-4">
          <div className="text-gray-400 text-xs font-semibold uppercase">{step.label}</div>
          <p className="text-white text-sm font-medium">{step.question}</p>

          <div className="bg-gray-700 rounded-xl px-4 py-2 font-mono text-sm text-center text-yellow-300">
            {step.formula}
          </div>

          {/* Choices */}
          <div className="grid grid-cols-3 gap-3">
            {step.options.map(opt => {
              const isCorrect = opt === step.answer
              const isChosen = chosen === opt
              let cls = 'bg-gray-700 text-white hover:bg-gray-600'
              if (chosen !== null) {
                if (isCorrect) cls = 'bg-green-700 text-white ring-2 ring-green-400'
                else if (isChosen) cls = 'bg-red-700 text-white'
                else cls = 'bg-gray-700 text-gray-500'
              }
              return (
                <button key={opt} onClick={() => handleChoice(opt)}
                  disabled={chosen === step.answer}
                  className={`py-4 rounded-xl font-bold text-xl transition-all ${cls}`}
                >
                  {opt}{step.unit && step.unit.length < 5 ? '' : ''}
                </button>
              )
            })}
          </div>

          {/* Unit label */}
          {step.unit && (
            <p className="text-xs text-gray-500 text-center">Одиниця: {step.unit}</p>
          )}

          {/* Feedback */}
          {chosen !== null && chosen !== step.answer && (
            <p className="text-xs text-red-400">Не вірно — спробуй ще раз 🔄</p>
          )}
          {chosen === step.answer && (
            <div className="bg-green-900 rounded-xl px-3 py-2">
              <p className="text-xs text-green-300 font-semibold">✓ Правильно!</p>
              {step.successNote && <p className="text-xs text-green-200 mt-0.5">{step.successNote}</p>}
            </div>
          )}
        </div>

        {/* Next step button */}
        {chosen === step.answer && (
          <button onClick={nextStep}
            className={`w-full rounded-2xl py-4 font-bold text-white text-base bg-gradient-to-r ${level.bg} hover:opacity-90`}
          >
            {stepIdx < project.steps.length - 1 ? 'Наступний крок →' : `Замовлення виконано ${level.emoji}`}
          </button>
        )}

        {/* Hint */}
        <div className="bg-gray-800 rounded-xl px-4 py-2">
          <button onClick={() => setHintOpen(v => !v)} className="text-xs text-yellow-400">
            💡 {hintOpen ? 'Сховати підказку' : 'Підказка'}
          </button>
          {hintOpen && (
            <div className="mt-2 text-xs text-yellow-200 space-y-1">
              <p className="font-mono">{level.theoryFormula}</p>
              <p className="text-yellow-300">{level.theoryExample}</p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
