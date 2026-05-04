'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ToastProvider'
import { formatDistance, activityIcon, timeAgo } from '@/lib/utils'
import { ArrowLeft, Trash2, ClipboardList } from 'lucide-react'
import Link from 'next/link'
import type { TrainingPlan, TrainingPlanDay } from '@/lib/types'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_ICONS: Record<string, string> = {
  run: '🏃', ride: '🚴', swim: '🏊', walk: '🚶', hike: '🥾', workout: '💪', rest: '😴',
}

export default function TrainingPlanDetailPage() {
  const params = useParams()
  const planId = params.id as string
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  const [plan, setPlan] = useState<TrainingPlan | null>(null)
  const [days, setDays] = useState<TrainingPlanDay[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [activeWeek, setActiveWeek] = useState(1)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUserId(user?.id ?? null)

      const [{ data: p }, { data: d }] = await Promise.all([
        supabase.from('training_plans').select('*, profiles(id,username,full_name,avatar_url)').eq('id', planId).single(),
        supabase.from('training_plan_days').select('*').eq('plan_id', planId).order('week').order('day_of_week'),
      ])

      setPlan(p as TrainingPlan)
      setDays((d as TrainingPlanDay[]) ?? [])
      setLoading(false)
    }
    load()
  }, [planId])

  const handleDelete = async () => {
    if (!confirm('Delete this training plan?')) return
    await supabase.from('training_plans').delete().eq('id', planId)
    toast('Plan deleted', 'info')
    router.push('/training')
  }

  if (loading) return (
    <div className="max-w-3xl mx-auto px-4 py-8 animate-pulse space-y-4">
      <div className="h-24 bg-white rounded-2xl" />
      <div className="h-48 bg-white rounded-2xl" />
    </div>
  )

  if (!plan) return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center text-gray-400">
      <ClipboardList size={48} className="mx-auto mb-3 text-gray-200" />
      <p className="text-lg font-medium">Plan not found</p>
      <Link href="/training" className="text-sm text-orange-500 hover:underline mt-2 inline-block">← Back to Plans</Link>
    </div>
  )

  const isOwner = userId === plan.user_id
  const weekDays = days.filter((d) => d.week === activeWeek)

  // Compute weekly volume
  const weeklyDist = weekDays.reduce((s, d) => s + (d.target_distance ?? 0), 0)
  const workoutCount = weekDays.filter((d) => d.activity_type !== 'rest').length

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/training" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{activityIcon(plan.activity_type === 'all' ? 'run' : plan.activity_type as never)}</span>
            <h1 className="text-2xl font-extrabold text-gray-900 truncate">{plan.title}</h1>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-sm text-gray-400">
            <span>{plan.duration_weeks} week{plan.duration_weeks > 1 ? 's' : ''}</span>
            <span>·</span>
            <span className="capitalize">{plan.activity_type}</span>
            <span>·</span>
            <span>by <Link href={`/profile/${plan.profiles?.username}`} className="text-orange-500 hover:underline">@{plan.profiles?.username}</Link></span>
            <span>·</span>
            <span>{timeAgo(plan.created_at)}</span>
          </div>
        </div>
        {isOwner && (
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-colors text-sm"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {plan.description && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <p className="text-gray-700 text-sm leading-relaxed">{plan.description}</p>
        </div>
      )}

      {/* Week selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-gray-600 mr-1">Week:</span>
        {Array.from({ length: plan.duration_weeks }, (_, i) => i + 1).map((w) => {
          const wDays = days.filter((d) => d.week === w)
          const hasWorkout = wDays.some((d) => d.activity_type !== 'rest')
          return (
            <button
              key={w}
              onClick={() => setActiveWeek(w)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeWeek === w ? 'bg-orange-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-orange-300'
              }`}
            >
              W{w}
              {hasWorkout && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />}
            </button>
          )
        })}
      </div>

      {/* Weekly stats */}
      {(weeklyDist > 0 || workoutCount > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {weeklyDist > 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center">
              <p className="text-xs text-gray-400 mb-1">Week {activeWeek} Distance</p>
              <p className="text-xl font-bold text-gray-900">{formatDistance(weeklyDist)}</p>
            </div>
          )}
          <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center">
            <p className="text-xs text-gray-400 mb-1">Workouts</p>
            <p className="text-xl font-bold text-gray-900">{workoutCount} day{workoutCount !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}

      {/* Day grid */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Week {activeWeek} Schedule</h3>
        <div className="grid grid-cols-7 gap-2">
          {DAYS.map((dayLabel, dayIdx) => {
            const d = weekDays.find((x) => x.day_of_week === dayIdx)
            return (
              <div
                key={dayIdx}
                className={`rounded-xl p-2 min-h-[80px] flex flex-col items-center gap-1 text-center ${
                  d && d.activity_type !== 'rest'
                    ? 'bg-orange-50 border border-orange-100'
                    : d?.activity_type === 'rest'
                    ? 'bg-green-50 border border-green-100'
                    : 'bg-gray-50 border border-gray-100'
                }`}
              >
                <p className="text-xs font-medium text-gray-500">{dayLabel}</p>
                {d ? (
                  <>
                    <span className="text-xl">{DAY_ICONS[d.activity_type] ?? '📅'}</span>
                    <p className="text-xs font-medium text-gray-700 capitalize">{d.activity_type}</p>
                    {d.target_distance != null && d.activity_type !== 'rest' && (
                      <p className="text-xs text-orange-600 font-semibold">{formatDistance(d.target_distance)}</p>
                    )}
                    {d.notes && <p className="text-xs text-gray-400 line-clamp-2 leading-tight">{d.notes}</p>}
                  </>
                ) : (
                  <span className="text-gray-200 text-xl mt-2">—</span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
