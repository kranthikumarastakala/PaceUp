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
