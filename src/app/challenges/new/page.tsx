'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ToastProvider'
import { useRouter } from 'next/navigation'
import { Trophy, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { ActivityType } from '@/lib/types'

const ACTIVITY_TYPES: (ActivityType | 'all')[] = ['all', 'run', 'ride', 'swim', 'walk', 'hike', 'workout']
const METRICS = ['distance', 'duration', 'elevation', 'activities'] as const

export default function NewChallengePage() {
  const supabase = createClient()
  const { toast } = useToast()
  const router = useRouter()

  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    activity_type: 'all' as ActivityType | 'all',
    metric: 'distance' as typeof METRICS[number],
    target_value: '',
    starts_at: '',
    ends_at: '',
    is_public: true,
  })

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title || !form.target_value || !form.starts_at || !form.ends_at) {
      toast('Please fill in all required fields', 'error'); return
    }
    if (new Date(form.ends_at) <= new Date(form.starts_at)) {
      toast('End date must be after start date', 'error'); return
    }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase.from('challenges').insert({
      creator_id: user.id,
      title: form.title,
      description: form.description || null,
      activity_type: form.activity_type,
      metric: form.metric,
      target_value: parseFloat(form.target_value),
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: new Date(form.ends_at).toISOString(),
      is_public: form.is_public,
      participant_count: 0,
    }).select().single()

    if (error) {
      toast(error.message, 'error')
      setSaving(false)
      return
    }

    // Auto-join as creator
    await supabase.from('challenge_participants').insert({
      challenge_id: (data as { id: string }).id,
      user_id: user.id,
      progress: 0,
    })
    // Bump participant count
    await supabase.from('challenges').update({ participant_count: 1 }).eq('id', (data as { id: string }).id)

    toast('Challenge created!', 'success')
    router.push(`/challenges/${(data as { id: string }).id}`)
  }

  const metricLabels: Record<string, string> = {
    distance: 'km',
    duration: 'minutes',
    elevation: 'meters gain',
    activities: 'activities',
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/challenges" className="p-2 rounded-xl hover:bg-orange-50 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <Trophy size={20} className="text-orange-500" />
        <h1 className="text-xl font-extrabold">New Challenge</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-2xl p-5 border shadow-sm space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Challenge Name *</label>
            <input
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="Run 100km in June"
              className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              style={{ background: 'var(--bg)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Description</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={2}
              placeholder="Describe your challenge…"
              className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
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
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Metric</label>
              <select
                value={form.metric}
                onChange={e => set('metric', e.target.value)}
                className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 capitalize"
                style={{ background: 'var(--bg)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}
              >
                {METRICS.map(m => <option key={m} value={m} className="capitalize">{m}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>
              Target ({metricLabels[form.metric]}) *
            </label>
            <input
              type="number"
              min="1"
              value={form.target_value}
              onChange={e => set('target_value', e.target.value)}
              placeholder="100"
              className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              style={{ background: 'var(--bg)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Start Date *</label>
              <input
                type="date"
                value={form.starts_at}
                onChange={e => set('starts_at', e.target.value)}
                className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                style={{ background: 'var(--bg)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>End Date *</label>
              <input
                type="date"
                value={form.ends_at}
                onChange={e => set('ends_at', e.target.value)}
                className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                style={{ background: 'var(--bg)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer py-1">
            <div
              onClick={() => set('is_public', !form.is_public)}
              className={`relative w-10 h-6 rounded-full transition-colors ${form.is_public ? 'bg-orange-500' : 'bg-gray-300'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.is_public ? 'translate-x-5' : 'translate-x-1'}`} />
            </div>
            <span className="text-sm font-medium">Public challenge</span>
          </label>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:opacity-50 text-white py-4 rounded-2xl font-bold shadow-lg shadow-orange-200 transition-all"
        >
          {saving ? 'Creating…' : 'Create Challenge'}
        </button>
      </form>
    </div>
  )
}
