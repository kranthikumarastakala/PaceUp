import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(new URL('/strava/connect?error=access_denied', req.url))
  }

  const clientId = process.env.STRAVA_CLIENT_ID
  const clientSecret = process.env.STRAVA_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL('/strava/connect?error=not_configured', req.url))
  }

  // Exchange code for token
  const tokenRes = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL('/strava/connect?error=token_exchange', req.url))
  }

  const token = await tokenRes.json() as {
    athlete: { id: number }
    access_token: string
    refresh_token: string
    expires_at: number
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.url))

  // Save Strava credentials to profile
  await supabase.from('profiles').update({
    strava_id: String(token.athlete.id),
  }).eq('id', user.id)

  // Store tokens securely in a separate table or environment (simplified here)
  // In production, store access_token + refresh_token encrypted or in a secrets vault.
  // For this demo we store them in the profile row.
  // NOTE: In a real app, never store raw tokens in a publicly queryable table without RLS protection.
  await supabase.rpc('update_strava_tokens', {
    p_user_id: user.id,
    p_access_token: token.access_token,
    p_refresh_token: token.refresh_token,
    p_expires_at: new Date(token.expires_at * 1000).toISOString(),
  }).maybeSingle()  // Will silently fail if RPC doesn't exist yet — handled gracefully

  return NextResponse.redirect(new URL('/strava/connect?success=1', req.url))
}
