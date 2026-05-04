'use client'

import { useState } from 'react'
import type { ReactionEmoji } from '@/lib/types'

const EMOJIS: ReactionEmoji[] = ['🔥', '💪', '👏', '😮', '❤️']

interface Props {
  activityId: string
  initialReactions: { emoji: ReactionEmoji; count: number; reacted: boolean }[]
}

export function ReactionBar({ activityId, initialReactions }: Props) {
  const [reactions, setReactions] = useState(initialReactions)

  const toggle = async (emoji: ReactionEmoji) => {
    const idx = reactions.findIndex(r => r.emoji === emoji)
    const current = reactions[idx]
    const action = current?.reacted ? 'remove' : 'add'

    // Optimistic update
    setReactions(prev => {
      const next = [...prev]
      if (idx >= 0) {
        next[idx] = { ...next[idx], reacted: !next[idx].reacted, count: next[idx].count + (action === 'add' ? 1 : -1) }
      } else {
        next.push({ emoji, count: 1, reacted: true })
      }
      return next
    })

    await fetch('/api/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activity_id: activityId, emoji, action }),
    })
  }

  // Build full emoji list merging initialReactions
  const emojiMap = new Map(reactions.map(r => [r.emoji, r]))

  return (
    <div className="flex flex-wrap gap-1.5">
      {EMOJIS.map(emoji => {
        const r = emojiMap.get(emoji)
        const active = r?.reacted ?? false
        const count = r?.count ?? 0
        return (
          <button
            key={emoji}
            onClick={() => toggle(emoji)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-sm border transition-all"
            style={{
              background: active ? '#f97316' + '20' : 'var(--surface)',
              borderColor: active ? '#f97316' : 'var(--surface-border)',
              color: active ? '#f97316' : 'var(--text-muted)',
              fontWeight: active ? 700 : 400,
            }}
          >
            <span>{emoji}</span>
            {count > 0 && <span className="text-xs">{count}</span>}
          </button>
        )
      })}
    </div>
  )
}
