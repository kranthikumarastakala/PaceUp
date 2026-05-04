'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ToastProvider'
import { parseGpxFile, formatDistance, formatDuration, formatElevation } from '@/lib/utils'
import { checkAndAwardAchievements } from '@/lib/achievements'
import type { ActivityType } from '@/lib/types'
import { Upload, FileText, CheckCircle, X, ArrowRight } from 'lucide-react'

const ACTIVITY_TYPES: { value: ActivityType; label: string; icon: string }[] = [
  { value: 'run', label: 'Run', icon: '🏃' },
  { value: 'ride', label: 'Ride', icon: '🚴' },
  { value: 'swim', label: 'Swim', icon: '🏊' },
  { value: 'walk', label: 'Walk', icon: '🚶' },
  { value: 'hike', label: 'Hike', icon: '🥾' },
  { value: 'workout', label: 'Workout', icon: '💪' },
]

interface ParsedActivity {
  fileName: string
  title: string
  type: ActivityType
  distance: number
  elevation: number
  duration: number
  startTime: string
  gpxText: string
}

export default function ImportPage() {
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  const [parsed, setParsed] = useState<ParsedActivity[]>([])
  const [saving, setSaving] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const processFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) =>
      f.name.toLowerCase().endsWith('.gpx')
    )
    if (arr.length === 0) {
      toast('Only .gpx files are supported', 'error')
      return
    }
    const readers = arr.map(
      (file) =>
        new Promise<ParsedActivity>((resolve) => {
          const reader = new FileReader()
          reader.onload = (e) => {
            const text = e.target?.result as string
            const { points, distance, elevation, duration, startTime } =
              parseGpxFile(text)
            const baseName = file.name.replace(/\.gpx$/i, '').replace(/[-_]/g, ' ')
            resolve({
              fileName: file.name,
              title: baseName.charAt(0).toUpperCase() + baseName.slice(1),
              type: 'run',
              distance,
              elevation,
              duration,
              startTime,
              gpxText: text,
              // store full parsed points inline for saving
              ...(points.length > 0 ? {} : {}),
              // hacky but we need points too — attach them
            } as ParsedActivity & { _points: typeof points })
            ;(resolve as unknown as (v: ParsedActivity & { _points: typeof points }) => void)({
              fileName: file.name,
              title: baseName.charAt(0).toUpperCase() + baseName.slice(1),
              type: 'run',
              distance,
              elevation,
              duration,
              startTime,
              gpxText: text,
              _points: points,
            } as ParsedActivity & { _points: typeof points })
          }
          reader.readAsText(file)
        })
    )
    Promise.all(readers).then((results) => {
      setParsed((prev) => [...prev, ...results])
    })
  }, [toast])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    processFiles(e.dataTransfer.files)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files)
  }

  const updateField = (
    idx: number,
    field: keyof ParsedActivity,
    value: string | ActivityType
  ) => {
    setParsed((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p))
    )
  }

  const removeItem = (idx: number) => {
    setParsed((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleImport = async () => {
    if (parsed.length === 0) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast('Not logged in', 'error'); setSaving(false); return }

    let imported = 0
    for (const item of parsed) {
      const ext = item as ParsedActivity & { _points: import('@/lib/types').GpxPoint[] }
      const points = ext._points ?? []
      const startLatlng: [number, number] | null =
        points.length > 0 ? [points[0].lat, points[0].lng] : null
      const avgPace =
        item.distance > 0 && item.duration > 0
          ? (item.duration / (item.distance / 1000))
          : 0
      const avgSpeed =
        item.distance > 0 && item.duration > 0
          ? (item.distance / 1000) / (item.duration / 3600)
          : 0

      const { error } = await supabase.from('activities').insert({
        user_id: user.id,
        title: item.title,
        type: item.type,
        distance: item.distance,
        duration: item.duration,
        elevation_gain: item.elevation,
        avg_pace: avgPace,
        avg_speed: avgSpeed,
        gpx_data: points,
        start_latlng: startLatlng,
        created_at: item.startTime || undefined,
      })
      if (!error) imported++
    }

    // Award achievements
    const { data: acts } = await supabase
      .from('activities')
      .select('*')
      .eq('user_id', user.id)
    const newBadges = await checkAndAwardAchievements(
      supabase,
      user.id,
      (acts ?? []) as import('@/lib/types').Activity[]
    )
    newBadges.forEach((b) => toast(`🏅 Achievement: ${b}`, 'success'))

    toast(`Imported ${imported} of ${parsed.length} activities!`, 'success')
    setSaving(false)
    router.push('/activities')
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">Import Activities</h1>
        <p className="text-gray-500 text-sm mt-1">
          Upload GPX files from Garmin, Wahoo, Strava export, or any GPS device.
        </p>
      </div>

      {/* Drop zone */}
      <label
        htmlFor="gpx-input"
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl p-10 cursor-pointer transition-colors ${
          dragOver
            ? 'border-orange-400 bg-orange-50'
            : 'border-gray-200 bg-white hover:border-orange-300 hover:bg-orange-50/50'
        }`}
      >
        <Upload size={36} className="text-orange-400" />
        <div className="text-center">
          <p className="font-semibold text-gray-800">Drop GPX files here</p>
          <p className="text-sm text-gray-400 mt-1">or click to browse — multiple files allowed</p>
        </div>
        <input
          id="gpx-input"
          type="file"
          accept=".gpx"
          multiple
          className="sr-only"
          onChange={handleFileInput}
        />
      </label>

      {/* Parsed list */}
      {parsed.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-800">{parsed.length} file{parsed.length > 1 ? 's' : ''} ready to import</h2>
          {parsed.map((item, idx) => (
            <div key={idx} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText size={16} className="text-orange-400 shrink-0" />
                  <span className="text-xs text-gray-400 truncate">{item.fileName}</span>
                </div>
                <button
                  onClick={() => removeItem(idx)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Title</label>
                  <input
                    value={item.title}
                    onChange={(e) => updateField(idx, 'title', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Activity Type</label>
                  <select
                    value={item.type}
                    onChange={(e) => updateField(idx, 'type', e.target.value as ActivityType)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  >
                    {ACTIVITY_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-500 pt-1 border-t border-gray-100">
                <span>📏 {formatDistance(item.distance)}</span>
                <span>⏱ {formatDuration(item.duration)}</span>
                <span>⛰ {formatElevation(item.elevation)}</span>
                {item.startTime && (
                  <span className="text-xs text-gray-400">
                    {new Date(item.startTime).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          ))}

          <button
            onClick={handleImport}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? (
              <>Importing…</>
            ) : (
              <>
                <CheckCircle size={18} />
                Import {parsed.length} Activit{parsed.length > 1 ? 'ies' : 'y'}
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
