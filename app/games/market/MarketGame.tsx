'use client'

import { useState, useMemo } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface BulkDeal {
  type: 'buyXpayY'   // купи X — заплати за Y (напр. 3 по ціні 2)
       | 'pctOff'    // знижка % від N штук
  buyQty: number
  payQty?: number    // для buyXpayY
  discountPct?: number // для pctOff
  label: string      // "3 за ціною 2"
}

interface Product {
  id: number
  departmentId: string
  brand: string
  name: string
  emoji: string
  price: number        // ціна за одиницю
  packageSize: number  // у грамах або мл
  packageUnit: string  // 'г' або 'мл'
  unitPrice100: number // ціна за 100г/мл (розраховано)
  tags: string[]       // ['органічне', 'без лактози', ...]
  composition: string
  discount: number     // % разова знижка
  bulkDeal?: BulkDeal
}

interface Department {
  id: string
  name: string
  emoji: string
  products: Product[]
}

interface Requirement {
  departmentId: string
  minQty: number
  preferTags?: string[]   // бажані теги
  avoidTags?: string[]    // небажані теги
  label: string           // "хоча б 2 пачки хліба"
}

interface Persona {
  name: string
  emoji: string
  description: string
  budget: number
  requirements: Requirement[]
  hints: string[]
}

// ─── Game Data ────────────────────────────────────────────────────────────────

const DEPARTMENTS: Department[] = [
  {
    id: 'dairy',
    name: 'Молочний відділ',
    emoji: '🥛',
    products: [
      {
        id: 1, departmentId: 'dairy',
        brand: 'Яготинське', name: 'Молоко 2,5%', emoji: '🥛',
        price: 38, packageSize: 1000, packageUnit: 'мл', unitPrice100: 3.8,
        tags: ['пастеризоване'],
        composition: 'Незбиране коров\'яче молоко',
        discount: 0,
        bulkDeal: { type: 'buyXpayY', buyQty: 3, payQty: 2, label: '3 пачки за ціною 2' },
      },
      {
        id: 2, departmentId: 'dairy',
        brand: 'Organic Milk', name: 'Молоко органічне 3,2%', emoji: '🥛',
        price: 82, packageSize: 1000, packageUnit: 'мл', unitPrice100: 8.2,
        tags: ['органічне', 'без антибіотиків', 'преміум'],
        composition: 'Органічне молоко з трав\'яного годування',
        discount: 0,
      },
      {
        id: 3, departmentId: 'dairy',
        brand: 'Lactel', name: 'Молоко без лактози', emoji: '🥛',
        price: 67, packageSize: 1000, packageUnit: 'мл', unitPrice100: 6.7,
        tags: ['без лактози', 'для алергіків'],
        composition: 'Молоко + фермент лактаза',
        discount: 10,
      },
    ],
  },
  {
    id: 'bread',
    name: 'Хлібний відділ',
    emoji: '🍞',
    products: [
      {
        id: 4, departmentId: 'bread',
        brand: 'Кульчицький', name: 'Хліб білий', emoji: '🍞',
        price: 29, packageSize: 400, packageUnit: 'г', unitPrice100: 7.25,
        tags: ['пшеничний', 'класичний'],
        composition: 'Борошно в/с, вода, дріжджі, сіль',
        discount: 0,
        bulkDeal: { type: 'pctOff', buyQty: 2, discountPct: 20, label: '−20% від 2 шт' },
      },
      {
        id: 5, departmentId: 'bread',
        brand: 'Bon Appetit', name: 'Хліб цільнозерновий', emoji: '🫓',
        price: 56, packageSize: 350, packageUnit: 'г', unitPrice100: 16,
        tags: ['цільнозерновий', 'клітковина', 'ЗСЖ'],
        composition: 'Борошно цільнозернове, насіння льону, вівсянка',
        discount: 0,
      },
      {
        id: 6, departmentId: 'bread',
        brand: 'Free From', name: 'Хліб без глютену', emoji: '🫓',
        price: 94, packageSize: 300, packageUnit: 'г', unitPrice100: 31.3,
        tags: ['без глютену', 'для алергіків', 'рисове борошно'],
        composition: 'Рисове борошно, крохмаль, яйця',
        discount: 5,
      },
    ],
  },
  {
    id: 'meat',
    name: "М'ясний відділ",
    emoji: '🍗',
    products: [
      {
        id: 7, departmentId: 'meat',
        brand: 'Наша Ряба', name: 'Філе куряче охолоджене', emoji: '🍗',
        price: 158, packageSize: 1000, packageUnit: 'г', unitPrice100: 15.8,
        tags: ['охолоджене', 'без заморозки', 'свіже'],
        composition: 'Куряче філе, без добавок',
        discount: 0,
        bulkDeal: { type: 'pctOff', buyQty: 2, discountPct: 15, label: '−15% від 2 упаковок' },
      },
      {
        id: 8, departmentId: 'meat',
        brand: 'МХП', name: 'Філе куряче заморожене', emoji: '🍗',
        price: 118, packageSize: 1000, packageUnit: 'г', unitPrice100: 11.8,
        tags: ['заморожене', 'економ'],
        composition: 'Куряче філе заморожене',
        discount: 0,
        bulkDeal: { type: 'buyXpayY', buyQty: 3, payQty: 2, label: '3 уп. за ціною 2' },
      },
      {
        id: 9, departmentId: 'meat',
        brand: 'Еко-Ферма', name: 'Курятина органічна', emoji: '🍗',
        price: 215, packageSize: 800, packageUnit: 'г', unitPrice100: 26.9,
        tags: ['органічне', 'без гормонів', 'вільний вигул', 'преміум'],
        composition: 'Куряче філе органічне, сертифіковане',
        discount: 0,
      },
    ],
  },
]

