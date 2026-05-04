'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Activity, Home, User, BarChart2, Target, Trophy, Settings, MessageCircle, Map, ClipboardList, TrendingUp, CalendarDays, Shield, Layers, Brain, Zap, Menu, X, Search, PlusCircle, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { NotificationBell } from '@/components/NotificationBell'

const navLinks = [
  { href: '/dashboard', label: 'Feed', icon: Home },
  { href: '/activities', label: 'Activities', icon: Activity },
  { href: '/stats', label: 'Stats', icon: BarChart2 },
  { href: '/analytics', label: 'Analytics', icon: TrendingUp },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/goals', label: 'Goals', icon: Target },
  { href: '/challenges', label: 'Challenges', icon: Trophy },
  { href: '/clubs', label: 'Clubs', icon: Shield },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/segments', label: 'Segments', icon: Layers },
  { href: '/routes', label: 'Routes', icon: Map },
  { href: '/training', label: 'Training', icon: ClipboardList },
  { href: '/coach', label: 'AI Coach', icon: Brain },
  { href: '/messages', label: 'Messages', icon: MessageCircle },
  { href: '/strava/connect', label: 'Strava', icon: Zap },
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) =>
      setUser(session?.user ?? null)
    )
    return () => listener.subscription.unsubscribe()
  }, [])

  // Close drawer whenever the route changes
  useEffect(() => { setDrawerOpen(false) }, [pathname])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <>
      {/* ── Top bar ── */}
      <nav className="fixed top-0 inset-x-0 z-50 h-16 backdrop-blur border-b" style={{ background: 'color-mix(in srgb, var(--surface) 85%, transparent)', borderColor: 'var(--surface-border)' }}>
        <div className="max-w-6xl mx-auto px-4 h-full flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <span className="text-orange-500">⚡</span>
            <span>PaceUp</span>
          </Link>

          {/* Desktop nav links */}
          {user && (
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    pathname.startsWith(href)
                      ? 'bg-orange-500/10 text-orange-500'
                      : 'hover:bg-orange-500/5'
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
                {/* Search icon — desktop */}
                <Link
                  href="/search"
                  className="hidden md:flex p-2 hover:bg-orange-500/5 rounded-lg transition-colors"
                  title="Search"
                >
                  <Search size={18} />
                </Link>
                {/* Notification bell */}
                <NotificationBell userId={user.id} />
                <Link
                  href="/activities/new"
                  className="hidden sm:flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                >
                  <PlusCircle size={15} />
                  Log Activity
                </Link>
                <button
                  onClick={handleLogout}
                  className="hidden md:flex p-2 hover:bg-orange-500/5 rounded-lg transition-colors"
                  title="Sign out"
                >
                  <LogOut size={16} />
                </button>
                {/* Hamburger — visible only on mobile */}
                <button
                  onClick={() => setDrawerOpen((o) => !o)}
                  className="md:hidden p-2 hover:bg-orange-500/5 rounded-lg transition-colors"
                  aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
                >
                  {drawerOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
              </>
            ) : (
              <div className="flex gap-2">
                <Link
                  href="/login"
                  className="px-4 py-1.5 text-sm text-gray-700 hover:text-gray-900 transition-colors"
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
      </nav>

      {/* ── Mobile drawer backdrop ── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── Mobile drawer panel ── */}
      <div
        className={cn(
          'fixed top-16 right-0 bottom-0 z-40 w-72 shadow-2xl flex flex-col md:hidden transition-transform duration-300 ease-in-out',
          drawerOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        style={{ background: 'var(--surface)', borderLeft: '1px solid var(--surface-border)' }}
      >
        {user && (
          <>
            <nav className="flex-1 overflow-y-auto p-4 space-y-1">
              {navLinks.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors',
                    pathname.startsWith(href)
                      ? 'bg-orange-500/10 text-orange-600'
                      : 'hover:bg-orange-500/5'
                  )}
                >
                  <Icon size={18} />
                  {label}
                </Link>
              ))}
              {/* Search — mobile drawer */}
              <Link
                href="/search"
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors',
                  pathname === '/search'
                    ? 'bg-orange-500/10 text-orange-600'
                    : 'hover:bg-orange-500/5'
                )}
              >
                <Search size={18} />
                Search
              </Link>
              <Link
                href="/activities/new"
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 transition-colors mt-2"
              >
                <PlusCircle size={18} />
                Log Activity
              </Link>
            </nav>
            <div className="p-4 border-t" style={{ borderColor: 'var(--surface-border)' }}>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
              >
                <LogOut size={18} />
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}


