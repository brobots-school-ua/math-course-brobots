import { cookies } from 'next/headers'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { prisma } from '@/lib/db'

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const userId = Number(cookieStore.get('userId')?.value)
  if (!userId) return Response.json({ error: 'Не авторизований' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('photo') as File | null
  const taskId = Number(formData.get('taskId'))

  if (!file || !taskId) {
    return Response.json({ error: 'Відсутній файл або taskId' }, { status: 400 })
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { lesson: { select: { moduleId: true } } },
  })
  if (!task) return Response.json({ error: 'Задача не знайдена' }, { status: 404 })

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const filename = `submission_${userId}_${taskId}_${Date.now()}.jpg`
  const filepath = join(process.cwd(), 'public', 'uploads', filename)
  await writeFile(filepath, buffer)

  const photoUrl = `/uploads/${filename}`

  await prisma.submission.create({
    data: {
      userId,
      taskId,
      answer: 'photo',
      isCorrect: false,
      photoUrl,
    },
  })

  return Response.json({ ok: true, photoUrl })
}
