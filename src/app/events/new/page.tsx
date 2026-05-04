'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Calendar } from 'lucide-react'
import Link from 'next/link'

export default function NewEventPage() {
  const supabase = createClient()
  const router = useRouter()

  const [form, setForm] = useState({
    title: '', description: '', activity_type: 'run',
    event_date: '', location: '',
    distance: '', is_virtual: false, is_public: true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof typeof form, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!form.title.trim() || !form.event_date) { setError('Title and date are required'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data, error: err } = await supabase.from('events').insert({
      creator_id: user.id,
      title: form.title.trim(),
      description: form.description.trim() || null,
      activity_type: form.activity_type,
      event_date: new Date(form.event_date).toISOString(),
      location: form.location.trim() || null,
      distance: form.distance ? parseFloat(form.distance) * 1000 : null,
      is_virtual: form.is_virtual,
      is_public: form.is_public,
    }).select().single()

    if (err) { setError(err.message); setSaving(false); return }

    // Auto-RSVP creator
    await supabase.from('event_participants').insert({ event_id: (data as { id: string }).id, user_id: user.id, rsvp: 'going' })
    await supabase.from('events').update({ participant_count: 1 }).eq('id', (data as { id: string }).id)

    router.push(`/events/${(data as { id: string }).id}`)
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/events" className="p-2 rounded-xl hover:bg-orange-50 transition-colors"><ArrowLeft size={18} /></Link>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-orange-500">
          <Calendar size={16} className="text-white" />
        </div>
        <h1 className="text-xl font-extrabold">Create Event</h1>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border p-6 space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        {error && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

        <div>
          <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>Event Title *</label>
          <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Sunday 10K Race" required
            className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            style={{ background: 'var(--bg)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>Activity Type</label>
            <select value={form.activity_type} onChange={e => set('activity_type', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none"
              style={{ background: 'var(--bg)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}>
              {['run','ride','swim','walk','hike','workout','all'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>Date &amp; Time *</label>
            <input type="datetime-local" value={form.event_date} onChange={e => set('event_date', e.target.value)} required
              className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none"
              style={{ background: 'var(--bg)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>Location</label>
            <input value={form.location} onChange={e => set('location', e.target.value)} placeholder="City Park, Start Line"
              className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none"
              style={{ background: 'var(--bg)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>Distance (km)</label>
            <input type="number" step="0.1" min="0" value={form.distance} onChange={e => set('distance', e.target.value)} placeholder="10"
              className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none"
              style={{ background: 'var(--bg)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>Description</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3}
            placeholder="Tell people what to expect..."
            className="w-full px-3 py-2 rounded-xl border text-sm resize-none focus:outline-none"
            style={{ background: 'var(--bg)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
        </div>

        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.is_virtual} onChange={e => set('is_virtual', e.target.checked)} className="rounded" />
            <span style={{ color: 'var(--text-secondary)' }}>Virtual event</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.is_public} onChange={e => set('is_public', e.target.checked)} className="rounded" />
            <span style={{ color: 'var(--text-secondary)' }}>Public</span>
          </label>
        </div>

        <button type="submit" disabled={saving}
          className="w-full py-3 rounded-xl font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-60 transition-all">
          {saving ? 'Creating...' : 'Create Event'}
        </button>
      </form>
    </div>
  )
}
