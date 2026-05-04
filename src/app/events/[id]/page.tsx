'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import type { Event, EventParticipant } from '@/lib/types'
import { format, isPast, parseISO } from 'date-fns'
import { Calendar, MapPin, Users, Zap, ArrowLeft, Trophy, CheckCircle, Clock } from 'lucide-react'
import Link from 'next/link'

export default function EventDetailPage() {
  const supabase = createClient()
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const [event, setEvent] = useState<Event | null>(null)
  const [participants, setParticipants] = useState<EventParticipant[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [myRsvp, setMyRsvp] = useState<EventParticipant | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'details' | 'leaderboard'>('details')
  const [saving, setSaving] = useState(false)
  const [finishTime, setFinishTime] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const [{ data: ev }, { data: parts }] = await Promise.all([
        supabase.from('events').select('*, profiles(username, full_name, avatar_url)').eq('id', id).single(),
        supabase.from('event_participants').select('*, profiles(username, full_name, avatar_url)').eq('event_id', id).order('finish_time', { ascending: true }),
      ])

      setEvent(ev as Event)
      const pList = (parts ?? []) as EventParticipant[]
      setParticipants(pList)
      setMyRsvp(pList.find(p => p.user_id === user.id) ?? null)
      setLoading(false)
    }
    load()
  }, [id])

  const handleRsvp = async (rsvp: 'going' | 'maybe' | 'not_going') => {
    if (!userId || !event) return
    setSaving(true)
    if (myRsvp) {
      await supabase.from('event_participants').update({ rsvp }).eq('event_id', event.id).eq('user_id', userId)
      setMyRsvp(p => p ? { ...p, rsvp } : null)
    } else {
      const { data } = await supabase.from('event_participants').insert({ event_id: event.id, user_id: userId, rsvp }).select().single()
      setMyRsvp(data as EventParticipant)
      const newCount = event.participant_count + 1
      await supabase.from('events').update({ participant_count: newCount }).eq('id', event.id)
      setEvent(e => e ? { ...e, participant_count: newCount } : e)
    }
    setSaving(false)
  }

  const handleSubmitTime = async () => {
    if (!finishTime || !myRsvp || !event) return
    const [h, m, s] = finishTime.split(':').map(Number)
    const secs = (h || 0) * 3600 + (m || 0) * 60 + (s || 0)
    await supabase.from('event_participants').update({ finish_time: secs }).eq('event_id', event.id).eq('user_id', userId ?? '')
    setMyRsvp(p => p ? { ...p, finish_time: secs } : null)
    setParticipants(ps => ps.map(p => p.user_id === userId ? { ...p, finish_time: secs } : p).sort((a, b) => (a.finish_time ?? 999999) - (b.finish_time ?? 999999)))
  }

  const fmtTime = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
    return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`
  }

  if (loading || !event) return (
    <div className="max-w-2xl mx-auto px-4 py-8 animate-pulse space-y-4">
      <div className="h-8 rounded w-1/2" style={{ background: 'var(--surface-border)' }} />
      <div className="h-48 rounded-2xl" style={{ background: 'var(--surface-border)' }} />
    </div>
  )

  const past = isPast(parseISO(event.event_date))
  const going = participants.filter(p => p.rsvp === 'going')
  const ranked = going.filter(p => p.finish_time != null).sort((a, b) => (a.finish_time ?? 999999) - (b.finish_time ?? 999999))

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/events" className="p-2 rounded-xl hover:bg-orange-50 transition-colors"><ArrowLeft size={18} /></Link>
        <h1 className="text-xl font-extrabold truncate flex-1">{event.title}</h1>
      </div>

      {/* Hero card */}
      <div className="rounded-2xl border p-5 space-y-3" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        <div className="flex flex-wrap gap-2">
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-orange-100 text-orange-600">{event.activity_type.toUpperCase()}</span>
          {event.is_virtual && <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-purple-100 text-purple-600">Virtual</span>}
          {past && <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-500">Past Event</span>}
        </div>
        <div className="space-y-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <div className="flex items-center gap-2"><Calendar size={14} className="text-orange-500" />{format(parseISO(event.event_date), 'EEEE, MMMM d yyyy · h:mm a')}</div>
          {event.location && <div className="flex items-center gap-2"><MapPin size={14} className="text-orange-500" />{event.location}</div>}
          <div className="flex items-center gap-2"><Users size={14} className="text-orange-500" />{event.participant_count} attending</div>
          {event.distance && <div className="flex items-center gap-2"><Zap size={14} className="text-orange-500" />{(event.distance / 1000).toFixed(1)} km</div>}
        </div>
        {event.description && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{event.description}</p>}

        {/* RSVP */}
        {!past && (
          <div className="pt-2 border-t flex gap-2" style={{ borderColor: 'var(--surface-border)' }}>
            {(['going', 'maybe', 'not_going'] as const).map(r => (
              <button key={r} onClick={() => handleRsvp(r)} disabled={saving}
                className="flex-1 py-2 rounded-xl text-xs font-bold transition-all border"
                style={{
                  background: myRsvp?.rsvp === r ? '#f97316' : 'transparent',
                  color: myRsvp?.rsvp === r ? 'white' : 'var(--text-secondary)',
                  borderColor: myRsvp?.rsvp === r ? '#f97316' : 'var(--surface-border)',
                }}>
                {r === 'going' ? '✓ Going' : r === 'maybe' ? '? Maybe' : '✗ Can\'t Go'}
              </button>
            ))}
          </div>
        )}

        {/* Submit finish time for past events */}
        {past && myRsvp?.rsvp === 'going' && (
          <div className="pt-2 border-t space-y-2" style={{ borderColor: 'var(--surface-border)' }}>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Submit your finish time</p>
            <div className="flex gap-2">
              <input type="text" placeholder="0:45:30 (h:mm:ss)" value={finishTime} onChange={e => setFinishTime(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border text-sm focus:outline-none"
                style={{ background: 'var(--bg)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
              <button onClick={handleSubmitTime} className="px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition-colors">
                Submit
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg)' }}>
        {(['details', 'leaderboard'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 py-2 text-sm font-semibold rounded-lg capitalize transition-all"
            style={{
              background: tab === t ? 'var(--surface)' : 'transparent',
              color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
            }}>
            {t === 'leaderboard' ? `Leaderboard (${ranked.length})` : 'Attendees'}
          </button>
        ))}
      </div>

      {tab === 'details' ? (
        <div className="space-y-2">
          {going.length === 0 ? (
            <p className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>No attendees yet. Be the first!</p>
          ) : going.map(p => (
            <div key={p.user_id} className="flex items-center gap-3 p-3 rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm">
                {(p.profiles?.full_name || p.profiles?.username || '?')[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold">{p.profiles?.full_name || p.profiles?.username}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>@{p.profiles?.username}</p>
              </div>
              {p.finish_time && <span className="ml-auto text-xs font-bold text-orange-500"><Clock size={10} className="inline mr-1" />{fmtTime(p.finish_time)}</span>}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {ranked.length === 0 ? (
            <p className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>No finish times submitted yet.</p>
          ) : ranked.map((p, i) => (
            <div key={p.user_id} className="flex items-center gap-3 p-3 rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
              <span className="w-6 text-center font-extrabold text-sm" style={{ color: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : 'var(--text-muted)' }}>
                {i < 3 ? ['🥇','🥈','🥉'][i] : i + 1}
              </span>
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm">
                {(p.profiles?.full_name || p.profiles?.username || '?')[0].toUpperCase()}
              </div>
              <p className="text-sm font-semibold flex-1">{p.profiles?.full_name || p.profiles?.username}</p>
              <span className="text-sm font-extrabold text-orange-500">{fmtTime(p.finish_time!)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
