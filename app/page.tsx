import Link from 'next/link'

const MODULES = [
  {
    order: 0,
    title: 'Вступ: Математика як мова реальності',
    description: 'Що таке математична модель, як читати задачу і не розгубитись у даних.',
    href: '/lesson/1',
    active: true,
  },
  {
    order: 1,
    title: 'Відсотки та пропорції',
    description: 'Знижки, курси валют, статистика — скрізь де є "скільки від чого".',
    href: null,
    active: false,
  },
  {
    order: 2,
    title: 'Швидкість, час, відстань',
    description: 'Моделі руху: від пішохода до потяга.',
    href: null,
    active: false,
  },
  {
    order: 3,
    title: 'Ймовірність і ризик',
    description: 'Як математика допомагає приймати рішення в умовах невизначеності.',
    href: null,
    active: false,
  },
]

const GAMES = [
  {
    title: 'Епідемія',
    description: 'SIR-модель розповсюдження хвороби. Керуй вакцинацією і спостерігай за графіком.',
    href: '/games/epidemic',
    emoji: '🦠',
    color: 'bg-red-50 border-red-200 hover:bg-red-100',
    badge: 'bg-red-100 text-red-700',
  },
  {
    title: 'Паркування',
    description: 'Розрахуй вартість паркування за різними тарифними формулами.',
    href: '/games/parking',
    emoji: '🅿️',
    color: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
    badge: 'bg-blue-100 text-blue-700',
  },
  {
    title: 'Майстриня',
    description: 'Пропорції, ділення та послідовності через задачі про в\'язання.',
    href: '/games/knitting',
    emoji: '🧶',
    color: 'bg-purple-50 border-purple-200 hover:bg-purple-100',
    badge: 'bg-purple-100 text-purple-700',
  },
  {
    title: 'Зупини армію',
    description: 'Стратегічна гра: використовуй математику щоб зупинити ворожі загони.',
    href: '/games/army',
    emoji: '⚔️',
    color: 'bg-orange-50 border-orange-200 hover:bg-orange-100',
    badge: 'bg-orange-100 text-orange-700',
  },
  {
    title: 'Ринок',
    description: 'Попит, пропозиція і ціни — керуй торгівлею і знаходь рівновагу.',
    href: '/games/market',
    emoji: '🏪',
    color: 'bg-green-50 border-green-200 hover:bg-green-100',
    badge: 'bg-green-100 text-green-700',
  },
  {
    title: 'Будівельник',
    description: 'Розраховуй матеріали, площі та витрати для будівництва.',
    href: '/games/builder',
    emoji: '🏗️',
    color: 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100',
    badge: 'bg-yellow-100 text-yellow-700',
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">📐 Прикладна математика</h1>
        <Link
          href="/login"
          className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Увійти до курсу
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-10">
        {/* Hero */}
        <section>
          <h2 className="text-3xl font-bold mb-3">Математика, яка пояснює світ</h2>
          <p className="text-gray-600 text-lg">
            Курс для тих, хто хоче розуміти — а не просто рахувати. Реальні задачі,
            інтерактивні моделі та ігри, які показують математику в дії.
          </p>
        </section>

        {/* Modules */}
        <section>
          <h3 className="text-lg font-semibold mb-4">Модулі курсу</h3>
          <div className="flex flex-col gap-3">
            {MODULES.map((mod) => (
              <div
                key={mod.order}
                className={`bg-white rounded-lg border p-4 ${mod.active ? 'border-blue-300' : 'opacity-60'}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs text-gray-400 uppercase tracking-wide">
                      Модуль {mod.order}
                    </span>
                    <h4 className="font-semibold">{mod.title}</h4>
                    <p className="text-sm text-gray-500 mt-1">{mod.description}</p>
                  </div>
                  <div className="ml-4 shrink-0">
                    {mod.active ? (
                      <Link
                        href="/login"
                        className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition-colors"
                      >
                        Почати →
                      </Link>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-400 px-3 py-1.5 rounded">
                        Скоро
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Games */}
        <section>
          <h3 className="text-lg font-semibold mb-1">Ігри-симуляції</h3>
          <p className="text-sm text-gray-500 mb-4">Можна грати без реєстрації — просто натисни і досліджуй</p>
          <div className="flex flex-col gap-3">
            {GAMES.map((game) => (
              <Link
                key={game.href}
                href={game.href}
                className={`border rounded-lg p-4 flex items-center gap-4 transition-colors ${game.color}`}
              >
                <span className="text-3xl">{game.emoji}</span>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold">{game.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${game.badge}`}>
                      гра
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{game.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
