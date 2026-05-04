'use client'

import { use, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ToastProvider'
import { useRouter } from 'next/navigation'
import { Challenge, ChallengeParticipant } from '@/lib/types'
import { Trophy, Calendar, Users, ArrowLeft, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { format, isPast, isFuture, differenceInDays } from 'date-fns'

export default function ChallengeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const supabase = createClient()
  const { toast } = useToast()
  const router = useRouter()

  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [participants, setParticipants] = useState<ChallengeParticipant[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [joined, setJoined] = useState(false)
  const [myProgress, setMyProgress] = useState(0)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const [{ data: ch }, { data: parts }, { data: myPart }] = await Promise.all([
        supabase.from('challenges')
          .select('*, profiles:creator_id(username, full_name, avatar_url)')
          .eq('id', id)
          .single(),
        supabase.from('challenge_participants')
          .select('*, profiles:user_id(username, full_name, avatar_url)')
          .eq('challenge_id', id)
          .order('progress', { ascending: false }),
        supabase.from('challenge_participants')
          .select('progress')
          .eq('challenge_id', id)
          .eq('user_id', user.id)
          .single()
      ])

      if (!ch) { router.push('/challenges'); return }
      setChallenge(ch as Challenge)
      setParticipants((parts as ChallengeParticipant[]) ?? [])
      if (myPart) {
        setJoined(true)
        setMyProgress((myPart as { progress: number }).progress ?? 0)
      }
      setLoading(false)
    }
    load()
  }, [id])

  const handleJoin = async () => {
    if (!userId || !challenge) return
    setJoining(true)
    const { error } = await supabase.from('challenge_participants').insert({
      challenge_id: id,
      user_id: userId,
      progress: 0,
    })
    if (error) {
      toast(error.message, 'error')
    } else {
      await supabase.from('challenges').update({ participant_count: (challenge.participant_count ?? 0) + 1 }).eq('id', id)
      setJoined(true)
      setChallenge(c => c ? { ...c, participant_count: (c.participant_count ?? 0) + 1 } : c)
      setParticipants(p => [...p, { challenge_id: id, user_id: userId, progress: 0, joined_at: new Date().toISOString() }])
      toast('Joined challenge!', 'success')
    }
    setJoining(false)
  }

  const handleLeave = async () => {
    if (!userId || !challenge) return
    setJoining(true)
    await supabase.from('challenge_participants').delete().eq('challenge_id', id).eq('user_id', userId)
    await supabase.from('challenges').update({ participant_count: Math.max(0, (challenge.participant_count ?? 1) - 1) }).eq('id', id)
    setJoined(false)
    setParticipants(p => p.filter(x => x.user_id !== userId))
    setChallenge(c => c ? { ...c, participant_count: Math.max(0, (c.participant_count ?? 1) - 1) } : c)
    toast('Left challenge', 'success')
    setJoining(false)
  }

  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 py-8 animate-pulse space-y-4">
      <div className="h-8 rounded w-1/2" style={{ background: 'var(--surface-border)' }} />
      <div className="h-40 rounded-2xl" style={{ background: 'var(--surface-border)' }} />
    </div>
  )

  if (!challenge) return null

  const isActive = !isFuture(new Date(challenge.starts_at)) && !isPast(new Date(challenge.ends_at))
  const daysLeft = Math.max(0, differenceInDays(new Date(challenge.ends_at), new Date()))
  const progressPct = Math.min(100, (myProgress / challenge.target_value) * 100)

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/challenges" className="p-2 rounded-xl hover:bg-orange-50 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <Trophy size={20} className="text-orange-500" />
        <h1 className="text-xl font-extrabold flex-1 min-w-0 truncate">{challenge.title}</h1>
      </div>

      {/* Challenge card */}
      <div className="rounded-2xl p-5 border shadow-sm" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        {challenge.description && <p className="mb-4" style={{ color: 'var(--text-secondary)' }}>{challenge.description}</p>}
        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Goal</p>
            <p className="font-bold text-lg">
              {challenge.target_value.toLocaleString()} {challenge.metric === 'distance' ? 'km' : challenge.metric}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Dates</p>
            <p className="font-medium">
              {format(new Date(challenge.starts_at), 'MMM d')} → {format(new Date(challenge.ends_at), 'MMM d, yyyy')}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Participants</p>
            <p className="flex items-center gap-1 font-medium"><Users size={14} />{challenge.participant_count}</p>
          </div>
          {isActive && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Time Left</p>
              <p className="text-orange-500 font-bold">{daysLeft} days</p>
            </div>
          )}
        </div>

        {/* My progress */}
        {joined && (
          <div className="mt-4 p-4 rounded-xl" style={{ background: 'var(--bg)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">My Progress</span>
              <span className="text-sm font-bold text-orange-500">{myProgress.toFixed(1)} / {challenge.target_value}</span>
            </div>
            <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--surface-border)' }}>
              <div
                className="h-3 rounded-full bg-gradient-to-r from-orange-400 to-red-500 transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            {progressPct >= 100 && (
              <p className="text-green-600 text-xs font-semibold mt-2 flex items-center gap-1"><CheckCircle size={12} /> Challenge complete!</p>
            )}
          </div>
        )}

        {/* Join/Leave */}
        {!isPast(new Date(challenge.ends_at)) && (
          <button
            onClick={joined ? handleLeave : handleJoin}
            disabled={joining}
            className={`mt-4 w-full py-3 rounded-xl font-semibold text-sm transition-all ${
              joined
                ? 'border-2 border-red-200 text-red-500 hover:bg-red-50'
                : 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md shadow-orange-200 hover:from-orange-600 hover:to-red-600'
            }`}
          >
            {joining ? '…' : joined ? 'Leave Challenge' : 'Join Challenge'}
          </button>
        )}
      </div>

      {/* Leaderboard */}
      <div className="rounded-2xl p-5 border shadow-sm" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        <h2 className="font-bold mb-4 flex items-center gap-2"><Trophy size={16} className="text-orange-500" />Leaderboard</h2>
        {participants.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No participants yet.</p>
        ) : (
          <div className="space-y-3">
            {participants.map((p, i) => {
              const pct = Math.min(100, (p.progress / challenge.target_value) * 100)
              const profile = (p as ChallengeParticipant & { profiles: { username: string; full_name: string; avatar_url: string } }).profiles
              return (
                <div key={p.user_id} className="flex items-center gap-3">
                  <span className={`w-6 text-sm font-bold text-center ${i < 3 ? 'text-orange-500' : ''}`} style={i >= 3 ? { color: 'var(--text-muted)' } : {}}>
                    {i + 1}
                  </span>
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white text-xs font-bold">
                      {(profile?.full_name || profile?.username || '?')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{profile?.full_name || profile?.username || 'User'}</p>
                    <div className="h-1.5 rounded-full mt-1" style={{ background: 'var(--surface-border)' }}>
                      <div className="h-1.5 rounded-full bg-gradient-to-r from-orange-400 to-red-400" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{p.progress.toFixed(1)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
