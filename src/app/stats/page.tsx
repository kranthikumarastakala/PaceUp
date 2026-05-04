'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Activity } from '@/lib/types'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend
} from 'recharts'
import { formatDistance, formatDuration, activityIcon } from '@/lib/utils'
import { format, startOfWeek, addDays } from 'date-fns'

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
    </div>
  )
}


