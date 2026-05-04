'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Event } from '@/lib/types'
import { format, isPast, parseISO } from 'date-fns'
import { Calendar, MapPin, Users, Zap, Plus, Trophy } from 'lucide-react'
import Link from 'next/link'

export default function EventsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [events, setEvents] = useState<Event[]>([])
  const [myRsvps, setMyRsvps] = useState<Set<string>>(new Set())
  const [userId, setUserId] = useState<string | null>(null)
  const [tab, setTab] = useState<'upcoming' | 'past' | 'mine'>('upcoming')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: evts } = await supabase
        .from('events')
        .select('*, profiles(username, full_name, avatar_url)')
        .eq('is_public', true)
        .order('event_date', { ascending: true })

      const { data: rsvps } = await supabase
        .from('event_participants')
        .select('event_id')
        .eq('user_id', user.id)

      setEvents((evts ?? []) as Event[])
      setMyRsvps(new Set((rsvps ?? []).map(r => r.event_id as string)))
      setLoading(false)
    }
    load()
  }, [])

  const now = new Date()
  const filtered = events.filter(e => {
    const d = parseISO(e.event_date)
    if (tab === 'upcoming') return !isPast(d)
    if (tab === 'past') return isPast(d)
    return myRsvps.has(e.id)
  })

  const typeColor: Record<string, string> = {
    run: '#f97316', ride: '#3b82f6', swim: '#06b6d4',
    walk: '#22c55e', hike: '#84cc16', workout: '#a855f7', all: '#64748b',
  }

  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-4 animate-pulse">
      {[...Array(3)].map((_, i) => <div key={i} className="h-28 rounded-2xl" style={{ background: 'var(--surface-border)' }} />)}
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Events &amp; Races</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Group runs, virtual races, community challenges</p>
        </div>
        <Link href="/events/new" className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 transition-colors">
          <Plus size={15} />New
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg)' }}>
        {(['upcoming', 'past', 'mine'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 py-2 text-sm font-semibold rounded-lg capitalize transition-all"
            style={{
              background: tab === t ? 'var(--surface)' : 'transparent',
              color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
            }}>
            {t === 'mine' ? 'My Events' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 rounded-2xl border" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
          <Calendar size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold" style={{ color: 'var(--text-secondary)' }}>No {tab} events</p>
          {tab === 'upcoming' && <Link href="/events/new" className="text-sm text-orange-500 mt-1 inline-block">Create the first one →</Link>}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(ev => {
            const past = isPast(parseISO(ev.event_date))
            const rsvpd = myRsvps.has(ev.id)
            return (
              <Link key={ev.id} href={`/events/${ev.id}`}
                className="block rounded-2xl border p-4 hover:shadow-md transition-all"
                style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: (typeColor[ev.activity_type] || '#64748b') + '20', color: typeColor[ev.activity_type] || '#64748b' }}>
                        {ev.activity_type.toUpperCase()}
                      </span>
                      {ev.is_virtual && <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-purple-100 text-purple-600">Virtual</span>}
                      {rsvpd && <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-green-100 text-green-600">Going</span>}
                    </div>
                    <h3 className="font-bold truncate">{ev.title}</h3>
                    <div className="flex flex-wrap gap-3 mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <span className="flex items-center gap-1"><Calendar size={11} />{format(parseISO(ev.event_date), 'MMM d, yyyy · h:mm a')}</span>
                      {ev.location && <span className="flex items-center gap-1"><MapPin size={11} />{ev.location}</span>}
                      <span className="flex items-center gap-1"><Users size={11} />{ev.participant_count} going</span>
                      {ev.distance && <span className="flex items-center gap-1"><Zap size={11} />{(ev.distance / 1000).toFixed(1)} km</span>}
                    </div>
                  </div>
                  {past && <Trophy size={18} className="text-yellow-500 shrink-0 mt-1" />}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
