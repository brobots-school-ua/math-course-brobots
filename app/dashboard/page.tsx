import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/db'

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const userId = Number(cookieStore.get('userId')?.value)
  if (!userId) redirect('/login')

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) redirect('/login')

  const modules = await prisma.module.findMany({
    orderBy: { order: 'asc' },
    include: {
      lessons: { select: { id: true } },
      progress: { where: { userId } },
    },
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">Прикладна математика</h1>
        <span className="text-gray-600 text-sm">👋 {user.name}</span>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <h2 className="text-lg font-semibold mb-4">Модулі курсу</h2>
        <div className="flex flex-col gap-3">
          {modules.map((mod) => {
            const mastery = mod.progress[0]?.masteryPercent ?? 0
            const lessonsCount = mod.lessons.length
            return (
              <div key={mod.id} className="bg-white rounded-lg border p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="text-xs text-gray-400 uppercase tracking-wide">
                      Модуль {mod.order}
                    </span>
                    <h3 className="font-semibold">{mod.title}</h3>
                    <p className="text-sm text-gray-500 mt-1">{mod.description}</p>
                  </div>
                  <span className="text-lg font-bold text-blue-600 ml-4 shrink-0">
                    {mastery}%
                  </span>
                </div>

                {/* Mastery bar */}
                <div className="h-2 bg-gray-200 rounded-full mb-3">
                  <div
                    className="h-2 bg-blue-500 rounded-full transition-all"
                    style={{ width: `${mastery}%` }}
                  />
                </div>

                <div className="flex gap-2">
                  {mod.lessons.map((lesson, idx) => (
                    <Link
                      key={lesson.id}
                      href={`/lesson/${lesson.id}`}
                      className="text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1 rounded"
                    >
                      Заняття {idx + 1}
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
