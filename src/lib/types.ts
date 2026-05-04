export type ActivityType = 'run' | 'ride' | 'swim' | 'walk' | 'hike' | 'workout'
export type GoalPeriod = 'weekly' | 'monthly' | 'yearly'
export type GoalMetric = 'distance' | 'duration' | 'elevation' | 'activities'

export interface Goal {
  id: string
  user_id: string
  type: GoalMetric
  period: GoalPeriod
  activity_type: ActivityType | 'all'
  target_value: number
  is_active: boolean
  created_at: string
}

export interface Profile {
  id: string
  username: string
  full_name: string
  avatar_url: string
  bio: string
  location: string
  unit_system: 'metric' | 'imperial'
  dark_mode: boolean
  strava_id: string | null
  created_at: string
}

export interface Achievement {
  id: string
  user_id: string
  achievement_id: string
  activity_id: string | null
  earned_at: string
}

export interface ActivityPhoto {
  id: string
  activity_id: string
  user_id: string
  url: string
  position: number
  created_at: string
}

export interface Activity {
  id: string
  user_id: string
  title: string
  type: ActivityType
  distance: number
  duration: number
  elevation_gain: number
  avg_pace: number
  avg_speed: number
  calories: number
  gpx_data: GpxPoint[] | null
  start_latlng: [number, number] | null
  description: string
  is_public: boolean
  kudos_count: number
  photo_url: string | null
  created_at: string
  profiles?: Profile
  activity_photos?: ActivityPhoto[]
}

export interface GpxPoint {
  lat: number
  lng: number
  ele: number
  time: string
}

export interface Kudos {
  id: string
  activity_id: string
  user_id: string
  created_at: string
}

export interface Comment {
  id: string
  activity_id: string
  user_id: string
  body: string
  created_at: string
  profiles?: Pick<Profile, 'username' | 'full_name' | 'avatar_url'>
}

export type NotificationType = 'kudos' | 'follow' | 'comment'

export interface Notification {
  id: string
  user_id: string      // recipient
  actor_id: string     // who triggered it
  type: NotificationType
  activity_id: string | null
  is_read: boolean
  created_at: string
  actor?: Pick<Profile, 'username' | 'full_name' | 'avatar_url'>
  activity?: Pick<Activity, 'title'>
}

// ─── Phase 5 ──────────────────────────────────────────────────────────────

export interface Message {
  id: string
  sender_id: string
  recipient_id: string
  body: string
  is_read: boolean
  created_at: string
  sender?: Pick<Profile, 'id' | 'username' | 'full_name' | 'avatar_url'>
  recipient?: Pick<Profile, 'id' | 'username' | 'full_name' | 'avatar_url'>
}

export interface Route {
  id: string
  user_id: string
  name: string
  description: string | null
  activity_type: ActivityType
  gpx_data: GpxPoint[] | null
  distance: number | null
  elevation_gain: number | null
  is_public: boolean
  star_count: number
  created_at: string
  profiles?: Pick<Profile, 'username' | 'full_name' | 'avatar_url'>
}

export interface TrainingPlan {
  id: string
  user_id: string
  title: string
  description: string | null
  duration_weeks: number
  activity_type: ActivityType | 'all'
  is_public: boolean
  created_at: string
  profiles?: Pick<Profile, 'username' | 'full_name' | 'avatar_url'>
  days?: TrainingPlanDay[]
}

export interface TrainingPlanDay {
  id: string
  plan_id: string
  week: number
  day_of_week: number   // 0=Mon … 6=Sun
  activity_type: ActivityType | 'rest'
  target_distance: number | null  // meters
  target_duration: number | null  // seconds
  notes: string | null
}

// ─── Phase 6 ──────────────────────────────────────────────────────────────

export interface Challenge {
  id: string
  creator_id: string
  title: string
  description: string | null
  activity_type: ActivityType | 'all'
  metric: 'distance' | 'duration' | 'elevation' | 'activities'
  target_value: number
  starts_at: string
  ends_at: string
  is_public: boolean
  participant_count: number
  created_at: string
  profiles?: Pick<Profile, 'username' | 'full_name' | 'avatar_url'>
}

export interface ChallengeParticipant {
  challenge_id: string
  user_id: string
  progress: number
  joined_at: string
  profiles?: Pick<Profile, 'username' | 'full_name' | 'avatar_url'>
}

export interface Club {
  id: string
  owner_id: string
  name: string
  description: string | null
  activity_type: ActivityType | 'all'
  avatar_url: string | null
  is_public: boolean
  member_count: number
  created_at: string
  profiles?: Pick<Profile, 'username' | 'full_name' | 'avatar_url'>
}

export interface ClubMember {
  club_id: string
  user_id: string
  role: 'owner' | 'member'
  joined_at: string
  profiles?: Pick<Profile, 'username' | 'full_name' | 'avatar_url'>
}

export interface Segment {
  id: string
  user_id: string
  name: string
  activity_type: ActivityType
  polyline: GpxPoint[]
  distance: number
  elevation_gain: number | null
  is_public: boolean
  created_at: string
  profiles?: Pick<Profile, 'username' | 'full_name' | 'avatar_url'>
}

export interface SegmentEffort {
  id: string
  segment_id: string
  activity_id: string
  user_id: string
  elapsed_time: number   // seconds
  is_pr: boolean
  created_at: string
  profiles?: Pick<Profile, 'username' | 'full_name' | 'avatar_url'>
  activities?: Pick<Activity, 'title' | 'created_at'>
}
