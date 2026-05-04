'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ToastProvider'
import { Settings, Ruler, Bell, LogOut, Moon } from 'lucide-react'
import { PushNotificationToggle } from '@/components/PushNotificationToggle'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SettingsPage() {
  const supabase = createClient()
  const { toast } = useToast()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [unitSystem, setUnitSystem] = useState<'metric' | 'imperial'>('metric')
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase
        .from('profiles')
        .select('unit_system, dark_mode')
        .eq('id', user.id)
        .single()
      if (data?.unit_system) setUnitSystem(data.unit_system as 'metric' | 'imperial')
      if (data != null) setDarkMode((data as { dark_mode: boolean }).dark_mode ?? false)
      setLoading(false)
    }
    load()
  }, [])

  // Live preview dark mode as toggle flips
  useEffect(() => {
    if (darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark')
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
  }, [darkMode])

  const handleSave = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase
      .from('profiles')
      .update({ unit_system: unitSystem, dark_mode: darkMode })
      .eq('id', user.id)
    if (error) {
      toast(error.message, 'error')
    } else {
      localStorage.setItem('paceup_dark_mode', String(darkMode))
      toast('Settings saved!', 'success')
    }
    setSaving(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-4 animate-pulse">
      <div className="h-8 bg-gray-100 rounded w-1/3" />
      {[1, 2].map((i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl" />)}
    </div>
  )

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Settings size={22} className="text-orange-500" />
        <h1 className="text-2xl font-extrabold">Settings</h1>
      </div>

      {/* Units */}
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Ruler size={16} className="text-gray-400" />
          <h2 className="font-bold">Units of Measurement</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(['metric', 'imperial'] as const).map((sys) => (
            <button
              key={sys}
              type="button"
              onClick={() => setUnitSystem(sys)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                unitSystem === sys
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-100 hover:border-gray-200'
              }`}
            >
              <div className={`font-semibold capitalize ${unitSystem === sys ? 'text-orange-700' : ''}`}>
                {sys}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {sys === 'metric' ? 'km, m, km/h, /km' : 'miles, ft, mph, /mi'}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Dark Mode */}
      <div className="rounded-2xl p-6 shadow-sm border" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Moon size={16} className="text-gray-400" />
          <h2 className="font-bold">Appearance</h2>
        </div>
        <label className="flex items-center justify-between cursor-pointer py-1">
          <div>
            <p className="text-sm font-medium">Dark Mode</p>
            <p className="text-xs text-gray-400 mt-0.5">Easy on the eyes at night</p>
          </div>
          <div
            onClick={() => setDarkMode(!darkMode)}
            className={`relative w-11 h-6 rounded-full transition-colors ${darkMode ? 'bg-orange-500' : 'bg-gray-300'}`}
          >
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${darkMode ? 'translate-x-6' : 'translate-x-1'}`} />
          </div>
        </label>
      </div>

      {/* Notifications */}
      <div className="rounded-2xl p-6 shadow-sm border" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Bell size={16} className="text-gray-400" />
          <h2 className="font-bold">Notifications</h2>
        </div>
        <div className="space-y-3">
          {['Kudos on my activities', 'Comments on my activities', 'New followers'].map((label) => (
            <div key={label} className="flex items-center justify-between py-1">
              <span className="text-sm">{label}</span>
              <div className="relative w-9 h-5 rounded-full bg-orange-500">
                <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-white rounded-full shadow" />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--surface-border)' }}>
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Push Notifications</p>
          <PushNotificationToggle />
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Requires NEXT_PUBLIC_VAPID_PUBLIC_KEY in .env.local</p>
        </div>
      </div>

      {/* Account */}
      <div className="rounded-2xl p-6 shadow-sm border" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        <h2 className="font-bold mb-3">Account</h2>
        <Link
          href="/profile/edit"
          className="flex items-center justify-between py-2 text-sm hover:text-orange-600 transition-colors"
        >
          Edit Profile
          <span className="text-gray-300">›</span>
        </Link>
        <div className="border-t" style={{ borderColor: 'var(--surface-border)' }} />
        <Link
          href="/strava/connect"
          className="flex items-center justify-between py-2 text-sm hover:text-orange-600 transition-colors"
        >
          Connect Strava Account
          <span className="text-gray-300">›</span>
        </Link>
        <div className="border-t" style={{ borderColor: 'var(--surface-border)' }} />
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 py-2 text-sm text-red-500 hover:text-red-700 transition-colors w-full"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:opacity-50 text-white py-4 rounded-2xl font-bold shadow-lg shadow-orange-200 transition-all"
      >
        {saving ? 'Saving…' : 'Save Settings'}
      </button>
    </div>
  )
}
