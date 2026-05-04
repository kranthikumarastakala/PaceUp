'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ActivityCard } from '@/components/ActivityCard'
import type { Activity, Profile } from '@/lib/types'
import { MapPin, Calendar } from 'lucide-react'
import { format } from 'date-fns'

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }

      const [{ data: prof }, { data: acts }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('activities').select('*, profiles(username, full_name, avatar_url)')
          .eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
      ])

      setProfile(prof as Profile)
      setActivities((acts as Activity[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="max-w-2xl mx-auto px-4 py-8 animate-pulse">
    <div className="h-32 bg-white rounded-2xl mb-4" />
  </div>

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Profile card */}
      <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-md">
        <div className="flex items-start gap-5">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-3xl font-bold shrink-0 shadow-lg shadow-orange-200 text-white">
            {profile?.full_name?.[0] ?? profile?.username?.[0] ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-extrabold text-gray-900">{profile?.full_name}</h1>
            <p className="text-orange-500 font-medium">@{profile?.username}</p>
            {profile?.bio && <p className="text-gray-600 text-sm mt-2">{profile.bio}</p>}
            <div className="flex items-center gap-4 mt-3 text-sm text-gray-400">
              {profile?.location && (
                <span className="flex items-center gap-1"><MapPin size={13} /> {profile.location}</span>
              )}
              {profile?.created_at && (
                <span className="flex items-center gap-1">
                  <Calendar size={13} /> Joined {format(new Date(profile.created_at), 'MMM yyyy')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 mt-6 pt-5 border-t border-gray-100">
          <div className="text-center">
            <div className="text-2xl font-extrabold text-gray-900">{activities.length}</div>
            <div className="text-xs text-gray-400 font-medium mt-0.5">Activities</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-extrabold text-gray-900">
              {(activities.reduce((s, a) => s + (a.distance ?? 0), 0) / 1000).toFixed(0)} km
            </div>
            <div className="text-xs text-gray-400 font-medium mt-0.5">Total Distance</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-extrabold text-gray-900">
              {Math.floor(activities.reduce((s, a) => s + (a.duration ?? 0), 0) / 3600)} h
            </div>
            <div className="text-xs text-gray-400 font-medium mt-0.5">Total Time</div>
          </div>
        </div>
      </div>

      {/* Recent activities */}
      <div>
        <h2 className="font-bold text-gray-900 mb-3">Recent Activities</h2>
        {activities.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-3">🏃</div>
            <p>No activities yet. Log your first workout!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((a) => <ActivityCard key={a.id} activity={a} />)}
          </div>
        )}
      </div>
    </div>
  )
}


