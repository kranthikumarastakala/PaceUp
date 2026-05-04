'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Upload, CheckCircle, AlertCircle, FileText, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface GpxPoint { lat: number; lng: number; ele: number; time: string }

function parseGpx(xml: string): { points: GpxPoint[]; distance: number; elevationGain: number; duration: number } {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'application/xml')
  const trkpts = Array.from(doc.querySelectorAll('trkpt'))

  const points: GpxPoint[] = trkpts.map(p => ({
    lat: parseFloat(p.getAttribute('lat') ?? '0'),
    lng: parseFloat(p.getAttribute('lon') ?? '0'),
    ele: parseFloat(p.querySelector('ele')?.textContent ?? '0'),
    time: p.querySelector('time')?.textContent ?? new Date().toISOString(),
  }))

  let distance = 0, elevationGain = 0
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1], curr = points[i]
    // Haversine
    const R = 6371000
    const dLat = (curr.lat - prev.lat) * Math.PI / 180
    const dLon = (curr.lng - prev.lng) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(prev.lat * Math.PI / 180) * Math.cos(curr.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2
    distance += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    if (curr.ele > prev.ele) elevationGain += curr.ele - prev.ele
  }

  let duration = 0
  if (points.length >= 2) {
    const start = new Date(points[0].time).getTime()
    const end = new Date(points[points.length - 1].time).getTime()
    duration = Math.round((end - start) / 1000)
  }

  return { points, distance: Math.round(distance), elevationGain: Math.round(elevationGain), duration }
}

export default function ImportPage() {
  const supabase = createClient()
  const router = useRouter()

  const [files, setFiles] = useState<File[]>([])
  const [status, setStatus] = useState<{ file: string; state: 'pending' | 'importing' | 'done' | 'error'; msg?: string }[]>([])
  const [activityType, setActivityType] = useState('run')
  const [importing, setImporting] = useState(false)

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []).filter(f => f.name.endsWith('.gpx'))
    setFiles(selected)
    setStatus(selected.map(f => ({ file: f.name, state: 'pending' })))
  }

  const handleImport = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setImporting(true)

    for (let i = 0; i < files.length; i++) {
      setStatus(s => s.map((item, idx) => idx === i ? { ...item, state: 'importing' } : item))
      try {
        const xml = await files[i].text()
        const { points, distance, elevationGain, duration } = parseGpx(xml)
        const title = files[i].name.replace('.gpx', '').replace(/[-_]/g, ' ')

        const avgPace = distance > 0 && duration > 0 ? (duration / (distance / 1000)) : 0
        const avgSpeed = duration > 0 ? ((distance / 1000) / (duration / 3600)) : 0

        const { error } = await supabase.from('activities').insert({
          user_id: user.id,
          title,
          type: activityType,
          distance,
          duration,
          elevation_gain: elevationGain,
          avg_pace: avgPace,
          avg_speed: avgSpeed,
          gpx_data: points.length > 0 ? points : null,
          start_latlng: points.length > 0 ? [points[0].lat, points[0].lng] : null,
          is_public: true,
        })

        setStatus(s => s.map((item, idx) =>
          idx === i ? { ...item, state: error ? 'error' : 'done', msg: error?.message } : item
        ))
      } catch (err) {
        setStatus(s => s.map((item, idx) =>
          idx === i ? { ...item, state: 'error', msg: String(err) } : item
        ))
      }
    }
    setImporting(false)
  }

  const allDone = status.length > 0 && status.every(s => s.state === 'done')

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/activities" className="p-2 rounded-xl hover:bg-orange-50 transition-colors"><ArrowLeft size={18} /></Link>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-orange-500">
          <Upload size={16} className="text-white" />
        </div>
        <h1 className="text-xl font-extrabold">Import Activities</h1>
      </div>

      <div className="rounded-2xl border p-6 space-y-5" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        <div>
          <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>Default Activity Type</label>
          <select value={activityType} onChange={e => setActivityType(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none"
            style={{ background: 'var(--bg)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}>
            {['run','ride','swim','walk','hike','workout'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold block mb-2" style={{ color: 'var(--text-secondary)' }}>GPX Files</label>
          <label className="flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed cursor-pointer hover:border-orange-400 transition-colors"
            style={{ borderColor: 'var(--surface-border)' }}>
            <Upload size={28} style={{ color: 'var(--text-muted)' }} />
            <div className="text-center">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Drop GPX files here or click to browse</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Supports .gpx files from Garmin, Apple Watch, etc.</p>
            </div>
            <input type="file" accept=".gpx" multiple onChange={handleFiles} className="hidden" />
          </label>
        </div>

        {files.length > 0 && (
          <div className="space-y-2">
            {status.map((s, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl border" style={{ background: 'var(--bg)', borderColor: 'var(--surface-border)' }}>
                <FileText size={14} style={{ color: 'var(--text-muted)' }} />
                <span className="text-sm flex-1 truncate">{s.file}</span>
                {s.state === 'pending' && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Pending</span>}
                {s.state === 'importing' && <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />}
                {s.state === 'done' && <CheckCircle size={16} className="text-green-500" />}
                {s.state === 'error' && (
                  <div className="flex items-center gap-1 text-red-500">
                    <AlertCircle size={14} />
                    <span className="text-xs">{s.msg ?? 'Error'}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <button onClick={handleImport} disabled={importing || files.length === 0}
          className="w-full py-3 rounded-xl font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 transition-all">
          {importing ? 'Importing...' : `Import ${files.length} File${files.length !== 1 ? 's' : ''}`}
        </button>

        {allDone && (
          <div className="text-center">
            <p className="text-green-600 font-semibold text-sm mb-2">All files imported!</p>
            <Link href="/activities" className="text-sm text-orange-500 hover:underline">View your activities →</Link>
          </div>
        )}
      </div>

      <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        <h3 className="font-bold text-sm mb-3">Supported formats</h3>
        <ul className="text-xs space-y-1" style={{ color: 'var(--text-secondary)' }}>
          <li>✓ GPX — GPS Exchange Format (Garmin, Wahoo, Apple Watch, Google Maps)</li>
          <li className="opacity-50">⏳ FIT — Garmin binary format (coming soon)</li>
          <li className="opacity-50">⏳ TCX — Training Center XML (coming soon)</li>
        </ul>
      </div>
    </div>
  )
}
