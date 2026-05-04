import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Sync latest Strava activities into PaceUp
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = process.env.STRAVA_CLIENT_ID
  const clientSecret = process.env.STRAVA_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Strava not configured on server' }, { status: 503 })
  }

  // Get stored tokens
  const { data: prof } = await supabase
    .from('profiles')
    .select('strava_id')
    .eq('id', user.id)
    .single()

  if (!(prof as { strava_id: string | null } | null)?.strava_id) {
    return NextResponse.json({ error: 'Strava not connected' }, { status: 400 })
  }

  // In a full implementation, we'd refresh the access token if expired, then
  // call GET https://www.strava.com/api/v3/athlete/activities and import them.
  // For now we return a success placeholder with instructions.
  return NextResponse.json({
    message: 'Strava sync triggered. In a production deployment, provide STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, and implement token refresh + activity import.',
    strava_id: (prof as { strava_id: string }).strava_id,
  })
}
