import { prisma } from './db'

// Recalculate masteryPercent for a student in a module.
// Formula: accuracy(50%) + hint_score(20%) + base_completion(30%)
// base_completion = % of tasks in module attempted at least once
export async function recalculateMastery(userId: number, moduleId: number): Promise<number> {
  // Get all tasks in this module
  const tasks = await prisma.task.findMany({
    where: { lesson: { moduleId } },
    select: { id: true },
  })
  if (tasks.length === 0) return 0

  const taskIds = tasks.map((t) => t.id)

  // Last submission per task (most recent attempt)
  const submissions = await prisma.submission.findMany({
    where: { userId, taskId: { in: taskIds } },
    orderBy: { createdAt: 'desc' },
  })

  // Most recent attempt per task
  const latestByTask = new Map<number, (typeof submissions)[0]>()
  for (const s of submissions) {
    if (!latestByTask.has(s.taskId)) latestByTask.set(s.taskId, s)
  }

  const attempted = latestByTask.size
  const correct = [...latestByTask.values()].filter((s) => s.isCorrect).length
  const totalHints = [...latestByTask.values()].reduce((sum, s) => sum + s.hintsUsed, 0)

  const accuracy = attempted > 0 ? correct / attempted : 0
  const hintScore = attempted > 0 ? Math.max(0, 1 - totalHints / (attempted * 3)) : 0
  const completion = attempted / tasks.length

  const mastery = Math.round(accuracy * 50 + hintScore * 20 + completion * 30)

  await prisma.moduleProgress.upsert({
    where: { userId_moduleId: { userId, moduleId } },
    update: { masteryPercent: mastery },
    create: { userId, moduleId, masteryPercent: mastery },
  })

  return mastery
}
