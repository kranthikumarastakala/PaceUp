import type { Activity } from './types'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface AchievementDef {
  id: string
  name: string
  description: string
  icon: string
  /** Tailwind classes for badge bg + text + border */
  color: string
  check: (activities: Activity[]) => boolean
}

function hasStreakOf(days: number) {
  return (activities: Activity[]): boolean => {
    if (activities.length === 0) return false
    const daySet = new Set(
      activities.map((a) => new Date(a.created_at).toISOString().slice(0, 10))
    )
    const days_arr = [...daySet].sort()
    let streak = 1, max = 1
    for (let i = 1; i < days_arr.length; i++) {
      const prev = new Date(days_arr[i - 1])
      const curr = new Date(days_arr[i])
      const diff = (curr.getTime() - prev.getTime()) / 86400000
      if (diff === 1) { streak++; max = Math.max(max, streak) }
      else streak = 1
    }
    return max >= days
  }
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_activity',
    name: 'First Steps',
    description: 'Log your first activity',
    icon: '🎉',
    color: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    check: (acts) => acts.length >= 1,
  },
  {
    id: 'first_run',
    name: 'Runner',
    description: 'Complete your first run',
    icon: '🏃',
    color: 'bg-orange-50 text-orange-700 border-orange-200',
    check: (acts) => acts.some((a) => a.type === 'run'),
  },
  {
    id: 'first_ride',
    name: 'Cyclist',
    description: 'Complete your first ride',
    icon: '🚴',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    check: (acts) => acts.some((a) => a.type === 'ride'),
  },
  {
    id: 'first_swim',
    name: 'Swimmer',
    description: 'Complete your first swim',
    icon: '🏊',
    color: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    check: (acts) => acts.some((a) => a.type === 'swim'),
  },
  {
    id: 'run_5k',
    name: '5K Club',
    description: 'Complete a 5K run',
    icon: '🏅',
    color: 'bg-green-50 text-green-700 border-green-200',
    check: (acts) => acts.some((a) => a.type === 'run' && (a.distance ?? 0) >= 5000),
  },
  {
    id: 'run_10k',
    name: '10K Finisher',
    description: 'Complete a 10K run',
    icon: '🥈',
    color: 'bg-slate-50 text-slate-700 border-slate-200',
    check: (acts) => acts.some((a) => a.type === 'run' && (a.distance ?? 0) >= 10000),
  },
  {
    id: 'run_half',
    name: 'Half Marathoner',
    description: 'Complete a half marathon',
    icon: '🥇',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    check: (acts) => acts.some((a) => a.type === 'run' && (a.distance ?? 0) >= 21097),
  },
  {
    id: 'run_marathon',
    name: 'Marathoner',
    description: 'Complete a full marathon',
    icon: '👑',
    color: 'bg-purple-50 text-purple-700 border-purple-200',
    check: (acts) => acts.some((a) => a.type === 'run' && (a.distance ?? 0) >= 42195),
  },
  {
    id: 'century_ride',
    name: 'Century Rider',
    description: 'Complete a 100K ride',
    icon: '🚵',
    color: 'bg-blue-50 text-blue-800 border-blue-200',
    check: (acts) => acts.some((a) => a.type === 'ride' && (a.distance ?? 0) >= 100000),
  },
  {
    id: 'dist_100km',
    name: '100km Club',
    description: 'Log 100km total distance',
    icon: '💯',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    check: (acts) => acts.reduce((s, a) => s + (a.distance ?? 0), 0) >= 100000,
  },
  {
    id: 'dist_500km',
    name: '500km Warrior',
    description: 'Log 500km total distance',
    icon: '⚡',
    color: 'bg-orange-50 text-orange-800 border-orange-300',
    check: (acts) => acts.reduce((s, a) => s + (a.distance ?? 0), 0) >= 500000,
  },
  {
    id: 'dist_1000km',
    name: '1000km Legend',
    description: 'Log 1000km total distance',
    icon: '🔥',
    color: 'bg-red-50 text-red-700 border-red-200',
    check: (acts) => acts.reduce((s, a) => s + (a.distance ?? 0), 0) >= 1000000,
  },
  {
    id: 'everest',
    name: 'Everester',
    description: 'Accumulate 8,848m elevation',
    icon: '🏔️',
    color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    check: (acts) => acts.reduce((s, a) => s + (a.elevation_gain ?? 0), 0) >= 8848,
  },
  {
    id: 'early_bird',
    name: 'Early Bird',
    description: 'Log an activity before 6am',
    icon: '🌅',
    color: 'bg-yellow-50 text-yellow-800 border-yellow-300',
    check: (acts) => acts.some((a) => new Date(a.created_at).getHours() < 6),
  },
  {
    id: 'streak_7',
    name: 'Week Streak',
    description: 'Active 7 days in a row',
    icon: '📅',
    color: 'bg-teal-50 text-teal-700 border-teal-200',
    check: hasStreakOf(7),
  },
  {
    id: 'streak_30',
    name: 'Month Streak',
    description: 'Active 30 days in a row',
    icon: '🗓️',
    color: 'bg-violet-50 text-violet-700 border-violet-200',
    check: hasStreakOf(30),
  },
  {
    id: 'social_10',
    name: 'Community Star',
    description: 'Log 10 public activities',
    icon: '⭐',
    color: 'bg-pink-50 text-pink-700 border-pink-200',
    check: (acts) => acts.filter((a) => a.is_public).length >= 10,
  },
]

/**
 * Checks all achievements against current activity list.
 * Inserts newly earned achievements and returns their definitions.
 * Safe to call after every activity save.
 */
export async function checkAndAwardAchievements(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  activities: Activity[]
): Promise<AchievementDef[]> {
  const { data: earned } = await supabase
    .from('user_achievements')
    .select('achievement_id')
    .eq('user_id', userId)

  const earnedIds = new Set((earned ?? []).map((e: { achievement_id: string }) => e.achievement_id))
  const newlyEarned = ACHIEVEMENTS.filter((a) => !earnedIds.has(a.id) && a.check(activities))

  if (newlyEarned.length > 0) {
    await supabase.from('user_achievements').insert(
      newlyEarned.map((a) => ({ user_id: userId, achievement_id: a.id }))
    )
  }

  return newlyEarned
}
