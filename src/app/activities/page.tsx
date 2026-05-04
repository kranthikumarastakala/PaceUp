'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ActivityCard } from '@/components/ActivityCard'
import type { Activity } from '@/lib/types'
import Link from 'next/link'

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }

      const { data } = await supabase
        .from('activities')
        .select('*, profiles(username, full_name, avatar_url)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      setActivities((data as Activity[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const totalDistance = activities.reduce((sum, a) => sum + (a.distance ?? 0), 0)
  const totalTime = activities.reduce((sum, a) => sum + (a.duration ?? 0), 0)
  const totalElevation = activities.reduce((sum, a) => sum + (a.elevation_gain ?? 0), 0)

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">My Activities</h1>
        <Link
          href="/activities/new"
          className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md shadow-orange-200 transition-all hover:shadow-lg"
        >
          + Log Activity
        </Link>
      </div>

      {/* Summary stats */}
      {activities.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Total Distance', value: `${(totalDistance / 1000).toFixed(1)} km`, color: 'text-orange-500' },
            { label: 'Total Time', value: `${Math.floor(totalTime / 3600)}h ${Math.floor((totalTime % 3600) / 60)}m`, color: 'text-blue-500' },
            { label: 'Total Elevation', value: `${Math.round(totalElevation)} m`, color: 'text-green-500' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
              <div className={`text-xl font-extrabold ${color}`}>{value}</div>
              <div className="text-xs text-gray-400 font-medium mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl h-48 animate-pulse border border-gray-100" />
          ))}
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <div className="text-5xl mb-4">🏃</div>
          <p className="text-lg font-medium text-gray-400">No activities yet</p>
          <Link
            href="/activities/new"
            className="inline-block mt-4 bg-orange-500 hover:bg-orange-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            Log your first activity
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {activities.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} />
          ))}
        </div>
      )}
    </div>
  )
}


