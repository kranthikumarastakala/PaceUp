'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Club } from '@/lib/types'
import { Users, Plus, Shield } from 'lucide-react'
import Link from 'next/link'

export default function ClubsPage() {
  const supabase = createClient()
  const router = useRouter()

  const [clubs, setClubs] = useState<Club[]>([])
  const [myClubs, setMyClubs] = useState<string[]>([])
  const [tab, setTab] = useState<'browse' | 'mine'>('browse')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [{ data: all }, { data: mine }] = await Promise.all([
        supabase.from('clubs').select('*, profiles:owner_id(username, full_name, avatar_url)').eq('is_public', true).order('member_count', { ascending: false }),
        supabase.from('club_members').select('club_id').eq('user_id', user.id)
      ])

      setClubs((all as Club[]) ?? [])
      setMyClubs((mine ?? []).map((m: { club_id: string }) => m.club_id))
      setLoading(false)
    }
    load()
  }, [])

  const filtered = tab === 'mine' ? clubs.filter(c => myClubs.includes(c.id)) : clubs

  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 py-8 animate-pulse space-y-4">
      <div className="h-8 rounded w-1/3" style={{ background: 'var(--surface-border)' }} />
      {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-2xl" style={{ background: 'var(--surface-border)' }} />)}
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield size={22} className="text-orange-500" />
          <h1 className="text-2xl font-extrabold">Clubs</h1>
        </div>
        <Link
          href="/clubs/new"
          className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:from-orange-600 hover:to-red-600 transition-all shadow-md shadow-orange-200"
        >
          <Plus size={16} /> New Club
        </Link>
      </div>

      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--surface-border)' }}>
        {(['browse', 'mine'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${tab === t ? 'bg-white shadow text-orange-600' : ''}`}
            style={tab !== t ? { color: 'var(--text-muted)' } : {}}
          >
            {t === 'browse' ? 'Browse Clubs' : 'My Clubs'}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
          <Shield size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">{tab === 'mine' ? "You haven't joined any clubs yet." : 'No clubs yet.'}</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(c => {
          const isMember = myClubs.includes(c.id)
          return (
            <Link
              key={c.id}
              href={`/clubs/${c.id}`}
              className="flex items-center gap-4 p-4 rounded-2xl border shadow-sm hover:border-orange-300 transition-all"
              style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}
            >
              {c.avatar_url ? (
                <img src={c.avatar_url} alt={c.name} className="w-12 h-12 rounded-xl object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-bold text-lg">
                  {c.name[0].toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="font-bold truncate">{c.name}</h2>
                  {isMember && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold">Member</span>}
                </div>
                {c.description && <p className="text-sm truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>{c.description}</p>}
                <div className="flex items-center gap-1 mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <Users size={11} />{c.member_count} members
                  {c.activity_type !== 'all' && <span className="ml-2 capitalize">· {c.activity_type}</span>}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
