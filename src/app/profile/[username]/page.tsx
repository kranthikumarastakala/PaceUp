'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ActivityCard } from '@/components/ActivityCard'
import type { Activity, Profile } from '@/lib/types'
import { MapPin, Calendar, UserPlus, UserMinus, UserCheck } from 'lucide-react'
import { format } from 'date-fns'

export default function PublicProfilePage() {
  const params = useParams()
  const username = params.username as string

  const [profile, setProfile] = useState<Profile | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [isFollowing, setIsFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [followLoading, setFollowLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id ?? null)

      // Load profile
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single()

      if (!prof) { setLoading(false); return }
      setProfile(prof as Profile)

      // Load activities, follower/following counts, and follow status in parallel
      const [
        { data: acts },
        { count: followers },
        { count: following },
      ] = await Promise.all([
        supabase
          .from('activities')
          .select('*, profiles(username, full_name, avatar_url)')
          .eq('user_id', prof.id)
          .eq('is_public', true)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', prof.id),
        supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', prof.id),
      ])

      setActivities((acts as Activity[]) ?? [])
      setFollowerCount(followers ?? 0)
      setFollowingCount(following ?? 0)

      if (user && user.id !== prof.id) {
        const { data: followRow } = await supabase
          .from('follows')
          .select('follower_id')
          .eq('follower_id', user.id)
          .eq('following_id', prof.id)
          .maybeSingle()
        setIsFollowing(!!followRow)
      }

      setLoading(false)
    }
    load()
  }, [username])

  const handleFollow = async () => {
    if (!currentUserId || !profile) return
    setFollowLoading(true)
    if (isFollowing) {
      await supabase.from('follows').delete().match({ follower_id: currentUserId, following_id: profile.id })
      setIsFollowing(false)
      setFollowerCount((c) => c - 1)
    } else {
      await supabase.from('follows').insert({ follower_id: currentUserId, following_id: profile.id })
      setIsFollowing(true)
      setFollowerCount((c) => c + 1)
    }
    setFollowLoading(false)
  }

  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 py-8 animate-pulse space-y-4">
      <div className="h-36 bg-gray-900 rounded-2xl" />
      <div className="h-48 bg-gray-900 rounded-2xl" />
    </div>
  )

  if (!profile) return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center text-gray-500">
      <div className="text-5xl mb-4">👤</div>
      <p className="text-lg">User not found.</p>
    </div>
  )

  const isOwnProfile = currentUserId === profile.id
  const totalDist = activities.reduce((s, a) => s + (a.distance ?? 0), 0)

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Profile card */}
      <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-md">
        <div className="flex items-start gap-5">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-3xl font-bold shrink-0 shadow-lg shadow-orange-200 text-white">
            {profile.full_name?.[0] ?? profile.username?.[0] ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h1 className="text-2xl font-extrabold text-gray-900">{profile.full_name}</h1>
                <p className="text-orange-500 font-medium">@{profile.username}</p>
              </div>
              {!isOwnProfile && currentUserId && (
                <button
                  onClick={handleFollow}
                  disabled={followLoading}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all border ${
                    isFollowing
                      ? 'border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-500 hover:bg-red-50'
                      : 'border-orange-500 bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md shadow-orange-200 hover:shadow-lg'
                  }`}
                >
                  {isFollowing ? (
                    <><UserMinus size={14} /> Unfollow</>
                  ) : (
                    <><UserPlus size={14} /> Follow</>
                  )}
                </button>
              )}
              {isOwnProfile && (
                <span className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-full font-semibold">
                  <UserCheck size={13} /> Your profile
                </span>
              )}
            </div>

            {profile.bio && <p className="text-gray-600 text-sm mt-2">{profile.bio}</p>}

            <div className="flex items-center gap-4 mt-2 text-sm text-gray-400 flex-wrap">
              {profile.location && (
                <span className="flex items-center gap-1"><MapPin size={12} /> {profile.location}</span>
              )}
              {profile.created_at && (
                <span className="flex items-center gap-1">
                  <Calendar size={12} /> Joined {format(new Date(profile.created_at), 'MMM yyyy')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2 mt-6 pt-5 border-t border-gray-100 text-center">
          <div>
            <div className="text-xl font-extrabold text-gray-900">{activities.length}</div>
            <div className="text-xs text-gray-400 font-medium">Activities</div>
          </div>
          <div>
            <div className="text-xl font-extrabold text-gray-900">{(totalDist / 1000).toFixed(0)} km</div>
            <div className="text-xs text-gray-400 font-medium">Distance</div>
          </div>
          <div>
            <div className="text-xl font-extrabold text-gray-900">{followerCount}</div>
            <div className="text-xs text-gray-400 font-medium">Followers</div>
          </div>
          <div>
            <div className="text-xl font-extrabold text-gray-900">{followingCount}</div>
            <div className="text-xs text-gray-400 font-medium">Following</div>
          </div>
        </div>
      </div>

      {/* Activities */}
      <div>
        <h2 className="font-bold text-gray-900 mb-3">Recent Activities</h2>
        {activities.length === 0 ? (
          <div className="text-center py-10 text-gray-400 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="text-4xl mb-2">🏃</div>
            <p className="text-sm">No public activities yet.</p>
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
