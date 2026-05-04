'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Activity, Home, User, PlusCircle, BarChart2, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import type { User as SupabaseUser } from '@supabase/supabase-js'

const navLinks = [
  { href: '/dashboard', label: 'Feed', icon: Home },
  { href: '/activities', label: 'Activities', icon: Activity },
  { href: '/stats', label: 'Stats', icon: BarChart2 },
  { href: '/profile', label: 'Profile', icon: User },
]

export function Navbar() {
  const pathname = usePathname()
  const supabase = createClient()
  const [user, setUser] = useState<SupabaseUser | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) =>
      setUser(session?.user ?? null)
    )
    return () => listener.subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <nav className="fixed top-0 inset-x-0 z-50 h-16 bg-white/80 backdrop-blur border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 h-full flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <span className="text-orange-500">⚡</span>
          <span>PaceUp</span>
        </Link>

        {/* Nav links */}
        {user && (
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  pathname.startsWith(href)
                    ? 'bg-orange-500/10 text-orange-400'
                    : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'
                )}
              >
                <Icon size={16} />
                {label}
              </Link>
            ))}
          </div>
        )}

        {/* Right side */}
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link
                href="/activities/new"
                className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              >
                <PlusCircle size={15} />
                Log Activity
              </Link>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Sign out"
              >
                <LogOut size={16} />
              </button>
            </>
          ) : (
            <div className="flex gap-2">
              <Link
                href="/login"
                className="px-4 py-1.5 text-sm text-gray-700 hover:text-white transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg font-medium transition-colors"
              >
                Sign up free
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Mobile bottom nav */}
      {user && (
        <div className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 flex">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center py-2 text-xs gap-1 transition-colors',
                pathname.startsWith(href) ? 'text-orange-400' : 'text-gray-400'
              )}
            >
              <Icon size={20} />
              {label}
            </Link>
          ))}
          <Link
            href="/activities/new"
            className="flex-1 flex flex-col items-center justify-center py-2 text-xs gap-1 text-orange-400"
          >
            <PlusCircle size={20} />
            Log
          </Link>
        </div>
      )}
    </nav>
  )
}


