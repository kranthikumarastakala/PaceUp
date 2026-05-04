'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { RouteMap } from '@/components/RouteMap'
import { ElevationChart } from '@/components/ElevationChart'
import type { Activity } from '@/lib/types'
import {
  formatDistance, formatDuration, formatPace, formatSpeed,
  formatElevation, activityIcon, activityColor, timeAgo
} from '@/lib/utils'
import { Heart, Clock, TrendingUp, Zap, Flame, MapPin } from 'lucide-react'

export default function ActivityDetailPage() {
  const params = useParams()
  const [activity, setActivity] = useState<Activity | null>(null)
  const [loading, setLoading] = useState(true)
  const [kudos, setKudos] = useState(0)
  const [liked, setLiked] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('activities')
        .select('*, profiles(username, full_name, avatar_url)')
        .eq('id', params.id)
        .single()
      if (data) {
        setActivity(data as Activity)
        setKudos(data.kudos_count ?? 0)
      }
      setLoading(false)
    }
    load()
  }, [params.id])

  const handleKudos = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !activity) return
    if (liked) {
      await supabase.from('kudos').delete().match({ activity_id: activity.id, user_id: user.id })
      setKudos((k) => k - 1)
    } else {
      await supabase.from('kudos').insert({ activity_id: activity.id, user_id: user.id })
      setKudos((k) => k + 1)
    }
    setLiked(!liked)
  }

  if (loading) return <div className="max-w-2xl mx-auto px-4 py-8 animate-pulse">
    <div className="h-8 bg-gray-800 rounded w-1/2 mb-4" />
    <div className="h-64 bg-gray-800 rounded-2xl" />
  </div>

  if (!activity) return <div className="max-w-2xl mx-auto px-4 py-16 text-center text-gray-500">Activity not found.</div>

  const stats = [
    { icon: MapPin, label: 'Distance', value: formatDistance(activity.distance), show: activity.distance > 0 },
    { icon: Clock, label: 'Duration', value: formatDuration(activity.duration), show: activity.duration > 0 },
    { icon: Zap, label: 'Avg Pace', value: formatPace(activity.avg_pace), show: activity.avg_pace > 0 },
    { icon: TrendingUp, label: 'Avg Speed', value: formatSpeed(activity.avg_speed), show: activity.avg_speed > 0 },
    { icon: TrendingUp, label: 'Elevation', value: formatElevation(activity.elevation_gain), show: activity.elevation_gain > 0 },
    { icon: Flame, label: 'Calories', value: `${activity.calories} kcal`, show: (activity.calories ?? 0) > 0 },
  ].filter((s) => s.show)

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
          <span>{activityIcon(activity.type)}</span>
          <span className={activityColor(activity.type) + ' font-medium capitalize'}>{activity.type}</span>
          <span>·</span>
          <span>{timeAgo(activity.created_at)}</span>
        </div>
        <h1 className="text-3xl font-bold">{activity.title}</h1>
        {activity.profiles && (
          <p className="text-gray-400 mt-1">by {activity.profiles.full_name || activity.profiles.username}</p>
        )}
      </div>

      {/* Map */}
      {activity.gpx_data && activity.gpx_data.length > 0 && (
        <RouteMap points={activity.gpx_data} height="350px" />
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {stats.map(({ icon: Icon, label, value }) => (
          <div key={label} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-1.5 text-gray-400 text-xs mb-1.5">
              <Icon size={12} /> {label}
            </div>
            <div className="text-xl font-bold text-gray-900">{value}</div>
          </div>
        ))}
      </div>

      {/* Elevation chart */}
      {activity.gpx_data && activity.gpx_data.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h3 className="font-semibold mb-4 text-sm text-gray-500">Elevation Profile</h3>
          <ElevationChart points={activity.gpx_data} />
        </div>
      )}

      {/* Description */}
      {activity.description && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <p className="text-gray-700">{activity.description}</p>
        </div>
      )}

      {/* Kudos */}
      <div className="flex items-center gap-4 pt-4 border-t border-gray-100">
        <button
          onClick={handleKudos}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all border ${
            liked
              ? 'border-orange-500 bg-orange-500 text-white shadow-md shadow-orange-200'
              : 'border-gray-200 text-gray-500 hover:border-orange-400 hover:text-orange-500 hover:bg-orange-50'
          }`}
        >
          <Heart size={15} fill={liked ? 'currentColor' : 'none'} />
          {kudos} {kudos === 1 ? 'Kudo' : 'Kudos'}
        </button>
      </div>
    </div>
  )
}
