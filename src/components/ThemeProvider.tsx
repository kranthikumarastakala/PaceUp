'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const apply = (dark: boolean) => {
      if (dark) {
        document.documentElement.setAttribute('data-theme', 'dark')
      } else {
        document.documentElement.removeAttribute('data-theme')
      }
    }

    // Check localStorage for instant apply (before DB round-trip)
    const cached = localStorage.getItem('paceup_dark_mode')
    if (cached !== null) apply(cached === 'true')

    // Then sync from DB
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { data: prof } = await supabase
        .from('profiles')
        .select('dark_mode')
        .eq('id', data.user.id)
        .single()
      if (prof != null) {
        const dark = (prof as { dark_mode: boolean }).dark_mode ?? false
        apply(dark)
        localStorage.setItem('paceup_dark_mode', String(dark))
      }
    })
  }, [])

  return <>{children}</>
}
