import { useState, useEffect } from 'react'
import { Activity, CheckCircle, XCircle, Clock, Zap, BarChart2, Database, TrendingUp, AlertTriangle, FileText, RefreshCw } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid } from 'recharts'
import api from '../services/api'

const AGENT_META = {
  analyst:    { label: 'Data Analyst',      color: '#388bff', icon: BarChart2 },
  sql:        { label: 'SQL Agent',         color: '#5b6af0', icon: Database },
  forecast:   { label: 'Forecasting',       color: '#2ea84a', icon: TrendingUp },
  anomaly:    { label: 'Anomaly Detection', color: '#e5484d', icon: AlertTriangle },
  supervisor: { label: 'Supervisor',        color: '#d4920a', icon: Zap },
}

const PIE_COLORS_ORDERED = ['#388bff', '#5b6af0', '#2ea84a', '#e5484d', '#d4920a']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#0c1628', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      <div style={{ color: 'var(--text2)', marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => <div key={i} style={{ color: p.color ?? '#f0f6ff' }}>{p.name}: {p.value}</div>)}
    </div>
  )
}

function AgentBadge({ type }) {
  const meta = AGENT_META[type] || { label: type, color: '#7d9cc0', icon: Zap }
  const Icon = meta.icon
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: `${meta.color}18`, color: meta.color,
    }}>
      <Icon size={9} />
      {meta.label}
    </span>
  )
}

export default function Monitor() {
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [pulsing, setPulsing]     = useState(false)

  const load = async () => {
    try {
      const { data: d } = await api.get('/agent/monitor')
      setData(d)
      setLastRefresh(new Date())
      setPulsing(true)
      setTimeout(() => setPulsing(false), 600)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  const pieData = data ? Object.entries(data.runs_by_agent)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({
      name:  AGENT_META[k]?.label ?? k,
      value: v,
      color: AGENT_META[k]?.color ?? '#7d9cc0',
    })) : []

  if (loading) return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  )

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(6,182,212,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={17} color="#06b6d4" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 className="page-title" style={{ marginBottom: 0 }}>AI Operations Monitor</h1>
              <span className="live-dot" />
              <span style={{ fontSize: 11, color: '#2ea84a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>LIVE</span>
            </div>
            <p className="page-subtitle">Auto-refreshes every 30s · AutoGen + LangGraph agent runs</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {lastRefresh && (
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button className="btn-icon" onClick={load} style={{ padding: 8 }}>
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: 'Total Runs',   value: data?.total_runs ?? 0,            color: '#388bff', bg: 'rgba(56,139,255,0.1)',  icon: Zap },
          { label: 'Success Rate', value: `${data?.success_rate ?? 0}%`,    color: '#2ea84a', bg: 'rgba(46,168,74,0.1)',   icon: CheckCircle },
          { label: 'Runs Today',   value: data?.runs_today ?? 0,            color: '#d4920a', bg: 'rgba(212,146,10,0.1)', icon: Activity },
          { label: 'Avg Duration', value: `${data?.avg_duration_seconds ?? 0}s`, color: '#06b6d4', bg: 'rgba(6,182,212,0.1)', icon: Clock },
        ].map(({ label, value, color, bg, icon: Icon }) => (
          <div key={label} className="stat-card" style={{ transition: 'box-shadow 0.3s', boxShadow: pulsing ? `0 0 20px ${color}25` : 'none' }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <Icon size={17} color={color} />
            </div>
            <div className="stat-num">{value}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      {/* Line chart */}
      {data?.runs_last_7_days?.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: 'var(--text)', marginBottom: 16 }}>
            Agent Runs — Last 7 Days
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data.runs_last_7_days} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="date" stroke="transparent" tick={{ fill: 'var(--text3)', fontSize: 11 }} />
              <YAxis stroke="transparent" tick={{ fill: 'var(--text3)', fontSize: 11 }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="count" name="Runs" stroke="#388bff" strokeWidth={2.5} dot={{ fill: '#388bff', r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Pie + Recent runs */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
        {/* Pie */}
        <div className="card">
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: 'var(--text)', marginBottom: 14 }}>Runs by Agent Type</div>
          {pieData.some(d => d.value > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color ?? PIE_COLORS_ORDERED[i % PIE_COLORS_ORDERED.length]} />)}
                </Pie>
                <Legend formatter={(value) => <span style={{ color: 'var(--text2)', fontSize: 12 }}>{value}</span>} />
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state" style={{ padding: '30px 0' }}>
              <p style={{ fontSize: 12 }}>No runs yet</p>
            </div>
          )}
          <div style={{ marginTop: 8 }}>
            {Object.entries(data?.runs_by_agent ?? {}).map(([type, count]) => {
              const meta = AGENT_META[type] || { label: type, color: '#7d9cc0' }
              const pct  = data.total_runs > 0 ? Math.round((count / data.total_runs) * 100) : 0
              return (
                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--text2)' }}>{meta.label}</span>
                  <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, minWidth: 28, textAlign: 'right' }}>{count}</span>
                  <span style={{ fontSize: 11, color: 'var(--text3)', minWidth: 36, textAlign: 'right' }}>{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Recent runs table */}
        <div className="card">
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: 'var(--text)', marginBottom: 14 }}>Recent Runs</div>
          <div style={{ overflowY: 'auto', maxHeight: 380 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)' }}>
                  {['Run ID', 'Agent', 'Status', 'Duration', 'Est. Tokens', 'Started At'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text3)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.recent_runs ?? []).map((run, i) => (
                  <tr key={run.run_id}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '9px 12px', fontFamily: 'monospace', color: 'var(--text3)', fontSize: 11 }}>{run.run_id.slice(0, 10)}...</td>
                    <td style={{ padding: '9px 12px' }}><AgentBadge type={run.agent_type} /></td>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {run.status === 'completed' ? <CheckCircle size={12} color="var(--success)" /> : run.status === 'failed' ? <XCircle size={12} color="var(--danger)" /> : <span className="spinner" style={{ width: 11, height: 11 }} />}
                        <span style={{ fontSize: 11, color: run.status === 'completed' ? 'var(--success)' : run.status === 'failed' ? 'var(--danger)' : 'var(--text2)' }}>{run.status}</span>
                      </span>
                    </td>
                    <td style={{ padding: '9px 12px', color: 'var(--text2)', fontFamily: 'monospace' }}>{run.duration > 0 ? `${run.duration}s` : '—'}</td>
                    <td style={{ padding: '9px 12px', color: 'var(--text3)', fontFamily: 'monospace' }}>{run.est_tokens > 0 ? run.est_tokens.toLocaleString() : '—'}</td>
                    <td style={{ padding: '9px 12px', color: 'var(--text3)', fontSize: 11 }}>{new Date(run.started_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(!data?.recent_runs?.length) && (
              <div className="empty-state" style={{ padding: '30px 0' }}>
                <Activity size={28} />
                <p>No runs recorded yet. Run an agent to see activity here.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
