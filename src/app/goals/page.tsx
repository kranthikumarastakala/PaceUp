'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ToastProvider'
import type { Activity, Goal, GoalMetric, GoalPeriod, ActivityType } from '@/lib/types'
import { formatDistance, formatDuration, activityIcon } from '@/lib/utils'
import { Target, Plus, Trash2, CheckCircle2, Loader2 } from 'lucide-react'
import { startOfWeek, startOfMonth, startOfYear } from 'date-fns'

// ─── helpers ──────────────────────────────────────────────────────────────
const METRIC_LABELS: Record<GoalMetric, string> = {
  distance: 'Distance',
  duration: 'Moving Time',
  elevation: 'Elevation',
  activities: 'Activities',
}

const PERIOD_LABELS: Record<GoalPeriod, string> = {
  weekly: 'This week',
  monthly: 'This month',
  yearly: 'This year',
}

function periodStart(period: GoalPeriod): Date {
  const now = new Date()
  if (period === 'weekly') return startOfWeek(now)
  if (period === 'monthly') return startOfMonth(now)
  return startOfYear(now)
}

function computeProgress(goal: Goal, activities: Activity[]): number {
  const since = periodStart(goal.period)
  const relevant = activities.filter((a) => {
    const after = new Date(a.created_at) >= since
    const typeMatch = goal.activity_type === 'all' || a.type === goal.activity_type
    return after && typeMatch
  })
  switch (goal.type) {
    case 'distance': return relevant.reduce((s, a) => s + (a.distance ?? 0), 0)
    case 'duration': return relevant.reduce((s, a) => s + (a.duration ?? 0), 0)
    case 'elevation': return relevant.reduce((s, a) => s + (a.elevation_gain ?? 0), 0)
    case 'activities': return relevant.length
  }
}

function formatValue(type: GoalMetric, value: number): string {
  if (type === 'distance') return formatDistance(value)
  if (type === 'duration') return formatDuration(value)
  if (type === 'elevation') return `${Math.round(value)} m`
  return String(Math.round(value))
}

function inputToStoredValue(type: GoalMetric, raw: number): number {
  if (type === 'distance') return raw * 1000       // user enters km → store meters
  if (type === 'duration') return raw * 60         // user enters min → store seconds
  return raw
}

function storedToDisplayValue(type: GoalMetric, stored: number): number {
  if (type === 'distance') return stored / 1000
  if (type === 'duration') return stored / 60
  return stored
}

const UNIT_LABELS: Record<GoalMetric, string> = {
  distance: 'km',
  duration: 'minutes',
  elevation: 'meters',
  activities: 'activities',
}

const ACTIVITY_TYPES: Array<{ value: ActivityType | 'all'; label: string }> = [
  { value: 'all', label: '🏅 All types' },
  { value: 'run', label: '🏃 Run' },
  { value: 'ride', label: '🚴 Ride' },
  { value: 'swim', label: '🏊 Swim' },
  { value: 'walk', label: '🚶 Walk' },
  { value: 'hike', label: '🥾 Hike' },
  { value: 'workout', label: '💪 Workout' },
]

// ─── Ring component ────────────────────────────────────────────────────────
function ProgressRing({ pct, size = 72, stroke = 7, color = '#f97316' }: {
  pct: number; size?: number; stroke?: number; color?: string
}) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const dash = Math.min(pct / 100, 1) * circ
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={pct >= 100 ? '#22c55e' : color}
        strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
    </svg>
  )
}

