'use client'

import { useState } from 'react'
import Link from 'next/link'

type Task = {
  id: number
  type: 'QUIZ' | 'PRACTICE' | 'OFFLINE'
  question: string
  options: string[]
  correctIdx: number | null
  correctAns: string | null
  tolerance: number
  hints: string[]
  postContent: string | null
}

type LessonData = {
  id: number
  title: string
  theoryMd: string
  module: { id: number; title: string; order: number }
  tasks: Task[]
}

type Stage = 'THEORY' | 'TASKS' | 'OFFLINE' | 'COMPLETE'

export default function LessonClient({ lesson }: { lesson: LessonData }) {
  const [stage, setStage] = useState<Stage>('THEORY')
  const [taskIdx, setTaskIdx] = useState(0)
  const [hintsShown, setHintsShown] = useState(0)
  const [answer, setAnswer] = useState('')
  const [timeHours, setTimeHours] = useState('')
  const [timeMinutes, setTimeMinutes] = useState('')
  const [result, setResult] = useState<{ isCorrect: boolean; mastery: number } | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [finalMastery, setFinalMastery] = useState(0)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoUploaded, setPhotoUploaded] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)

  const regularTasks = lesson.tasks.filter(t => t.type !== 'OFFLINE')
  const offlineTask = lesson.tasks.find(t => t.type === 'OFFLINE') ?? null
  const currentTask = regularTasks[taskIdx]

  async function submitAnswer(ans: string) {
    if (submitted) return
    setSubmitted(true)

    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId: currentTask.id,
        answer: ans,
        hintsUsed: hintsShown,
      }),
    })
    const data = await res.json()
    setResult(data)
    setFinalMastery(data.mastery)
  }

  function nextTask() {
    if (taskIdx + 1 >= regularTasks.length) {
      if (offlineTask) {
        setStage('OFFLINE')
      } else {
        setStage('COMPLETE')
      }
    } else {
      setTaskIdx((i) => i + 1)
      setHintsShown(0)
      setAnswer('')
      setTimeHours('')
      setTimeMinutes('')
      setResult(null)
      setSubmitted(false)
      setPhotoFile(null)
      setPhotoUploaded(false)
    }
  }

  async function uploadPhoto() {
    if (!photoFile || !offlineTask) return
    setPhotoUploading(true)
    const form = new FormData()
    form.append('photo', photoFile)
    form.append('taskId', String(offlineTask.id))
    await fetch('/api/upload', { method: 'POST', body: form })
    setPhotoUploaded(true)
    setPhotoUploading(false)
  }

  // ── THEORY ─────────────────────────────────────────────────────────
  if (stage === 'THEORY') {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b px-6 py-4 flex gap-3 items-center">
          <Link href="/dashboard" className="text-blue-600 hover:underline text-sm">
            ← Назад
          </Link>
          <span className="text-gray-400 text-sm">/</span>
          <span className="text-sm text-gray-600">
            Модуль {lesson.module.order} · {lesson.title}
          </span>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg border p-6 mb-6">
            <div className="prose max-w-none">
              <TheoryRenderer text={lesson.theoryMd} />
            </div>
          </div>

          <button
            onClick={() => setStage('TASKS')}
            className="w-full bg-blue-600 text-white rounded-lg px-4 py-3 hover:bg-blue-700 font-medium"
          >
            Перейти до завдань →
          </button>
        </main>
      </div>
    )
  }

  // ── COMPLETE ────────────────────────────────────────────────────────
  if (stage === 'COMPLETE') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg border p-8 max-w-sm w-full text-center">
          <div className="text-4xl mb-4">🎉</div>
          <h2 className="text-xl font-bold mb-2">Заняття завершено!</h2>
          <p className="text-gray-500 mb-4 text-sm">
            Майстерність модуля: <span className="font-bold text-blue-600">{finalMastery}%</span>
          </p>
          <Link
            href="/dashboard"
            className="block bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700"
          >
            До списку модулів
          </Link>
        </div>
      </div>
    )
  }

  // ── OFFLINE ─────────────────────────────────────────────────────────
  if (stage === 'OFFLINE' && offlineTask) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b px-6 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="text-blue-600 hover:underline text-sm">← Назад</Link>
          <span className="text-sm font-medium text-purple-600">Офлайн-завдання</span>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-8">
          {/* Description */}
          <div className="bg-white rounded-lg border p-6 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">📝</span>
              <span className="text-xs uppercase tracking-wide text-purple-500 font-medium">Офлайн-завдання</span>
            </div>
            <p className="text-gray-800 whitespace-pre-wrap">{offlineTask.question}</p>
          </div>

          {/* Download / Print */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-5 mb-4">
            <p className="font-medium text-purple-900 mb-1">Крок 1 — Роздрукуй бланк</p>
            <p className="text-sm text-purple-700 mb-4">
              Натисни кнопку нижче — відкриється бланк для друку. У новій вкладці натисни «Друкувати».
            </p>
            <div className="flex gap-3">
              <a
                href="/offline/module-0.pdf"
                download
                className="flex-1 flex items-center justify-center gap-2 bg-purple-600 text-white rounded-lg px-4 py-3 hover:bg-purple-700 font-medium"
              >
                ⬇ Завантажити PDF
              </a>
              <a
                href="/offline/module-0.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-white border border-purple-300 text-purple-700 rounded-lg px-4 py-3 hover:bg-purple-50 font-medium text-sm"
              >
                🔍 Переглянути
              </a>
            </div>
          </div>

          {/* Photo upload */}
          <div className="bg-white rounded-lg border p-6">
            <p className="font-medium mb-1">Крок 2 — Здай виконане завдання</p>
            <p className="text-sm text-gray-500 mb-4">
              Розв&apos;яжи задачі на бланку від руки, сфотографуй і завантаж фото нижче.
            </p>

            {!photoUploaded ? (
              <div className="flex flex-col gap-3">
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                  <span className="text-3xl mb-2">📷</span>
                  <span className="text-sm text-gray-600">
                    {photoFile ? photoFile.name : 'Натисни щоб вибрати фото'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                {photoFile && (
                  <button
                    onClick={uploadPhoto}
                    disabled={photoUploading}
                    className="bg-blue-600 text-white rounded-lg px-4 py-3 hover:bg-blue-700 disabled:opacity-50 font-medium"
                  >
                    {photoUploading ? 'Завантажую...' : '📤 Надіслати на перевірку'}
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-green-50 rounded-lg p-4 text-green-800 text-sm">
                ✅ Фото надіслано! Результат з&apos;явиться після перевірки.
              </div>
            )}
          </div>

          {photoUploaded && (
            <button
              onClick={() => setStage('COMPLETE')}
              className="mt-4 w-full bg-blue-600 text-white rounded-lg px-4 py-3 hover:bg-blue-700 font-medium"
            >
              Завершити заняття →
            </button>
          )}
        </main>
      </div>
    )
  }

  // ── TASKS ───────────────────────────────────────────────────────────
  const isQuiz = currentTask.type === 'QUIZ'
  const progress = `${taskIdx + 1} / ${regularTasks.length}`

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <Link href="/dashboard" className="text-blue-600 hover:underline text-sm">
          ← Назад
        </Link>
        <span className="text-sm text-gray-500">
          Завдання {progress}
        </span>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg border p-6 mb-4">
          {/* Question */}
          <div className="mb-5">
            <span className="text-xs uppercase tracking-wide text-gray-400 font-medium">
              {isQuiz ? 'Квіз' : 'Практика'}
            </span>
            <p className="mt-1 text-gray-800 whitespace-pre-wrap">{currentTask.question}</p>
          </div>

          {/* Quiz: options */}
          {isQuiz && !submitted && (
            <div className="flex flex-col gap-2">
              {currentTask.options.map((opt, idx) => (
                <button
                  key={idx}
                  onClick={() => submitAnswer(String(idx))}
                  className="text-left border rounded-lg px-4 py-3 hover:bg-blue-50 hover:border-blue-400 transition-colors"
                >
                  <span className="font-medium text-gray-400 mr-2">
                    {['А', 'Б', 'В', 'Г'][idx]}.
                  </span>
                  {opt}
                </button>
              ))}
            </div>
          )}

          {/* Quiz: result */}
          {isQuiz && submitted && result && (
            <div className="flex flex-col gap-2">
              {currentTask.options.map((opt, idx) => {
                const isCorrectOption = idx === currentTask.correctIdx
                const isSelected = idx === Number(answer || currentTask.options.findIndex((_, i) => i === currentTask.correctIdx))
                const base = 'text-left border rounded-lg px-4 py-3'
                const style = isCorrectOption
                  ? `${base} bg-green-50 border-green-500`
                  : result.isCorrect === false && isSelected
                  ? `${base} bg-red-50 border-red-400`
                  : `${base} opacity-50`
                return (
                  <div key={idx} className={style}>
                    <span className="font-medium text-gray-400 mr-2">
                      {['А', 'Б', 'В', 'Г'][idx]}.
                    </span>
                    {opt}
                    {isCorrectOption && ' ✓'}
                  </div>
                )
              })}
            </div>
          )}

          {/* Practice: input */}
          {!isQuiz && !submitted && (() => {
            const isTime = /^\d{1,2}:\d{2}$/.test(currentTask.correctAns ?? '')
            if (isTime) {
              const timeReady = timeHours !== '' && timeMinutes !== ''
              const timeValue = `${timeHours.padStart(2, '0')}:${timeMinutes.padStart(2, '0')}`
              return (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-gray-500">Введи час виходу:</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min="0" max="23"
                      value={timeHours}
                      onChange={(e) => setTimeHours(e.target.value)}
                      placeholder="ГГ"
                      className="w-20 border rounded-lg px-3 py-2 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-xl font-bold text-gray-400">:</span>
                    <input
                      type="number" min="0" max="59"
                      value={timeMinutes}
                      onChange={(e) => setTimeMinutes(e.target.value)}
                      placeholder="ХХ"
                      className="w-20 border rounded-lg px-3 py-2 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-400">год : хв</span>
                    <button
                      onClick={() => submitAnswer(timeValue)}
                      disabled={!timeReady}
                      className="ml-auto bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 disabled:opacity-40"
                    >
                      Відповісти
                    </button>
                  </div>
                </div>
              )
            }
            return (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && answer && submitAnswer(answer)}
                  placeholder="Введи відповідь..."
                  className="flex-1 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => submitAnswer(answer)}
                  disabled={!answer}
                  className="bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 disabled:opacity-40"
                >
                  Відповісти
                </button>
              </div>
            )
          })()}

          {/* Practice: result */}
          {!isQuiz && submitted && result && (
            <div
              className={`rounded-lg px-4 py-3 text-sm ${
                result.isCorrect ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
              }`}
            >
              {result.isCorrect ? (
                <>✅ Правильно! Відповідь: <strong>{answer}</strong></>
              ) : (
                <>❌ Неправильно. Правильна відповідь: <strong>{currentTask.correctAns}</strong></>
              )}
            </div>
          )}
        </div>

        {/* Hints */}
        {!submitted && currentTask.hints.length > 0 && (
          <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4 mb-4">
            <p className="text-xs text-yellow-700 font-medium mb-2 uppercase tracking-wide">
              Підказки ({hintsShown}/{currentTask.hints.length})
            </p>
            {currentTask.hints.slice(0, hintsShown).map((hint, i) => (
              <p key={i} className="text-sm text-yellow-800 mb-1">
                {i + 1}. {hint}
              </p>
            ))}
            {hintsShown < currentTask.hints.length && (
              <button
                onClick={() => setHintsShown((n) => n + 1)}
                className="text-sm text-yellow-700 hover:underline mt-1"
              >
                + Показати підказку
              </button>
            )}
          </div>
        )}

        {/* Feedback after submission */}
        {submitted && result && (
          <div className="flex flex-col gap-3">
            {!result.isCorrect && hintsShown < currentTask.hints.length && (
              <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
                <p className="text-xs text-yellow-700 font-medium mb-2 uppercase tracking-wide">
                  Підказки
                </p>
                {currentTask.hints.map((hint, i) => (
                  <p key={i} className="text-sm text-yellow-800 mb-1">
                    {i + 1}. {hint}
                  </p>
                ))}
              </div>
            )}
            {/* postContent — shown after result, before Next */}
            {currentTask.postContent && (
              <div className="bg-blue-50 rounded-lg border border-blue-200 p-5">
                <p className="text-xs text-blue-600 font-medium mb-3 uppercase tracking-wide">
                  Пояснення
                </p>
                <div className="prose max-w-none text-sm">
                  <TheoryRenderer text={currentTask.postContent} />
                </div>
              </div>
            )}
            <button
              onClick={nextTask}
              className="w-full bg-blue-600 text-white rounded-lg px-4 py-3 hover:bg-blue-700 font-medium"
            >
              {taskIdx + 1 >= regularTasks.length
                ? offlineTask ? 'Перейти до офлайн-завдання →' : 'Завершити заняття'
                : 'Наступне завдання →'}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

// Simple Markdown-like renderer (no external dep)
function TheoryRenderer({ text }: { text: string }) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith('## ')) {
      elements.push(<h2 key={i} className="text-xl font-bold mt-6 mb-3">{line.slice(3)}</h2>)
    } else if (line.startsWith('### ')) {
      elements.push(<h3 key={i} className="text-lg font-semibold mt-4 mb-2">{line.slice(4)}</h3>)
    } else if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={i} className="border-l-4 border-blue-400 pl-4 my-3 text-gray-600 italic">
          {line.slice(2)}
        </blockquote>
      )
    } else if (line.startsWith('| ')) {
      const tableLines = []
      let j = i
      while (j < lines.length && lines[j].startsWith('|')) {
        tableLines.push(lines[j])
        j++
      }
      elements.push(<TableRenderer key={i} rows={tableLines} />)
      i = j - 1
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <li key={i} className="ml-4 list-disc text-gray-700">
          <InlineRenderer text={line.slice(2)} />
        </li>
      )
    } else if (/^\d+\./.test(line)) {
      elements.push(
        <li key={i} className="ml-4 list-decimal text-gray-700">
          <InlineRenderer text={line.replace(/^\d+\.\s*/, '')} />
        </li>
      )
    } else if (line.startsWith('---')) {
      elements.push(<hr key={i} className="my-4 border-gray-200" />)
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />)
    } else {
      elements.push(
        <p key={i} className="text-gray-700 leading-relaxed">
          <InlineRenderer text={line} />
        </p>
      )
    }
  }

  return <div className="space-y-1">{elements}</div>
}

function InlineRenderer({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**'))
          return <strong key={i}>{part.slice(2, -2)}</strong>
        if (part.startsWith('`') && part.endsWith('`'))
          return <code key={i} className="bg-gray-100 px-1 rounded text-sm font-mono">{part.slice(1, -1)}</code>
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

function TableRenderer({ rows }: { rows: string[] }) {
  const parsed = rows.map((r) =>
    r.split('|').filter((_, i, arr) => i > 0 && i < arr.length - 1).map((c) => c.trim())
  )
  const [header, , ...body] = parsed
  return (
    <div className="overflow-x-auto my-3">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100">
            {header?.map((h, i) => (
              <th key={i} className="border px-3 py-2 text-left font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, i) => (
            <tr key={i} className="even:bg-gray-50">
              {row.map((cell, j) => (
                <td key={j} className="border px-3 py-2">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
