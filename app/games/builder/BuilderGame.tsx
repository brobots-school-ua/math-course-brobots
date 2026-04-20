'use client'

import { useState, useRef } from 'react'

const G = 8  // grid 8×8, кожна клітинка = 1 м²
const INSULATION_PER_CELL = 250  // грн за клітинку на зовнішньому периметрі
const BUDGET = 90_000

type RoomId = 'living' | 'bedroom' | 'kitchen' | 'bathroom'

interface RoomDef {
  name: string; emoji: string
  bg: string; border: string; text: string; light: string
  minArea: number; maxArea: number; pricePerM2: number
  required: true
}

const DEFS: Record<RoomId, RoomDef> = {
  living:   { name: 'Вітальня', emoji: '🛋️', bg: '#bfdbfe', border: '#3b82f6', text: '#1d4ed8', light: 'bg-blue-50',   minArea: 12, maxArea: 25, pricePerM2: 1200, required: true },
  bedroom:  { name: 'Спальня',  emoji: '🛏️', bg: '#e9d5ff', border: '#8b5cf6', text: '#6d28d9', light: 'bg-purple-50', minArea: 9,  maxArea: 16, pricePerM2: 1100, required: true },
  kitchen:  { name: 'Кухня',    emoji: '🍳', bg: '#fef08a', border: '#ca8a04', text: '#854d0e', light: 'bg-yellow-50', minArea: 6,  maxArea: 12, pricePerM2: 1800, required: true },
  bathroom: { name: 'Ванна',    emoji: '🚿', bg: '#99f6e4', border: '#0d9488', text: '#134e4a', light: 'bg-teal-50',   minArea: 4,  maxArea: 6,  pricePerM2: 2500, required: true },
}

const ROOM_ORDER: RoomId[] = ['living', 'bedroom', 'kitchen', 'bathroom']

interface Room { id: string; type: RoomId; row: number; col: number; w: number; h: number }

// ─── Geometry helpers ─────────────────────────────────────────────────────────

function overlaps(a: Room, row: number, col: number, w: number, h: number): boolean {
  return a.row < row + h && a.row + a.h > row && a.col < col + w && a.col + a.w > col
}

function adjacent(a: Room, b: Room): boolean {
  const colOvlp = Math.max(a.col, b.col) < Math.min(a.col + a.w, b.col + b.w)
  const rowOvlp = Math.max(a.row, b.row) < Math.min(a.row + a.h, b.row + b.h)
  return (a.row + a.h === b.row || b.row + b.h === a.row) && colOvlp
      || (a.col + a.w === b.col || b.col + b.w === a.col) && rowOvlp
}

function touchesSouth(r: Room): boolean { return r.row + r.h === G }
function touchesEast(r: Room): boolean  { return r.col + r.w === G }
function touchesNorth(r: Room): boolean { return r.row === 0 }

function externalCells(r: Room): number {
  let count = 0
  for (let row = r.row; row < r.row + r.h; row++)
    for (let col = r.col; col < r.col + r.w; col++)
      if (row === 0 || row === G - 1 || col === 0 || col === G - 1) count++
  return count
}

function roomCost(r: Room): number {
  return r.w * r.h * DEFS[r.type].pricePerM2 + externalCells(r) * INSULATION_PER_CELL
}

// ─── Constraints ──────────────────────────────────────────────────────────────

interface Check { id: string; label: string; ok: boolean; detail?: string }

