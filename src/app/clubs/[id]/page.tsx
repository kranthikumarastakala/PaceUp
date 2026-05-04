'use client'

import { use, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ToastProvider'
import { useRouter } from 'next/navigation'
import { Club, ClubMember, Activity } from '@/lib/types'
import { Shield, ArrowLeft, Users, Trophy } from 'lucide-react'
import Link from 'next/link'
import { activityColor, activityIcon, formatDistance, timeAgo } from '@/lib/utils'

export default function ClubDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const supabase = createClient()
  const { toast } = useToast()
  const router = useRouter()

  const [club, setClub] = useState<Club | null>(null)
  const [members, setMembers] = useState<ClubMember[]>([])
  const [feed, setFeed] = useState<Activity[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [isMember, setIsMember] = useState(false)
  const [tab, setTab] = useState<'feed' | 'members' | 'leaderboard'>('feed')
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const [{ data: c }, { data: mems }, { data: myMem }] = await Promise.all([
        supabase.from('clubs').select('*, profiles:owner_id(username, full_name, avatar_url)').eq('id', id).single(),
        supabase.from('club_members').select('*, profiles:user_id(username, full_name, avatar_url)').eq('club_id', id),
        supabase.from('club_members').select('role').eq('club_id', id).eq('user_id', user.id).single()
      ])

      if (!c) { router.push('/clubs'); return }
      setClub(c as Club)
      setMembers((mems as ClubMember[]) ?? [])
      setIsMember(!!myMem)

      // Load member activities (club feed)
      const memberIds = (mems ?? []).map((m: { user_id: string }) => m.user_id)
      if (memberIds.length > 0) {
        const { data: acts } = await supabase.from('activities')
          .select('*, profiles(username, full_name, avatar_url)')
          .in('user_id', memberIds)
          .eq('is_public', true)
          .order('created_at', { ascending: false })
          .limit(30)
        setFeed((acts as Activity[]) ?? [])
      }
      setLoading(false)
    }
    load()
  }, [id])

  const handleJoin = async () => {
    if (!userId || !club) return
    setJoining(true)
    const { error } = await supabase.from('club_members').insert({ club_id: id, user_id: userId, role: 'member' })
    if (error) { toast(error.message, 'error'); setJoining(false); return }
    await supabase.from('clubs').update({ member_count: (club.member_count ?? 0) + 1 }).eq('id', id)
    setIsMember(true)
    setClub(c => c ? { ...c, member_count: (c.member_count ?? 0) + 1 } : c)
    toast('Joined club!', 'success')
    setJoining(false)
  }

  const handleLeave = async () => {
    if (!userId || !club) return
    setJoining(true)
    await supabase.from('club_members').delete().eq('club_id', id).eq('user_id', userId)
    await supabase.from('clubs').update({ member_count: Math.max(0, (club.member_count ?? 1) - 1) }).eq('id', id)
    setIsMember(false)
    setClub(c => c ? { ...c, member_count: Math.max(0, (c.member_count ?? 1) - 1) } : c)
    toast('Left club', 'success')
    setJoining(false)
  }

  // Leaderboard: total distance per member in last 30 days
  const memberIds = members.map(m => m.user_id)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const leaderboard = memberIds.map(uid => {
    const acts = feed.filter(a => a.user_id === uid && a.created_at >= thirtyDaysAgo)
    const dist = acts.reduce((s, a) => s + (a.distance ?? 0), 0)
    const member = members.find(m => m.user_id === uid)
    const profile = (member as ClubMember & { profiles: { username: string; full_name: string; avatar_url: string } })?.profiles
    return { uid, dist, profile }
  }).sort((a, b) => b.dist - a.dist)

  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 py-8 animate-pulse space-y-4">
      <div className="h-8 rounded w-1/2" style={{ background: 'var(--surface-border)' }} />
      <div className="h-40 rounded-2xl" style={{ background: 'var(--surface-border)' }} />
    </div>
  )

  if (!club) return null

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/clubs" className="p-2 rounded-xl hover:bg-orange-50 transition-colors"><ArrowLeft size={18} /></Link>
        <Shield size={20} className="text-orange-500" />
        <h1 className="text-xl font-extrabold flex-1 min-w-0 truncate">{club.name}</h1>
      </div>

      {/* Club info */}
      <div className="rounded-2xl p-5 border shadow-sm" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        <div className="flex gap-4">
          {club.avatar_url ? (
            <img src={club.avatar_url} alt={club.name} className="w-16 h-16 rounded-xl object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-bold text-2xl">
              {club.name[0].toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            {club.description && <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>{club.description}</p>}
            <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-muted)' }}>
              <span className="flex items-center gap-1"><Users size={13} />{club.member_count} members</span>
              {club.activity_type !== 'all' && <span className="capitalize">· {club.activity_type}</span>}
            </div>
          </div>
        </div>

        {club.owner_id !== userId && (
          <button
            onClick={isMember ? handleLeave : handleJoin}
            disabled={joining}
            className={`mt-4 w-full py-3 rounded-xl font-semibold text-sm transition-all ${
              isMember
                ? 'border-2 border-red-200 text-red-500 hover:bg-red-50'
                : 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md shadow-orange-200 hover:from-orange-600 hover:to-red-600'
            }`}
          >
            {joining ? '…' : isMember ? 'Leave Club' : 'Join Club'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--surface-border)' }}>
        {(['feed', 'members', 'leaderboard'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 px-2 rounded-lg text-xs font-semibold transition-all capitalize ${tab === t ? 'bg-white shadow text-orange-600' : ''}`}
            style={tab !== t ? { color: 'var(--text-muted)' } : {}}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Feed */}
      {tab === 'feed' && (
        <div className="space-y-3">
          {feed.length === 0 && (
            <p className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>No recent activities from club members.</p>
          )}
          {feed.map(a => (
            <Link
              key={a.id}
              href={`/activities/${a.id}`}
              className="flex gap-3 p-4 rounded-2xl border hover:border-orange-300 transition-all"
              style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}
            >
              <span className="w-9 h-9 rounded-xl flex items-center justify-center text-base" style={{ background: activityColor(a.type) + '22' }}>
                {activityIcon(a.type)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{a.title}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {a.profiles?.full_name || a.profiles?.username} · {timeAgo(a.created_at)} · {formatDistance(a.distance ?? 0)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Members */}
      {tab === 'members' && (
        <div className="space-y-2">
          {members.map(m => {
            const profile = (m as ClubMember & { profiles: { username: string; full_name: string; avatar_url: string } }).profiles
            return (
              <Link
                key={m.user_id}
                href={`/profile/${profile?.username}`}
                className="flex items-center gap-3 p-3 rounded-2xl border hover:border-orange-300 transition-all"
                style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-bold">
                    {(profile?.full_name || profile?.username || '?')[0].toUpperCase()}
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-semibold text-sm">{profile?.full_name || profile?.username}</p>
                  <p className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>{m.role}</p>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Leaderboard */}
      {tab === 'leaderboard' && (
        <div className="rounded-2xl p-5 border shadow-sm" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
          <h2 className="font-bold mb-4 flex items-center gap-2"><Trophy size={16} className="text-orange-500" />This Month (Distance)</h2>
          <div className="space-y-3">
            {leaderboard.map((item, i) => (
              <div key={item.uid} className="flex items-center gap-3">
                <span className={`w-6 text-sm font-bold text-center ${i < 3 ? 'text-orange-500' : ''}`} style={i >= 3 ? { color: 'var(--text-muted)' } : {}}>
                  {i + 1}
                </span>
                {item.profile?.avatar_url ? (
                  <img src={item.profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white text-xs font-bold">
                    {(item.profile?.full_name || item.profile?.username || '?')[0].toUpperCase()}
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-sm font-semibold">{item.profile?.full_name || item.profile?.username || 'User'}</p>
                </div>
                <span className="text-sm font-bold text-orange-500">{formatDistance(item.dist)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
