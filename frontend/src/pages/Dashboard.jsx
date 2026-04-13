import { useState, useEffect } from 'react'
import { FolderKanban, CheckSquare, Users, Bot, TrendingUp, Activity, Clock, Smile, BarChart2, Database, AlertTriangle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTeam } from '../context/TeamContext'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

const AGENT_META = {
  analyst:  { label: 'Data Analyst', color: '#388bff' },
  sql:      { label: 'SQL Agent',    color: '#5b6af0' },
  forecast: { label: 'Forecasting',  color: '#2ea84a' },
  anomaly:  { label: 'Anomaly Det.', color: '#e5484d' },
}

export default function Dashboard() {
  const { user } = useAuth()
  const { currentTeam } = useTeam()
  const navigate = useNavigate()
  const [stats, setStats]               = useState(null)
  const [activityStats, setActivityStats] = useState(null)
  const [recentRuns, setRecentRuns]     = useState([])
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    if (currentTeam) loadData()
  }, [currentTeam])

  const loadData = async () => {
    setLoading(true)
    try {
      const [s, a, runs] = await Promise.all([
        api.get(`/teams/${currentTeam.id}/analytics/overview`),
        api.get(`/teams/${currentTeam.id}/activities/stats`),
        api.get('/agent/runs').catch(() => ({ data: [] })),
      ])
      setStats(s.data)
      setActivityStats(a.data)
      setRecentRuns(runs.data.slice(0, 5))
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
        <h1 className="page-title">{greeting}, {user?.name?.split(' ')[0]}</h1>
        <p className="page-subtitle">{currentTeam ? `${currentTeam.name} workspace` : 'No team selected'} · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      </div>

      {/* Stat Cards — numbers always white */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        {[
          { icon: FolderKanban, label: 'Projects',     value: stats?.total_projects ?? 0,                                    color: '#388bff', bg: 'rgba(56,139,255,0.1)' },
          { icon: CheckSquare,  label: 'Tasks Done',   value: `${stats?.completed_tasks ?? 0}/${stats?.total_tasks ?? 0}`,  color: '#2ea84a', bg: 'rgba(46,168,74,0.1)' },
          { icon: Users,        label: 'Team Members', value: stats?.total_members ?? 0,                                    color: '#5b6af0', bg: 'rgba(91,106,240,0.1)' },
          { icon: Bot,          label: 'Agent Runs',   value: stats?.agent_runs ?? 0,                                       color: '#06b6d4', bg: 'rgba(6,182,212,0.1)' },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div className="stat-card" key={label}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <Icon size={17} color={color} />
            </div>
            <div className="stat-num">{value}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Activity Summary */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>Your Activity (Last 30 Days)</h3>
            <Activity size={15} color="var(--text3)" />
          </div>
          {activityStats ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { icon: Clock,    label: 'Hours Logged', value: activityStats.total_hours },
                { icon: Activity, label: 'Days Logged',  value: activityStats.total_days_logged },
                { icon: Users,    label: 'Meetings',     value: activityStats.total_meetings },
                { icon: Smile,    label: 'Avg Mood',     value: `${activityStats.avg_mood}/5` },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 20, fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--text)' }}>{value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{label}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '20px' }}>
              <p>No activity logged yet</p>
            </div>
          )}
        </div>

        {/* Task Completion */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>Task Completion</h3>
            <TrendingUp size={15} color="var(--text3)" />
          </div>
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 52, fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>
              {stats?.completion_rate ?? 0}%
            </div>
            <div style={{ color: 'var(--text3)', fontSize: 11, marginTop: 8, marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.6px' }}>completion rate</div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${stats?.completion_rate ?? 0}%` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 12, color: 'var(--text2)' }}>
              <span>{stats?.completed_tasks ?? 0} done</span>
              <span>{(stats?.total_tasks ?? 0) - (stats?.completed_tasks ?? 0)} remaining</span>
            </div>
          </div>
        </div>
      </div>

      {/* Hours This Week mini chart */}
      {activityStats?.recent?.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: 'var(--text)', marginBottom: 16 }}>Hours This Week</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80 }}>
            {activityStats.recent.slice(0, 7).map((day, i) => {
              const maxH = Math.max(...activityStats.recent.map(d => d.hours), 1)
              const h = (day.hours / maxH) * 80
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: '100%', height: h, background: 'linear-gradient(180deg, #388bff, rgba(56,139,255,0.3))', borderRadius: '4px 4px 0 0', minHeight: 4, transition: 'height 0.5s ease' }} title={`${day.hours}h`} />
                  <div style={{ fontSize: 10, color: 'var(--text3)' }}>{day.date?.slice(5)}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent Agent Runs */}
      {recentRuns.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>Recent Agent Runs</h3>
            <button onClick={() => navigate('/agent-runs')} className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>View all →</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {recentRuns.map(run => {
              const meta = AGENT_META[run.agent_type] || { label: run.agent_type, color: '#7d9cc0' }
              return (
                <div key={run.run_id} onClick={() => navigate('/agent-runs')}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', background: 'rgba(255,255,255,0.02)', border: '1px solid transparent' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(56,139,255,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 500 }}>{meta.label}</span>
                    <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text3)' }}>{run.run_id?.slice(0, 10)}…</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {run.duration_seconds && <span style={{ fontSize: 11, color: 'var(--text3)' }}>{run.duration_seconds}s</span>}
                    <span style={{
                      padding: '1px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600,
                      background: run.status === 'completed' ? 'rgba(46,168,74,0.12)' : run.status === 'failed' ? 'rgba(229,72,77,0.12)' : 'rgba(56,139,255,0.12)',
                      color: run.status === 'completed' ? '#2ea84a' : run.status === 'failed' ? '#e5484d' : '#388bff',
                    }}>{run.status}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