function runChecks(rooms: Room[]): Check[] {
  const get = (t: RoomId) => rooms.find(r => r.type === t)
  const living = get('living'), bedroom = get('bedroom')
  const kitchen = get('kitchen'), bathroom = get('bathroom')
  const total = rooms.reduce((s, r) => s + roomCost(r), 0)

  return [
    {
      id: 'placed',
      label: 'Всі 4 кімнати розміщені',
      ok: !!(living && bedroom && kitchen && bathroom),
    },
    {
      id: 'area',
      label: 'Площа кожної кімнати у межах',
      ok: ROOM_ORDER.every(t => {
        const r = get(t); if (!r) return false
        const a = r.w * r.h
        return a >= DEFS[t].minArea && a <= DEFS[t].maxArea
      }),
      detail: ROOM_ORDER.map(t => {
        const r = get(t); if (!r) return null
        const a = r.w * r.h, d = DEFS[t]
        if (a < d.minArea) return `${d.emoji} замала (${a} м², мін ${d.minArea})`
        if (a > d.maxArea) return `${d.emoji} завелика (${a} м², макс ${d.maxArea})`
        return null
      }).filter(Boolean).join(', ') || undefined,
    },
    {
      id: 'ratio',
      label: 'Жодна кімната не вужча 3:1',
      ok: rooms.every(r => Math.max(r.w, r.h) / Math.min(r.w, r.h) <= 3),
      detail: rooms
        .filter(r => Math.max(r.w, r.h) / Math.min(r.w, r.h) > 3)
        .map(r => `${DEFS[r.type].emoji} ${r.w}×${r.h}`)
        .join(', ') || undefined,
    },
    {
      id: 'adj_bath',
      label: '🚿 Ванна суміжна зі спальнею',
      ok: !!(bathroom && bedroom && adjacent(bathroom, bedroom)),
    },
    {
      id: 'adj_kitchen',
      label: '🍳 Кухня суміжна з вітальнею',
      ok: !!(kitchen && living && adjacent(kitchen, living)),
    },
    {
      id: 'sunny',
      label: '☀️ Вітальня або спальня на сонячній стороні (південь/схід)',
      ok: !!((living && (touchesSouth(living) || touchesEast(living))) ||
             (bedroom && (touchesSouth(bedroom) || touchesEast(bedroom)))),
      detail: 'Хоча б одна з них повинна торкатись нижнього або правого краю',
    },
    {
      id: 'noise',
      label: '🔇 Спальня не на вулиці і не поруч із кухнею',
      ok: !!(bedroom && !touchesNorth(bedroom) && !(kitchen && adjacent(bedroom, kitchen))),
      detail: bedroom
        ? touchesNorth(bedroom)
          ? 'Спальня торкається північної стіни (вулиця — шумно!)'
          : kitchen && adjacent(bedroom, kitchen)
          ? 'Спальня суміжна з кухнею — шум від плити та посуду'
          : undefined
        : undefined,
    },
    {
      id: 'budget',
      label: `💰 Бюджет ≤ ${BUDGET.toLocaleString('uk')} грн`,
      ok: total <= BUDGET,
      detail: total > BUDGET ? `Перевищення: ${(total - BUDGET).toLocaleString('uk')} грн` : undefined,
    },
  ]
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BuilderGame() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [selected, setSelected] = useState<RoomId>('living')
  const [preview, setPreview] = useState<{ row: number; col: number; w: number; h: number } | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const drawStart = useRef<{ row: number; col: number } | null>(null)

  // Build cell → room map
  const cellMap: Record<string, string> = {}
  for (const r of rooms)
    for (let row = r.row; row < r.row + r.h; row++)
      for (let col = r.col; col < r.col + r.w; col++)
        cellMap[`${row},${col}`] = r.id

  const getRoomAt = (row: number, col: number) =>
    rooms.find(r => r.id === cellMap[`${row},${col}`]) ?? null

  function startDraw(row: number, col: number) {
    if (submitted) return
    const existing = getRoomAt(row, col)
    if (existing) { setRooms(prev => prev.filter(r => r.id !== existing.id)); return }
    drawStart.current = { row, col }
    setPreview({ row, col, w: 1, h: 1 })
    setErrorMsg('')
  }

  function moveDraw(row: number, col: number) {
    if (!drawStart.current) return
    const { row: sr, col: sc } = drawStart.current
    setPreview({
      row: Math.min(sr, row), col: Math.min(sc, col),
      w: Math.abs(col - sc) + 1, h: Math.abs(row - sr) + 1,
    })
  }

  function endDraw() {
    if (!drawStart.current || !preview) { drawStart.current = null; setPreview(null); return }
    const { row, col, w, h } = preview
    const area = w * h
    const def = DEFS[selected]

    if (rooms.some(r => overlaps(r, row, col, w, h))) {
      setErrorMsg('Кімнати не можуть перекриватись!'); drawStart.current = null; setPreview(null); return
    }
    if (area < def.minArea) {
      setErrorMsg(`${def.name}: мінімум ${def.minArea} м² (у тебе ${area} м²)`); drawStart.current = null; setPreview(null); return
    }
    if (area > def.maxArea) {
      setErrorMsg(`${def.name}: максимум ${def.maxArea} м² (у тебе ${area} м²)`); drawStart.current = null; setPreview(null); return
    }
    if (Math.max(w, h) / Math.min(w, h) > 3) {
      setErrorMsg('Кімната занадто вузька! Максимум 3:1'); drawStart.current = null; setPreview(null); return
    }
    // Replace same type if already placed
    setRooms(prev => [
      ...prev.filter(r => r.type !== selected),
      { id: `${selected}-${Date.now()}`, type: selected, row, col, w, h },
    ])
    drawStart.current = null; setPreview(null)
  }

  const checks = runChecks(rooms)
  const allOk = checks.every(c => c.ok)
  const totalCost = rooms.reduce((s, r) => s + roomCost(r), 0)
  const totalArea = rooms.reduce((s, r) => s + r.w * r.h, 0)
  const totalInsulation = rooms.reduce((s, r) => s + externalCells(r) * INSULATION_PER_CELL, 0)

  // Score
  const passedCount = checks.filter(c => c.ok).length
  const efficiency = totalCost > 0 ? Math.min(1, (BUDGET - totalCost) / BUDGET * 3) : 0
  const score = submitted && allOk
    ? Math.round(70 + 20 * (1 - totalInsulation / 20000) + 10 * efficiency)
    : 0

  function reset() { setRooms([]); setSubmitted(false); setErrorMsg('') }

  // Preview color
  const prevDef = DEFS[selected]

  return (
    <div className="min-h-screen bg-stone-100 p-4 pb-28">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* Header */}
        <div className="bg-white rounded-2xl shadow p-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🏗️</span>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Гра «Будівельник»</h1>
              <p className="text-sm text-gray-500">Модуль 3 · Площі, пропорції, кошторис</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-3">
            Намалюй план квартири на сітці 8×8 м. Обери тип кімнати внизу, потім
            <strong> клікни і тягни</strong> по сітці щоб намалювати прямокутник.
            Клік на кімнату — видалити. Дотримуйся всіх 8 умов.
          </p>
        </div>

        {/* Compass + Grid */}
        <div className="bg-white rounded-2xl shadow p-4">
          <div className="flex flex-col items-center gap-1">
            {/* North label */}
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <span className="text-red-500 font-semibold">↑ ПІВНІЧ</span>
              <span className="text-gray-400">(вулиця 🚗 — шумно)</span>
            </div>

            <div className="flex items-center gap-2">
              {/* West label */}
              <div className="text-xs text-gray-400 writing-mode-vertical" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                ЗАХІД ←
              </div>

              {/* Grid */}
              <div
                className="relative select-none"
                style={{ touchAction: 'none' }}
                onPointerLeave={() => { drawStart.current = null; setPreview(null) }}
                onPointerUp={endDraw}
              >
                <div
                  className="grid gap-0"
                  style={{ gridTemplateColumns: `repeat(${G}, 1fr)`, display: 'grid' }}
                >
                  {Array.from({ length: G }, (_, row) =>
                    Array.from({ length: G }, (_, col) => {
                      const room = getRoomAt(row, col)
                      const def = room ? DEFS[room.type] : null

                      // Preview overlay
                      const inPreview = preview &&
                        row >= preview.row && row < preview.row + preview.h &&
                        col >= preview.col && col < preview.col + preview.w

                      // Grid edge indicators
                      const isNorth = row === 0
                      const isSouth = row === G - 1
                      const isEast = col === G - 1

                      return (
                        <div
                          key={`${row},${col}`}
                          className={`relative border cursor-crosshair transition-colors
                            ${isNorth ? 'border-t-2 border-t-red-300' : ''}
                            ${isSouth ? 'border-b-2 border-b-yellow-400' : ''}
                            ${isEast  ? 'border-r-2 border-r-yellow-400' : ''}
                            ${room ? 'border-transparent' : 'border-stone-200 hover:bg-stone-50'}
                          `}
                          style={{
                            width: 36, height: 36,
                            backgroundColor: room ? def!.bg : inPreview ? prevDef.bg + '88' : undefined,
                            outline: room && (room.row === row || room.col === col ||
                              room.row + room.h - 1 === row || room.col + room.w - 1 === col)
                              ? `2px solid ${def!.border}` : undefined,
                          }}
                          onPointerDown={e => { e.preventDefault(); startDraw(row, col) }}
                          onPointerEnter={() => moveDraw(row, col)}
                        >
                          {/* Room label — show in center cell */}
                          {room && room.row + Math.floor(room.h / 2) === row &&
                            room.col + Math.floor(room.w / 2) === col && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                              <span className="text-base leading-none">{def!.emoji}</span>
                              <span className="text-xs font-bold leading-none mt-0.5" style={{ color: def!.text, fontSize: 9 }}>
                                {room.w}×{room.h}
                              </span>
                            </div>
                          )}
                          {/* Preview label */}
                          {inPreview && !room &&
                            preview && preview.row + Math.floor(preview.h / 2) === row &&
                            preview.col + Math.floor(preview.w / 2) === col && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                              <span className="text-xs font-semibold" style={{ color: prevDef.text, fontSize: 9 }}>
                                {preview.w}×{preview.h}={preview.w * preview.h}м²
                              </span>
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Grid size label */}
                <div className="text-center text-xs text-gray-400 mt-1">8 м</div>
              </div>

              {/* East label */}
              <div className="text-xs text-yellow-600 font-semibold" style={{ writingMode: 'vertical-rl' }}>
                → СХІД ☀️
              </div>
            </div>

            {/* South label */}
            <div className="text-xs text-yellow-600 font-semibold mt-0">
              ПІВДЕНЬ ☀️ ↓
            </div>

            {/* Legend */}
            <div className="flex gap-4 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 border-2 border-t-red-300 border-red-300"></span> вулиця</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 border-2 border-yellow-400"></span> сонячно</span>
            </div>
          </div>

          {errorMsg && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700">
              ⚠️ {errorMsg}
            </div>
          )}
        </div>

        {/* Room palette */}
        {!submitted && (
          <div className="bg-white rounded-2xl shadow p-4">
            <p className="text-xs text-gray-500 mb-3 font-semibold uppercase tracking-wide">Обери кімнату для малювання</p>
            <div className="grid grid-cols-2 gap-2">
              {ROOM_ORDER.map(id => {
                const def = DEFS[id]
                const placed = rooms.find(r => r.type === id)
                return (
                  <button
                    key={id}
                    onClick={() => setSelected(id)}
                    className={`rounded-xl p-3 text-left border-2 transition-all ${
                      selected === id ? 'border-gray-700 shadow-md' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: def.bg + (placed ? 'cc' : '55') }}
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-xl">{def.emoji}</span>
                      {placed ? (
                        <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-white bg-opacity-70" style={{ color: def.text }}>
                          {placed.w}×{placed.h} = {placed.w * placed.h} м²
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">не розміщено</span>
                      )}
                    </div>
                    <div className="font-semibold text-sm mt-1" style={{ color: def.text }}>{def.name}</div>
                    <div className="text-xs text-gray-500">{def.minArea}–{def.maxArea} м² · {def.pricePerM2.toLocaleString('uk')} грн/м²</div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Constraints checklist */}
        <div className="bg-white rounded-2xl shadow p-4">
          <p className="text-xs text-gray-500 mb-3 font-semibold uppercase tracking-wide">Умови планування</p>
          <div className="space-y-2">
            {checks.map(c => (
              <div key={c.id} className={`flex items-start gap-2 text-sm rounded-xl px-3 py-2 ${
                c.ok ? 'bg-green-50 text-green-800' : 'bg-gray-50 text-gray-500'
              }`}>
                <span className="shrink-0 mt-0.5">{c.ok ? '✅' : '⬜'}</span>
                <div>
                  <div>{c.label}</div>
                  {!c.ok && c.detail && (
                    <div className="text-xs text-orange-600 mt-0.5">{c.detail}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live cost summary */}
        {rooms.length > 0 && !submitted && (
          <div className="bg-white rounded-2xl shadow p-4">
            <p className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wide">Кошторис</p>
            <div className="space-y-1.5 text-sm">
              {rooms.map(r => {
                const def = DEFS[r.type]
                const area = r.w * r.h
                const base = area * def.pricePerM2
                const ins = externalCells(r) * INSULATION_PER_CELL
                return (
                  <div key={r.id}>
                    <div className="flex justify-between text-gray-700">
                      <span>{def.emoji} {def.name} ({r.w}×{r.h} = {area} м²)</span>
                      <span className="font-semibold">{(base + ins).toLocaleString('uk')} грн</span>
                    </div>
                    <div className="text-xs text-gray-400 ml-4">
                      {area} × {def.pricePerM2.toLocaleString('uk')} = {base.toLocaleString('uk')}
                      {ins > 0 && <span className="text-orange-500"> + {ins.toLocaleString('uk')} грн утеплення ({externalCells(r)} зовн.кл.)</span>}
                    </div>
                  </div>
                )
              })}
              <div className="border-t pt-2 flex justify-between font-bold text-gray-800">
                <span>Разом ({totalArea} м²)</span>
                <span className={totalCost > BUDGET ? 'text-red-600' : 'text-gray-800'}>
                  {totalCost.toLocaleString('uk')} / {BUDGET.toLocaleString('uk')} грн
                </span>
              </div>
              {totalInsulation > 0 && (
                <div className="text-xs text-orange-600">
                  🧱 З них утеплення: {totalInsulation.toLocaleString('uk')} грн
                  — мінімізуй зовнішні стіни щоб зекономити!
                </div>
              )}
            </div>
          </div>
        )}

        {/* Result */}
        {submitted && (
          <div className={`rounded-2xl shadow-lg p-5 ${allOk ? 'bg-green-50 border-2 border-green-400' : 'bg-red-50 border-2 border-red-300'}`}>
            {allOk ? (
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">🏠</div>
                <h2 className="text-xl font-bold text-green-700">Проєкт затверджено!</h2>
                <p className="text-sm text-gray-600 mt-1">Всі умови виконано. Будівництво можна починати.</p>
                <div className="mt-3 inline-block bg-white rounded-xl px-5 py-2 shadow">
                  <span className="text-2xl font-bold text-green-700">{score}</span>
                  <span className="text-green-600"> / 100 балів</span>
                </div>
                {score >= 85 && <p className="text-xs text-green-600 mt-2">🏆 Відмінне утеплення — мінімум зовнішніх стін!</p>}
              </div>
            ) : (
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">📋</div>
                <h2 className="text-xl font-bold text-red-700">
                  Порушено {checks.filter(c => !c.ok).length} з {checks.length} умов
                </h2>
                <p className="text-sm text-gray-600 mt-1">Виправ помилки і спробуй знову</p>
              </div>
            )}

            {/* Math breakdown */}
            <div className="bg-white rounded-xl p-4 mt-2">
              <div className="font-bold text-gray-700 mb-3">📐 Математика проєкту</div>
              <div className="space-y-2 text-sm text-gray-600">
                <p>🔹 <strong>Площа прямокутника</strong>: довжина × ширина</p>
                {rooms.map(r => {
                  const def = DEFS[r.type]
                  return (
                    <div key={r.id} className="text-xs bg-gray-50 rounded-lg p-2 ml-2">
                      {def.emoji} {def.name}: {r.w} м × {r.h} м = <strong>{r.w * r.h} м²</strong>
                    </div>
                  )
                })}
                <p className="mt-2">🔹 <strong>Вартість кімнати</strong>: площа × ціна/м² + утеплення</p>
                <p>🔹 <strong>Утеплення</strong>: клітинки на зовнішньому периметрі × {INSULATION_PER_CELL} грн</p>
                <p>🔹 <strong>Частка від бюджету</strong>: {totalCost.toLocaleString('uk')} ÷ {BUDGET.toLocaleString('uk')} = {Math.round(totalCost / BUDGET * 100)}%</p>
              </div>
            </div>

            <button onClick={reset}
              className="w-full mt-4 bg-blue-600 text-white rounded-2xl py-3 font-semibold hover:bg-blue-700 transition-colors">
              Спробувати ще раз
            </button>
          </div>
        )}
      </div>

      {/* Sticky bottom */}
      {!submitted && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-xl px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <div className="flex-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">
                  Умов виконано: <strong>{passedCount}/{checks.length}</strong>
                </span>
                <span className={`font-bold ${totalCost > BUDGET ? 'text-red-600' : 'text-gray-700'}`}>
                  {totalCost.toLocaleString('uk')} / {BUDGET.toLocaleString('uk')} грн
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1 overflow-hidden">
                <div
                  className="h-1.5 rounded-full bg-green-500 transition-all"
                  style={{ width: `${(passedCount / checks.length) * 100}%` }}
                />
              </div>
            </div>
            <button
              onClick={() => setSubmitted(true)}
              disabled={rooms.length === 0}
              className="bg-blue-600 text-white rounded-xl px-5 py-2.5 font-semibold text-sm
                disabled:opacity-40 hover:bg-blue-700 transition-colors shrink-0"
            >
              Здати проєкт
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
