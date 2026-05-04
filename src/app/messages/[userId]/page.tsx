'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Send, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { timeAgo } from '@/lib/utils'
import type { Message, Profile } from '@/lib/types'

export default function MessageThreadPage() {
  const params = useParams()
  const partnerId = params.userId as string
  const supabase = createClient()

  const [messages, setMessages] = useState<Message[]>([])
  const [partner, setPartner] = useState<Profile | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      setUserId(user.id)

      const [{ data: prof }, { data: msgs }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', partnerId).single(),
        supabase
          .from('messages')
          .select('*')
          .or(
            `and(sender_id.eq.${user.id},recipient_id.eq.${partnerId}),and(sender_id.eq.${partnerId},recipient_id.eq.${user.id})`
          )
          .order('created_at', { ascending: true }),
      ])

      setPartner(prof as Profile)
      setMessages((msgs as Message[]) ?? [])
      setLoading(false)

      // Mark unread messages as read
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('recipient_id', user.id)
        .eq('sender_id', partnerId)
        .eq('is_read', false)
    }
    load()
  }, [partnerId])

  // Realtime subscription
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`messages:thread:${userId}:${partnerId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const msg = payload.new as Message
          if (msg.sender_id === partnerId) {
            setMessages((prev) => [...prev, msg])
            // Mark as read immediately since we're in the thread
            supabase
              .from('messages')
              .update({ is_read: true })
              .eq('id', msg.id)
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, partnerId])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim() || !userId) return
    setSending(true)

    const optimistic: Message = {
      id: crypto.randomUUID(),
      sender_id: userId,
      recipient_id: partnerId,
      body: body.trim(),
      is_read: false,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    setBody('')

    const { error } = await supabase.from('messages').insert({
      sender_id: userId,
      recipient_id: partnerId,
      body: optimistic.body,
    })

    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      setBody(optimistic.body)
    }
    setSending(false)
  }

  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 py-8 animate-pulse space-y-3">
      {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-white rounded-xl" />)}
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 shrink-0">
        <Link href="/messages" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        {partner?.avatar_url ? (
          <img src={partner.avatar_url} alt="" className="w-10 h-10 rounded-xl object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-bold">
            {partner?.full_name?.[0] ?? partner?.username?.[0]}
          </div>
        )}
        <div>
          <p className="font-semibold text-gray-900 leading-tight">
            {partner?.full_name || partner?.username}
          </p>
          <Link href={`/profile/${partner?.username}`} className="text-xs text-orange-500 hover:underline">
            @{partner?.username}
          </Link>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {messages.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">
            No messages yet — say hi! 👋
          </p>
        )}
        {messages.map((msg) => {
          const isMine = msg.sender_id === userId
          return (
            <div
              key={msg.id}
              className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                  isMine
                    ? 'bg-gradient-to-br from-orange-500 to-red-500 text-white rounded-br-sm'
                    : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm shadow-sm'
                }`}
              >
                <p className="leading-relaxed">{msg.body}</p>
                <p className={`text-xs mt-1 ${isMine ? 'text-orange-100' : 'text-gray-400'}`}>
                  {timeAgo(msg.created_at)}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="flex items-center gap-2 px-4 py-3 bg-white border-t border-gray-100 shrink-0"
      >
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Type a message…"
          maxLength={2000}
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
        <button
          type="submit"
          disabled={!body.trim() || sending}
          className="p-2.5 bg-gradient-to-br from-orange-500 to-red-500 text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  )
}
