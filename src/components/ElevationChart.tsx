'use client'

import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'
import type { GpxPoint } from '@/lib/types'

interface Props {
  points: GpxPoint[]
}

export function ElevationChart({ points }: Props) {
  // Sample every Nth point for performance
  const step = Math.max(1, Math.floor(points.length / 200))
  let cumDist = 0
  const data = points
    .filter((_, i) => i % step === 0)
    .map((p, i, arr) => {
      if (i > 0) {
        const prev = arr[i - 1]
        const dLat = p.lat - prev.lat
        const dLng = p.lng - prev.lng
        cumDist += Math.sqrt(dLat * dLat + dLng * dLng) * 111320
      }
      return { dist: parseFloat((cumDist / 1000).toFixed(2)), ele: Math.round(p.ele) }
    })

  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="dist" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => `${v}km`} />
        <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => `${v}m`} />
        <Tooltip
          contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
          labelStyle={{ color: '#1e293b', fontWeight: 600 }}
          labelFormatter={(v) => `${v} km`}
          formatter={(v) => [`${v} m`, 'Elevation']}
        />
        <Area type="monotone" dataKey="ele" stroke="#f97316" strokeWidth={2} fill="url(#elevGrad)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}


