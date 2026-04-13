import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, CartesianGrid } from 'recharts'
import { useTeam } from '../context/TeamContext'
import api from '../services/api'

const COLORS = ['#388bff', '#5b6af0', '#06b6d4', '#2ea84a', '#d4920a', '#e5484d']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#0c1628', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      <div style={{ color: 'var(--text2)', marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => <div key={i} style={{ color: '#f0f6ff' }}>{p.name}: {p.value}</div>)}
    </div>
  )
}

export default function Analytics() {
  const { currentTeam } = useTeam()
  const [overview, setOverview] = useState(null)
  const [activityStats, setActivityStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (currentTeam) load() }, [currentTeam])

  const load = async () => {
    setLoading(true)
    try {
      const [o, a] = await Promise.all([
        api.get(`/teams/${currentTeam.id}/analytics/overview`),
        api.get(`/teams/${currentTeam.id}/activities/stats`)
      ])
      setOverview(o.data)
      setActivityStats(a.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  if (loading) return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  )

  const taskData = overview ? [
    { name: 'Done',      value: overview.completed_tasks,                               fill: '#2ea84a' },
    { name: 'Remaining', value: overview.total_tasks - overview.completed_tasks,        fill: 'rgba(255,255,255,0.06)' },
  ] : []

  const activityChartData = activityStats?.recent?.map(d => ({
    date:  d.date?.slice(5),
    hours: parseFloat(d.hours?.toFixed(1)),
    mood:  d.mood,
  })) || []

  const summaryCards = overview ? [
    { label: 'Total Projects',  value: overview.total_projects,                      color: '#388bff' },
    { label: 'Total Tasks',     value: overview.total_tasks,                         color: '#5b6af0' },
    { label: 'Completion Rate', value: `${overview.completion_rate}%`,              color: '#2ea84a' },
    { label: 'Team Size',       value: overview.total_members,                       color: '#06b6d4' },
    { label: 'Agent Runs',      value: overview.agent_runs,                          color: '#d4920a' },
    { label: 'Days Logged',     value: activityStats?.total_days_logged || 0,        color: '#e5484d' },
  ] : []

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Analytics</h1>
        <p className="page-subtitle">Team performance and activity insights for {currentTeam?.name}</p>
      </div>

      {/* Summary Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 20 }}>
        {summaryCards.map(({ label, value, color }) => (
          <div key={label} className="stat-card" style={{ textAlign: 'center', padding: '16px 10px' }}>
            <div className="stat-num" style={{ fontSize: 24 }}>{value}</div>
            <div className="stat-label" style={{ fontSize: 10 }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Hours Chart */}
        <div className="card">
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: 'var(--text)', marginBottom: 16 }}>Daily Hours Logged</h3>
          {activityChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={activityChartData} barSize={20}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="hours" fill="#388bff" radius={[4, 4, 0, 0]} name="Hours" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state" style={{ height: 200 }}><p>No activity data yet</p></div>
          )}
        </div>

        {/* Task Completion Donut */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: 'var(--text)', marginBottom: 16, alignSelf: 'flex-start' }}>Task Status</h3>
          {overview?.total_tasks > 0 ? (
            <>
              <PieChart width={160} height={160}>
                <Pie data={taskData} cx={75} cy={75} innerRadius={50} outerRadius={72} dataKey="value" strokeWidth={0}>
                  {taskData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
              </PieChart>
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <div style={{ fontSize: 24, fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--text)' }}>{overview.completion_rate}%</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>completion rate</div>
              </div>
            </>
          ) : (
            <div className="empty-state" style={{ height: 160 }}><p>No tasks yet</p></div>
          )}
        </div>
      </div>

      {/* Mood Trend */}
      {activityChartData.length > 0 && (
        <div className="card">
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: 'var(--text)', marginBottom: 16 }}>Mood Trend</h3>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={activityChartData}>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[1, 5]} tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="mood" stroke="#d4920a" strokeWidth={2} dot={{ fill: '#d4920a', r: 3 }} name="Mood" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
