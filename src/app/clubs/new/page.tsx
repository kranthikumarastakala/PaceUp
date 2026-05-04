'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ToastProvider'
import { useRouter } from 'next/navigation'
import { Shield, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { ActivityType } from '@/lib/types'

const ACTIVITY_TYPES: (ActivityType | 'all')[] = ['all', 'run', 'ride', 'swim', 'walk', 'hike', 'workout']

export default function NewClubPage() {
  const supabase = createClient()
  const { toast } = useToast()
  const router = useRouter()

  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    activity_type: 'all' as ActivityType | 'all',
    is_public: true,
  })

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { toast('Club name is required', 'error'); return }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase.from('clubs').insert({
      owner_id: user.id,
      name: form.name.trim(),
      description: form.description || null,
      activity_type: form.activity_type,
      is_public: form.is_public,
      member_count: 1,
    }).select().single()

    if (error) { toast(error.message, 'error'); setSaving(false); return }

    // Auto-join as owner
    await supabase.from('club_members').insert({
      club_id: (data as { id: string }).id,
      user_id: user.id,
      role: 'owner',
    })

    toast('Club created!', 'success')
    router.push(`/clubs/${(data as { id: string }).id}`)
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/clubs" className="p-2 rounded-xl hover:bg-orange-50 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <Shield size={20} className="text-orange-500" />
        <h1 className="text-xl font-extrabold">Create a Club</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-2xl p-5 border shadow-sm space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Club Name *</label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Berlin Running Crew"
              className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              style={{ background: 'var(--bg)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Description</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={3}
              placeholder="What is this club about?"
              className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
              style={{ background: 'var(--bg)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Primary Activity</label>
            <select
              value={form.activity_type}
              onChange={e => set('activity_type', e.target.value)}
              className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 capitalize"
              style={{ background: 'var(--bg)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}
            >
              {ACTIVITY_TYPES.map(t => <option key={t} value={t} className="capitalize">{t === 'all' ? 'All activities' : t}</option>)}
            </select>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => set('is_public', !form.is_public)}
              className={`relative w-10 h-6 rounded-full transition-colors ${form.is_public ? 'bg-orange-500' : 'bg-gray-300'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.is_public ? 'translate-x-5' : 'translate-x-1'}`} />
            </div>
            <div>
              <p className="text-sm font-medium">Public club</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Anyone can find and join this club</p>
            </div>
          </label>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:opacity-50 text-white py-4 rounded-2xl font-bold shadow-lg shadow-orange-200 transition-all"
        >
          {saving ? 'Creating…' : 'Create Club'}
        </button>
      </form>
    </div>
  )
}
