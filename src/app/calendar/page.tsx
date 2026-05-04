'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Activity, TrainingPlan, TrainingPlanDay } from '@/lib/types'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, subMonths, addMonths } from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { activityColor, activityIcon } from '@/lib/utils'
import Link from 'next/link'

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

export default function CalendarPage() {
  const supabase = createClient()
  const router = useRouter()

  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [activities, setActivities] = useState<Activity[]>([])
  const [activePlan, setActivePlan] = useState<(TrainingPlan & { days: TrainingPlanDay[] }) | null>(null)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const start = startOfMonth(currentMonth).toISOString()
      const end = endOfMonth(currentMonth).toISOString()

      const [{ data: acts }, { data: plans }] = await Promise.all([
        supabase.from('activities')
          .select('id, title, type, distance, duration, created_at')
          .eq('user_id', user.id)
          .gte('created_at', start)
          .lte('created_at', end)
          .order('created_at'),
        supabase.from('training_plans')
          .select('*, days:training_plan_days(*)')
          .eq('user_id', user.id)
          .limit(1)
          .single()
      ])

      setActivities((acts as Activity[]) ?? [])
      if (plans) setActivePlan(plans as TrainingPlan & { days: TrainingPlanDay[] })
      setLoading(false)
    }
    load()
  }, [currentMonth])

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })
  const firstDow = (getDay(startOfMonth(currentMonth)) + 6) % 7  // Monday-first

  const getActivitiesForDay = (day: Date) =>
    activities.filter(a => isSameDay(new Date(a.created_at), day))

  // Training plan: figure out week 1 = first day of plan (approximated as 12 weeks from now back)
  const planStartDate = activePlan
    ? subMonths(new Date(), Math.floor((activePlan.duration_weeks ?? 4) / 2))
    : null

  const getPlanWorkoutsForDay = (day: Date) => {
    if (!activePlan || !planStartDate) return []
    const diffMs = day.getTime() - planStartDate.getTime()
    const diffDays = Math.floor(diffMs / 86_400_000)
    if (diffDays < 0) return []
    const week = Math.floor(diffDays / 7) + 1
    const dow = (getDay(day) + 6) % 7  // 0=Mon
    return (activePlan.days ?? []).filter(d => d.week === week && d.day_of_week === dow)
  }

  const selectedActivities = selectedDay ? getActivitiesForDay(selectedDay) : []
  const selectedPlan = selectedDay ? getPlanWorkoutsForDay(selectedDay) : []

  if (loading) return (
    <div className="max-w-3xl mx-auto px-4 py-8 animate-pulse">
      <div className="h-8 rounded w-1/3 mb-6" style={{ background: 'var(--surface-border)' }} />
      <div className="h-96 rounded-2xl" style={{ background: 'var(--surface-border)' }} />
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <CalendarDays size={22} className="text-orange-500" />
        <h1 className="text-2xl font-extrabold">Training Calendar</h1>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-2 rounded-xl hover:bg-orange-50 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-lg font-bold">{format(currentMonth, 'MMMM yyyy')}</h2>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-2 rounded-xl hover:bg-orange-50 transition-colors"
          disabled={addMonths(currentMonth, 1) > addMonths(new Date(), 1)}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="rounded-2xl overflow-hidden shadow-sm border" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        {/* Weekday header */}
        <div className="grid grid-cols-7 text-center text-xs font-semibold py-2 border-b" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-muted)' }}>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {/* Leading empty cells */}
          {Array.from({ length: firstDow }, (_, i) => (
            <div key={`pad-${i}`} className="h-20 border-b border-r" style={{ borderColor: 'var(--surface-border)', background: 'var(--bg)' }} />
          ))}

          {days.map((day) => {
            const dayActs = getActivitiesForDay(day)
            const planWks = getPlanWorkoutsForDay(day)
            const isToday = isSameDay(day, new Date())
            const isSelected = selectedDay && isSameDay(day, selectedDay)
            const dow = (getDay(day) + 6) % 7
            const isWeekend = dow === 5 || dow === 6

            return (
              <div
                key={day.toISOString()}
                onClick={() => setSelectedDay(isSelected ? null : day)}
                className={`h-20 p-1.5 border-b border-r cursor-pointer transition-colors ${
                  isSelected ? 'ring-2 ring-inset ring-orange-400' : ''
                } ${isWeekend ? '' : ''}`}
                style={{
                  borderColor: 'var(--surface-border)',
                  background: isSelected ? 'rgba(249,115,22,0.07)' : isWeekend ? 'var(--bg)' : 'var(--surface)',
                }}
              >
                <div className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full mb-1 ${
                  isToday ? 'bg-orange-500 text-white' : ''
                }`}>
                  {format(day, 'd')}
                </div>
                {/* Activity dots */}
                <div className="flex flex-wrap gap-0.5">
                  {dayActs.slice(0, 3).map(a => (
                    <span
                      key={a.id}
                      className="w-3 h-3 rounded-full text-white text-[8px] flex items-center justify-center"
                      style={{ background: activityColor(a.type) }}
                      title={a.title}
                    >
                      {activityIcon(a.type)}
                    </span>
                  ))}
                  {dayActs.length > 3 && (
                    <span className="text-[9px] text-orange-500 font-bold">+{dayActs.length - 3}</span>
                  )}
                </div>
                {/* Plan overlay */}
                {planWks.length > 0 && dayActs.length === 0 && (
                  <div className="flex gap-0.5 mt-0.5">
                    {planWks.map(w => (
                      <span
                        key={w.id}
                        className="w-2 h-2 rounded-sm opacity-50 border"
                        style={{ borderColor: w.activity_type === 'rest' ? '#94a3b8' : activityColor(w.activity_type as never), background: w.activity_type === 'rest' ? '#e2e8f0' : activityColor(w.activity_type as never) }}
                        title={`Plan: ${w.activity_type}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-orange-500" />
          Completed activity
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm border-2 border-blue-400 opacity-50" />
          Planned workout
        </div>
      </div>

      {/* Selected day detail */}
      {selectedDay && (
        <div className="rounded-2xl p-5 border shadow-sm" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
          <h3 className="font-bold mb-3">{format(selectedDay, 'EEEE, MMMM d')}</h3>

          {selectedActivities.length === 0 && selectedPlan.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No activities or planned workouts for this day.</p>
          )}

          {selectedPlan.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Training Plan</p>
              {selectedPlan.map(p => (
                <div key={p.id} className="flex items-center gap-3 py-2 border-b last:border-0" style={{ borderColor: 'var(--surface-border)' }}>
                  <span className="text-lg">{activityIcon(p.activity_type as never)}</span>
                  <div>
                    <p className="text-sm font-medium capitalize">{p.activity_type}</p>
                    {p.notes && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.notes}</p>}
                    {p.target_distance && <p className="text-xs text-orange-500">{(p.target_distance / 1000).toFixed(1)} km target</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedActivities.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Activities</p>
              {selectedActivities.map(a => (
                <Link
                  key={a.id}
                  href={`/activities/${a.id}`}
                  className="flex items-center gap-3 py-2 border-b last:border-0 hover:text-orange-500 transition-colors"
                  style={{ borderColor: 'var(--surface-border)' }}
                >
                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-sm" style={{ background: activityColor(a.type) + '22' }}>
                    {activityIcon(a.type)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.title}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {((a.distance ?? 0) / 1000).toFixed(1)} km · {Math.round((a.duration ?? 0) / 60)} min
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
