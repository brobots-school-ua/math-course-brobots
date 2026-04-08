import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import LessonClient from './LessonClient'

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const cookieStore = await cookies()
  const userId = Number(cookieStore.get('userId')?.value)
  if (!userId) redirect('/login')

  const { id } = await params
  const lesson = await prisma.lesson.findUnique({
    where: { id: Number(id) },
    include: {
      tasks: { orderBy: { order: 'asc' } },
      module: { select: { id: true, title: true, order: true } },
    },
  })
  if (!lesson) notFound()

  // Serialize to plain object (no Date issues in client component)
  const lessonData = {
    id: lesson.id,
    title: lesson.title,
    theoryMd: lesson.theoryMd,
    module: lesson.module,
    tasks: lesson.tasks.map((t) => ({
      id: t.id,
      type: t.type,
      question: t.question,
      options: t.options,
      correctIdx: t.correctIdx,
      correctAns: t.correctAns,
      tolerance: t.tolerance,
      hints: t.hints,
    })),
  }

  return <LessonClient lesson={lessonData} />
}
