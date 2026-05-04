'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Activity, Profile } from '@/lib/types'
import { formatDistance, formatDuration, activityIcon } from '@/lib/utils'
import { Trophy, Flame, TrendingUp, Activity as ActivityIcon } from 'lucide-react'
import Link from 'next/link'
import { startOfWeek, startOfMonth, format } from 'date-fns'

type Period = 'weekly' | 'monthly'
type Metric = 'distance' | 'elevation' | 'duration' | 'activities' | 'kudos'

interface LeaderEntry {
  profile: Profile
  value: number
  activityCount: number
}

const METRIC_CONFIG: Record<Metric, { label: string; icon: React.ElementType; format: (v: number) => string }> = {
  distance:   { label: 'Distance',    icon: ActivityIcon, format: (v) => formatDistance(v) },
  elevation:  { label: 'Elevation',   icon: TrendingUp,   format: (v) => `${Math.round(v)} m` },
  duration:   { label: 'Moving Time', icon: Flame,        format: (v) => formatDuration(v) },
  activities: { label: 'Activities',  icon: ActivityIcon, format: (v) => `${v}` },
  kudos:      { label: 'Kudos',       icon: Trophy,       format: (v) => `${v}` },
}

const MEDALS = ['🥇', '🥈', '🥉']

export default function LeaderboardPage() {
  const supabase = createClient()

  const [period, setPeriod] = useState<Period>('weekly')
  const [metric, setMetric] = useState<Metric>('distance')
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const [peerActivities, setPeerActivities] = useState<(Activity & { profiles: Profile })[]>([])
  const [kudosMap, setKudosMap] = useState<Record<string, number>>({})
  const [profileMap, setProfileMap] = useState<Record<string, Profile>>({})

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      setCurrentUserId(user.id)

      // Get everyone I follow + myself
      const { data: follows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id)
      const ids: string[] = [...(follows ?? []).map((f: any) => f.following_id as string), user.id]

      // Activities from all peers (last 30 days is enough for both weekly/monthly)
      const since = startOfMonth(new Date()).toISOString()
      const { data: acts } = await supabase
        .from('activities')
        .select('*, profiles(id, username, full_name, avatar_url)')
        .in('user_id', ids)
        .gte('created_at', since)
      setPeerActivities((acts ?? []) as (Activity & { profiles: Profile })[])

      // Build profileMap
      const pm: Record<string, Profile> = {}
      for (const a of acts ?? []) {
        if (a.profiles && !pm[a.profiles.id]) pm[a.profiles.id] = a.profiles as Profile
      }
      setProfileMap(pm)

      // Kudos given/received per user this period
      const actIds = (acts ?? []).map((a: any) => a.id)
      if (actIds.length > 0) {
        const { data: kudos } = await supabase
          .from('kudos')
          .select('activity_id')
          .in('activity_id', actIds)
        const km: Record<string, number> = {}
        for (const k of kudos ?? []) {
          const act = (acts ?? []).find((a: any) => a.id === k.activity_id)
          if (act) km[act.user_id] = (km[act.user_id] ?? 0) + 1
        }
        setKudosMap(km)
      }

      setLoading(false)
    }
    load()
  }, [])

  const periodStart = period === 'weekly' ? startOfWeek(new Date()) : startOfMonth(new Date())

  const board: LeaderEntry[] = useMemo(() => {
    const filtered = peerActivities.filter((a) => new Date(a.created_at) >= periodStart)

    const byUser: Record<string, { profile: Profile; distance: number; elevation: number; duration: number; activities: number }> = {}

    for (const a of filtered) {
      const uid = a.user_id
      if (!byUser[uid]) {
        byUser[uid] = { profile: a.profiles, distance: 0, elevation: 0, duration: 0, activities: 0 }
      }
      byUser[uid].distance += a.distance ?? 0
      byUser[uid].elevation += a.elevation_gain ?? 0
      byUser[uid].duration += a.duration ?? 0
      byUser[uid].activities += 1
    }

    return Object.entries(byUser)
      .map(([uid, stats]) => ({
        profile: stats.profile ?? profileMap[uid],
        value: metric === 'kudos'
          ? kudosMap[uid] ?? 0
          : stats[metric === 'distance' ? 'distance'
              : metric === 'elevation' ? 'elevation'
              : metric === 'duration' ? 'duration'
              : 'activities'],
        activityCount: stats.activities,
      }))
      .filter((e) => e.profile)
      .sort((a, b) => b.value - a.value)
  }, [peerActivities, period, metric, kudosMap, profileMap, periodStart])

  const cfg = METRIC_CONFIG[metric]
  const maxValue = board[0]?.value ?? 1

  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-4 animate-pulse">
      <div className="h-8 bg-gray-100 rounded w-1/3" />
      {[1,2,3,4,5].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-2xl" />)}
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
          <Trophy size={22} className="text-orange-500" />
          Leaderboard
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">You + everyone you follow</p>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Period toggle */}
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          {(['weekly', 'monthly'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                period === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-700'
              }`}
            >
              {p === 'weekly' ? `Week of ${format(startOfWeek(new Date()), 'MMM d')}` : format(new Date(), 'MMMM')}
            </button>
          ))}
        </div>
        {/* Metric tabs */}
        <div className="flex gap-1 overflow-x-auto">
          {(Object.keys(METRIC_CONFIG) as Metric[]).map((m) => {
            const Icon = METRIC_CONFIG[m].icon
            return (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  metric === m
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-500 hover:text-gray-800'
                }`}
              >
                <Icon size={12} />
                {METRIC_CONFIG[m].label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Board */}
      {board.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-4">👥</div>
          <p className="text-lg font-medium">No data yet</p>
          <p className="text-sm mt-1">Log activities or follow athletes to see rankings.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {board.map((entry, i) => {
            const isMe = entry.profile.id === currentUserId
            const barPct = maxValue > 0 ? (entry.value / maxValue) * 100 : 0
            return (
              <Link
                key={entry.profile.id}
                href={`/profile/${entry.profile.username}`}
                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all hover:shadow-md ${
                  isMe
                    ? 'border-orange-200 bg-orange-50'
                    : 'border-gray-100 bg-white'
                }`}
              >
                {/* Rank */}
                <div className="w-7 text-center shrink-0">
                  {i < 3
                    ? <span className="text-xl">{MEDALS[i]}</span>
                    : <span className="text-sm font-bold text-gray-400">{i + 1}</span>
                  }
                </div>

                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-sm font-bold text-white shrink-0 overflow-hidden">
                  {entry.profile.avatar_url
                    ? <img src={entry.profile.avatar_url} alt="" className="w-full h-full object-cover" />  // eslint-disable-line @next/next/no-img-element
                    : (entry.profile.full_name?.[0] ?? entry.profile.username?.[0] ?? '?').toUpperCase()
                  }
                </div>

                {/* Name + bar */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between mb-1">
                    <span className={`text-sm font-semibold truncate ${isMe ? 'text-orange-700' : 'text-gray-900'}`}>
                      {entry.profile.full_name || entry.profile.username}
                      {isMe && <span className="ml-1.5 text-xs font-normal text-orange-400">(you)</span>}
                    </span>
                    <span className={`text-sm font-extrabold shrink-0 ml-2 ${isMe ? 'text-orange-600' : 'text-gray-900'}`}>
                      {cfg.format(entry.value)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isMe ? 'bg-orange-500' : 'bg-gradient-to-r from-blue-400 to-indigo-500'}`}
                      style={{ width: `${barPct}%`, transition: 'width 0.6s ease' }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{entry.activityCount} {entry.activityCount === 1 ? 'activity' : 'activities'}</p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
