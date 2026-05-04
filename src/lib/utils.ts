import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { ActivityType } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDistance(meters: number, imperial = false): string {
  if (imperial) {
    const miles = meters / 1609.344
    return miles >= 1 ? `${miles.toFixed(2)} mi` : `${Math.round(meters * 3.281)} ft`
  }
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`
  return `${Math.round(meters)} m`
}

export function formatElevation(meters: number, imperial = false): string {
  if (imperial) return `${Math.round(meters * 3.281)} ft`
  return `${Math.round(meters)} m`
}

export function formatPace(secondsPerKm: number, imperial = false): string {
  if (!secondsPerKm) return '--'
  const spUnit = imperial ? secondsPerKm * 1.60934 : secondsPerKm
  const m = Math.floor(spUnit / 60)
  const s = Math.round(spUnit % 60)
  return `${m}:${String(s).padStart(2, '0')} /${imperial ? 'mi' : 'km'}`
}

export function formatSpeed(kmh: number, imperial = false): string {
  if (imperial) return `${(kmh * 0.621371).toFixed(1)} mph`
  return `${kmh.toFixed(1)} km/h`
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}


export function activityIcon(type: ActivityType): string {
  const icons: Record<ActivityType, string> = {
    run: '🏃',
    ride: '🚴',
    swim: '🏊',
    walk: '🚶',
    hike: '🥾',
    workout: '💪',
  }
  return icons[type] ?? '🏅'
}

export function activityColor(type: ActivityType): string {
  const colors: Record<ActivityType, string> = {
    run: 'text-orange-500',
    ride: 'text-blue-500',
    swim: 'text-cyan-500',
    walk: 'text-green-500',
    hike: 'text-emerald-600',
    workout: 'text-purple-500',
  }
  return colors[type] ?? 'text-gray-500'
}

export function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(date).toLocaleDateString()
}

/**
 * Upload an activity photo to Supabase Storage.
 * Returns the public URL or null if storage is unavailable.
 */
export async function uploadActivityPhoto(
  supabase: ReturnType<typeof import('./supabase/client').createClient>,
  file: File,
  userId: string
): Promise<string | null> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${userId}/${Date.now()}.${ext}`
  const { data, error } = await supabase.storage
    .from('activity-photos')
    .upload(path, file, { cacheControl: '3600', upsert: false })
  if (error || !data) return null
  const { data: urlData } = supabase.storage.from('activity-photos').getPublicUrl(data.path)
  return urlData.publicUrl
}

export function parseGpxFile(text: string): {
  points: import('./types').GpxPoint[]
  distance: number
  elevation: number
  duration: number
  startTime: string
} {
  const parser = new DOMParser()
  const xml = parser.parseFromString(text, 'application/xml')
  const trkpts = Array.from(xml.querySelectorAll('trkpt'))

  const points: import('./types').GpxPoint[] = trkpts.map((pt) => ({
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
      Math.cos((prev.lat * Math.PI) / 180) *
        Math.cos((curr.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2
    distance += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    if (curr.ele > prev.ele) elevation += curr.ele - prev.ele
  }

  const startTime = points[0]?.time ?? ''
  const endTime = points[points.length - 1]?.time ?? ''
  const duration =
    startTime && endTime
      ? Math.round(
          (new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000
        )
      : 0

  return { points, distance, elevation, duration, startTime }
}