const PERSONAS: Persona[] = [
  {
    name: 'Олена',
    emoji: '👩',
    description: 'Мама двох дітей. Молодший син має непереносимість лактози — йому можна тільки безлактозне молоко. Потрібно купити молоко (3 пачки), хліб і курятину. Бюджет обмежений.',
    budget: 450,
    requirements: [
      { departmentId: 'dairy', minQty: 3, label: '3 пачки молока', avoidTags: [] },
      { departmentId: 'bread', minQty: 1, label: 'хоча б 1 хліб', avoidTags: [] },
      { departmentId: 'meat',  minQty: 1, label: 'хоча б 1 упаковка курятини', avoidTags: [] },
    ],
    hints: [
      'Синові потрібне безлактозне молоко — шукай тег "без лактози"',
      'Якщо купиш 3 пачки "Яготинське" — спрацює акція "3 за ціною 2" 🎯',
      'Порівняй ціну за 100 мл, щоб знайти найвигідніше молоко',
    ],
  },
  {
    name: 'Артем',
    emoji: '🧑‍🎓',
    description: 'Студент, живе один. Стежить за харчуванням: їсть цільнозерновий хліб і уникає зайвого жиру. Потрібно молоко, хліб і курятина. Бюджет невеликий — вибирай з розумом.',
    budget: 280,
    requirements: [
      { departmentId: 'dairy', minQty: 1, label: '1 пачка молока', preferTags: ['ЗСЖ', 'без антибіотиків'], avoidTags: [] },
      { departmentId: 'bread', minQty: 1, label: '1 хліб', preferTags: ['цільнозерновий', 'клітковина'], avoidTags: [] },
      { departmentId: 'meat',  minQty: 1, label: '1 упаковка курятини', avoidTags: [] },
    ],
    hints: [
      'Артем любить здорове харчування — шукай теги "цільнозерновий" і "ЗСЖ"',
      'Бюджет тільки 280 грн — рахуй уважно, обирай найдешевший варіант де можна',
      'Охолоджена курятина свіжіша за заморожену, але дорожча',
    ],
  },
  {
    name: 'Василь',
    emoji: '🏋️',
    description: 'Спортсмен, готується до змагань. Купує продукти оптом — дешевше. Потрібно багато білка: 2 упаковки курятини. Також 2 хліби і 2 молока. Є бюджет — використай акції максимально.',
    budget: 600,
    requirements: [
      { departmentId: 'dairy', minQty: 2, label: '2 пачки молока', avoidTags: [] },
      { departmentId: 'bread', minQty: 2, label: '2 хліби', avoidTags: [] },
      { departmentId: 'meat',  minQty: 2, label: '2 упаковки курятини', avoidTags: [] },
    ],
    hints: [
      'Василь купує оптом — шукай продукти з bulk-акціями для економії',
      'МХП: 3 упаковки за ціною 2 — якщо взяти 3, зекономиш ціну однієї 💪',
      'Для хліба: від 2 шт "Кульчицький" знижка 20%',
    ],
  },
]

