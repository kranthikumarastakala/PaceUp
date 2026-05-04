'use client'

import { ACHIEVEMENTS, type AchievementDef } from '@/lib/achievements'
import type { Achievement } from '@/lib/types'

interface Props {
  /** Rows from user_achievements table */
  earned: Achievement[]
  /** Show all locked achievements dimmed, or only earned ones */
  showLocked?: boolean
}

export function AchievementBadges({ earned, showLocked = false }: Props) {
  const earnedIds = new Set(earned.map((e) => e.achievement_id))

  const visible: AchievementDef[] = showLocked
    ? ACHIEVEMENTS
    : ACHIEVEMENTS.filter((a) => earnedIds.has(a.id))

  if (visible.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <div className="text-4xl mb-2">🏅</div>
        <p className="text-sm">No achievements yet — keep moving!</p>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {visible.map((def) => {
        const isEarned = earnedIds.has(def.id)
        return (
          <div
            key={def.id}
            title={def.description}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
              isEarned
                ? def.color
                : 'bg-gray-50 text-gray-300 border-gray-100 opacity-50'
            }`}
          >
            <span className={isEarned ? '' : 'grayscale'}>{def.icon}</span>
            {def.name}
          </div>
        )
      })}
    </div>
  )
}
