import Link from 'next/link'
import { Activity, BarChart2, Map, Users, Zap, Shield, Heart } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden py-28 px-4">
        {/* Background blobs */}
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-orange-100 rounded-full blur-3xl opacity-60 pointer-events-none" />
        <div className="absolute -bottom-20 -left-40 w-[500px] h-[500px] bg-blue-50 rounded-full blur-3xl opacity-70 pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 bg-orange-50 border border-orange-200 text-orange-600 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
            <Zap size={13} /> Free forever · No paywalls · No subscriptions
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 text-gray-900 leading-tight">
            The fitness app{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-red-500 to-pink-500">
              you'll actually love
            </span>
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            Track runs, rides, swims & more. See beautiful maps, crush personal records,
            and celebrate with your community — all completely free.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/signup"
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-8 py-4 rounded-2xl font-semibold text-lg shadow-lg shadow-orange-200 transition-all hover:shadow-xl hover:-translate-y-0.5"
            >
              Start for Free →
            </Link>
            <Link
              href="/login"
              className="bg-white border border-gray-200 hover:border-gray-300 text-gray-700 px-8 py-4 rounded-2xl font-semibold text-lg shadow-sm transition-all hover:shadow-md"
            >
              Sign In
            </Link>
          </div>

          {/* Social proof */}
          <div className="flex items-center justify-center gap-6 mt-10 text-sm text-gray-400">
            <span>✓ No credit card</span>
            <span>✓ GPX import</span>
            <span>✓ Open source</span>
          </div>
        </div>
      </section>

      {/* Stats banner */}
      <section className="py-10 px-4 bg-gradient-to-r from-orange-500 to-red-500">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-6 text-white text-center">
          {[
            { value: '6', label: 'Activity Types' },
            { value: 'GPX', label: 'Route Import' },
            { value: '100%', label: 'Free Forever' },
          ].map(({ value, label }) => (
            <div key={label}>
              <div className="text-3xl font-extrabold">{value}</div>
              <div className="text-orange-100 text-sm mt-1">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-4 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-extrabold text-gray-900 mb-3">
              Everything you need.
            </h2>
            <p className="text-gray-500 text-lg">Built for athletes who hate paywalls.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Activity, title: 'Activity Logging', desc: 'Log runs, rides, swims, hikes & more. Upload GPX files to import your GPS routes instantly.', color: 'bg-orange-50 text-orange-500', border: 'hover:border-orange-200' },
              { icon: Map, title: 'Interactive Maps', desc: 'Beautiful route visualization on OpenStreetMap. See start, finish and elevation profile all in one view.', color: 'bg-blue-50 text-blue-500', border: 'hover:border-blue-200' },
              { icon: BarChart2, title: 'Deep Analytics', desc: 'Weekly distance, pace trends, elevation gained — every metric you care about in beautiful charts.', color: 'bg-green-50 text-green-600', border: 'hover:border-green-200' },
              { icon: Users, title: 'Social Feed', desc: 'Follow friends, give kudos, celebrate PRs together. Your own community, without algorithmic BS.', color: 'bg-purple-50 text-purple-500', border: 'hover:border-purple-200' },
              { icon: Heart, title: 'Kudos & Reactions', desc: 'Cheer on your training partners. One tap kudos on every activity in the feed.', color: 'bg-pink-50 text-pink-500', border: 'hover:border-pink-200' },
              { icon: Shield, title: 'You Own Your Data', desc: 'No vendor lock-in. Export everything. Self-hostable. Your fitness data is yours forever.', color: 'bg-slate-100 text-slate-600', border: 'hover:border-slate-300' },
            ].map(({ icon: Icon, title, desc, color, border }) => (
              <div key={title} className={`bg-white border border-gray-100 ${border} rounded-2xl p-6 shadow-sm hover:shadow-md transition-all`}>
                <div className={`w-11 h-11 ${color} rounded-xl flex items-center justify-center mb-4`}>
                  <Icon size={22} />
                </div>
                <h3 className="font-bold text-gray-900 text-lg mb-2">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Activity types */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Track any sport</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              { emoji: '🏃', label: 'Run', color: 'bg-orange-50 text-orange-700 border-orange-200' },
              { emoji: '🚴', label: 'Ride', color: 'bg-blue-50 text-blue-700 border-blue-200' },
              { emoji: '🏊', label: 'Swim', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
              { emoji: '🚶', label: 'Walk', color: 'bg-green-50 text-green-700 border-green-200' },
              { emoji: '🥾', label: 'Hike', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
              { emoji: '💪', label: 'Workout', color: 'bg-purple-50 text-purple-700 border-purple-200' },
            ].map(({ emoji, label, color }) => (
              <div key={label} className={`flex items-center gap-2 border px-5 py-2.5 rounded-full text-sm font-semibold ${color}`}>
                <span className="text-lg">{emoji}</span> {label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 bg-gradient-to-br from-orange-500 via-red-500 to-pink-500 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl font-extrabold mb-4">Ready to crush your goals?</h2>
          <p className="text-orange-100 text-lg mb-8">Join athletes who track smarter, not harder.</p>
          <Link
            href="/signup"
            className="inline-block bg-white text-orange-600 hover:bg-orange-50 px-10 py-4 rounded-2xl font-bold text-lg shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
          >
            Create Free Account →
          </Link>
        </div>
      </section>
    </div>
  )
}



