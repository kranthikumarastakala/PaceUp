'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { RouteMap } from '@/components/RouteMap'
import { ElevationChart } from '@/components/ElevationChart'
import { useToast } from '@/components/ToastProvider'
import type { Activity } from '@/lib/types'
import {
  formatDistance, formatDuration, formatPace, formatSpeed,
  formatElevation, activityIcon, activityColor, timeAgo
} from '@/lib/utils'
import { Heart, Clock, TrendingUp, Zap, Flame, MapPin, Pencil, Trash2, X } from 'lucide-react'
import { Comments } from '@/components/Comments'

export default function ActivityDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [activity, setActivity] = useState<Activity | null>(null)
  const [loading, setLoading] = useState(true)
  const [kudos, setKudos] = useState(0)
  const [liked, setLiked] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const supabase = createClient()
  const { toast } = useToast()

  useEffect(() => {
    const load = async () => {
      const [{ data: activityData }, { data: { user } }] = await Promise.all([
        supabase
          .from('activities')
          .select('*, profiles(username, full_name, avatar_url)')
          .eq('id', params.id)
          .single(),
        supabase.auth.getUser(),
      ])
      if (activityData) {
        setActivity(activityData as Activity)
        setKudos(activityData.kudos_count ?? 0)
      }
      setCurrentUserId(user?.id ?? null)
      setLoading(false)
    }
    load()
  }, [params.id])

  const handleKudos = async () => {
    if (!currentUserId || !activity) return
    if (liked) {
      await supabase.from('kudos').delete().match({ activity_id: activity.id, user_id: currentUserId })
      setKudos((k) => k - 1)
    } else {
      await supabase.from('kudos').insert({ activity_id: activity.id, user_id: currentUserId })
      setKudos((k) => k + 1)
    }
    setLiked(!liked)
  }

  const handleDelete = async () => {
    if (!activity) return
    setDeleting(true)
    const { error } = await supabase.from('activities').delete().eq('id', activity.id)
    if (error) {
      toast(error.message, 'error')
      setDeleting(false)
      setShowDeleteModal(false)
    } else {
      toast('Activity deleted', 'success')
      router.push('/activities')
    }
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
        <div className="flex items-start justify-between gap-4">
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
          {/* Owner actions */}
          {currentUserId === activity.user_id && (
            <div className="flex items-center gap-1 shrink-0">
              <Link
                href={`/activities/${activity.id}/edit`}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              >
                <Pencil size={15} />
                Edit
              </Link>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={15} />
                Delete
              </button>
            </div>
          )}
        </div>
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

      {/* Comments */}
      <Comments activityId={activity.id} />

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Delete Activity?</h2>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="p-1 text-gray-400 hover:text-gray-700 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              <span className="font-semibold text-gray-800">&ldquo;{activity.title}&rdquo;</span> will be
              permanently deleted. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2.5 rounded-xl font-medium text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl font-medium text-sm bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white transition-colors"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
