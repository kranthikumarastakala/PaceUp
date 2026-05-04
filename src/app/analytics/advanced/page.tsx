'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Activity, FitnessPoint, HRZone } from '@/lib/types'
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { format, subDays, parseISO, differenceInDays } from 'date-fns'
import { Heart, Zap, TrendingUp, Brain } from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────

function calcTSS(durationSec: number, avgHR: number, restHR = 60, maxHR = 190): number {
  const hrReserve = maxHR - restHR
  const ifactor = (avgHR - restHR) / hrReserve
  return (durationSec / 3600) * ifactor * ifactor * 100
}

function buildFitnessCurve(activities: Activity[]): FitnessPoint[] {
  const days: Record<string, number> = {}
  for (const a of activities) {
    const day = a.created_at.slice(0, 10)
    const tss = a.avg_heart_rate
      ? calcTSS(a.duration ?? 0, a.avg_heart_rate)
      : (a.duration ?? 0) / 36
    days[day] = (days[day] ?? 0) + tss
  }

  const points: FitnessPoint[] = []
  let ctl = 0, atl = 0
  for (let i = 41; i >= 0; i--) {
    const d = format(subDays(new Date(), i), 'yyyy-MM-dd')
    const tss = days[d] ?? 0
    ctl = ctl + (tss - ctl) / 42
    atl = atl + (tss - atl) / 7
    points.push({ date: d, ctl: Math.round(ctl * 10) / 10, atl: Math.round(atl * 10) / 10, tsb: Math.round((ctl - atl) * 10) / 10 })
  }
  return points
}

function buildHRZones(activities: Activity[]): HRZone[] {
  const zones: HRZone[] = [
    { zone: 1, label: 'Recovery',    min_hr: 0,   max_hr: 114, seconds: 0, color: '#93c5fd' },
    { zone: 2, label: 'Aerobic',     min_hr: 114, max_hr: 133, seconds: 0, color: '#6ee7b7' },
    { zone: 3, label: 'Tempo',       min_hr: 133, max_hr: 152, seconds: 0, color: '#fde68a' },
    { zone: 4, label: 'Threshold',   min_hr: 152, max_hr: 171, seconds: 0, color: '#fca5a5' },
    { zone: 5, label: 'VO2 Max',     min_hr: 171, max_hr: 999, seconds: 0, color: '#f87171' },
  ]

  for (const a of activities) {
    if (!a.avg_heart_rate || !a.duration) continue
    const z = zones.find(z => a.avg_heart_rate! >= z.min_hr && a.avg_heart_rate! < z.max_hr)
    if (z) z.seconds += a.duration
  }
  return zones
}

function estimateVO2Max(activities: Activity[]): number | null {
  const runs = activities.filter(a => a.type === 'run' && a.distance && a.duration && a.avg_heart_rate)
  if (!runs.length) return null
  // Simplified Firstbeat formula proxy: VO2max ≈ 15 × (MaxHR / RestHR)
  // Or from pace + HR: (speed_m_per_min / HR) × 209.3  
  const latest = runs.slice(0, 5)
  const estimates = latest.map(a => {
    const speedMpm = ((a.distance ?? 0) / (a.duration ?? 1)) * 60
    return (speedMpm / a.avg_heart_rate!) * 209.3
  })
  return Math.round(estimates.reduce((s, v) => s + v, 0) / estimates.length)
}

// ─── Component ────────────────────────────────────────────────────────────

