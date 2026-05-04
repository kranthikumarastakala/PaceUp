'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Plus, ClipboardList } from 'lucide-react'
import { activityIcon, timeAgo } from '@/lib/utils'
import type { TrainingPlan } from '@/lib/types'

export default function TrainingPlansPage() {
  const supabase = createClient()
  const [myPlans, setMyPlans] = useState<TrainingPlan[]>([])
  const [publicPlans, setPublicPlans] = useState<TrainingPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [tab, setTab] = useState<'mine' | 'discover'>('mine')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUserId(user?.id ?? null)

      const [{ data: mine }, { data: pub }] = await Promise.all([
        user
          ? supabase.from('training_plans').select('*, profiles(username,full_name,avatar_url)').eq('user_id', user.id).order('created_at', { ascending: false })
          : Promise.resolve({ data: [] }),
        supabase.from('training_plans').select('*, profiles(username,full_name,avatar_url)').eq('is_public', true).order('created_at', { ascending: false }).limit(20),
      ])

      setMyPlans((mine as TrainingPlan[]) ?? [])
      setPublicPlans((pub as TrainingPlan[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const plans = tab === 'mine' ? myPlans : publicPlans.filter((p) => p.user_id !== userId)

  if (loading) return (
    <div className="max-w-3xl mx-auto px-4 py-8 animate-pulse space-y-3">
      {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-white rounded-2xl" />)}
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Training Plans</h1>
          <p className="text-gray-500 text-sm mt-0.5">Structured weekly training programs</p>
        </div>
        {userId && (
          <Link
            href="/training/new"
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus size={16} /> New Plan
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {(['mine', 'discover'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'mine' ? 'My Plans' : 'Discover'}
          </button>
        ))}
      </div>

      {plans.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ClipboardList size={48} className="mx-auto mb-3 text-gray-200" />
          <p className="font-medium">{tab === 'mine' ? 'No training plans yet' : 'No public plans found'}</p>
          {tab === 'mine' && userId && (
            <Link href="/training/new" className="text-sm text-orange-500 hover:underline mt-2 inline-block">
              Create your first plan
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => (
            <Link
              key={plan.id}
              href={`/training/${plan.id}`}
              className="block bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{activityIcon(plan.activity_type === 'all' ? 'run' : plan.activity_type as never)}</span>
                  <div>
                    <h3 className="font-semibold text-gray-900">{plan.title}</h3>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                      <span>{plan.duration_weeks} week{plan.duration_weeks > 1 ? 's' : ''}</span>
                      <span>·</span>
                      <span className="capitalize">{plan.activity_type}</span>
                      {tab === 'discover' && <><span>·</span><span>by @{plan.profiles?.username}</span></>}
                      <span>·</span>
                      <span>{timeAgo(plan.created_at)}</span>
                    </div>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${plan.is_public ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                  {plan.is_public ? 'Public' : 'Private'}
                </span>
              </div>
              {plan.description && (
                <p className="text-sm text-gray-400 mt-2 line-clamp-2">{plan.description}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
