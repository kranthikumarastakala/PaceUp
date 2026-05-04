'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Activity } from '@/lib/types'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { formatDistance, formatDuration, formatPace, formatSpeed, activityIcon } from '@/lib/utils'
import { format, startOfWeek, addDays, subWeeks, getMonth } from 'date-fns'
import { Trophy } from 'lucide-react'

// ── Activity Year Heatmap ─────────────────────────────────────────────────
function ActivityHeatmap({ activities }: { activities: Activity[] }) {
  const countByDay: Record<string, number> = {}
  activities.forEach((a) => {
    const day = format(new Date(a.created_at), 'yyyy-MM-dd')
    countByDay[day] = (countByDay[day] ?? 0) + 1
  })

  const today = new Date()
  const startDate = startOfWeek(subWeeks(today, 51), { weekStartsOn: 1 })
  const cells: { date: Date; count: number }[] = []
  for (let i = 0; i < 52 * 7; i++) {
    const date = addDays(startDate, i)
    cells.push({ date, count: countByDay[format(date, 'yyyy-MM-dd')] ?? 0 })
  }
  const weeks: { date: Date; count: number }[][] = []
  for (let i = 0; i < 52; i++) weeks.push(cells.slice(i * 7, i * 7 + 7))

  // Month labels — find the first week each month starts
  const monthLabels: { label: string; col: number }[] = []
  weeks.forEach((week, wi) => {
    const first = week[0]
    if (first && getMonth(first.date) !== getMonth(addDays(first.date, -7))) {
      monthLabels.push({ label: format(first.date, 'MMM'), col: wi })
    }
  })

  const cellColor = (count: number) => {
    if (count === 0) return 'bg-gray-100'
    if (count === 1) return 'bg-orange-200'
    if (count <= 3) return 'bg-orange-400'
    return 'bg-orange-600'
  }

  const totalYear = activities.filter(
    (a) => new Date(a.created_at) >= startDate
  ).length

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-gray-900">Activity Map</h2>
        <span className="text-xs text-gray-400">{totalYear} activities in the last year</span>
      </div>
      <div className="overflow-x-auto pb-1">
        <div className="inline-block min-w-full">
          {/* Month labels */}
          <div className="flex gap-1 mb-1 pl-0">
            {weeks.map((_, wi) => {
              const lbl = monthLabels.find((m) => m.col === wi)
              return (
                <div key={wi} className="w-3 shrink-0 text-center">
                  {lbl && <span className="text-[9px] text-gray-400 leading-none">{lbl.label}</span>}
                </div>
              )
            })}
          </div>
          {/* Grid */}
          <div className="flex gap-1">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.map(({ date, count }, di) => (
                  <div
                    key={di}
                    title={`${format(date, 'MMM d, yyyy')}: ${count} ${count === 1 ? 'activity' : 'activities'}`}
                    className={`w-3 h-3 rounded-sm cursor-default transition-opacity hover:opacity-70 ${cellColor(count)}`}
                  />
                ))}
              </div>
            ))}
          </div>
          {/* Legend */}
          <div className="flex items-center gap-1.5 mt-2 justify-end">
            <span className="text-[10px] text-gray-400">Less</span>
            {['bg-gray-100', 'bg-orange-200', 'bg-orange-400', 'bg-orange-600'].map((c) => (
              <div key={c} className={`w-3 h-3 rounded-sm ${c}`} />
            ))}
            <span className="text-[10px] text-gray-400">More</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function StatsPage() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      const { data } = await supabase
        .from('activities')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
      setActivities((data as Activity[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  // Weekly distance data (last 8 weeks)
  const weeklyData = (() => {
    const weeks: Record<string, number> = {}
    for (let i = 7; i >= 0; i--) {
      const w = startOfWeek(addDays(new Date(), -i * 7))
      weeks[format(w, 'MMM d')] = 0
    }
    activities.forEach((a) => {
      const w = format(startOfWeek(new Date(a.created_at)), 'MMM d')
      if (w in weeks) weeks[w] = (weeks[w] ?? 0) + (a.distance ?? 0) / 1000
    })
    return Object.entries(weeks).map(([week, km]) => ({ week, km: parseFloat(km.toFixed(2)) }))
  })()

  // Activity type breakdown
  const typeBreakdown = activities.reduce((acc, a) => {
    acc[a.type] = (acc[a.type] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)
  const typeData = Object.entries(typeBreakdown).map(([type, count]) => ({
    type: `${activityIcon(type as any)} ${type}`,
    count,
  }))

  const totalDist = activities.reduce((s, a) => s + (a.distance ?? 0), 0)
  const totalTime = activities.reduce((s, a) => s + (a.duration ?? 0), 0)
  const totalElev = activities.reduce((s, a) => s + (a.elevation_gain ?? 0), 0)
  const totalCals = activities.reduce((s, a) => s + (a.calories ?? 0), 0)

  // ── Personal Records ──────────────────────────────────────────────────────
  const RUN_MILESTONES = [
    { label: '1 Mile',          distance: 1609  },
    { label: '5K',              distance: 5000  },
    { label: '10K',             distance: 10000 },
    { label: 'Half Marathon',   distance: 21097 },
    { label: 'Marathon',        distance: 42195 },
  ]
  const RIDE_MILESTONES = [
    { label: '20K',  distance: 20000  },
    { label: '40K',  distance: 40000  },
    { label: '100K', distance: 100000 },
  ]

  const personalRecords = useMemo(() => {
    const runs  = activities.filter((a) => a.type === 'run'  && a.distance > 0 && a.avg_pace  > 0)
    const rides = activities.filter((a) => a.type === 'ride' && a.distance > 0 && a.avg_speed > 0)

    const runPRs = RUN_MILESTONES.map(({ label, distance }) => {
      const eligible = runs.filter((a) => a.distance >= distance)
      if (!eligible.length) return null
      const best = eligible.reduce((a, b) => (a.avg_pace < b.avg_pace ? a : b))
      return { label, value: formatPace(best.avg_pace), sub: 'avg pace', id: best.id, date: best.created_at }
    }).filter(Boolean) as { label: string; value: string; sub: string; id: string; date: string }[]

    const ridePRs = RIDE_MILESTONES.map(({ label, distance }) => {
      const eligible = rides.filter((a) => a.distance >= distance)
      if (!eligible.length) return null
      const best = eligible.reduce((a, b) => (a.avg_speed > b.avg_speed ? a : b))
      return { label, value: formatSpeed(best.avg_speed), sub: 'avg speed', id: best.id, date: best.created_at }
    }).filter(Boolean) as { label: string; value: string; sub: string; id: string; date: string }[]

    return { runPRs, ridePRs }
  }, [activities])

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-8">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
      {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-white rounded-xl animate-pulse" />)}
    </div>
  </div>

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <h1 className="text-2xl font-bold">My Stats</h1>

      {/* All-time summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Distance', value: formatDistance(totalDist), emoji: '📍' },
          { label: 'Total Time', value: formatDuration(totalTime), emoji: '⏱' },
          { label: 'Elevation Gained', value: `${Math.round(totalElev)} m`, emoji: '⛰️' },
          { label: 'Calories Burned', value: `${totalCals.toLocaleString()} kcal`, emoji: '🔥' },
        ].map(({ label, value, emoji }) => (
          <div key={label} className="bg-white border border-gray-100 rounded-2xl p-5">
            <div className="text-2xl mb-1">{emoji}</div>
            <div className="text-xl font-bold text-orange-400">{value}</div>
            <div className="text-xs text-gray-400 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Weekly distance chart */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <h2 className="font-bold text-gray-900 mb-4">Weekly Distance (km)</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={weeklyData} margin={{ left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="week" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => `${v}`} />
            <Tooltip
              contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              labelStyle={{ color: '#1e293b', fontWeight: 600 }}
              formatter={(v) => [`${v} km`, 'Distance']}
            />
            <Bar dataKey="km" fill="url(#orangeGrad)" radius={[6, 6, 0, 0]} />
            <defs>
              <linearGradient id="orangeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f97316" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
            </defs>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Activity year heatmap */}
      {activities.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <ActivityHeatmap activities={activities} />
        </div>
      )}

      {/* Activity type distribution */}
      {typeData.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-4">Activity Types</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={typeData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis dataKey="type" type="category" tick={{ fill: '#64748b', fontSize: 12 }} width={100} />
              <Tooltip
                contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                labelStyle={{ color: '#1e293b', fontWeight: 600 }}
                formatter={(v) => [v, 'Activities']}
              />
              <Bar dataKey="count" fill="#6366f1" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {activities.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-3">📊</div>
          <p>Log some activities to see your stats!</p>
        </div>
      )}

      {/* ── Personal Records ─────────────────────────────────────────────── */}
      {(personalRecords.runPRs.length > 0 || personalRecords.ridePRs.length > 0) && (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-5 flex items-center gap-2">
            <Trophy size={18} className="text-orange-500" />
            Personal Records
          </h2>

          {personalRecords.runPRs.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-1.5">
                🏃 Running
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {personalRecords.runPRs.map((pr) => (
                  <Link
                    key={pr.id}
                    href={`/activities/${pr.id}`}
                    className="group bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 rounded-xl p-4 hover:border-orange-300 hover:shadow-sm transition-all"
                  >
                    <div className="text-xs font-semibold text-orange-500 mb-1">{pr.label}</div>
                    <div className="text-lg font-extrabold text-gray-900 group-hover:text-orange-600 transition-colors">
                      {pr.value}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{pr.sub}</div>
                    <div className="text-xs text-gray-300 mt-1">{new Date(pr.date).toLocaleDateString()}</div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {personalRecords.ridePRs.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-1.5">
                🚴 Cycling
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {personalRecords.ridePRs.map((pr) => (
                  <Link
                    key={pr.id}
                    href={`/activities/${pr.id}`}
                    className="group bg-gradient-to-br from-blue-50 to-sky-50 border border-blue-100 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all"
                  >
                    <div className="text-xs font-semibold text-blue-500 mb-1">{pr.label}</div>
                    <div className="text-lg font-extrabold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {pr.value}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{pr.sub}</div>
                    <div className="text-xs text-gray-300 mt-1">{new Date(pr.date).toLocaleDateString()}</div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}


