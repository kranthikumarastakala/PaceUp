'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn, timeAgo } from '@/lib/utils'
import type { Notification } from '@/lib/types'

interface Props {
  userId: string
}

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

export function NotificationBell({ userId }: Props) {
  const supabase = createClient()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const unreadCount = notifications.filter((n) => !n.is_read).length

  const fetchNotifications = useCallback(async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*, actor:actor_id(username, full_name, avatar_url), activity:activity_id(title)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)
    setNotifications((data as Notification[]) ?? [])
  }, [userId])

  useEffect(() => {
    fetchNotifications()

    // Realtime: listen for new notifications addressed to this user
    const channel = supabase
      .channel(`notif-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          // Re-fetch so we get the joined actor/activity data
          fetchNotifications()
          // Use the browser Notification API for a system nudge if page is backgrounded
          if (typeof window !== 'undefined' && document.hidden && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('PaceUp', { body: 'You have a new notification', icon: '/favicon.ico' })
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, fetchNotifications])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

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

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] bg-orange-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-100 rounded-2xl shadow-2xl overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-orange-500 hover:text-orange-600 font-medium transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <div className="text-3xl mb-2">🔔</div>
                <p className="text-sm text-gray-400">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => {
                const initials = (n.actor?.full_name || n.actor?.username || '?').charAt(0).toUpperCase()
                return (
                  <Link
                    key={n.id}
                    href={getNotifHref(n)}
                    onClick={() => { markRead(n); setOpen(false) }}
                    className={cn(
                      'flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors',
                      !n.is_read && 'bg-orange-50/50'
                    )}
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-red-500 text-white text-xs font-bold flex items-center justify-center shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 leading-snug">{getNotifText(n)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.is_read && (
                      <div className="w-2 h-2 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                    )}
                  </Link>
                )
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="block text-center py-3 text-sm text-orange-500 hover:text-orange-600 font-medium border-t border-gray-100 transition-colors"
            >
              See all notifications →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
