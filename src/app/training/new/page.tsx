'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ToastProvider'
import type { ActivityType, TrainingPlanDay } from '@/lib/types'
import { Plus, Trash2 } from 'lucide-react'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_TYPES = ['run', 'ride', 'swim', 'walk', 'hike', 'workout', 'rest'] as const
const DAY_ICONS: Record<string, string> = {
  run: '🏃', ride: '🚴', swim: '🏊', walk: '🚶', hike: '🥾', workout: '💪', rest: '😴',
}
const ACT_TYPES = ['run', 'ride', 'swim', 'walk', 'hike', 'workout', 'all'] as const

type DraftDay = Omit<TrainingPlanDay, 'id' | 'plan_id' | 'created_at'>

export default function NewTrainingPlanPage() {
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [durationWeeks, setDurationWeeks] = useState(4)
  const [activityType, setActivityType] = useState<ActivityType | 'all'>('run')
  const [isPublic, setIsPublic] = useState(true)
  const [days, setDays] = useState<DraftDay[]>([])
  const [saving, setSaving] = useState(false)
  const [activeWeek, setActiveWeek] = useState(1)

  const addDay = (week: number, dayOfWeek: number) => {
    if (days.find((d) => d.week === week && d.day_of_week === dayOfWeek)) return
    setDays((prev) => [
      ...prev,
      {
        week,
        day_of_week: dayOfWeek,
        activity_type: activityType === 'all' ? 'run' : activityType as typeof DAY_TYPES[number],
        target_distance: null,
        target_duration: null,
        notes: null,
      },
    ])
  }

  const removeDay = (week: number, dayOfWeek: number) => {
    setDays((prev) => prev.filter((d) => !(d.week === week && d.day_of_week === dayOfWeek)))
  }

  const updateDay = (week: number, dayOfWeek: number, patch: Partial<DraftDay>) => {
    setDays((prev) =>
      prev.map((d) => d.week === week && d.day_of_week === dayOfWeek ? { ...d, ...patch } : d)
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { toast('Title is required', 'error'); return }
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast('Not logged in', 'error'); setSaving(false); return }

    const { data: plan, error: planErr } = await supabase
      .from('training_plans')
      .insert({
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        duration_weeks: durationWeeks,
        activity_type: activityType,
        is_public: isPublic,
      })
      .select()
      .single()

    if (planErr || !plan) {
      toast(planErr?.message ?? 'Error creating plan', 'error')
      setSaving(false)
      return
    }

    if (days.length > 0) {
      await supabase.from('training_plan_days').insert(
        days.map((d) => ({ ...d, plan_id: (plan as { id: string }).id }))
      )
    }

    toast('Training plan created!', 'success')
    router.push(`/training/${(plan as { id: string }).id}`)
    setSaving(false)
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">New Training Plan</h1>
        <p className="text-gray-500 text-sm mt-1">Design a structured weekly program</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Title */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">Plan Name *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. 10K Build — 8 Weeks"
            required
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Duration */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Duration (weeks)</label>
            <input
              type="number"
              min={1}
              max={52}
              value={durationWeeks}
              onChange={(e) => setDurationWeeks(parseInt(e.target.value) || 4)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          {/* Activity type */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Sport</label>
            <select
              value={activityType}
              onChange={(e) => setActivityType(e.target.value as ActivityType | 'all')}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              {ACT_TYPES.map((t) => (
                <option key={t} value={t}>{DAY_ICONS[t] ?? ''} {t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Who is this plan for? What's the goal?"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
          />
        </div>

        {/* Weekly schedule builder */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-gray-700">Weekly Schedule</label>
            <div className="flex gap-1">
              {Array.from({ length: durationWeeks }, (_, i) => i + 1).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setActiveWeek(w)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                    activeWeek === w ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  W{w}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {DAYS.map((dayLabel, dayIdx) => {
              const existing = days.find((d) => d.week === activeWeek && d.day_of_week === dayIdx)
              return (
                <div
                  key={dayIdx}
                  className={`rounded-xl border p-2 min-h-[90px] flex flex-col gap-1 transition-colors ${
                    existing ? 'border-orange-200 bg-orange-50' : 'border-gray-100 bg-white'
                  }`}
                >
                  <p className="text-xs font-medium text-gray-500 text-center">{dayLabel}</p>
                  {existing ? (
                    <>
                      <select
                        value={existing.activity_type}
                        onChange={(e) => updateDay(activeWeek, dayIdx, { activity_type: e.target.value as typeof DAY_TYPES[number] })}
                        className="text-xs border border-gray-200 rounded-lg p-1 w-full focus:outline-none"
                      >
                        {DAY_TYPES.map((t) => <option key={t} value={t}>{DAY_ICONS[t]} {t}</option>)}
                      </select>
                      {existing.activity_type !== 'rest' && (
                        <input
                          type="number"
                          placeholder="km"
                          min={0}
                          step={0.1}
                          value={existing.target_distance != null ? existing.target_distance / 1000 : ''}
                          onChange={(e) =>
                            updateDay(activeWeek, dayIdx, {
                              target_distance: e.target.value ? parseFloat(e.target.value) * 1000 : null,
                            })
                          }
                          className="text-xs border border-gray-200 rounded-lg p-1 w-full focus:outline-none"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => removeDay(activeWeek, dayIdx)}
                        className="text-red-400 hover:text-red-600 text-xs self-end mt-auto"
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => addDay(activeWeek, dayIdx)}
                      className="flex-1 flex items-center justify-center text-gray-300 hover:text-orange-400 transition-colors"
                    >
                      <Plus size={18} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Visibility */}
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => setIsPublic(!isPublic)}
            className={`relative w-10 h-6 rounded-full transition-colors ${isPublic ? 'bg-orange-500' : 'bg-gray-300'}`}
          >
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${isPublic ? 'translate-x-5' : 'translate-x-1'}`} />
          </div>
          <span className="text-sm text-gray-700">Public plan — visible to everyone</span>
        </label>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Create Plan'}
          </button>
        </div>
      </form>
    </div>
  )
}
