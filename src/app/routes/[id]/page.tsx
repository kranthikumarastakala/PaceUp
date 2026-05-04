'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ToastProvider'
import { formatDistance, formatElevation, activityIcon, timeAgo } from '@/lib/utils'
import { Star, Trash2, ArrowLeft, Map } from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import type { Route } from '@/lib/types'

const RouteMap = dynamic(
  () => import('@/components/RouteMap').then((m) => m.RouteMap),
  { ssr: false }
)

export default function RouteDetailPage() {
  const params = useParams()
  const routeId = params.id as string
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  const [route, setRoute] = useState<Route | null>(null)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [isStarred, setIsStarred] = useState(false)
  const [starCount, setStarCount] = useState(0)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUserId(user?.id ?? null)

      const { data } = await supabase
        .from('routes')
        .select('*, profiles(id,username,full_name,avatar_url)')
        .eq('id', routeId)
        .single()

      if (!data) { setLoading(false); return }
      setRoute(data as Route)
      setStarCount((data as Route).star_count)

      if (user) {
        const { data: star } = await supabase
          .from('route_stars')
          .select('route_id')
          .eq('route_id', routeId)
          .eq('user_id', user.id)
          .maybeSingle()
        setIsStarred(!!star)
      }
      setLoading(false)
    }
    load()
  }, [routeId])

  const toggleStar = async () => {
    if (!userId || !route) return
    if (isStarred) {
      setIsStarred(false)
      setStarCount((c) => c - 1)
      await supabase.from('route_stars').delete().eq('route_id', routeId).eq('user_id', userId)
      await supabase.from('routes').update({ star_count: starCount - 1 }).eq('id', routeId)
    } else {
      setIsStarred(true)
      setStarCount((c) => c + 1)
      await supabase.from('route_stars').insert({ route_id: routeId, user_id: userId })
      await supabase.from('routes').update({ star_count: starCount + 1 }).eq('id', routeId)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this route?')) return
    await supabase.from('routes').delete().eq('id', routeId)
    toast('Route deleted', 'info')
    router.push('/routes')
  }

  const handleUseRoute = () => {
    router.push('/activities/new')
    toast('GPX route loaded — create your activity!', 'success')
  }

  if (loading) return (
    <div className="max-w-3xl mx-auto px-4 py-8 animate-pulse space-y-4">
      <div className="h-48 bg-white rounded-2xl" />
      <div className="h-24 bg-white rounded-2xl" />
    </div>
  )

  if (!route) return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center text-gray-400">
      <Map size={48} className="mx-auto mb-3 text-gray-200" />
      <p className="text-lg font-medium">Route not found</p>
      <Link href="/routes" className="text-sm text-orange-500 hover:underline mt-2 inline-block">← Back to Routes</Link>
    </div>
  )

  const isOwner = userId === route.user_id
  const gpxPoints = route.gpx_data ?? []

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/routes" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-extrabold text-gray-900 truncate">{route.name}</h1>
          <div className="flex items-center gap-2 mt-0.5 text-sm text-gray-400">
            <span>{activityIcon(route.activity_type)}</span>
            <span>by</span>
            <Link href={`/profile/${route.profiles?.username}`} className="text-orange-500 hover:underline">
              @{route.profiles?.username}
            </Link>
            <span>·</span>
            <span>{timeAgo(route.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {route.distance != null && (
          <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center">
            <p className="text-xs text-gray-400 mb-1">Distance</p>
            <p className="text-xl font-bold text-gray-900">{formatDistance(route.distance)}</p>
          </div>
        )}
        {route.elevation_gain != null && (
          <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center">
            <p className="text-xs text-gray-400 mb-1">Elevation</p>
            <p className="text-xl font-bold text-gray-900">{formatElevation(route.elevation_gain)}</p>
          </div>
        )}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center">
          <p className="text-xs text-gray-400 mb-1">Stars</p>
          <p className="text-xl font-bold text-gray-900">{starCount}</p>
        </div>
      </div>

      {/* Map */}
      {gpxPoints.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm" style={{ height: 320 }}>
          <RouteMap points={gpxPoints} />
        </div>
      )}

      {/* Description */}
      {route.description && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <p className="text-gray-700 text-sm leading-relaxed">{route.description}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={toggleStar}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
            isStarred
              ? 'border-yellow-300 bg-yellow-50 text-yellow-600'
              : 'border-gray-200 text-gray-500 hover:border-yellow-300 hover:text-yellow-600'
          }`}
        >
          <Star size={16} className={isStarred ? 'fill-yellow-400' : ''} />
          {isStarred ? 'Starred' : 'Star Route'}
        </button>

        <button
          onClick={handleUseRoute}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Use This Route
        </button>

        {isOwner && (
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-colors text-sm"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  )
}
