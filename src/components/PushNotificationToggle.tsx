'use client'

import { useState, useEffect } from 'react'
import { Bell, BellOff } from 'lucide-react'

export function PushNotificationToggle() {
  const [supported, setSupported] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setSupported(true)
      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager.getSubscription().then(sub => setSubscribed(!!sub))
      })
    }
  }, [])

  const toggle = async () => {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready

      if (subscribed) {
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await fetch('/api/push/subscribe', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          })
          await sub.unsubscribe()
        }
        setSubscribed(false)
      } else {
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        if (!vapidKey) {
          alert('Push notifications require NEXT_PUBLIC_VAPID_PUBLIC_KEY in your .env.local')
          return
        }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        })
        const json = sub.toJSON()
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
        })
        setSubscribed(true)
      }
    } finally {
      setLoading(false)
    }
  }

  if (!supported) return null

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={subscribed ? 'Disable push notifications' : 'Enable push notifications'}
      className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-all"
      style={{
        background: subscribed ? 'var(--accent-orange)' : 'var(--surface)',
        borderColor: 'var(--surface-border)',
        color: subscribed ? 'white' : 'var(--text-secondary)',
      }}
    >
      {subscribed ? <Bell size={14} /> : <BellOff size={14} />}
      {subscribed ? 'Notifications On' : 'Enable Notifications'}
    </button>
  )
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const buffer = new ArrayBuffer(rawData.length)
  const view = new Uint8Array(buffer)
  for (let i = 0; i < rawData.length; i++) view[i] = rawData.charCodeAt(i)
  return buffer
}
