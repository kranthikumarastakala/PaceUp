'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ToastProvider'
import Link from 'next/link'
import { MessageCircle, Search } from 'lucide-react'
import { timeAgo } from '@/lib/utils'
import type { Message, Profile } from '@/lib/types'

interface Conversation {
  partner: Pick<Profile, 'id' | 'username' | 'full_name' | 'avatar_url'>
  lastMessage: Message
  unreadCount: number
}

export default function MessagesInboxPage() {
  const supabase = createClient()
  const { toast } = useToast()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      setUserId(user.id)

      // Fetch all messages involving current user
      const { data: msgs } = await supabase
        .from('messages')
        .select('*, sender:profiles!messages_sender_id_fkey(id,username,full_name,avatar_url), recipient:profiles!messages_recipient_id_fkey(id,username,full_name,avatar_url)')
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order('created_at', { ascending: false })

      if (!msgs) { setLoading(false); return }

      // Group by conversation partner
      const convMap = new Map<string, Conversation>()
      for (const msg of msgs as Message[]) {
        const partner = msg.sender_id === user.id ? msg.recipient! : msg.sender!
        const partnerId = (partner as Profile).id
        if (!convMap.has(partnerId)) {
          convMap.set(partnerId, {
            partner: partner as Profile,
            lastMessage: msg,
            unreadCount: 0,
          })
        }
        if (!msg.is_read && msg.recipient_id === user.id) {
          const conv = convMap.get(partnerId)!
          conv.unreadCount++
        }
      }

      setConversations(Array.from(convMap.values()))
      setLoading(false)
    }
    load()
  }, [])

  const handleSearch = async (q: string) => {
    setSearch(q)
    if (q.trim().length < 2) { setSearchResults([]); return }
    setSearching(true)
    const { data } = await supabase
      .from('profiles')
      .select('id,username,full_name,avatar_url')
      .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
      .neq('id', userId ?? '')
      .limit(5)
    setSearchResults((data as Profile[]) ?? [])
    setSearching(false)
  }

  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 py-8 animate-pulse space-y-3">
      {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-white rounded-2xl" />)}
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-gray-900">Messages</h1>
      </div>

      {/* New conversation search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Start a new conversation…"
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
        />
        {searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-10 overflow-hidden">
            {searchResults.map((p) => (
              <Link
                key={p.id}
                href={`/messages/${p.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                onClick={() => { setSearch(''); setSearchResults([]) }}
              >
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white text-sm font-bold">
                    {p.full_name?.[0] ?? p.username?.[0]}
                  </div>
                )}
                <div>
                  <p className="font-medium text-sm text-gray-900">{p.full_name || p.username}</p>
                  <p className="text-xs text-gray-400">@{p.username}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Conversation list */}
      {conversations.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <MessageCircle size={48} className="mx-auto mb-3 text-gray-200" />
          <p className="font-medium">No conversations yet</p>
          <p className="text-sm mt-1">Search for a user above to start chatting</p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map(({ partner, lastMessage, unreadCount }) => (
            <Link
              key={partner.id}
              href={`/messages/${partner.id}`}
              className="flex items-center gap-4 bg-white border border-gray-100 rounded-2xl p-4 hover:shadow-md transition-shadow"
            >
              {partner.avatar_url ? (
                <img src={partner.avatar_url} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-bold text-lg shrink-0">
                  {partner.full_name?.[0] ?? partner.username?.[0]}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className={`font-semibold text-sm ${unreadCount > 0 ? 'text-gray-900' : 'text-gray-700'}`}>
                    {partner.full_name || partner.username}
                  </p>
                  <span className="text-xs text-gray-400 shrink-0">{timeAgo(lastMessage.created_at)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p className={`text-sm truncate ${unreadCount > 0 ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
                    {lastMessage.sender_id === userId ? 'You: ' : ''}{lastMessage.body}
                  </p>
                  {unreadCount > 0 && (
                    <span className="shrink-0 bg-orange-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                      {unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
