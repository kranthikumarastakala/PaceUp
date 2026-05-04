'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Activity } from '@/lib/types'
import { formatDuration } from '@/lib/utils'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, LineChart, Line, ReferenceLine
} from 'recharts'
import { TrendingUp, Zap, Activity as ActivityIcon, Target } from 'lucide-react'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'

interface MonthBucket { label: string; distance: number; duration: number; activities: number }
interface ZoneBucket { zone: string; minutes: number; pct: number; color: string }
interface WeeklyLoad { week: string; load: number }

export default function AnalyticsPage() {
  const supabase = createClient()
  const router = useRouter()

  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [unit, setUnit] = useState<'metric' | 'imperial'>('metric')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [{ data: prof }, { data: acts }] = await Promise.all([
        supabase.from('profiles').select('unit_system').eq('id', user.id).single(),
        supabase.from('activities')
          .select('*')
          .eq('user_id', user.id)
          .gte('created_at', subMonths(new Date(), 12).toISOString())
          .order('created_at', { ascending: true })
      ])

      if (prof?.unit_system) setUnit(prof.unit_system as 'metric' | 'imperial')
      setActivities((acts as Activity[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  // ── Monthly volume buckets (12 months) ──
  const monthlyData: MonthBucket[] = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), 11 - i)
    const start = startOfMonth(date).toISOString()
    const end = endOfMonth(date).toISOString()
    const bucket = activities.filter(a => a.created_at >= start && a.created_at <= end)
    const distKm = bucket.reduce((s, a) => s + (a.distance ?? 0), 0) / 1000
    return {
      label: format(date, 'MMM'),
      distance: unit === 'imperial' ? +(distKm * 0.621371).toFixed(1) : +distKm.toFixed(1),
      duration: Math.round(bucket.reduce((s, a) => s + (a.duration ?? 0), 0) / 60),
      activities: bucket.length,
    }
  })

  const distUnit = unit === 'imperial' ? 'mi' : 'km'

  // ── Training load: 7-day rolling effort (duration in mins × intensity proxy) ──
  const weeklyLoad: WeeklyLoad[] = Array.from({ length: 12 }, (_, i) => {
    const weekEnd = new Date()
    weekEnd.setDate(weekEnd.getDate() - i * 7)
    const weekStart = new Date(weekEnd)
    weekStart.setDate(weekEnd.getDate() - 7)
    const bucket = activities.filter(a => {
      const d = new Date(a.created_at)
      return d >= weekStart && d < weekEnd
    })
    const load = bucket.reduce((s, a) => {
      const mins = (a.duration ?? 0) / 60
      // intensity proxy: run=1.2, ride=0.9, swim=1.5, others=1
      const intensity: Record<string, number> = { run: 1.2, ride: 0.9, swim: 1.5, walk: 0.7, hike: 0.8, workout: 1.1 }
      return s + mins * (intensity[a.type] ?? 1)
    }, 0)
    return { week: format(weekEnd, 'MMM d'), load: Math.round(load) }
  }).reverse()

  // ── Pace zones for runs (last 90 days) ──
  const runs = activities.filter(a => a.type === 'run' && a.avg_pace > 0)
  const paceZones: ZoneBucket[] = (() => {
    const zones = [
      { zone: 'Z1 Easy', max: unit === 'imperial' ? 9.0 : 7.5, color: '#86efac' },
      { zone: 'Z2 Aerobic', max: unit === 'imperial' ? 7.5 : 6.0, color: '#4ade80' },
      { zone: 'Z3 Tempo', max: unit === 'imperial' ? 6.5 : 5.0, color: '#facc15' },
      { zone: 'Z4 Threshold', max: unit === 'imperial' ? 5.5 : 4.0, color: '#fb923c' },
      { zone: 'Z5 VO2 Max', max: 0, color: '#f87171' },
    ]
    const buckets = zones.map(z => ({ ...z, count: 0 }))
    for (const r of runs) {
      const paceMinsPerKm = r.avg_pace / 60   // avg_pace is seconds/km
      const paceDisplay = unit === 'imperial' ? paceMinsPerKm * 1.60934 : paceMinsPerKm
      for (let i = 0; i < buckets.length; i++) {
        if (paceDisplay >= buckets[i].max || i === buckets.length - 1) {
          buckets[i].count++
          break
        }
      }
    }
    const total = runs.length || 1
    return buckets.map(b => ({
      zone: b.zone,
      minutes: b.count,
      pct: Math.round((b.count / total) * 100),
      color: b.color,
    }))
  })()

  // ── Weekly consistency: % of weeks with ≥2 activities (last 12 weeks) ──
  const weeksWithActivity = weeklyLoad.filter(w => w.load > 0).length
  const consistencyPct = Math.round((weeksWithActivity / 12) * 100)

  // ── KPI tiles ──
  const totalDist = activities.reduce((s, a) => s + (a.distance ?? 0), 0) / 1000
  const totalDistDisplay = unit === 'imperial' ? (totalDist * 0.621371).toFixed(0) : totalDist.toFixed(0)
  const totalDuration = activities.reduce((s, a) => s + (a.duration ?? 0), 0)
  const avgWeekly = activities.length > 0 ? (totalDist / 12).toFixed(1) : '0'

  if (loading) return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-4 animate-pulse">
      <div className="h-8 rounded w-1/3" style={{ background: 'var(--surface-border)' }} />
      {[1, 2, 3].map(i => <div key={i} className="h-48 rounded-2xl" style={{ background: 'var(--surface-border)' }} />)}
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <TrendingUp size={22} className="text-orange-500" />
        <h1 className="text-2xl font-extrabold">Activity Analytics</h1>
        <span className="ml-auto text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-600 font-medium">
          Last 12 months
        </span>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: `Total Distance`, value: `${totalDistDisplay} ${distUnit}`, icon: <ActivityIcon size={18} className="text-orange-500" /> },
          { label: 'Total Time', value: formatDuration(totalDuration), icon: <Zap size={18} className="text-blue-500" /> },
          { label: 'Avg Weekly', value: `${avgWeekly} ${distUnit}`, icon: <TrendingUp size={18} className="text-green-500" /> },
          { label: 'Consistency', value: `${consistencyPct}%`, icon: <Target size={18} className="text-purple-500" /> },
        ].map(({ label, value, icon }) => (
          <div key={label} className="rounded-2xl p-4 shadow-sm border" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
            <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span></div>
            <div className="text-xl font-extrabold">{value}</div>
          </div>
        ))}
      </div>

      {/* Monthly volume */}
      <div className="rounded-2xl p-6 shadow-sm border" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        <h2 className="font-bold mb-4">Monthly Volume ({distUnit})</h2>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={monthlyData}>
            <defs>
              <linearGradient id="distGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
            <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
            <Tooltip
              contentStyle={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', borderRadius: 8 }}
              labelStyle={{ color: 'var(--text-primary)' }}
            />
            <Area type="monotone" dataKey="distance" stroke="#f97316" strokeWidth={2} fill="url(#distGrad)" name={`Distance (${distUnit})`} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Weekly Training Load */}
      <div className="rounded-2xl p-6 shadow-sm border" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        <h2 className="font-bold mb-1">Weekly Training Load</h2>
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Duration × intensity factor (arbitrary units)</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={weeklyLoad}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" />
            <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
            <Tooltip
              contentStyle={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', borderRadius: 8 }}
              labelStyle={{ color: 'var(--text-primary)' }}
            />
            <ReferenceLine
              y={weeklyLoad.reduce((s, w) => s + w.load, 0) / (weeklyLoad.length || 1)}
              stroke="#f97316" strokeDasharray="4 4" label={{ value: 'avg', fill: '#f97316', fontSize: 11 }}
            />
            <Bar dataKey="load" fill="#fb923c" radius={[4, 4, 0, 0]} name="Training Load" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Pace zones */}
      {runs.length > 0 && (
        <div className="rounded-2xl p-6 shadow-sm border" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
          <h2 className="font-bold mb-1">Pace Zones (Runs)</h2>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Distribution of {runs.length} runs by effort level</p>
          <div className="space-y-3">
            {paceZones.map(z => (
              <div key={z.zone} className="flex items-center gap-3">
                <span className="w-28 text-xs font-medium shrink-0">{z.zone}</span>
                <div className="flex-1 rounded-full overflow-hidden h-4" style={{ background: 'var(--surface-border)' }}>
                  <div
                    className="h-4 rounded-full transition-all duration-700"
                    style={{ width: `${z.pct}%`, background: z.color }}
                  />
                </div>
                <span className="text-xs font-semibold w-10 text-right" style={{ color: 'var(--text-secondary)' }}>{z.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity type breakdown */}
      <div className="rounded-2xl p-6 shadow-sm border" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        <h2 className="font-bold mb-4">Activity Breakdown</h2>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', borderRadius: 8 }}
              labelStyle={{ color: 'var(--text-primary)' }}
            />
            <Bar dataKey="activities" fill="#6366f1" radius={[4, 4, 0, 0]} name="Activities" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Trend chart: weekly line */}
      <div className="rounded-2xl p-6 shadow-sm border" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        <h2 className="font-bold mb-4">Trend: Weekly Sessions</h2>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={weeklyLoad}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" />
            <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
            <Tooltip
              contentStyle={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', borderRadius: 8 }}
              labelStyle={{ color: 'var(--text-primary)' }}
            />
            <Line type="monotone" dataKey="load" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3, fill: '#8b5cf6' }} name="Load" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
