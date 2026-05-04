import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { content_type: string; content_id: string; reason: string }

  if (!['activity', 'comment', 'profile'].includes(body.content_type)) {
    return NextResponse.json({ error: 'Invalid content_type' }, { status: 400 })
  }
  if (!body.content_id || !body.reason?.trim()) {
    return NextResponse.json({ error: 'content_id and reason are required' }, { status: 400 })
  }

  const { error } = await supabase.from('admin_flags').insert({
    reporter_id: user.id,
    content_type: body.content_type,
    content_id: body.content_id,
    reason: body.reason.trim().slice(0, 500),
    status: 'open',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
