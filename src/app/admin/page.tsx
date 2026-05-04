'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { AdminFlag, Profile } from '@/lib/types'
import { Shield, CheckCircle, XCircle, Flag, Users, Activity, BarChart2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'

// Admin check: this page enforces that the user's profile has username === 'admin'
// For production, use a proper role system (e.g., profiles.role = 'admin')

interface PlatformStats {
  users: number
  activities: number
  flags: number
  openFlags: number
}

export default function AdminPage() {
  const supabase = createClient()
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [flags, setFlags] = useState<(AdminFlag & { reporter: Pick<Profile,'username'> | null })[]>([])
  const [tab, setTab] = useState<'overview' | 'flags' | 'users'>('overview')
  const [users, setUsers] = useState<Profile[]>([])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Simple admin check — username must be 'admin'
      const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).single()
      if ((profile as { username: string } | null)?.username !== 'admin') {
        router.push('/dashboard')
        return
      }
      setAuthorized(true)

      const [
        { count: userCount },
        { count: actCount },
        { count: flagCount },
        { count: openCount },
        { data: flagData },
        { data: userData },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('activities').select('*', { count: 'exact', head: true }),
        supabase.from('admin_flags').select('*', { count: 'exact', head: true }),
        supabase.from('admin_flags').select('*', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('admin_flags').select('*, reporter:reporter_id(username)').order('created_at', { ascending: false }).limit(50),
        supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(100),
      ])

      setStats({ users: userCount ?? 0, activities: actCount ?? 0, flags: flagCount ?? 0, openFlags: openCount ?? 0 })
      setFlags((flagData ?? []) as (AdminFlag & { reporter: Pick<Profile,'username'> | null })[])
      setUsers((userData ?? []) as Profile[])
      setLoading(false)
    }
    load()
  }, [])

  const handleFlag = async (flagId: string, status: 'reviewed' | 'dismissed') => {
    await supabase.from('admin_flags').update({ status }).eq('id', flagId)
    setFlags(fs => fs.map(f => f.id === flagId ? { ...f, status } : f))
  }

  if (loading) return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-pulse space-y-4">
      {[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-2xl" style={{ background: 'var(--surface-border)' }} />)}
    </div>
  )

  if (!authorized) return null

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-500">
          <Shield size={16} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold">Admin Dashboard</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Platform moderation &amp; statistics</p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Users', value: stats.users, icon: Users, color: '#3b82f6' },
            { label: 'Activities', value: stats.activities, icon: Activity, color: '#f97316' },
            { label: 'Total Flags', value: stats.flags, icon: Flag, color: '#8b5cf6' },
            { label: 'Open Flags', value: stats.openFlags, icon: Flag, color: '#ef4444' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-2xl p-4 border" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: color + '20' }}>
                  <Icon size={14} style={{ color }} />
                </div>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
              </div>
              <p className="text-2xl font-extrabold" style={{ color }}>{value.toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg)' }}>
        {(['overview', 'flags', 'users'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 py-2 text-sm font-semibold rounded-lg capitalize transition-all"
            style={{
              background: tab === t ? 'var(--surface)' : 'transparent',
              color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
            }}>
            {t === 'flags' ? `Flags (${flags.filter(f => f.status === 'open').length} open)` : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="rounded-2xl p-5 border" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={16} className="text-orange-500" />
            <h2 className="font-bold text-sm">Platform Health</h2>
          </div>
          <div className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <p>Total registered users: <strong>{stats?.users.toLocaleString()}</strong></p>
            <p>Total activities logged: <strong>{stats?.activities.toLocaleString()}</strong></p>
            <p>Activities per user (avg): <strong>{stats && stats.users > 0 ? (stats.activities / stats.users).toFixed(1) : '—'}</strong></p>
            <p>Open moderation flags: <strong style={{ color: stats?.openFlags ? '#ef4444' : '#22c55e' }}>{stats?.openFlags}</strong></p>
          </div>
        </div>
      )}

      {tab === 'flags' && (
        <div className="space-y-3">
          {flags.length === 0 ? (
            <p className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>No flags submitted</p>
          ) : flags.map(f => (
            <div key={f.id} className="rounded-2xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex gap-2 items-center mb-1 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: f.status === 'open' ? '#fef2f2' : '#f0fdf4', color: f.status === 'open' ? '#ef4444' : '#22c55e' }}>
                      {f.status}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{f.content_type}</span>
                  </div>
                  <p className="text-sm font-semibold">{f.reason}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    By @{f.reporter?.username ?? 'unknown'} · {format(parseISO(f.created_at), 'MMM d, yyyy')}
                  </p>
                  <p className="text-xs font-mono mt-1 truncate" style={{ color: 'var(--text-muted)' }}>Content ID: {f.content_id}</p>
                </div>
                {f.status === 'open' && (
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => handleFlag(f.id, 'reviewed')}
                      className="p-2 rounded-lg hover:bg-green-50 text-green-600 transition-colors" title="Mark reviewed">
                      <CheckCircle size={16} />
                    </button>
                    <button onClick={() => handleFlag(f.id, 'dismissed')}
                      className="p-2 rounded-lg hover:bg-gray-50 transition-colors" title="Dismiss" style={{ color: 'var(--text-muted)' }}>
                      <XCircle size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'users' && (
        <div className="space-y-2">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Showing most recent 100 users</p>
          {users.map(u => (
            <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center font-bold text-orange-600 text-sm">
                {(u.full_name || u.username || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{u.full_name || u.username}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>@{u.username} · Joined {format(parseISO(u.created_at), 'MMM d, yyyy')}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
