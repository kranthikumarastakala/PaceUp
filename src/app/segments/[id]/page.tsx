'use client'

import { use, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Segment, SegmentEffort } from '@/lib/types'
import { Layers, ArrowLeft, Trophy, Star } from 'lucide-react'
import Link from 'next/link'
import { formatDistance, formatDuration } from '@/lib/utils'
import { format } from 'date-fns'

export default function SegmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const supabase = createClient()
  const router = useRouter()

  const [segment, setSegment] = useState<Segment | null>(null)
  const [efforts, setEfforts] = useState<SegmentEffort[]>([])
  const [myPR, setMyPR] = useState<SegmentEffort | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const [{ data: seg }, { data: effs }] = await Promise.all([
        supabase.from('segments')
          .select('*, profiles:user_id(username, full_name, avatar_url)')
          .eq('id', id)
          .single(),
        supabase.from('segment_efforts')
          .select('*, profiles:user_id(username, full_name, avatar_url), activities:activity_id(title, created_at)')
          .eq('segment_id', id)
          .order('elapsed_time', { ascending: true })
          .limit(50)
      ])

      if (!seg) { router.push('/segments'); return }
      setSegment(seg as Segment)
      const effsData = (effs as SegmentEffort[]) ?? []
      setEfforts(effsData)

      // My best effort
      const mine = effsData.filter(e => e.user_id === user.id).sort((a, b) => a.elapsed_time - b.elapsed_time)[0]
      setMyPR(mine ?? null)
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 py-8 animate-pulse space-y-4">
      <div className="h-8 rounded w-1/2" style={{ background: 'var(--surface-border)' }} />
      <div className="h-40 rounded-2xl" style={{ background: 'var(--surface-border)' }} />
    </div>
  )

  if (!segment) return null

  const creatorProfile = (segment as Segment & { profiles: { username: string; full_name: string } }).profiles

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/segments" className="p-2 rounded-xl hover:bg-orange-50 transition-colors"><ArrowLeft size={18} /></Link>
        <Layers size={20} className="text-orange-500" />
        <h1 className="text-xl font-extrabold flex-1 min-w-0 truncate">{segment.name}</h1>
      </div>

      {/* Segment info */}
      <div className="rounded-2xl p-5 border shadow-sm" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Distance</p>
            <p className="font-bold">{formatDistance(segment.distance)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Elevation</p>
            <p className="font-bold">{segment.elevation_gain ? `+${Math.round(segment.elevation_gain)}m` : '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Type</p>
            <p className="font-bold capitalize">{segment.activity_type}</p>
          </div>
        </div>
        {creatorProfile && (
          <p className="text-xs mt-3 text-center" style={{ color: 'var(--text-muted)' }}>
            Created by {creatorProfile.full_name || creatorProfile.username}
          </p>
        )}

        {/* My PR */}
        {myPR && (
          <div className="mt-4 p-4 rounded-xl flex items-center gap-3" style={{ background: 'rgba(249,115,22,0.07)' }}>
            <Star size={18} className="text-orange-500 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">My Personal Record</p>
              <p className="font-bold text-lg text-orange-600">{formatDuration(myPR.elapsed_time)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Leaderboard */}
      <div className="rounded-2xl p-5 border shadow-sm" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        <h2 className="font-bold mb-4 flex items-center gap-2"><Trophy size={16} className="text-orange-500" />All-Time Leaderboard</h2>

        {/* KOM/QOM */}
        {efforts.length > 0 && (() => {
          const kom = efforts[0]
          const komProfile = (kom as SegmentEffort & { profiles: { username: string; full_name: string; avatar_url: string } }).profiles
          return (
            <div className="flex items-center gap-3 p-3 rounded-xl mb-4" style={{ background: 'rgba(249,115,22,0.07)' }}>
              <span className="text-2xl">👑</span>
              {komProfile?.avatar_url ? (
                <img src={komProfile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-bold">
                  {(komProfile?.full_name || komProfile?.username || '?')[0].toUpperCase()}
                </div>
              )}
              <div>
                <p className="font-bold">{komProfile?.full_name || komProfile?.username}</p>
                <p className="text-sm text-orange-600 font-semibold">{formatDuration(kom.elapsed_time)} — Course Record</p>
              </div>
            </div>
          )
        })()}

        {efforts.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No efforts recorded yet for this segment.</p>
        )}

        <div className="space-y-3">
          {efforts.map((e, i) => {
            const profile = (e as SegmentEffort & { profiles: { username: string; full_name: string; avatar_url: string } }).profiles
            const activity = (e as SegmentEffort & { activities: { title: string; created_at: string } }).activities
            const isMe = e.user_id === userId
            return (
              <div
                key={e.id}
                className={`flex items-center gap-3 py-2 border-b last:border-0 ${isMe ? 'text-orange-600' : ''}`}
                style={{ borderColor: 'var(--surface-border)' }}
              >
                <span className="w-6 text-sm font-bold text-center" style={i >= 3 ? { color: 'var(--text-muted)' } : { color: i < 3 ? '#f97316' : undefined }}>
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
                  <p className="text-sm font-semibold truncate">{profile?.full_name || profile?.username}{isMe && ' (you)'}</p>
                  {activity && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{activity.title} · {format(new Date(activity.created_at), 'MMM d, yyyy')}</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{formatDuration(e.elapsed_time)}</p>
                  {e.is_pr && <p className="text-xs text-green-600 font-semibold">PR</p>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
