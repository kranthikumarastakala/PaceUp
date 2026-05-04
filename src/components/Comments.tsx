'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ToastProvider'
import { timeAgo } from '@/lib/utils'
import type { Comment } from '@/lib/types'
import { Trash2, MessageCircle, Send } from 'lucide-react'

interface CommentsProps {
  activityId: string
  activityOwnerId?: string
}

export function Comments({ activityId, activityOwnerId }: CommentsProps) {
  const supabase = createClient()
  const { toast } = useToast()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [comments, setComments] = useState<Comment[]>([])
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [{ data: commentsData }, { data: { user } }] = await Promise.all([
        supabase
          .from('comments')
          .select('*, profiles(username, full_name, avatar_url)')
          .eq('activity_id', activityId)
          .order('created_at', { ascending: true }),
        supabase.auth.getUser(),
      ])
      setComments((commentsData as Comment[]) ?? [])
      setCurrentUserId(user?.id ?? null)
      setLoading(false)
    }
    load()
  }, [activityId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = body.trim()
    if (!trimmed || !currentUserId) return
    setSubmitting(true)

    const { data, error } = await supabase
      .from('comments')
      .insert({ activity_id: activityId, user_id: currentUserId, body: trimmed })
      .select('*, profiles(username, full_name, avatar_url)')
      .single()

    if (error) {
      toast(error.message, 'error')
    } else {
      setComments((prev) => [...prev, data as Comment])
      setBody('')
      textareaRef.current?.focus()
      // Notify activity owner (skip self-comments)
      if (activityOwnerId && currentUserId !== activityOwnerId) {
        await supabase.from('notifications').insert({
          user_id: activityOwnerId,
          actor_id: currentUserId,
          type: 'comment',
          activity_id: activityId,
        })
      }
    }
    setSubmitting(false)
  }

  const handleDelete = async (commentId: string) => {
    const { error } = await supabase.from('comments').delete().eq('id', commentId)
    if (error) {
      toast(error.message, 'error')
    } else {
      setComments((prev) => prev.filter((c) => c.id !== commentId))
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit(e as unknown as React.FormEvent)
    }
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
      <h3 className="font-semibold text-sm text-gray-500 mb-4 flex items-center gap-1.5">
        <MessageCircle size={14} />
        Comments {comments.length > 0 && `(${comments.length})`}
      </h3>

      {/* Comment list */}
      {loading ? (
        <div className="space-y-3 mb-4">
          {[1, 2].map((i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-gray-100 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-gray-100 rounded w-1/4" />
                <div className="h-3 bg-gray-100 rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-gray-400 mb-4">No comments yet. Be the first!</p>
      ) : (
        <ul className="space-y-4 mb-4">
          {comments.map((comment) => {
            const initials = (comment.profiles?.full_name || comment.profiles?.username || '?')
              .charAt(0)
              .toUpperCase()
            return (
              <li key={comment.id} className="flex gap-3 group">
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 text-xs font-bold flex items-center justify-center shrink-0">
                  {comment.profiles?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={comment.profiles.avatar_url}
                      alt={initials}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </div>
                {/* Body */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold text-gray-800">
                      {comment.profiles?.full_name || comment.profiles?.username}
                    </span>
                    <span className="text-xs text-gray-400">{timeAgo(comment.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-700 mt-0.5 break-words">{comment.body}</p>
                </div>
                {/* Delete own comment */}
                {comment.user_id === currentUserId && (
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500 transition-all rounded"
                    title="Delete comment"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* Input */}
      {currentUserId ? (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            maxLength={1000}
            placeholder="Add a comment… (⌘↵ to send)"
            className="flex-1 bg-slate-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all resize-none"
          />
          <button
            type="submit"
            disabled={submitting || !body.trim()}
            className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white transition-colors"
            title="Send"
          >
            <Send size={15} />
          </button>
        </form>
      ) : (
        <p className="text-sm text-gray-400">
          <a href="/login" className="text-orange-500 hover:underline font-medium">Sign in</a> to leave a comment.
        </p>
      )}
    </div>
  )
}
