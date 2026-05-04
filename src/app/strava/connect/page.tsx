'use client'

import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Zap, CheckCircle, AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

function StravaConnectContent() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [stravaId, setStravaId] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const success = searchParams.get('success')
  const errorParam = searchParams.get('error')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase.from('profiles').select('strava_id').eq('id', user.id).single()
      setStravaId((data as { strava_id: string | null } | null)?.strava_id ?? null)
      setLoading(false)
    }
    load()
  }, [success])

  const handleConnect = () => {
    const clientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID
    if (!clientId) {
      alert('NEXT_PUBLIC_STRAVA_CLIENT_ID is not configured. Add it to your .env.local file.')
      return
    }
    const redirectUri = `${window.location.origin}/api/strava/callback`
    const scope = 'read,activity:read_all'
    window.location.href = `https://www.strava.com/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&approval_prompt=auto`
  }

  const handleSync = async () => {
    setSyncing(true)
    setSyncMsg(null)
    const res = await fetch('/api/strava/sync', { method: 'POST' })
    const data = await res.json() as { message?: string; error?: string }
    setSyncMsg(data.message ?? data.error ?? 'Done')
    setSyncing(false)
  }

  const handleDisconnect = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('profiles').update({ strava_id: null }).eq('id', user.id)
    setStravaId(null)
  }

  if (loading) return (
    <div className="max-w-xl mx-auto px-4 py-8 animate-pulse space-y-4">
      <div className="h-8 rounded w-1/3" style={{ background: 'var(--surface-border)' }} />
      <div className="h-48 rounded-2xl" style={{ background: 'var(--surface-border)' }} />
    </div>
  )

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/settings" className="p-2 rounded-xl hover:bg-orange-50 transition-colors"><ArrowLeft size={18} /></Link>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#FC4C02' }}>
          <Zap size={16} className="text-white" />
        </div>
        <h1 className="text-xl font-extrabold">Strava Connection</h1>
      </div>

      {success && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-green-50 border border-green-200 text-green-700">
          <CheckCircle size={18} />
          <p className="text-sm font-medium">Strava connected successfully!</p>
        </div>
      )}
      {errorParam && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700">
          <AlertCircle size={18} />
          <p className="text-sm font-medium">
            {errorParam === 'not_configured'
              ? 'Strava OAuth is not configured. Add STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET to your environment.'
              : errorParam === 'access_denied'
              ? "You denied access. Connect anytime when you are ready."
              : 'Connection error. Please try again.'}
          </p>
        </div>
      )}

      <div className="rounded-2xl p-6 border shadow-sm" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: '#FC4C02' }}>
            <Zap size={24} className="text-white" />
          </div>
          <div>
            <h2 className="font-bold text-lg">Strava</h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {stravaId ? 'Connected as athlete ' + stravaId : 'Not connected'}
            </p>
          </div>
          {stravaId && <CheckCircle size={20} className="ml-auto text-green-500" />}
        </div>

        <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
          {stravaId
            ? 'Your Strava account is linked. Sync your latest activities or disconnect at any time.'
            : 'Connect your Strava account to auto-import activities. Read-only access — we never post on your behalf.'}
        </p>

        {stravaId ? (
          <div className="space-y-3">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm border-2 border-orange-200 text-orange-600 hover:bg-orange-50 transition-all"
            >
              {syncing
                ? <><RefreshCw size={15} className="animate-spin" />Syncing...</>
                : <><RefreshCw size={15} />Sync Latest Activities</>}
            </button>
            {syncMsg && <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>{syncMsg}</p>}
            <button
              onClick={handleDisconnect}
              className="w-full py-3 rounded-xl font-semibold text-sm text-red-500 hover:bg-red-50 border border-red-100 transition-all"
            >
              Disconnect Strava
            </button>
          </div>
        ) : (
          <button
            onClick={handleConnect}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white transition-all"
            style={{ background: '#FC4C02' }}
          >
            <Zap size={16} />
            Connect with Strava
          </button>
        )}
      </div>

      <div className="rounded-2xl p-5 border" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        <h3 className="font-bold mb-3 text-sm">Developer Setup</h3>
        <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
          Register your app at strava.com/settings/api, then add to .env.local:
        </p>
        <div className="p-3 rounded-lg text-xs font-mono" style={{ background: 'var(--bg)', color: 'var(--text-secondary)' }}>
          STRAVA_CLIENT_ID=your_id
          <br />STRAVA_CLIENT_SECRET=your_secret
          <br />NEXT_PUBLIC_STRAVA_CLIENT_ID=your_id
        </div>
      </div>
    </div>
  )
}

export default function StravaConnectPage() {
  return (
    <Suspense fallback={
      <div className="max-w-xl mx-auto px-4 py-8 animate-pulse space-y-4">
        <div className="h-8 rounded w-1/3" style={{ background: 'var(--surface-border)' }} />
        <div className="h-48 rounded-2xl" style={{ background: 'var(--surface-border)' }} />
      </div>
    }>
      <StravaConnectContent />
    </Suspense>
  )
}
