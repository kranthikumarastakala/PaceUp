'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Segment } from '@/lib/types'
import { Layers, Plus } from 'lucide-react'
import Link from 'next/link'
import { formatDistance } from '@/lib/utils'

export default function SegmentsPage() {
  const supabase = createClient()
  const router = useRouter()

  const [segments, setSegments] = useState<Segment[]>([])
  const [tab, setTab] = useState<'all' | 'mine'>('all')
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data } = await supabase
        .from('segments')
        .select('*, profiles:user_id(username, full_name, avatar_url)')
        .eq('is_public', true)
        .order('created_at', { ascending: false })

      setSegments((data as Segment[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = tab === 'mine' ? segments.filter(s => s.user_id === userId) : segments

  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 py-8 animate-pulse space-y-4">
      <div className="h-8 rounded w-1/3" style={{ background: 'var(--surface-border)' }} />
      {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-2xl" style={{ background: 'var(--surface-border)' }} />)}
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Layers size={22} className="text-orange-500" />
          <h1 className="text-2xl font-extrabold">Segments</h1>
        </div>
        <Link
          href="/segments/new"
          className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:from-orange-600 hover:to-red-600 transition-all shadow-md shadow-orange-200"
        >
          <Plus size={16} /> New Segment
        </Link>
      </div>

      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--surface-border)' }}>
        {(['all', 'mine'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${tab === t ? 'bg-white shadow text-orange-600' : ''}`}
            style={tab !== t ? { color: 'var(--text-muted)' } : {}}
          >
            {t === 'all' ? 'All Segments' : 'My Segments'}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
          <Layers size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No segments yet.</p>
          <p className="text-sm mt-1">Create one from an activity route.</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(s => {
          const profile = (s as Segment & { profiles: { username: string; full_name: string } }).profiles
          return (
            <Link
              key={s.id}
              href={`/segments/${s.id}`}
              className="flex items-center gap-4 p-4 rounded-2xl border shadow-sm hover:border-orange-300 transition-all"
              style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}
            >
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                <Layers size={18} className="text-orange-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate">{s.name}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {formatDistance(s.distance)} · {s.elevation_gain ? `+${Math.round(s.elevation_gain)}m` : 'flat'} · {s.activity_type}
                  {profile && ` · by ${profile.full_name || profile.username}`}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
