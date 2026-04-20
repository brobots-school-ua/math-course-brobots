'use client'

import { useState, useMemo } from 'react'

interface Product {
  id: number
  emoji: string
  name: string
  unit: string
  basePrice: number
  discount: number   // відсоток знижки, 0 якщо немає
  required: boolean  // обов'язкова покупка
}

const PRODUCTS: Product[] = [
  { id: 1,  emoji: '🥛', name: 'Молоко',     unit: '1 л',   basePrice: 48,  discount: 10, required: true  },
  { id: 2,  emoji: '🍞', name: 'Хліб',       unit: '1 шт',  basePrice: 32,  discount: 0,  required: true  },
  { id: 3,  emoji: '🥚', name: 'Яйця',       unit: '10 шт', basePrice: 95,  discount: 15, required: true  },
  { id: 4,  emoji: '🧀', name: 'Сир',        unit: '200 г', basePrice: 74,  discount: 0,  required: false },
  { id: 5,  emoji: '🧈', name: 'Масло',      unit: '200 г', basePrice: 85,  discount: 20, required: false },
  { id: 6,  emoji: '🍅', name: 'Помідори',   unit: '500 г', basePrice: 52,  discount: 0,  required: false },
  { id: 7,  emoji: '🍝', name: 'Макарони',   unit: '400 г', basePrice: 42,  discount: 5,  required: false },
  { id: 8,  emoji: '🍗', name: 'Курятина',   unit: '500 г', basePrice: 138, discount: 25, required: false },
  { id: 9,  emoji: '🥤', name: 'Сік',        unit: '1 л',   basePrice: 68,  discount: 0,  required: false },
  { id: 10, emoji: '🍫', name: 'Шоколад',    unit: '100 г', basePrice: 55,  discount: 30, required: false },
]

const BUDGET = 350

function finalPrice(p: Product): number {
  return Math.round(p.basePrice * (1 - p.discount / 100) * 100) / 100
}

function savedAmount(p: Product): number {
  return Math.round((p.basePrice - finalPrice(p)) * 100) / 100
}

type GameState = 'playing' | 'success' | 'over_budget' | 'missing_required'

