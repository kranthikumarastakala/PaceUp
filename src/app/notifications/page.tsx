'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { cn, timeAgo } from '@/lib/utils'
import type { Notification } from '@/lib/types'
import { Bell, CheckCheck } from 'lucide-react'

function getNotifText(n: Notification): string {
  const actor = n.actor?.full_name || n.actor?.username || 'Someone'
  switch (n.type) {
    case 'kudos':   return `${actor} gave kudos on "${n.activity?.title ?? 'your activity'}"`
    case 'comment': return `${actor} commented on "${n.activity?.title ?? 'your activity'}"`
    case 'follow':  return `${actor} started following you`
  }
}

function getNotifHref(n: Notification): string {
  if (n.type === 'follow') return `/profile/${n.actor?.username ?? ''}`
  if (n.activity_id) return `/activities/${n.activity_id}`
  return '#'
}

const TYPE_EMOJI: Record<string, string> = {
  kudos: '❤️',
  comment: '💬',
  follow: '👤',
}

export default function NotificationsPage() {
  const supabase = createClient()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/login'; return }

    const { data } = await supabase
      .from('notifications')
      .select('*, actor:actor_id(username, full_name, avatar_url), activity:activity_id(title)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)

    setNotifications((data as Notification[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const markAllRead = async () => {
    const ids = notifications.filter((n) => !n.is_read).map((n) => n.id)
    if (!ids.length) return
    await supabase.from('notifications').update({ is_read: true }).in('id', ids)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  const markRead = async (n: Notification) => {
    if (n.is_read) return
    await supabase.from('notifications').update({ is_read: true }).eq('id', n.id)
    setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)))
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-3 animate-pulse">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-16 bg-white rounded-2xl border border-gray-100" />
        ))}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            <Bell size={22} className="text-orange-500" />
            Notifications
          </h1>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-400 mt-0.5">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 text-sm font-medium text-orange-500 hover:text-orange-600 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-lg transition-colors"
          >
            <CheckCheck size={15} />
            Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-24">
          <div className="text-5xl mb-4">🔔</div>
          <p className="text-lg font-medium text-gray-500">No notifications yet</p>
          <p className="text-sm text-gray-400 mt-1">When someone likes or comments on your activities, you'll see it here.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-50">
          {notifications.map((n) => {
            const initials = (n.actor?.full_name || n.actor?.username || '?').charAt(0).toUpperCase()
            return (
              <Link
                key={n.id}
                href={getNotifHref(n)}
                onClick={() => markRead(n)}
                className={cn(
                  'flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors',
                  !n.is_read && 'bg-orange-50/40'
                )}
              >
                {/* Actor avatar */}
                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-red-500 text-white font-bold flex items-center justify-center">
                    {initials}
                  </div>
                  <span className="absolute -bottom-1 -right-1 text-base">{TYPE_EMOJI[n.type]}</span>
                </div>

                {/* Body */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 leading-snug font-medium">{getNotifText(n)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{timeAgo(n.created_at)}</p>
                </div>

                {/* Unread dot */}
                {!n.is_read && (
                  <div className="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0 mt-1.5" />
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
