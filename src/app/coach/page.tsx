'use client'

import { useState } from 'react'
import { Sparkles, RefreshCw, Brain } from 'lucide-react'

export default function CoachPage() {
  const [tips, setTips] = useState<string | null>(null)
  const [source, setSource] = useState<'openai' | 'offline' | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAdvice = async () => {
    setLoading(true)
    setError(null)
    setTips(null)

    try {
      const res = await fetch('/api/coach', { method: 'POST' })
      if (res.status === 401) { setError('Please log in to use the AI coach.'); return }
      if (!res.ok) { setError('Failed to fetch coaching advice. Please try again.'); return }

      const data = await res.json() as { tips: string; source: 'openai' | 'offline' }
      setTips(data.tips)
      setSource(data.source)
    } catch {
      setError('Network error. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }

  const bulletLines = tips
    ? tips
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0)
    : []

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Brain size={22} className="text-orange-500" />
        <h1 className="text-2xl font-extrabold">AI Performance Coach</h1>
      </div>

      {/* Intro */}
      <div className="rounded-2xl p-5 border" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shrink-0">
            <Sparkles size={18} className="text-white" />
          </div>
          <div>
            <h2 className="font-bold mb-1">Your Personal Training Coach</h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Analyzes your last 28 days of training and provides personalised coaching advice — 
              pacing, recovery, volume, and upcoming workouts.
              {' '}
              {source === 'openai'
                ? 'Powered by GPT-4o Mini.'
                : 'Smart offline analysis (add OPENAI_API_KEY to enable GPT coaching).'}
            </p>
          </div>
        </div>

        <button
          onClick={fetchAdvice}
          disabled={loading}
          className="mt-4 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:opacity-60 text-white py-3 rounded-xl font-semibold transition-all shadow-md shadow-orange-200"
        >
          {loading ? (
            <>
              <RefreshCw size={16} className="animate-spin" />
              Analyzing your training…
            </>
          ) : (
            <>
              <Sparkles size={16} />
              {tips ? 'Refresh Advice' : 'Get My Coaching Report'}
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-2xl p-4 border border-red-200 bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      {/* Tips */}
      {bulletLines.length > 0 && (
        <div className="rounded-2xl p-5 border shadow-sm space-y-3" style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)' }}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold flex items-center gap-2"><Sparkles size={16} className="text-orange-500" />Your Coaching Report</h2>
            {source && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                source === 'openai' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {source === 'openai' ? '✦ GPT-4o Mini' : 'Smart Analysis'}
              </span>
            )}
          </div>

          <div className="space-y-3">
            {bulletLines.map((line, i) => {
              const cleaned = line.replace(/^[•\-\*]\s*/, '')
              return (
                <div key={i} className="flex gap-3 p-3 rounded-xl" style={{ background: 'var(--bg)' }}>
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-red-400 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <p className="text-sm leading-relaxed">{cleaned}</p>
                </div>
              )
            })}
          </div>

          <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
            Based on your last 28 days of training · Not a substitute for professional medical advice
          </p>
        </div>
      )}

      {/* Empty state */}
      {!tips && !loading && !error && (
        <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
          <Brain size={48} className="mx-auto mb-4 opacity-20" />
          <p className="font-medium">Your coaching report is just a tap away.</p>
          <p className="text-sm mt-1">We'll analyze your recent training and give you personalised tips.</p>
        </div>
      )}
    </div>
  )
}