export default function MarketGame() {
  const [cart, setCart] = useState<Set<number>>(new Set())
  const [submitted, setSubmitted] = useState(false)
  const [gameState, setGameState] = useState<GameState>('playing')

  const total = useMemo(
    () => PRODUCTS.filter(p => cart.has(p.id)).reduce((sum, p) => sum + finalPrice(p), 0),
    [cart]
  )

  const totalSaved = useMemo(
    () => PRODUCTS.filter(p => cart.has(p.id)).reduce((sum, p) => sum + savedAmount(p), 0),
    [cart]
  )

  const remaining = BUDGET - total
  const requiredIds = PRODUCTS.filter(p => p.required).map(p => p.id)
  const allRequiredInCart = requiredIds.every(id => cart.has(id))

  function toggleItem(id: number) {
    if (submitted) return
    setCart(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleSubmit() {
    if (!allRequiredInCart) {
      setGameState('missing_required')
    } else if (total > BUDGET) {
      setGameState('over_budget')
    } else {
      setGameState('success')
    }
    setSubmitted(true)
  }

  function handleReset() {
    setCart(new Set())
    setSubmitted(false)
    setGameState('playing')
  }

  const cartItems = PRODUCTS.filter(p => cart.has(p.id))

  // Score: base 60 for required items + up to 40 for efficiency (closer to budget = better)
  const score = gameState === 'success'
    ? Math.round(60 + 40 * (1 - remaining / BUDGET))
    : 0

  return (
    <div className="min-h-screen bg-amber-50 p-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="bg-white rounded-2xl shadow p-5 mb-4">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">🛒</span>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Гра «Ринок»</h1>
              <p className="text-sm text-gray-500">Модуль 2 · Відсотки та знижки</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Мама дала тобі <strong>350 грн</strong> і список покупок.
            Купи всі <span className="text-red-500 font-semibold">обов'язкові товари</span> (позначені 🔴)
            і постарайся витратити якомога більше з бюджету — залишок здавати не потрібно, але й перевитрати бути не може.
          </p>
        </div>

        {/* Budget indicator */}
        <div className={`rounded-2xl shadow p-4 mb-4 transition-colors ${
          total > BUDGET ? 'bg-red-100 border-2 border-red-400' : 'bg-green-50'
        }`}>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-600">Бюджет використано</span>
            <span className={`text-lg font-bold ${total > BUDGET ? 'text-red-600' : 'text-green-700'}`}>
              {total.toFixed(2)} / {BUDGET} грн
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className={`h-3 rounded-full transition-all duration-300 ${
                total > BUDGET ? 'bg-red-500' : total > BUDGET * 0.9 ? 'bg-amber-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min((total / BUDGET) * 100, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-gray-500">
              {total > BUDGET
                ? `⚠️ Перевищення на ${(total - BUDGET).toFixed(2)} грн`
                : `Залишок: ${remaining.toFixed(2)} грн`}
            </span>
            {totalSaved > 0 && (
              <span className="text-xs text-green-600 font-medium">
                💰 Зекономлено на знижках: {totalSaved.toFixed(2)} грн
              </span>
            )}
          </div>
        </div>

        {/* Products grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {PRODUCTS.map(product => {
            const inCart = cart.has(product.id)
            const fp = finalPrice(product)
            const saved = savedAmount(product)
            return (
              <button
                key={product.id}
                onClick={() => toggleItem(product.id)}
                disabled={submitted}
                className={`rounded-2xl p-3 text-left border-2 transition-all ${
                  submitted ? 'cursor-default' : 'cursor-pointer hover:shadow-md'
                } ${
                  inCart
                    ? 'bg-blue-50 border-blue-400 shadow-md'
                    : 'bg-white border-gray-200'
                } ${
                  submitted && product.required && !inCart
                    ? 'border-red-400 bg-red-50'
                    : ''
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="text-2xl">{product.emoji}</span>
                  <div className="flex gap-1">
                    {product.required && (
                      <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
                        🔴 обов'язково
                      </span>
                    )}
                    {inCart && (
                      <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">
                        ✓ в кошику
                      </span>
                    )}
                  </div>
                </div>
                <div className="font-semibold text-gray-800 text-sm">{product.name}</div>
                <div className="text-xs text-gray-400 mb-1">{product.unit}</div>
                <div className="flex items-baseline gap-2">
                  <span className="font-bold text-gray-900">{fp.toFixed(2)} грн</span>
                  {product.discount > 0 && (
                    <>
                      <span className="text-xs line-through text-gray-400">{product.basePrice}</span>
                      <span className="text-xs text-green-600 font-medium">-{product.discount}%</span>
                    </>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Missing required warning */}
        {!submitted && !allRequiredInCart && cart.size > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-3 text-sm text-orange-700">
            ⚠️ Ще не вибрано всі обов'язкові товари (🔴)
          </div>
        )}

        {/* Submit button */}
        {!submitted && (
          <button
            onClick={handleSubmit}
            disabled={cart.size === 0}
            className="w-full bg-blue-600 text-white rounded-2xl py-3 font-semibold text-base
              disabled:opacity-40 hover:bg-blue-700 transition-colors shadow"
          >
            Оплатити ({total.toFixed(2)} грн)
          </button>
        )}

        {/* Result */}
        {submitted && (
          <div className={`rounded-2xl shadow-lg p-5 mt-2 ${
            gameState === 'success' ? 'bg-green-50 border-2 border-green-400'
            : 'bg-red-50 border-2 border-red-400'
          }`}>
            {gameState === 'success' && (
              <>
                <div className="text-center mb-4">
                  <div className="text-4xl mb-2">🎉</div>
                  <h2 className="text-xl font-bold text-green-700">Чудово! Завдання виконано!</h2>
                  <p className="text-gray-600 text-sm mt-1">
                    Всі обов'язкові товари куплено, бюджет не перевищено.
                  </p>
                  <div className="mt-3 inline-block bg-green-100 rounded-xl px-4 py-2">
                    <span className="text-2xl font-bold text-green-700">{score}</span>
                    <span className="text-green-600 text-sm"> / 100 балів</span>
                  </div>
                </div>
              </>
            )}
            {gameState === 'missing_required' && (
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">😕</div>
                <h2 className="text-xl font-bold text-red-700">Не вистачає обов'язкових товарів</h2>
                <p className="text-gray-600 text-sm mt-1">
                  Мама просила купити певні продукти — без них не можна повертатися додому!
                </p>
              </div>
            )}
            {gameState === 'over_budget' && (
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">💸</div>
                <h2 className="text-xl font-bold text-red-700">Перевищено бюджет!</h2>
                <p className="text-gray-600 text-sm mt-1">
                  У тебе тільки 350 грн. Потрібно прибрати щось із кошика.
                </p>
              </div>
            )}

            {/* Math breakdown — shown always */}
            <div className="bg-white rounded-xl p-4 mt-2">
              <h3 className="font-bold text-gray-700 mb-3">🧮 Як рахувалась ціна зі знижкою</h3>
              {cartItems.length === 0 ? (
                <p className="text-sm text-gray-400">Кошик порожній</p>
              ) : (
                <div className="space-y-2">
                  {cartItems.map(p => (
                    <div key={p.id} className="text-sm">
                      <div className="flex justify-between">
                        <span>{p.emoji} {p.name}</span>
                        <span className="font-semibold">{finalPrice(p).toFixed(2)} грн</span>
                      </div>
                      {p.discount > 0 && (
                        <div className="text-xs text-gray-500 ml-4">
                          {p.basePrice} × (1 − {p.discount}/100) = {p.basePrice} × {((100 - p.discount) / 100).toFixed(2)} = {finalPrice(p).toFixed(2)} грн
                          <span className="text-green-600 ml-1">(зекономлено {savedAmount(p).toFixed(2)} грн)</span>
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="border-t pt-2 flex justify-between font-bold text-gray-800">
                    <span>Разом</span>
                    <span>{total.toFixed(2)} грн</span>
                  </div>
                  {totalSaved > 0 && (
                    <div className="text-xs text-green-600 text-right">
                      Завдяки знижкам ти зекономив(ла) {totalSaved.toFixed(2)} грн 🎯
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Formula reminder */}
            <div className="bg-blue-50 rounded-xl p-4 mt-3">
              <h3 className="font-bold text-gray-700 mb-2">📐 Формула знижки</h3>
              <div className="text-sm text-gray-600 space-y-1">
                <p><strong>Ціна зі знижкою</strong> = Стара ціна × (1 − Знижка%/100)</p>
                <p><strong>Сума знижки</strong> = Стара ціна × Знижка%/100</p>
                <p className="text-xs text-gray-400 mt-2">
                  Наприклад: молоко 48 грн зі знижкою 10%:
                  <br />48 × (1 − 10/100) = 48 × 0.9 = <strong>43.2 грн</strong>
                </p>
              </div>
            </div>

            <button
              onClick={handleReset}
              className="w-full mt-4 bg-blue-600 text-white rounded-2xl py-3 font-semibold
                hover:bg-blue-700 transition-colors"
            >
              Спробувати ще раз
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