// ─── Price calculations ───────────────────────────────────────────────────────

function singlePrice(p: Product): number {
  return p.discount > 0 ? Math.round(p.price * (1 - p.discount / 100) * 100) / 100 : p.price
}

function lineTotal(p: Product, qty: number): number {
  if (qty === 0) return 0
  const base = singlePrice(p)
  if (!p.bulkDeal) return base * qty

  const { type, buyQty, payQty, discountPct } = p.bulkDeal
  if (type === 'buyXpayY' && payQty) {
    const freeItems = Math.floor(qty / buyQty) * (buyQty - payQty)
    return (qty - freeItems) * base
  }
  if (type === 'pctOff' && discountPct) {
    if (qty >= buyQty) return Math.round(base * qty * (1 - discountPct / 100) * 100) / 100
  }
  return base * qty
}

function lineSaving(p: Product, qty: number): number {
  if (qty === 0) return 0
  return Math.round((singlePrice(p) * qty - lineTotal(p, qty)) * 100) / 100
}

function isBulkActive(p: Product, qty: number): boolean {
  if (!p.bulkDeal) return false
  return qty >= p.bulkDeal.buyQty
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MarketGame() {
  const [personaIdx] = useState(() => Math.floor(Math.random() * PERSONAS.length))
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [submitted, setSubmitted] = useState(false)
  const [hintsOpen, setHintsOpen] = useState(false)
  const [openDepts, setOpenDepts] = useState<Set<string>>(
    new Set(DEPARTMENTS.map(d => d.id))
  )

  const persona = PERSONAS[personaIdx]

  const total = useMemo(
    () => DEPARTMENTS.flatMap(d => d.products)
      .reduce((sum, p) => sum + lineTotal(p, quantities[p.id] ?? 0), 0),
    [quantities]
  )

  const totalSaved = useMemo(
    () => DEPARTMENTS.flatMap(d => d.products)
      .reduce((sum, p) => sum + lineSaving(p, quantities[p.id] ?? 0), 0),
    [quantities]
  )

  const remaining = persona.budget - total

  function setQty(id: number, delta: number) {
    if (submitted) return
    setQuantities(prev => {
      const cur = prev[id] ?? 0
      const next = Math.max(0, Math.min(5, cur + delta))
      return { ...prev, [id]: next }
    })
  }

  function toggleDept(id: string) {
    setOpenDepts(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  // Check requirements
  const reqResults = persona.requirements.map(req => {
    const deptQty = DEPARTMENTS
      .find(d => d.id === req.departmentId)!.products
      .reduce((sum, p) => sum + (quantities[p.id] ?? 0), 0)

    const hasPrefTag = !req.preferTags?.length || DEPARTMENTS
      .find(d => d.id === req.departmentId)!.products
      .some(p => (quantities[p.id] ?? 0) > 0 && req.preferTags!.some(t => p.tags.includes(t)))

    return {
      ...req,
      met: deptQty >= req.minQty,
      deptQty,
      hasPrefTag,
    }
  })

  const allMet = reqResults.every(r => r.met)
  const overBudget = total > persona.budget

  function handleSubmit() {
    setSubmitted(true)
  }

  function handleReset() {
    setQuantities({})
    setSubmitted(false)
    setHintsOpen(false)
  }

  const success = allMet && !overBudget

  // Score
  const prefScore = reqResults.filter(r => r.hasPrefTag).length
  const score = !success ? 0 : Math.round(
    50 +                                          // base за виконання
    20 * (prefScore / persona.requirements.length) + // за вподобання покупця
    20 * Math.min(1, totalSaved / 30) +           // за використання акцій
    10 * (1 - Math.max(0, remaining) / persona.budget) // за ефективність бюджету
  )

  const allProducts = DEPARTMENTS.flatMap(d => d.products)
  const cartItems = allProducts.filter(p => (quantities[p.id] ?? 0) > 0)

  return (
    <div className="min-h-screen bg-amber-50 p-4 pb-32">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* Header */}
        <div className="bg-white rounded-2xl shadow p-5">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">🛒</span>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Гра «Супермаркет»</h1>
              <p className="text-sm text-gray-500">Модуль 2 · Відсотки, знижки, порівняння цін</p>
            </div>
          </div>

          {/* Persona card */}
          <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
            <div className="flex items-start gap-3">
              <span className="text-3xl">{persona.emoji}</span>
              <div className="flex-1">
                <div className="font-bold text-gray-800">{persona.name}</div>
                <p className="text-sm text-gray-600 mt-1">{persona.description}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-sm font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                    💰 Бюджет: {persona.budget} грн
                  </span>
                </div>
              </div>
            </div>

            {/* Requirements checklist */}
            <div className="mt-3 space-y-1">
              {reqResults.map((req, i) => (
                <div key={i} className={`flex items-center gap-2 text-sm rounded-lg px-2 py-1 ${
                  submitted
                    ? req.met ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                    : req.met ? 'text-green-700' : 'text-gray-500'
                }`}>
                  <span>{req.met ? '✅' : '⬜'}</span>
                  <span>{req.label}</span>
                  {req.deptQty > 0 && (
                    <span className="ml-auto text-xs opacity-70">{req.deptQty} шт</span>
                  )}
                </div>
              ))}
            </div>

            {/* Hints toggle */}
            <button
              onClick={() => setHintsOpen(v => !v)}
              className="mt-3 text-xs text-amber-700 underline"
            >
              {hintsOpen ? '▲ Сховати підказки' : '💡 Показати підказки'}
            </button>
            {hintsOpen && (
              <ul className="mt-2 space-y-1">
                {persona.hints.map((h, i) => (
                  <li key={i} className="text-xs text-amber-800 bg-amber-100 rounded-lg px-3 py-1.5">
                    {h}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Departments */}
        {DEPARTMENTS.map(dept => (
          <div key={dept.id} className="bg-white rounded-2xl shadow overflow-hidden">
            <button
              onClick={() => toggleDept(dept.id)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50"
            >
              <span className="font-bold text-gray-800 text-base">
                {dept.emoji} {dept.name}
              </span>
              <span className="text-gray-400 text-sm">
                {openDepts.has(dept.id) ? '▲' : '▼'}
              </span>
            </button>

            {openDepts.has(dept.id) && (
              <div className="px-4 pb-4 space-y-3">
                {dept.products.map(product => {
                  const qty = quantities[product.id] ?? 0
                  const sp = singlePrice(product)
                  const total_line = lineTotal(product, qty)
                  const saving = lineSaving(product, qty)
                  const bulkActive = isBulkActive(product, qty)
                  const bulkNextAt = product.bulkDeal
                    ? product.bulkDeal.buyQty - (qty % product.bulkDeal.buyQty || product.bulkDeal.buyQty)
                    : 0

                  return (
                    <div
                      key={product.id}
                      className={`rounded-xl border-2 p-3 transition-all ${
                        qty > 0
                          ? bulkActive
                            ? 'border-green-400 bg-green-50'
                            : 'border-blue-300 bg-blue-50'
                          : 'border-gray-100 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        {/* Product info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xl">{product.emoji}</span>
                            <span className="font-semibold text-gray-800 text-sm">{product.brand}</span>
                            <span className="text-gray-500 text-sm">{product.name}</span>
                          </div>

                          {/* Tags */}
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {product.tags.map(tag => (
                              <span key={tag} className={`text-xs px-1.5 py-0.5 rounded-full ${
                                tag === 'органічне' || tag === 'без антибіотиків'
                                  ? 'bg-green-100 text-green-700'
                                  : tag === 'без лактози' || tag === 'без глютену' || tag === 'для алергіків'
                                  ? 'bg-purple-100 text-purple-700'
                                  : tag === 'преміум'
                                  ? 'bg-amber-100 text-amber-700'
                                  : tag === 'ЗСЖ' || tag === 'цільнозерновий' || tag === 'клітковина'
                                  ? 'bg-teal-100 text-teal-700'
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                {tag}
                              </span>
                            ))}
                          </div>

                          {/* Composition */}
                          <p className="text-xs text-gray-400 mt-1">{product.composition}</p>

                          {/* Price info */}
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <div>
                              <span className="font-bold text-gray-900">{sp.toFixed(2)} грн</span>
                              {product.discount > 0 && (
                                <span className="text-xs line-through text-gray-400 ml-1">{product.price}</span>
                              )}
                            </div>
                            <span className="text-xs text-gray-400">
                              {product.unitPrice100.toFixed(1)} грн / 100{product.packageUnit}
                            </span>
                            <span className="text-xs text-gray-400">
                              уп. {product.packageSize}{product.packageUnit}
                            </span>
                          </div>

                          {/* Bulk deal badge */}
                          {product.bulkDeal && (
                            <div className={`mt-1.5 text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${
                              bulkActive
                                ? 'bg-green-200 text-green-800 font-semibold'
                                : 'bg-orange-100 text-orange-700'
                            }`}>
                              🏷️ {product.bulkDeal.label}
                              {bulkActive ? ' ✓ активна!' : qty > 0 && bulkNextAt > 0
                                ? ` (ще ${bulkNextAt} шт для активації)`
                                : ''}
                            </div>
                          )}
                        </div>

                        {/* Qty stepper + line total */}
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setQty(product.id, -1)}
                              disabled={qty === 0 || submitted}
                              className="w-8 h-8 rounded-full bg-gray-200 font-bold text-lg
                                disabled:opacity-30 hover:bg-gray-300 transition-colors"
                            >−</button>
                            <span className="w-5 text-center font-bold text-gray-800">{qty}</span>
                            <button
                              onClick={() => setQty(product.id, 1)}
                              disabled={qty >= 5 || submitted}
                              className="w-8 h-8 rounded-full bg-blue-500 text-white font-bold text-lg
                                disabled:opacity-30 hover:bg-blue-600 transition-colors"
                            >+</button>
                          </div>
                          {qty > 0 && (
                            <div className="text-right">
                              <div className="font-bold text-sm text-gray-800">{total_line.toFixed(2)} грн</div>
                              {saving > 0 && (
                                <div className="text-xs text-green-600">−{saving.toFixed(2)} грн</div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}

        {/* Result */}
        {submitted && (
          <div className={`rounded-2xl shadow-lg p-5 ${
            success ? 'bg-green-50 border-2 border-green-400' : 'bg-red-50 border-2 border-red-400'
          }`}>
            {success ? (
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">🎉</div>
                <h2 className="text-xl font-bold text-green-700">
                  Чудово, {persona.name} задоволена!
                </h2>
                <div className="mt-2 inline-block bg-white rounded-xl px-4 py-2 shadow">
                  <span className="text-2xl font-bold text-green-700">{score}</span>
                  <span className="text-green-600"> / 100 балів</span>
                </div>
              </div>
            ) : (
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">{overBudget ? '💸' : '😕'}</div>
                <h2 className="text-xl font-bold text-red-700">
                  {overBudget ? 'Перевищено бюджет!' : 'Не вистачає потрібних товарів'}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {overBudget
                    ? `Вийшло на ${(total - persona.budget).toFixed(2)} грн більше ніж є`
                    : 'Перевір список — не всі пункти виконані'}
                </p>
              </div>
            )}

            {/* Receipt */}
            <div className="bg-white rounded-xl p-4 font-mono text-sm">
              <div className="text-center font-bold mb-3 tracking-widest">── ЧЕК ──</div>
              {cartItems.length === 0 ? (
                <p className="text-gray-400 text-center">Кошик порожній</p>
              ) : cartItems.map(p => {
                const qty = quantities[p.id] ?? 0
                const sp = singlePrice(p)
                const lt = lineTotal(p, qty)
                const sv = lineSaving(p, qty)
                const bulk = isBulkActive(p, qty)
                return (
                  <div key={p.id} className="mb-3">
                    <div className="flex justify-between">
                      <span className="text-gray-700">{p.emoji} {p.brand} {p.name}</span>
                      <span className="font-bold">{lt.toFixed(2)} грн</span>
                    </div>
                    <div className="text-xs text-gray-400 ml-3">
                      {sp.toFixed(2)} грн × {qty} шт
                      {p.discount > 0 && ` (зі знижкою ${p.discount}%: ${p.price}×${(1 - p.discount / 100)} = ${sp.toFixed(2)})`}
                      {bulk && p.bulkDeal?.type === 'buyXpayY' && (
                        <span className="text-green-600">
                          {' '}→ акція {p.bulkDeal.label}: платиш за {lineTotal(p, qty) / sp} з {qty}
                        </span>
                      )}
                      {bulk && p.bulkDeal?.type === 'pctOff' && (
                        <span className="text-green-600">
                          {' '}→ акція {p.bulkDeal.label}: {sp.toFixed(2)}×{qty}×{(1 - (p.bulkDeal.discountPct ?? 0) / 100)} = {lt.toFixed(2)}
                        </span>
                      )}
                    </div>
                    {sv > 0 && (
                      <div className="text-xs text-green-600 ml-3">💚 зекономлено: {sv.toFixed(2)} грн</div>
                    )}
                  </div>
                )
              })}
              <div className="border-t border-dashed pt-2 mt-2">
                <div className="flex justify-between font-bold">
                  <span>РАЗОМ</span>
                  <span>{total.toFixed(2)} грн</span>
                </div>
                {totalSaved > 0 && (
                  <div className="flex justify-between text-xs text-green-600 mt-1">
                    <span>Зекономлено на акціях</span>
                    <span>−{totalSaved.toFixed(2)} грн</span>
                  </div>
                )}
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Бюджет</span>
                  <span>{persona.budget.toFixed(2)} грн</span>
                </div>
                <div className={`flex justify-between text-sm font-semibold mt-1 ${remaining >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  <span>{remaining >= 0 ? 'Решта' : 'Не вистачає'}</span>
                  <span>{Math.abs(remaining).toFixed(2)} грн</span>
                </div>
              </div>
            </div>

            {/* Formula box */}
            <div className="bg-blue-50 rounded-xl p-4 mt-3 text-sm">
              <div className="font-bold text-gray-700 mb-2">📐 Формули які використовувались</div>
              <div className="space-y-1.5 text-gray-600 text-xs">
                <p>🔹 <strong>Ціна зі знижкою</strong> = Стара × (1 − знижка% / 100)</p>
                <p>🔹 <strong>Акція "купи X — заплати за Y"</strong>: безкоштовних = ⌊кількість ÷ X⌋ × (X − Y)</p>
                <p>🔹 <strong>Акція "−N% від K шт"</strong>: сума = ціна × кількість × (1 − N/100)</p>
                <p>🔹 <strong>Ціна за 100г</strong> = ціна упаковки ÷ вага_г × 100</p>
              </div>
            </div>

            <button
              onClick={handleReset}
              className="w-full mt-4 bg-blue-600 text-white rounded-2xl py-3 font-semibold
                hover:bg-blue-700 transition-colors"
            >
              Грати ще раз (новий покупець)
            </button>
          </div>
        )}
      </div>

      {/* Sticky bottom bar */}
      {!submitted && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-xl px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <div className="flex-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Разом</span>
                <span className={`font-bold ${total > persona.budget ? 'text-red-600' : 'text-gray-800'}`}>
                  {total.toFixed(2)} / {persona.budget} грн
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    total > persona.budget ? 'bg-red-500'
                    : total > persona.budget * 0.9 ? 'bg-amber-500'
                    : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min((total / persona.budget) * 100, 100)}%` }}
                />
              </div>
              {totalSaved > 0 && (
                <p className="text-xs text-green-600 mt-0.5">💰 Акції: −{totalSaved.toFixed(2)} грн</p>
              )}
            </div>
            <button
              onClick={handleSubmit}
              disabled={cartItems.length === 0}
              className="bg-blue-600 text-white rounded-xl px-5 py-2.5 font-semibold text-sm
                disabled:opacity-40 hover:bg-blue-700 transition-colors shrink-0"
            >
              Оплатити
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
