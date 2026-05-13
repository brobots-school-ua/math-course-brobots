import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { recalculateMastery } from '@/lib/mastery'

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const userId = Number(cookieStore.get('userId')?.value)
  if (!userId) return Response.json({ error: 'Не авторизований' }, { status: 401 })

  const { taskId, answer, hintsUsed } = await request.json()

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { lesson: { select: { moduleId: true } } },
  })
  if (!task) return Response.json({ error: 'Задача не знайдена' }, { status: 404 })

  // Check correctness
  let isCorrect = false
  if (task.type === 'QUIZ') {
    isCorrect = Number(answer) === task.correctIdx
  } else if (task.type === 'PRACTICE') {
    const correctAns = task.correctAns ?? '0'
    // TIME format HH:MM — compare as total minutes with tolerance in minutes
    if (/^\d{1,2}:\d{2}$/.test(correctAns)) {
      const toMinutes = (t: string) => {
        const [h, m] = t.split(':').map(Number)
        return h * 60 + m
      }
      const studentStr = String(answer).trim()
      if (/^\d{1,2}:\d{2}$/.test(studentStr)) {
        isCorrect = Math.abs(toMinutes(studentStr) - toMinutes(correctAns)) <= task.tolerance
      }
    } else {
      const studentNum = parseFloat(String(answer).replace(',', '.'))
      const correctNum = parseFloat(correctAns)
      if (!isNaN(studentNum) && !isNaN(correctNum)) {
        const denom = Math.abs(correctNum) || 1
        isCorrect = Math.abs(studentNum - correctNum) / denom <= task.tolerance
      }
    }
  }

  await prisma.submission.create({
    data: { userId, taskId, answer: String(answer), isCorrect, hintsUsed: hintsUsed ?? 0 },
  })

  const mastery = await recalculateMastery(userId, task.lesson.moduleId)

  return Response.json({ isCorrect, mastery })
}