// ─── Goal card ─────────────────────────────────────────────────────────────
function GoalCard({ goal, activities, onDelete }: {
  goal: Goal; activities: Activity[]; onDelete: (id: string) => void
}) {
  const current = computeProgress(goal, activities)
  const pct = goal.target_value > 0 ? (current / goal.target_value) * 100 : 0
  const done = pct >= 100

  return (
    <div className={`bg-white border rounded-2xl p-5 shadow-sm transition-all ${done ? 'border-green-200' : 'border-gray-100'}`}>
      <div className="flex items-center gap-4">
        {/* Ring */}
        <div className="relative shrink-0">
          <ProgressRing pct={pct} />
          <div className="absolute inset-0 flex items-center justify-center">
            {done
              ? <CheckCircle2 size={22} className="text-green-500" />
              : <span className="text-xs font-bold text-gray-700">{Math.round(pct)}%</span>
            }
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-xs font-semibold text-orange-500 uppercase tracking-wide">
              {PERIOD_LABELS[goal.period]}
            </span>
            {goal.activity_type !== 'all' && (
              <span className="text-xs text-gray-400">{activityIcon(goal.activity_type as ActivityType)}</span>
            )}
          </div>
          <p className="font-bold text-gray-900 text-sm">
            {METRIC_LABELS[goal.type]}
          </p>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className={`text-lg font-extrabold ${done ? 'text-green-600' : 'text-gray-900'}`}>
              {formatValue(goal.type, current)}
            </span>
            <span className="text-xs text-gray-400">/ {formatValue(goal.type, goal.target_value)}</span>
          </div>
          {/* Progress bar */}
          <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${done ? 'bg-green-500' : 'bg-gradient-to-r from-orange-400 to-red-500'}`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
        </div>

        {/* Delete */}
        <button
          onClick={() => onDelete(goal.id)}
          className="shrink-0 p-1.5 text-gray-300 hover:text-red-400 transition-colors rounded-lg"
          title="Delete goal"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────
export default function GoalsPage() {
  const supabase = createClient()
  const { toast } = useToast()

  const [goals, setGoals] = useState<Goal[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  // form state
  const [formType, setFormType] = useState<GoalMetric>('distance')
  const [formPeriod, setFormPeriod] = useState<GoalPeriod>('weekly')
  const [formActivityType, setFormActivityType] = useState<ActivityType | 'all'>('all')
  const [formTarget, setFormTarget] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }

      const [{ data: goalsData }, { data: actsData }] = await Promise.all([
        supabase.from('goals').select('*').eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: false }),
        supabase.from('activities').select('*').eq('user_id', user.id),
      ])
      setGoals((goalsData as Goal[]) ?? [])
      setActivities((actsData as Activity[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault()
    const raw = parseFloat(formTarget)
    if (!raw || raw <= 0) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('goals')
      .insert({
        user_id: user.id,
        type: formType,
        period: formPeriod,
        activity_type: formActivityType,
        target_value: inputToStoredValue(formType, raw),
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      toast(error.message, 'error')
    } else {
      setGoals((prev) => [data as Goal, ...prev])
      setShowForm(false)
      setFormTarget('')
      toast('Goal created!', 'success')
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    await supabase.from('goals').update({ is_active: false }).eq('id', id)
    setGoals((prev) => prev.filter((g) => g.id !== id))
    toast('Goal removed', 'info')
  }

  // Group goals by period
  const grouped = useMemo(() => {
    const map: Partial<Record<GoalPeriod, Goal[]>> = {}
    for (const g of goals) {
      if (!map[g.period]) map[g.period] = []
      map[g.period]!.push(g)
    }
    return map
  }, [goals])

  const completedCount = goals.filter((g) => {
    const pct = computeProgress(g, activities) / g.target_value * 100
    return pct >= 100
  }).length

  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-4 animate-pulse">
      <div className="h-8 bg-gray-100 rounded w-1/3" />
      {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl" />)}
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            <Target size={22} className="text-orange-500" />
            Goals
          </h1>
          {goals.length > 0 && (
            <p className="text-sm text-gray-400 mt-0.5">
              {completedCount}/{goals.length} completed
            </p>
          )}
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-1.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md shadow-orange-200 transition-all"
        >
          <Plus size={15} />
          New Goal
        </button>
      </div>

      {/* New goal form */}
      {showForm && (
        <div className="bg-white border border-orange-100 rounded-2xl p-5 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-4">Set a New Goal</h2>
          <form onSubmit={handleAddGoal} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Metric</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as GoalMetric)}
                  className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  {(Object.keys(METRIC_LABELS) as GoalMetric[]).map((k) => (
                    <option key={k} value={k}>{METRIC_LABELS[k]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Period</label>
                <select
                  value={formPeriod}
                  onChange={(e) => setFormPeriod(e.target.value as GoalPeriod)}
                  className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Activity Type</label>
                <select
                  value={formActivityType}
                  onChange={(e) => setFormActivityType(e.target.value as ActivityType | 'all')}
                  className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  {ACTIVITY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                  Target ({UNIT_LABELS[formType]})
                </label>
                <input
                  type="number"
                  value={formTarget}
                  onChange={(e) => setFormTarget(e.target.value)}
                  min="0.1"
                  step="any"
                  placeholder={formType === 'distance' ? '50' : formType === 'duration' ? '300' : formType === 'elevation' ? '1000' : '5'}
                  required
                  className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white transition-colors flex items-center justify-center gap-1.5"
              >
                {saving && <Loader2 size={13} className="animate-spin" />}
                Create Goal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Goal list, grouped by period */}
      {goals.length === 0 && !showForm ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-4">🎯</div>
          <p className="text-lg font-medium">No goals yet</p>
          <p className="text-sm mt-1 mb-6">Set a weekly distance target, a monthly activity count — anything that motivates you.</p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            Set your first goal
          </button>
        </div>
      ) : (
        (['weekly', 'monthly', 'yearly'] as GoalPeriod[]).map((period) => {
          const list = grouped[period]
          if (!list || list.length === 0) return null
          return (
            <div key={period}>
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                {period.charAt(0).toUpperCase() + period.slice(1)} Goals
              </h2>
              <div className="space-y-3">
                {list.map((goal) => (
                  <GoalCard key={goal.id} goal={goal} activities={activities} onDelete={handleDelete} />
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
