import { useState, useEffect } from 'react'
import { FolderKanban, CheckSquare, Users, Bot, TrendingUp, Activity, Clock, Smile } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTeam } from '../context/TeamContext'
import api from '../services/api'

export default function Dashboard() {
  const { user } = useAuth()
  const { currentTeam } = useTeam()
  const [stats, setStats] = useState(null)
  const [activityStats, setActivityStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (currentTeam) loadData()
  }, [currentTeam])

  const loadData = async () => {
    setLoading(true)
    try {
      const [s, a] = await Promise.all([
        api.get(`/teams/${currentTeam.id}/analytics/overview`),
        api.get(`/teams/${currentTeam.id}/activities/stats`)
      ])
      setStats(s.data)
      setActivityStats(a.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  if (loading) return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  )

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">{greeting}, {user?.name?.split(' ')[0]} 👋</h1>
        <p className="page-subtitle">{currentTeam ? `${currentTeam.name} workspace` : 'No team selected'} · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      </div>

      {/* Stat Cards */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        {[
          { icon: FolderKanban, label: 'Projects', value: stats?.total_projects ?? 0, color: 'var(--accent)', bg: 'rgba(79,142,255,0.1)' },
          { icon: CheckSquare, label: 'Tasks Done', value: `${stats?.completed_tasks ?? 0}/${stats?.total_tasks ?? 0}`, color: 'var(--success)', bg: 'rgba(16,185,129,0.1)' },
          { icon: Users, label: 'Team Members', value: stats?.total_members ?? 0, color: '#a78bfa', bg: 'rgba(124,58,237,0.1)' },
          { icon: Bot, label: 'Agent Runs', value: stats?.agent_runs ?? 0, color: 'var(--accent3)', bg: 'rgba(6,182,212,0.1)' },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div className="stat-card" key={label}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Icon size={16} color={color} />
            </div>
            <div className="stat-num" style={{ color }}>{value}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Activity Summary */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>Your Activity (Last 30 Days)</h3>
            <Activity size={16} color="var(--text2)" />
          </div>
          {activityStats ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { icon: Clock, label: 'Hours Logged', value: activityStats.total_hours },
                { icon: Activity, label: 'Days Logged', value: activityStats.total_days_logged },
                { icon: Users, label: 'Meetings', value: activityStats.total_meetings },
                { icon: Smile, label: 'Avg Mood', value: `${activityStats.avg_mood}/5` },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} style={{ background: 'var(--bg3)', borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text)' }}>{value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '20px' }}>
              <p>No activity logged yet</p>
            </div>
          )}
        </div>

        {/* Completion Rate */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>Task Completion</h3>
            <TrendingUp size={16} color="var(--text2)" />
          </div>
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 52, fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--success)', lineHeight: 1 }}>
              {stats?.completion_rate ?? 0}%
            </div>
            <div style={{ color: 'var(--text2)', fontSize: 13, marginTop: 8, marginBottom: 20 }}>completion rate</div>
            <div style={{ background: 'var(--bg3)', borderRadius: 8, height: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${stats?.completion_rate ?? 0}%`, background: 'linear-gradient(90deg, var(--accent), var(--success))', borderRadius: 8, transition: 'width 1s ease' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: 'var(--text2)' }}>
              <span>{stats?.completed_tasks ?? 0} done</span>
              <span>{(stats?.total_tasks ?? 0) - (stats?.completed_tasks ?? 0)} remaining</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Chart */}
      {activityStats?.recent?.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Hours This Week</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80 }}>
            {activityStats.recent.slice(0, 7).map((day, i) => {
              const maxH = Math.max(...activityStats.recent.map(d => d.hours), 1)
              const h = (day.hours / maxH) * 80
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: '100%', height: h, background: 'linear-gradient(180deg, var(--accent), rgba(79,142,255,0.3))', borderRadius: '4px 4px 0 0', minHeight: 4, transition: 'height 0.5s ease' }} title={`${day.hours}h`} />
                  <div style={{ fontSize: 10, color: 'var(--text2)' }}>{day.date?.slice(5)}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
