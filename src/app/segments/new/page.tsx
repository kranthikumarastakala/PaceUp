'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ToastProvider'
import { useRouter } from 'next/navigation'
import { Layers, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { ActivityType } from '@/lib/types'

const ACTIVITY_TYPES: ActivityType[] = ['run', 'ride', 'swim', 'walk', 'hike', 'workout']

export default function NewSegmentPage() {
  const supabase = createClient()
  const { toast } = useToast()
  const router = useRouter()

  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    activity_type: 'run' as ActivityType,
    distance: '',
    elevation_gain: '',
    is_public: true,
  })

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.distance) { toast('Name and distance are required', 'error'); return }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase.from('segments').insert({
      user_id: user.id,
      name: form.name.trim(),
      activity_type: form.activity_type,
      polyline: [],   // In a full implementation, this would be drawn on a map
      distance: parseFloat(form.distance) * 1000,  // km → meters
      elevation_gain: form.elevation_gain ? parseFloat(form.elevation_gain) : null,
      is_public: form.is_public,
    }).select().single()

    if (error) { toast(error.message, 'error'); setSaving(false); return }

    toast('Segment created!', 'success')
    router.push(`/segments/${(data as { id: string }).id}`)
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/segments" className="p-2 rounded-xl hover:bg-orange-50 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <Layers size={20} className="text-orange-500" />
        <h1 className="text-xl font-extrabold">New Segment</h1>
      </div>

      <div className="rounded-2xl p-4 mb-5 border" style={{ background: 'rgba(251,146,60,0.07)', borderColor: 'rgba(251,146,60,0.3)' }}>
        <p className="text-sm text-orange-700">
          <strong>Tip:</strong> In a future update you will be able to draw segments directly on the map.
          For now, enter the segment details manually. Once created, the system will auto-detect efforts from activities with matching GPS data.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-2xl p-5 border shadow-sm space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Segment Name *</label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Riverside Sprint"
              className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              style={{ background: 'var(--bg)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Activity Type</label>
              <select
                value={form.activity_type}
                onChange={e => set('activity_type', e.target.value)}
                className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 capitalize"
                style={{ background: 'var(--bg)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}
              >
                {ACTIVITY_TYPES.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Distance (km) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={form.distance}
                onChange={e => set('distance', e.target.value)}
                placeholder="2.5"
                className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                style={{ background: 'var(--bg)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Elevation Gain (m)</label>
            <input
              type="number"
              step="1"
              min="0"
              value={form.elevation_gain}
              onChange={e => set('elevation_gain', e.target.value)}
              placeholder="Optional"
              className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              style={{ background: 'var(--bg)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => set('is_public', !form.is_public)}
              className={`relative w-10 h-6 rounded-full transition-colors ${form.is_public ? 'bg-orange-500' : 'bg-gray-300'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.is_public ? 'translate-x-5' : 'translate-x-1'}`} />
            </div>
            <span className="text-sm font-medium">Public segment</span>
          </label>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:opacity-50 text-white py-4 rounded-2xl font-bold shadow-lg shadow-orange-200 transition-all"
        >
          {saving ? 'Creating…' : 'Create Segment'}
        </button>
      </form>
    </div>
  )
}
