'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ActivityCard } from '@/components/ActivityCard'
import type { Activity } from '@/lib/types'
import Link from 'next/link'
import { formatDistance, formatDuration } from '@/lib/utils'
import { startOfWeek } from 'date-fns'

export default function DashboardPage() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [weeklyActivities, setWeeklyActivities] = useState<Activity[]>([])
  const [feed, setFeed] = useState<'all' | 'following'>('all')
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      setUserId(user.id)

      // Weekly personal stats (this week only, own activities)
      const weekStart = startOfWeek(new Date()).toISOString()
      const { data: weekly } = await supabase
        .from('activities')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', weekStart)
      setWeeklyActivities((weekly as Activity[]) ?? [])

      await loadFeed('all', user.id)
      setLoading(false)
    }
    load()
  }, [])

  const loadFeed = async (type: 'all' | 'following', uid?: string) => {
    const id = uid ?? userId
    if (!id) return
    setLoading(true)

    if (type === 'following') {
      // Get IDs of people I follow
      const { data: follows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', id)
      const ids = (follows ?? []).map((f: any) => f.following_id)
      ids.push(id) // include own activities

      const { data } = await supabase
        .from('activities')
        .select('*, profiles(username, full_name, avatar_url)')
        .in('user_id', ids.length > 0 ? ids : ['00000000-0000-0000-0000-000000000000'])
        .order('created_at', { ascending: false })
        .limit(30)
      setActivities((data as Activity[]) ?? [])
    } else {
      const { data } = await supabase
        .from('activities')
        .select('*, profiles(username, full_name, avatar_url)')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(30)
      setActivities((data as Activity[]) ?? [])
    }
    setLoading(false)
  }

  const switchFeed = (type: 'all' | 'following') => {
    setFeed(type)
    loadFeed(type)
  }

  const weekDist = weeklyActivities.reduce((s, a) => s + (a.distance ?? 0), 0)
  const weekTime = weeklyActivities.reduce((s, a) => s + (a.duration ?? 0), 0)
  const weekElev = weeklyActivities.reduce((s, a) => s + (a.elevation_gain ?? 0), 0)

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">

      {/* Weekly summary */}
      <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-5 mb-6 shadow-lg shadow-orange-200 text-white">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-white">This Week</h2>
          <span className="text-xs text-orange-100">{weeklyActivities.length} {weeklyActivities.length === 1 ? 'activity' : 'activities'}</span>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-xl font-bold">{formatDistance(weekDist)}</div>
          <div className="text-xs text-orange-100 mt-0.5">Distance</div>
          </div>
          <div>
            <div className="text-xl font-bold">{formatDuration(weekTime)}</div>
            <div className="text-xs text-orange-100 mt-0.5">Time</div>
          </div>
          <div>
            <div className="text-xl font-bold">{Math.round(weekElev)} m</div>
            <div className="text-xs text-orange-100 mt-0.5">Elevation</div>
          </div>
        </div>
      </div>

      {/* Feed header + toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
          {(['all', 'following'] as const).map((t) => (
            <button
              key={t}
              onClick={() => switchFeed(t)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                feed === t ? 'bg-gray-200 text-white' : 'text-gray-400 hover:text-gray-800'
              }`}
            >
              {t === 'all' ? '🌍 Everyone' : '👥 Following'}
            </button>
          ))}
        </div>
        <Link
          href="/activities/new"
          className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Log Activity
        </Link>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl h-48 animate-pulse border border-gray-100" />
          ))}
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <div className="text-5xl mb-4">{feed === 'following' ? '👥' : '🏃'}</div>
          <p className="text-lg font-medium text-gray-400">
            {feed === 'following' ? 'No activities from people you follow' : 'No activities yet'}
          </p>
          <p className="text-sm mt-1 mb-6">
            {feed === 'following' ? 'Follow some athletes or switch to Everyone' : 'Be the first to log an activity!'}
          </p>
          <Link
            href="/activities/new"
            className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            Log your first activity
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {activities.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} showAuthor />
          ))}
        </div>
      )}
    </div>
  )
}



