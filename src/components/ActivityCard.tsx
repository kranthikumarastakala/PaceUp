'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Heart, MapPin, Clock, TrendingUp, Zap } from 'lucide-react'
import type { Activity } from '@/lib/types'
import {
  formatDistance,
  formatDuration,
  formatPace,
  formatElevation,
  activityIcon,
  activityColor,
  timeAgo,
} from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ToastProvider'

interface Props {
  activity: Activity
  showAuthor?: boolean
}

export function ActivityCard({ activity, showAuthor }: Props) {
  const [kudos, setKudos] = useState(activity.kudos_count ?? 0)
  const [liked, setLiked] = useState(false)
  const { toast } = useToast()

  const handleKudos = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast('Sign in to give kudos', 'info'); return }

    if (liked) {
      await supabase.from('kudos').delete().match({ activity_id: activity.id, user_id: user.id })
      setKudos((k) => k - 1)
    } else {
      await supabase.from('kudos').insert({ activity_id: activity.id, user_id: user.id })
      setKudos((k) => k + 1)
      await supabase.from('activities').update({ kudos_count: kudos + 1 }).eq('id', activity.id)
    }
    setLiked(!liked)
  }

  const profile = activity.profiles

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center font-bold text-sm text-white shrink-0">
            {profile?.full_name?.[0] ?? profile?.username?.[0] ?? '?'}
          </div>
          <div>
            {showAuthor && (
              <Link href={`/profile/${profile?.username}`} className="font-semibold text-gray-900 hover:text-orange-500 transition-colors text-sm">
                {profile?.full_name || profile?.username}
              </Link>
            )}
            <div className="flex items-center gap-2">
              <span className="text-lg">{activityIcon(activity.type)}</span>
              <Link href={`/activities/${activity.id}`} className="font-bold text-gray-900 hover:text-orange-500 transition-colors">
                {activity.title}
              </Link>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{timeAgo(activity.created_at)}</p>
          </div>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${activityColor(activity.type)} bg-orange-50`}>
          {activity.type}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {activity.distance > 0 && (
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 rounded-xl p-3">
            <div className="flex items-center gap-1 text-orange-400 text-xs mb-1"><MapPin size={10} /> Distance</div>
            <div className="font-bold text-gray-900 text-sm">{formatDistance(activity.distance)}</div>
          </div>
        )}
        {activity.duration > 0 && (
          <div className="bg-gradient-to-br from-blue-50 to-sky-50 border border-blue-100 rounded-xl p-3">
            <div className="flex items-center gap-1 text-blue-400 text-xs mb-1"><Clock size={10} /> Duration</div>
            <div className="font-bold text-gray-900 text-sm">{formatDuration(activity.duration)}</div>
          </div>
        )}
        {activity.avg_pace > 0 && (
          <div className="bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-100 rounded-xl p-3">
            <div className="flex items-center gap-1 text-purple-400 text-xs mb-1"><Zap size={10} /> Pace</div>
            <div className="font-bold text-gray-900 text-sm">{formatPace(activity.avg_pace)}</div>
          </div>
        )}
        {activity.elevation_gain > 0 && (
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 rounded-xl p-3">
            <div className="flex items-center gap-1 text-green-500 text-xs mb-1"><TrendingUp size={10} /> Elevation</div>
            <div className="font-bold text-gray-900 text-sm">{formatElevation(activity.elevation_gain)}</div>
          </div>
        )}
      </div>

      {activity.description && (
        <p className="text-gray-500 text-sm mb-4 line-clamp-2">{activity.description}</p>
      )}

      {/* Footer */}
      <div className="flex items-center gap-4 pt-3 border-t border-gray-100">
        <button
          onClick={handleKudos}
          className={`flex items-center gap-1.5 text-sm font-medium transition-all px-3 py-1.5 rounded-full ${
            liked
              ? 'bg-orange-50 text-orange-500 border border-orange-200'
              : 'text-gray-400 hover:bg-orange-50 hover:text-orange-500 border border-transparent'
          }`}
        >
          <Heart size={14} fill={liked ? 'currentColor' : 'none'} />
          <span>{kudos} {kudos === 1 ? 'kudo' : 'kudos'}</span>
        </button>
        <Link
          href={`/activities/${activity.id}`}
          className="text-sm text-gray-400 hover:text-orange-500 font-medium transition-colors ml-auto"
        >
          View details →
        </Link>
      </div>
    </div>
  )
}


