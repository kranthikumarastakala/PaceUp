'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Plus, Map, Star, Search } from 'lucide-react'
import { formatDistance, formatElevation, activityIcon, timeAgo } from '@/lib/utils'
import type { Route } from '@/lib/types'

const TYPE_FILTERS = ['all', 'run', 'ride', 'walk', 'hike'] as const

export default function RoutesPage() {
  const supabase = createClient()
  const [routes, setRoutes] = useState<Route[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<typeof TYPE_FILTERS[number]>('all')
  const [search, setSearch] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUserId(user?.id ?? null)

      const query = supabase
        .from('routes')
        .select('*, profiles(username,full_name,avatar_url)')
        .eq('is_public', true)
        .order('star_count', { ascending: false })
        .limit(50)

      const { data } = await query
      setRoutes((data as Route[]) ?? [])

      if (user) {
        const { data: stars } = await supabase
          .from('route_stars')
          .select('route_id')
          .eq('user_id', user.id)
        setStarredIds(new Set((stars ?? []).map((s: { route_id: string }) => s.route_id)))
      }
      setLoading(false)
    }
    load()
  }, [])

  const toggleStar = async (routeId: string) => {
    if (!userId) return
    const isStarred = starredIds.has(routeId)

    if (isStarred) {
      setStarredIds((s) => { const n = new Set(s); n.delete(routeId); return n })
      setRoutes((r) => r.map((x) => x.id === routeId ? { ...x, star_count: x.star_count - 1 } : x))
      await supabase.from('route_stars').delete().eq('route_id', routeId).eq('user_id', userId)
      await supabase.from('routes').update({ star_count: (routes.find(r => r.id === routeId)?.star_count ?? 1) - 1 }).eq('id', routeId)
    } else {
      setStarredIds((s) => new Set(s).add(routeId))
      setRoutes((r) => r.map((x) => x.id === routeId ? { ...x, star_count: x.star_count + 1 } : x))
      await supabase.from('route_stars').insert({ route_id: routeId, user_id: userId })
      await supabase.from('routes').update({ star_count: (routes.find(r => r.id === routeId)?.star_count ?? 0) + 1 }).eq('id', routeId)
    }
  }

  const filtered = routes.filter((r) => {
    const matchType = filter === 'all' || r.activity_type === filter
    const matchSearch = !search.trim() || r.name.toLowerCase().includes(search.toLowerCase())
    return matchType && matchSearch
  })

  if (loading) return (
    <div className="max-w-3xl mx-auto px-4 py-8 animate-pulse space-y-3">
      {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-white rounded-2xl" />)}
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Routes</h1>
          <p className="text-gray-500 text-sm mt-0.5">Discover & share GPX routes</p>
        </div>
        {userId && (
          <Link
            href="/routes/new"
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus size={16} /> New Route
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search routes…"
            className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        <div className="flex gap-1.5">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === t
                  ? 'bg-orange-500 text-white'
                  : 'bg-white border border-gray-200 text-gray-500 hover:border-orange-300'
              }`}
            >
              {t === 'all' ? 'All' : `${activityIcon(t as never)} ${t.charAt(0).toUpperCase() + t.slice(1)}`}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Map size={48} className="mx-auto mb-3 text-gray-200" />
          <p className="font-medium">No routes found</p>
          {userId && (
            <Link href="/routes/new" className="text-sm text-orange-500 hover:underline mt-2 inline-block">
              Create the first one
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((route) => (
            <div key={route.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <Link href={`/routes/${route.id}`} className="flex-1 min-w-0 group">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{activityIcon(route.activity_type)}</span>
                    <h3 className="font-semibold text-gray-900 group-hover:text-orange-500 transition-colors truncate">
                      {route.name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                    {route.distance != null && <span>📏 {formatDistance(route.distance)}</span>}
                    {route.elevation_gain != null && <span>⛰ {formatElevation(route.elevation_gain)}</span>}
                    <span className="text-xs text-gray-400">by @{route.profiles?.username}</span>
                    <span className="text-xs text-gray-400">{timeAgo(route.created_at)}</span>
                  </div>
                  {route.description && (
                    <p className="text-sm text-gray-400 mt-1.5 line-clamp-2">{route.description}</p>
                  )}
                </Link>

                <button
                  onClick={() => toggleStar(route.id)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                    starredIds.has(route.id)
                      ? 'text-yellow-500 bg-yellow-50'
                      : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50'
                  }`}
                >
                  <Star size={15} className={starredIds.has(route.id) ? 'fill-yellow-400' : ''} />
                  <span className="font-medium">{route.star_count}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
