'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Challenge } from '@/lib/types'
import { Trophy, Plus, Calendar, Users } from 'lucide-react'
import Link from 'next/link'
import { format, isPast, isFuture } from 'date-fns'

function statusBadge(c: Challenge) {
  if (isFuture(new Date(c.starts_at))) return { label: 'Upcoming', cls: 'bg-blue-100 text-blue-700' }
  if (isPast(new Date(c.ends_at))) return { label: 'Ended', cls: 'bg-gray-100 text-gray-500' }
  return { label: 'Active', cls: 'bg-green-100 text-green-700' }
}

export default function ChallengesPage() {
  const supabase = createClient()
  const router = useRouter()

  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [myChallenges, setMyChallenges] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'all' | 'joined' | 'mine'>('all')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [{ data: all }, { data: joined }] = await Promise.all([
        supabase.from('challenges')
          .select('*, profiles:creator_id(username, full_name, avatar_url)')
          .eq('is_public', true)
          .order('created_at', { ascending: false }),
        supabase.from('challenge_participants')
          .select('challenge_id')
          .eq('user_id', user.id)
      ])

      setChallenges((all as Challenge[]) ?? [])
      setMyChallenges((joined ?? []).map((j: { challenge_id: string }) => j.challenge_id))
      setLoading(false)
    }
    load()
  }, [])

  const filtered = challenges.filter(c => {
    if (tab === 'joined') return myChallenges.includes(c.id)
    return true
  })

  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 py-8 animate-pulse space-y-4">
      <div className="h-8 rounded w-1/3" style={{ background: 'var(--surface-border)' }} />
      {[1, 2, 3].map(i => <div key={i} className="h-32 rounded-2xl" style={{ background: 'var(--surface-border)' }} />)}
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy size={22} className="text-orange-500" />
          <h1 className="text-2xl font-extrabold">Challenges</h1>
        </div>
        <Link
          href="/challenges/new"
          className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:from-orange-600 hover:to-red-600 transition-all shadow-md shadow-orange-200"
        >
          <Plus size={16} /> New Challenge
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--surface-border)' }}>
        {(['all', 'joined'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all capitalize ${tab === t ? 'bg-white shadow text-orange-600' : ''}`}
            style={tab !== t ? { color: 'var(--text-muted)' } : {}}
          >
            {t === 'all' ? 'Browse' : 'My Challenges'}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
          <Trophy size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No challenges yet.</p>
          <p className="text-sm mt-1">Create the first one!</p>
        </div>
      )}

      <div className="space-y-4">
        {filtered.map(c => {
          const badge = statusBadge(c)
          const joined = myChallenges.includes(c.id)
          const daysLeft = Math.max(0, Math.ceil((new Date(c.ends_at).getTime() - Date.now()) / 86_400_000))

          return (
            <Link
              key={c.id}
              href={`/challenges/${c.id}`}
              className="block rounded-2xl p-5 border shadow-sm hover:border-orange-300 transition-all"
              style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <h2 className="font-bold text-lg leading-tight">{c.title}</h2>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${badge.cls}`}>{badge.label}</span>
              </div>
              {c.description && <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>{c.description}</p>}
              <div className="flex flex-wrap gap-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                <span className="flex items-center gap-1">
                  <Trophy size={13} />
                  {c.target_value.toLocaleString()} {c.metric === 'distance' ? 'km' : c.metric}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar size={13} />
                  {format(new Date(c.starts_at), 'MMM d')} – {format(new Date(c.ends_at), 'MMM d')}
                </span>
                <span className="flex items-center gap-1">
                  <Users size={13} />
                  {c.participant_count} joined
                </span>
                {badge.label === 'Active' && (
                  <span className="text-orange-500 font-medium">{daysLeft}d left</span>
                )}
              </div>
              {joined && (
                <div className="mt-3">
                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold">✓ Joined</span>
                </div>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
