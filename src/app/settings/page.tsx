'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ToastProvider'
import { Settings, Ruler, Bell, LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SettingsPage() {
  const supabase = createClient()
  const { toast } = useToast()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [unitSystem, setUnitSystem] = useState<'metric' | 'imperial'>('metric')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase
        .from('profiles')
        .select('unit_system')
        .eq('id', user.id)
        .single()
      if (data?.unit_system) setUnitSystem(data.unit_system as 'metric' | 'imperial')
      setLoading(false)
    }
    load()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase
      .from('profiles')
      .update({ unit_system: unitSystem })
      .eq('id', user.id)
    if (error) {
      toast(error.message, 'error')
    } else {
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
      {/* Header */}
      <div className="flex items-center gap-3">
        <Settings size={22} className="text-orange-500" />
        <h1 className="text-2xl font-extrabold text-gray-900">Settings</h1>
      </div>

      {/* Units */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Ruler size={16} className="text-gray-400" />
          <h2 className="font-bold text-gray-800">Units of Measurement</h2>
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
                  : 'border-gray-100 bg-gray-50 hover:border-gray-200'
              }`}
            >
              <div className={`font-semibold capitalize ${unitSystem === sys ? 'text-orange-700' : 'text-gray-700'}`}>
                {sys}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {sys === 'metric' ? 'km, m, km/h, /km' : 'miles, ft, mph, /mi'}
              </div>
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Affects how distances, pace, and elevation are displayed throughout the app.
        </p>
      </div>

      {/* Notifications placeholder */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Bell size={16} className="text-gray-400" />
          <h2 className="font-bold text-gray-800">Notifications</h2>
        </div>
        <div className="space-y-3">
          {[
            { label: 'Kudos on my activities', defaultOn: true },
            { label: 'Comments on my activities', defaultOn: true },
            { label: 'New followers', defaultOn: true },
          ].map(({ label }) => (
            <div key={label} className="flex items-center justify-between py-1">
              <span className="text-sm text-gray-700">{label}</span>
              <div className="relative w-9 h-5 rounded-full bg-orange-500">
                <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-white rounded-full shadow" />
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3">Notification preferences coming in a future update.</p>
      </div>

      {/* Account links */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-3">
        <h2 className="font-bold text-gray-800 mb-2">Account</h2>
        <Link
          href="/profile/edit"
          className="flex items-center justify-between py-2 text-sm text-gray-700 hover:text-orange-600 transition-colors"
        >
          Edit Profile
          <span className="text-gray-300">›</span>
        </Link>
        <div className="border-t border-gray-50" />
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 py-2 text-sm text-red-500 hover:text-red-700 transition-colors w-full"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>

      {/* Save */}
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
