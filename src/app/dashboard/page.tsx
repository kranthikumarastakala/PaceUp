'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ActivityCard } from '@/components/ActivityCard'
import type { Activity } from '@/lib/types'
import Link from 'next/link'
import { formatDistance, formatDuration } from '@/lib/utils'
import { startOfWeek } from 'date-fns'
import { Loader2 } from 'lucide-react'

const PAGE_SIZE = 20

export default function DashboardPage() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [weeklyActivities, setWeeklyActivities] = useState<Activity[]>([])
  const [feed, setFeed] = useState<'all' | 'following'>('all')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [followIds, setFollowIds] = useState<string[]>([])
  const sentinelRef = useRef<HTMLDivElement>(null)
  const feedRef = useRef(feed)
  feedRef.current = feed
  const supabase = createClient()

  const fetchFeedPage = useCallback(async (
    type: 'all' | 'following',
    uid: string,
    fids: string[],
    from: number
  ): Promise<Activity[]> => {
    if (type === 'following') {
      const ids = fids.length > 0 ? [...fids, uid] : [uid]
      const { data } = await supabase
        .from('activities')
        .select('*, profiles(username, full_name, avatar_url)')
        .in('user_id', ids)
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1)
      return (data as Activity[]) ?? []
    } else {
      const { data } = await supabase
        .from('activities')
        .select('*, profiles(username, full_name, avatar_url)')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1)
      return (data as Activity[]) ?? []
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      setUserId(user.id)

      const weekStart = startOfWeek(new Date()).toISOString()
      const [{ data: weekly }, { data: follows }] = await Promise.all([
        supabase.from('activities').select('*').eq('user_id', user.id).gte('created_at', weekStart),
        supabase.from('follows').select('following_id').eq('follower_id', user.id),
      ])
      setWeeklyActivities((weekly as Activity[]) ?? [])
      const fids = (follows ?? []).map((f: any) => f.following_id as string)
      setFollowIds(fids)

      const first = await fetchFeedPage('all', user.id, fids, 0)
      setActivities(first)
      setHasMore(first.length === PAGE_SIZE)
      setLoading(false)
    }
    init()
  }, [])

  // Sentinel observer for infinite scroll
  useEffect(() => {
    if (!hasMore || loadingMore || loading) return
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting || !userId) return
        setLoadingMore(true)
        const next = await fetchFeedPage(feedRef.current, userId, followIds, activities.length)
        setActivities((prev) => [...prev, ...next])
        setHasMore(next.length === PAGE_SIZE)
        setLoadingMore(false)
      },
      { rootMargin: '300px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, loading, userId, followIds, activities.length, fetchFeedPage])

  const switchFeed = async (type: 'all' | 'following') => {
    if (!userId) return
    setFeed(type)
    setLoading(true)
    const first = await fetchFeedPage(type, userId, followIds, 0)
    setActivities(first)
    setHasMore(first.length === PAGE_SIZE)
    setLoading(false)
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
                feed === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-800'
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
          <p className="text-lg font-medium">
            {feed === 'following' ? 'No activities from people you follow' : 'No activities yet'}
          </p>
          <p className="text-sm mt-1 mb-6">
            {feed === 'following' ? 'Follow some athletes or switch to Everyone' : 'Be the first to log an activity!'}
          </p>
          <Link href="/activities/new" className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors">
            Log your first activity
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {activities.map((activity) => (
              <ActivityCard key={activity.id} activity={activity} showAuthor />
            ))}
          </div>
          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="h-10 flex items-center justify-center mt-4">
            {loadingMore && <Loader2 size={20} className="animate-spin text-orange-400" />}
            {!hasMore && activities.length > 0 && (
              <p className="text-xs text-gray-400">You&rsquo;re all caught up!</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