export default function AdvancedAnalyticsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const cutoff = format(subDays(new Date(), 90), 'yyyy-MM-dd')
      const { data } = await supabase
        .from('activities')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', cutoff)
        .order('created_at', { ascending: true })
      setActivities((data ?? []) as Activity[])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-4 animate-pulse">
      {[...Array(4)].map((_, i) => <div key={i} className="h-32 rounded-2xl" style={{ background: 'var(--surface-border)' }} />)}
    </div>
  )

  const fitnessCurve = buildFitnessCurve(activities)
  const hrZones = buildHRZones(activities)
  const vo2 = estimateVO2Max(activities)
  const latest = fitnessCurve[fitnessCurve.length - 1]
  const tsbStatus = latest.tsb > 5 ? { label: 'Fresh', color: '#22c55e' } :
                    latest.tsb > -10 ? { label: 'Neutral', color: '#f59e0b' } :
                    { label: 'Fatigued', color: '#ef4444' }

  const totalHRSeconds = hrZones.reduce((s, z) => s + z.seconds, 0)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Advanced Analytics</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Last 90 days · Fitness, fatigue &amp; heart rate analysis</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Fitness (CTL)', value: latest.ctl.toFixed(1), icon: TrendingUp, color: '#f97316' },
          { label: 'Fatigue (ATL)', value: latest.atl.toFixed(1), icon: Zap, color: '#ef4444' },
          { label: 'Form (TSB)', value: latest.tsb.toFixed(1), icon: Brain, color: tsbStatus.color, sub: tsbStatus.label },
          { label: 'Est. VO₂ Max', value: vo2 ? `${vo2} ml/kg` : '—', icon: Heart, color: '#ec4899' },
        ].map(({ label, value, icon: Icon, color, sub }) => (
          <div key={label} className="rounded-2xl p-4 border" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: color + '20' }}>
                <Icon size={14} style={{ color }} />
              </div>
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
            </div>
            <p className="text-2xl font-extrabold" style={{ color }}>{value}</p>
            {sub && <p className="text-xs mt-0.5" style={{ color }}>{sub}</p>}
          </div>
        ))}
      </div>

      {/* Fitness / Fatigue / Form chart */}
      <div className="rounded-2xl p-5 border" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        <h2 className="font-bold text-sm mb-4">Fitness · Fatigue · Form (42 days)</h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={fitnessCurve} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" />
            <XAxis dataKey="date" tickFormatter={d => format(parseISO(d), 'MMM d')} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval={6} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
            <Tooltip
              contentStyle={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', borderRadius: 8, fontSize: 12 }}
              labelFormatter={d => format(parseISO(d as string), 'MMM d')}
            />
            <ReferenceLine y={0} stroke="var(--text-muted)" strokeDasharray="4 2" />
            <Line type="monotone" dataKey="ctl" stroke="#f97316" strokeWidth={2} dot={false} name="Fitness" />
            <Line type="monotone" dataKey="atl" stroke="#ef4444" strokeWidth={2} dot={false} name="Fatigue" />
            <Line type="monotone" dataKey="tsb" stroke="#22c55e" strokeWidth={1.5} dot={false} name="Form" strokeDasharray="4 2" />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5 bg-orange-500" />Fitness (CTL)</span>
          <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5 bg-red-500" />Fatigue (ATL)</span>
          <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5 bg-green-500" />Form (TSB)</span>
        </div>
      </div>

      {/* HR Zones */}
      <div className="rounded-2xl p-5 border" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        <h2 className="font-bold text-sm mb-4">Heart Rate Zone Distribution</h2>
        {totalHRSeconds === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>
            No heart rate data yet. Add avg_heart_rate to your activities to see zone breakdown.
          </p>
        ) : (
          <div className="space-y-3">
            {hrZones.map(z => {
              const pct = totalHRSeconds > 0 ? (z.seconds / totalHRSeconds) * 100 : 0
              const hrs = Math.floor(z.seconds / 3600)
              const mins = Math.floor((z.seconds % 3600) / 60)
              return (
                <div key={z.zone} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">Z{z.zone} · {z.label}</span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {hrs > 0 ? `${hrs}h ` : ''}{mins}m · {pct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--bg)' }}>
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: z.color }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* VO2 Max explanation */}
      {vo2 && (
        <div className="rounded-2xl p-5 border" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
          <div className="flex items-center gap-3 mb-3">
            <Heart size={18} className="text-pink-500" />
            <h2 className="font-bold text-sm">Estimated VO₂ Max: <span className="text-pink-500">{vo2} ml/kg/min</span></h2>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Estimated from your pace and heart rate using the Firstbeat proxy method.
            {vo2 >= 55 ? ' Excellent fitness — elite range.' :
             vo2 >= 45 ? ' Very good — above average for your age group.' :
             vo2 >= 35 ? ' Good — average recreational athlete range.' :
             ' Below average — consistent aerobic training will improve this.'}
          </p>
        </div>
      )}
    </div>
  )
}
