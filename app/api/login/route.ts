import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'

export async function POST(request: Request) {
  const { name } = await request.json()

  if (!name || name.trim().length < 2) {
    return Response.json({ error: 'Ім\'я занадто коротке' }, { status: 400 })
  }

  // Find or create user by name (MVP: no password)
  let user = await prisma.user.findFirst({ where: { name: name.trim() } })
  if (!user) {
    user = await prisma.user.create({ data: { name: name.trim() } })
  }

  const cookieStore = await cookies()
  cookieStore.set('userId', String(user.id), {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  })

  return Response.json({ ok: true, name: user.name })
}
