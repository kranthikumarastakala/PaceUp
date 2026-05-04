'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ToastProvider'
import type { ActivityType, GpxPoint } from '@/lib/types'

const ACTIVITY_TYPES: { value: ActivityType; label: string; icon: string }[] = [
  { value: 'run', label: 'Run', icon: '🏃' },
  { value: 'ride', label: 'Ride', icon: '🚴' },
  { value: 'swim', label: 'Swim', icon: '🏊' },
  { value: 'walk', label: 'Walk', icon: '🚶' },
  { value: 'hike', label: 'Hike', icon: '🥾' },
  { value: 'workout', label: 'Workout', icon: '💪' },
]

function parseGpxFile(text: string): { points: GpxPoint[]; distance: number; elevation: number } {
  const parser = new DOMParser()
  const xml = parser.parseFromString(text, 'application/xml')
  const trkpts = Array.from(xml.querySelectorAll('trkpt'))
  const points: GpxPoint[] = trkpts.map((pt) => ({
    lat: parseFloat(pt.getAttribute('lat') ?? '0'),
    lng: parseFloat(pt.getAttribute('lon') ?? '0'),
    ele: parseFloat(pt.querySelector('ele')?.textContent ?? '0'),
    time: pt.querySelector('time')?.textContent ?? '',
  }))
  let distance = 0
  let elevation = 0
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const R = 6371000
    const dLat = ((curr.lat - prev.lat) * Math.PI) / 180
    const dLng = ((curr.lng - prev.lng) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((prev.lat * Math.PI) / 180) * Math.cos((curr.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
    distance += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    if (curr.ele > prev.ele) elevation += curr.ele - prev.ele
  }
  return { points, distance, elevation }
}

export default function EditActivityPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const { toast } = useToast()

  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [type, setType] = useState<ActivityType>('run')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [distanceKm, setDistanceKm] = useState('')
  const [durationMin, setDurationMin] = useState('')
  const [durationSec, setDurationSec] = useState('')
  const [elevationM, setElevationM] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [gpxData, setGpxData] = useState<GpxPoint[]>([])
  const [gpxFileName, setGpxFileName] = useState('')

  // Load existing activity
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('id', params.id)
        .eq('user_id', user.id)
        .single()

      if (error || !data) {
        toast('Activity not found or access denied', 'error')
        router.push('/activities')
        return
      }

      setType(data.type)
      setTitle(data.title)
      setDescription(data.description ?? '')
      setDistanceKm(data.distance > 0 ? (data.distance / 1000).toFixed(2) : '')
      const mins = Math.floor(data.duration / 60)
      const secs = data.duration % 60
      setDurationMin(mins > 0 ? String(mins) : '')
      setDurationSec(secs > 0 ? String(secs) : '')
      setElevationM(data.elevation_gain > 0 ? String(Math.round(data.elevation_gain)) : '')
      setIsPublic(data.is_public)
      if (data.gpx_data) setGpxData(data.gpx_data)
      setInitialLoading(false)
    }
    load()
  }, [params.id])

  const handleGpxUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const { points, distance, elevation } = parseGpxFile(text)
      setGpxData(points)
      setGpxFileName(file.name)
      setDistanceKm((distance / 1000).toFixed(2))
      setElevationM(Math.round(elevation).toString())
    }
    reader.readAsText(file)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const distanceM = parseFloat(distanceKm) * 1000
    const durationS = parseInt(durationMin || '0') * 60 + parseInt(durationSec || '0')
    const avgPace = distanceM > 0 && durationS > 0 ? durationS / (distanceM / 1000) : 0
    const avgSpeed = distanceM > 0 && durationS > 0 ? (distanceM / 1000) / (durationS / 3600) : 0
    const calories = Math.round((durationS / 60) * 8)

    const { error } = await supabase
      .from('activities')
      .update({
        title,
        type,
        description,
        distance: distanceM,
        duration: durationS,
        elevation_gain: parseFloat(elevationM) || 0,
        avg_pace: avgPace,
        avg_speed: avgSpeed,
        calories,
        gpx_data: gpxData.length > 0 ? gpxData : null,
        start_latlng: gpxData.length > 0 ? [gpxData[0].lat, gpxData[0].lng] : null,
        is_public: isPublic,
      })
      .eq('id', params.id)

    if (error) {
      toast(error.message, 'error')
      setLoading(false)
    } else {
      toast('Activity updated!', 'success')
      router.push(`/activities/${params.id}`)
    }
  }

  if (initialLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="h-40 bg-gray-200 rounded-2xl" />
        <div className="h-40 bg-gray-200 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Edit Activity</h1>
      <p className="text-gray-500 text-sm mb-8">Update your workout details</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Activity Type */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <label className="block text-sm font-semibold text-gray-700 mb-3">Activity Type</label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {ACTIVITY_TYPES.map(({ value, label, icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setType(value)}
                className={`flex flex-col items-center gap-1 py-3 rounded-xl border text-sm font-medium transition-all ${
                  type === value
                    ? 'border-orange-500 bg-gradient-to-b from-orange-50 to-white text-orange-600 shadow-sm'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-orange-300 hover:text-orange-500'
                }`}
              >
                <span className="text-xl">{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder={`Morning ${type.charAt(0).toUpperCase() + type.slice(1)}`}
            className="w-full bg-slate-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all"
          />
        </div>

        {/* Stats */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <label className="block text-sm font-semibold text-gray-700 mb-3">Stats</label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Distance (km)</label>
              <input
                type="number"
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                step="0.01"
                min="0"
                placeholder="5.00"
                className="w-full bg-slate-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Elevation Gain (m)</label>
              <input
                type="number"
                value={elevationM}
                onChange={(e) => setElevationM(e.target.value)}
                min="0"
                placeholder="0"
                className="w-full bg-slate-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Duration — Minutes</label>
              <input
                type="number"
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)}
                min="0"
                placeholder="30"
                className="w-full bg-slate-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Duration — Seconds</label>
              <input
                type="number"
                value={durationSec}
                onChange={(e) => setDurationSec(e.target.value)}
                min="0"
                max="59"
                placeholder="0"
                className="w-full bg-slate-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all"
              />
            </div>
          </div>
        </div>

        {/* GPX Upload */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Replace GPX File <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          {gpxData.length > 0 && !gpxFileName && (
            <p className="text-xs text-green-600 mb-2">✓ GPX data loaded from saved activity</p>
          )}
          <label className="flex items-center gap-3 bg-gradient-to-r from-orange-50 to-pink-50 border-2 border-dashed border-orange-200 rounded-xl px-4 py-5 cursor-pointer hover:border-orange-400 transition-all group">
            <span className="text-3xl">📍</span>
            <div>
              <div className="text-sm font-semibold text-gray-700 group-hover:text-orange-600 transition-colors">
                {gpxFileName || 'Click to upload a new .gpx file'}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">Replaces distance & elevation with new GPS data</div>
            </div>
            <input type="file" accept=".gpx" onChange={handleGpxUpload} className="hidden" />
          </label>
        </div>

        {/* Description */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Description <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="How did it feel? Any notes..."
            className="w-full bg-slate-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all resize-none"
          />
        </div>

        {/* Visibility */}
        <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <button
            type="button"
            onClick={() => setIsPublic(!isPublic)}
            className={`relative w-11 h-6 rounded-full transition-colors ${isPublic ? 'bg-orange-500' : 'bg-gray-200'}`}
          >
            <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${isPublic ? 'translate-x-5' : ''}`} />
          </button>
          <div>
            <div className="text-sm font-semibold text-gray-700">Share to public feed</div>
            <div className="text-xs text-gray-400">{isPublic ? 'Everyone can see this activity' : 'Only you can see this'}</div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 py-4 rounded-2xl font-bold text-base border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:opacity-50 text-white py-4 rounded-2xl font-bold text-base shadow-lg shadow-orange-200 transition-all hover:shadow-xl hover:-translate-y-0.5"
          >
            {loading ? 'Saving…' : '✓ Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
