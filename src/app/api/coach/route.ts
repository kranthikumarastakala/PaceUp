import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch last 4 weeks of activities for context
  const since = new Date(Date.now() - 28 * 86_400_000).toISOString()
  const { data: activities } = await supabase
    .from('activities')
    .select('type, distance, duration, elevation_gain, avg_pace, created_at')
    .eq('user_id', user.id)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(20)

  const actSummary = (activities ?? []).map(a => ({
    type: a.type,
    distKm: ((a.distance ?? 0) / 1000).toFixed(1),
    durationMin: Math.round((a.duration ?? 0) / 60),
    elevGain: Math.round(a.elevation_gain ?? 0),
    date: a.created_at?.slice(0, 10),
  }))

  const totalKm = actSummary.reduce((s, a) => s + parseFloat(a.distKm), 0)
  const avgPerWeek = (totalKm / 4).toFixed(1)

  const systemPrompt = `You are an experienced running and triathlon coach. Give concise, actionable training advice (3-5 bullet points). Be encouraging. Focus on:
- Training load analysis
- Recovery recommendations  
- Upcoming workout suggestions
- Any imbalances or areas for improvement
Keep each bullet to 1-2 sentences. Be specific using the athlete's numbers.`

  const userPrompt = `Here are my last 28 days of training activities:

${JSON.stringify(actSummary, null, 2)}

Summary: ${actSummary.length} activities, ${totalKm.toFixed(1)} km total, ~${avgPerWeek} km/week average.

Please give me personalised coaching feedback and training recommendations.`

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    // Return a smart fallback when no API key is configured
    const tips = generateOfflineTips(actSummary, totalKm, parseFloat(avgPerWeek))
    return NextResponse.json({ tips, source: 'offline' })
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 600,
        temperature: 0.7,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('OpenAI error:', err)
      const tips = generateOfflineTips(actSummary, totalKm, parseFloat(avgPerWeek))
      return NextResponse.json({ tips, source: 'offline' })
    }

    const json = await res.json() as { choices: Array<{ message: { content: string } }> }
    const content = json.choices?.[0]?.message?.content ?? ''
    return NextResponse.json({ tips: content, source: 'openai' })
  } catch (err) {
    console.error('Coach API error:', err)
    const tips = generateOfflineTips(actSummary, totalKm, parseFloat(avgPerWeek))
    return NextResponse.json({ tips, source: 'offline' })
  }
}

function generateOfflineTips(
  activities: Array<{ type: string; distKm: string; durationMin: number; elevGain: number; date: string }>,
  totalKm: number,
  avgPerWeek: number
): string {
  const tips: string[] = []

  if (activities.length === 0) {
    return '• Start by logging your first activity! Consistency is the foundation of any training program.\n• Aim for 3 sessions per week to build a sustainable habit.\n• Mix easy aerobic runs with one slightly harder effort each week.'
  }

  const runCount = activities.filter(a => a.type === 'run').length
  const rideCount = activities.filter(a => a.type === 'ride').length
  const weeklyCount = activities.length / 4

  if (weeklyCount < 2) {
    tips.push(`• You averaged ${weeklyCount.toFixed(1)} sessions/week. Try to increase to 3-4 to build fitness consistently.`)
  } else if (weeklyCount >= 5) {
    tips.push(`• Great consistency! ${weeklyCount.toFixed(1)} sessions/week shows dedication. Make sure to include at least 1 full rest day.`)
  } else {
    tips.push(`• Solid ${weeklyCount.toFixed(1)} sessions/week average. You're in a good training rhythm.`)
  }

  if (avgPerWeek < 20 && runCount > 0) {
    tips.push(`• Your weekly run volume of ~${avgPerWeek} km has good growth potential. Add 10% each week, but take a recovery week every 4th week.`)
  } else if (avgPerWeek >= 50) {
    tips.push(`• ${avgPerWeek} km/week is solid mileage. Focus on quality over quantity — include strides, tempo intervals, or threshold runs.`)
  } else if (runCount > 0) {
    tips.push(`• ${avgPerWeek} km/week is a healthy base. Try adding a mid-week medium-long run to boost aerobic efficiency.`)
  }

  if (rideCount > 0 && runCount > 0) {
    tips.push(`• Great cross-training mix! Cycling complements running nicely for aerobic base without impact stress.`)
  }

  const elevGainTotal = activities.reduce((s, a) => s + a.elevGain, 0)
  if (elevGainTotal < 200 && runCount > 2) {
    tips.push(`• Consider adding some hill work to your runs. Even 100-200m of climbing per week builds strength and improves running economy.`)
  } else if (elevGainTotal > 1000) {
    tips.push(`• Impressive elevation profile (${Math.round(elevGainTotal)}m total)! Your hill training will translate to stronger flat running.`)
  }

  const recentDates = activities.map(a => new Date(a.date).getTime()).sort((a, b) => b - a)
  const daysSinceLastActivity = (Date.now() - (recentDates[0] ?? 0)) / 86_400_000
  if (daysSinceLastActivity > 5) {
    tips.push(`• It looks like you've had a break. Ease back in with an easy-paced session at 70% effort before resuming normal training.`)
  } else if (daysSinceLastActivity <= 1) {
    tips.push(`• Fresh from your last session! If it was intense, today is a great day for recovery — easy walk, swim, or rest.`)
  }

  tips.push(`• Remember: 80% of your training should feel easy (conversational pace). Only 20% should be hard. Most athletes overtrain in the "moderate" zone.`)

  return tips.join('\n')
}
