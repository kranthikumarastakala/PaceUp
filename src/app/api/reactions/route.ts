import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { activity_id?: string; emoji: string; action: 'add' | 'remove' }
  if (!body.activity_id || !body.emoji || !body.action) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const allowed = ['🔥','💪','👏','😮','❤️']
  if (!allowed.includes(body.emoji)) {
    return NextResponse.json({ error: 'Invalid emoji' }, { status: 400 })
  }

  if (body.action === 'add') {
    const { error } = await supabase.from('reactions').upsert({
      activity_id: body.activity_id,
      user_id: user.id,
      emoji: body.emoji,
    }, { onConflict: 'activity_id,user_id,emoji' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    await supabase.from('reactions')
      .delete()
      .eq('activity_id', body.activity_id)
      .eq('user_id', user.id)
      .eq('emoji', body.emoji)
  }

  return NextResponse.json({ ok: true })
}
