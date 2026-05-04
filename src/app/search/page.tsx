'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ActivityCard } from '@/components/ActivityCard'
import { cn } from '@/lib/utils'
import type { Profile, Activity, Club, Event } from '@/lib/types'
import { Search, User, Shield, Calendar } from 'lucide-react'
import { format, parseISO } from 'date-fns'

export default function SearchPage() {
  const supabase = createClient()
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<'activities' | 'users' | 'clubs' | 'events'>('activities')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [clubs, setClubs] = useState<Club[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(false)

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim()
    if (!trimmed) { setProfiles([]); setActivities([]); setClubs([]); setEvents([]); return }
    setLoading(true)
    const p = `%${trimmed}%`
    const [{ data: users }, { data: acts }, { data: clubData }, { data: eventData }] = await Promise.all([
      supabase.from('profiles').select('*').or(`username.ilike.${p},full_name.ilike.${p}`).limit(15),
      supabase.from('activities').select('*, profiles(username, full_name, avatar_url)').eq('is_public', true).or(`title.ilike.${p},description.ilike.${p}`).order('created_at', { ascending: false }).limit(20),
      supabase.from('clubs').select('*').ilike('name', p).eq('is_public', true).limit(15),
      supabase.from('events').select('*').ilike('title', p).eq('is_public', true).limit(15),
    ])
    setProfiles((users as Profile[]) ?? [])
    setActivities((acts as Activity[]) ?? [])
    setClubs((clubData as Club[]) ?? [])
    setEvents((eventData as Event[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => runSearch(query), 300)
    return () => clearTimeout(timer)
  }, [query, runSearch])

  const hasResults = profiles.length > 0 || activities.length > 0 || clubs.length > 0 || events.length > 0

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-extrabold mb-6">Discover</h1>

      <div className="relative mb-6">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
        <input type="search" autoFocus value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search athletes, activities, clubs, events..."
          className="w-full border rounded-2xl pl-11 pr-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-orange-400 shadow-sm text-sm"
          style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
        {loading && <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />}
      </div>

      {query && hasResults && (
        <div className="flex gap-1 mb-5 p-1 rounded-xl w-fit" style={{ background: 'var(--bg)' }}>
          {(['activities', 'users', 'clubs', 'events'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all')}
              style={{ background: tab === t ? 'var(--surface)' : 'transparent', color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)', boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,.08)' : 'none' }}>
              {t}
              {t === 'activities' && activities.length > 0 && <span className="ml-1 text-orange-500">{activities.length}</span>}
              {t === 'users' && profiles.length > 0 && <span className="ml-1 text-orange-500">{profiles.length}</span>}
              {t === 'clubs' && clubs.length > 0 && <span className="ml-1 text-orange-500">{clubs.length}</span>}
              {t === 'events' && events.length > 0 && <span className="ml-1 text-orange-500">{events.length}</span>}
            </button>
          ))}
        </div>
      )}

      {!loading && query && tab === 'activities' && (
        activities.length === 0
          ? <p className="text-center py-16" style={{ color: 'var(--text-muted)' }}>No activities found</p>
          : <div className="space-y-4">{activities.map(a => <ActivityCard key={a.id} activity={a} showAuthor />)}</div>
      )}

      {!loading && query && tab === 'users' && (
        profiles.length === 0
          ? <p className="text-center py-16" style={{ color: 'var(--text-muted)' }}>No athletes found</p>
          : <div className="space-y-3">
            {profiles.map(p => (
              <Link key={p.id} href={`/profile/${p.username}`}
                className="flex items-center gap-3 border rounded-2xl p-4 shadow-sm hover:shadow-md transition-all"
                style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-bold shrink-0">
                  {(p.full_name || p.username || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{p.full_name || p.username}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>@{p.username}</div>
                  {p.bio && <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>{p.bio}</div>}
                </div>
                <User size={16} style={{ color: 'var(--text-muted)' }} className="shrink-0" />
              </Link>
            ))}
          </div>
      )}

      {!loading && query && tab === 'clubs' && (
        clubs.length === 0
          ? <p className="text-center py-16" style={{ color: 'var(--text-muted)' }}>No clubs found</p>
          : <div className="space-y-3">
            {clubs.map(c => (
              <Link key={c.id} href={`/clubs/${c.id}`}
                className="flex items-center gap-3 border rounded-2xl p-4 hover:shadow-md transition-all"
                style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Shield size={16} className="text-blue-500" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{c.name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.member_count} members</p>
                </div>
              </Link>
            ))}
          </div>
      )}

      {!loading && query && tab === 'events' && (
        events.length === 0
          ? <p className="text-center py-16" style={{ color: 'var(--text-muted)' }}>No events found</p>
          : <div className="space-y-3">
            {events.map(ev => (
              <Link key={ev.id} href={`/events/${ev.id}`}
                className="flex items-center gap-3 border rounded-2xl p-4 hover:shadow-md transition-all"
                style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                  <Calendar size={16} className="text-green-500" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{ev.title}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{format(parseISO(ev.event_date), 'MMM d, yyyy')} · {ev.participant_count} going</p>
                </div>
              </Link>
            ))}
          </div>
      )}

      {!query && (
        <div className="text-center py-24">
          <div className="text-5xl mb-3">🔍</div>
          <p className="text-base font-medium" style={{ color: 'var(--text-secondary)' }}>Search across the entire platform</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Athletes, activities, clubs and events</p>
        </div>
      )}
    </div>
  )
}
