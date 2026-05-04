'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ToastProvider'
import { parseGpxFile, formatDistance, formatElevation } from '@/lib/utils'
import type { ActivityType, GpxPoint } from '@/lib/types'
import { Upload, Map } from 'lucide-react'

const ROUTE_TYPES = [
  { value: 'run', label: 'Run', icon: '🏃' },
  { value: 'ride', label: 'Ride', icon: '🚴' },
  { value: 'walk', label: 'Walk', icon: '🚶' },
  { value: 'hike', label: 'Hike', icon: '🥾' },
] as const

export default function NewRoutePage() {
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [activityType, setActivityType] = useState<ActivityType>('run')
  const [isPublic, setIsPublic] = useState(true)
  const [gpxPoints, setGpxPoints] = useState<GpxPoint[]>([])
  const [parsedStats, setParsedStats] = useState<{ distance: number; elevation: number } | null>(null)
  const [gpxFileName, setGpxFileName] = useState('')
  const [saving, setSaving] = useState(false)

  const handleGpxUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setGpxFileName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const { points, distance, elevation } = parseGpxFile(text)
      setGpxPoints(points)
      setParsedStats({ distance, elevation })
      if (!name) setName(file.name.replace(/\.gpx$/i, '').replace(/[-_]/g, ' '))
    }
    reader.readAsText(file)
  }, [name])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { toast('Route name is required', 'error'); return }
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast('Not logged in', 'error'); setSaving(false); return }

    const { data, error } = await supabase.from('routes').insert({
      user_id: user.id,
      name: name.trim(),
      description: description.trim() || null,
      activity_type: activityType,
      gpx_data: gpxPoints.length > 0 ? gpxPoints : null,
      distance: parsedStats?.distance ?? null,
      elevation_gain: parsedStats?.elevation ?? null,
      is_public: isPublic,
      star_count: 0,
    }).select().single()

    if (error) {
      toast(error.message, 'error')
    } else {
      toast('Route created!', 'success')
      router.push(`/routes/${(data as { id: string }).id}`)
    }
    setSaving(false)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">New Route</h1>
        <p className="text-gray-500 text-sm mt-1">Share a GPX route for others to follow</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* GPX upload */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">GPX File (optional)</label>
          <label
            htmlFor="route-gpx"
            className="flex items-center gap-3 border-2 border-dashed border-gray-200 rounded-xl px-4 py-4 cursor-pointer hover:border-orange-300 hover:bg-orange-50/50 transition-colors"
          >
            {gpxFileName ? (
              <>
                <Map size={20} className="text-orange-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-800">{gpxFileName}</p>
                  {parsedStats && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatDistance(parsedStats.distance)} · {formatElevation(parsedStats.elevation)} gain
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <Upload size={20} className="text-gray-400 shrink-0" />
                <span className="text-sm text-gray-500">Upload a .gpx file to auto-fill distance &amp; elevation</span>
              </>
            )}
            <input id="route-gpx" type="file" accept=".gpx" className="sr-only" onChange={handleGpxUpload} />
          </label>
        </div>

        {/* Name */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">Route Name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Morning Loop through the Park"
            required
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>

        {/* Type */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">Activity Type</label>
          <div className="grid grid-cols-4 gap-2">
            {ROUTE_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setActivityType(t.value as ActivityType)}
                className={`flex flex-col items-center gap-1 py-3 rounded-xl border text-sm font-medium transition-all ${
                  activityType === t.value
                    ? 'border-orange-400 bg-orange-50 text-orange-600'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <span className="text-xl">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Describe the route, highlights, difficulty…"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
          />
        </div>

        {/* Visibility */}
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => setIsPublic(!isPublic)}
            className={`relative w-10 h-6 rounded-full transition-colors ${isPublic ? 'bg-orange-500' : 'bg-gray-300'}`}
          >
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${isPublic ? 'translate-x-5' : 'translate-x-1'}`} />
          </div>
          <span className="text-sm text-gray-700">Public route — visible to everyone</span>
        </label>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Create Route'}
          </button>
        </div>
      </form>
    </div>
  )
}
