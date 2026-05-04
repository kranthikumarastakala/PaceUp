'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ActivityCard } from '@/components/ActivityCard'
import { cn } from '@/lib/utils'
import type { Profile, Activity } from '@/lib/types'
import { Search, User } from 'lucide-react'

export default function SearchPage() {
  const supabase = createClient()
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<'activities' | 'users'>('activities')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(false)

  const runSearch = useCallback(
    async (q: string) => {
      const trimmed = q.trim()
      if (!trimmed) {
        setProfiles([])
        setActivities([])
        return
      }
      setLoading(true)

      const [{ data: users }, { data: acts }] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .or(`username.ilike.%${trimmed}%,full_name.ilike.%${trimmed}%`)
          .limit(15),
        supabase
          .from('activities')
          .select('*, profiles(username, full_name, avatar_url)')
          .eq('is_public', true)
          .or(`title.ilike.%${trimmed}%,description.ilike.%${trimmed}%`)
          .order('created_at', { ascending: false })
          .limit(20),
      ])

      setProfiles((users as Profile[]) ?? [])
      setActivities((acts as Activity[]) ?? [])
      setLoading(false)
    },
    []
  )

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => runSearch(query), 300)
    return () => clearTimeout(timer)
  }, [query, runSearch])

  const hasResults = profiles.length > 0 || activities.length > 0

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-extrabold text-gray-900 mb-6">Search</h1>

      {/* Search input */}
      <div className="relative mb-6">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search athletes, activities…"
          className="w-full bg-white border border-gray-200 rounded-2xl pl-11 pr-4 py-3.5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent shadow-sm transition-all text-sm"
        />
        {loading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {query && hasResults && (
        /* Tabs */
        <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-xl w-fit">
          {(['activities', 'users'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors',
                tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {t}
              {t === 'activities' && activities.length > 0 && (
                <span className="ml-1.5 text-xs text-orange-500 font-semibold">{activities.length}</span>
              )}
              {t === 'users' && profiles.length > 0 && (
                <span className="ml-1.5 text-xs text-orange-500 font-semibold">{profiles.length}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {!loading && query && tab === 'activities' && (
        activities.length === 0 ? (
          <p className="text-center py-16 text-gray-400">No activities found for &ldquo;{query}&rdquo;</p>
        ) : (
          <div className="space-y-4">
            {activities.map((a) => <ActivityCard key={a.id} activity={a} showAuthor />)}
          </div>
        )
      )}

      {!loading && query && tab === 'users' && (
        profiles.length === 0 ? (
          <p className="text-center py-16 text-gray-400">No athletes found for &ldquo;{query}&rdquo;</p>
        ) : (
          <div className="space-y-3">
            {profiles.map((p) => (
              <Link
                key={p.id}
                href={`/profile/${p.username}`}
                className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-bold shrink-0">
                  {(p.full_name || p.username || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 text-sm truncate">{p.full_name || p.username}</div>
                  <div className="text-xs text-gray-400">@{p.username}</div>
                  {p.bio && <div className="text-xs text-gray-500 mt-0.5 truncate">{p.bio}</div>}
                </div>
                <User size={16} className="text-gray-300 shrink-0" />
              </Link>
            ))}
          </div>
        )
      )}

      {/* Empty state */}
      {!query && (
        <div className="text-center py-24">
          <div className="text-5xl mb-3">🔍</div>
          <p className="text-base font-medium text-gray-500">Search for athletes or activities</p>
          <p className="text-sm text-gray-400 mt-1">Find friends, discover new routes</p>
        </div>
      )}
    </div>
  )
}
