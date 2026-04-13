import { useState, useEffect } from 'react'
import { Bot, CheckCircle, XCircle, Clock, BarChart2, Database, TrendingUp, AlertTriangle, RefreshCw, ChevronDown, ChevronUp, FileText, ZoomIn } from 'lucide-react'
import api from '../services/api'

const AGENT_META = {
  analyst:  { label: 'Data Analyst',      color: '#388bff', icon: BarChart2 },
  sql:      { label: 'SQL Agent',         color: '#5b6af0', icon: Database },
  forecast: { label: 'Forecasting',       color: '#2ea84a', icon: TrendingUp },
  anomaly:  { label: 'Anomaly Detection', color: '#e5484d', icon: AlertTriangle },
}

function StatusBadge({ status }) {
  const s = {
    completed: { bg: 'rgba(46,168,74,0.12)',   color: '#2ea84a', label: 'Completed' },
    failed:    { bg: 'rgba(229,72,77,0.12)',   color: '#e5484d', label: 'Failed' },
    running:   { bg: 'rgba(56,139,255,0.12)',  color: '#388bff', label: 'Running' },
  }[status] || { bg: 'rgba(125,156,192,0.1)', color: '#7d9cc0', label: status }
  return (
    <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

function RunDetail({ run, onClose }) {
  const [detail, setDetail]       = useState(null)
  const [loading, setLoading]     = useState(true)
  const [showLogs, setShowLogs]   = useState(false)
  const [lightbox, setLightbox]   = useState(null)

  useEffect(() => {
    api.get(`/agent/run/${run.run_id}`)
      .then(r => setDetail(r.data))
      .catch(() => setDetail(run))
      .finally(() => setLoading(false))
  }, [run.run_id])

  const meta = AGENT_META[run.agent_type] || AGENT_META.analyst
  const Icon = meta.icon

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 24,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg2)', borderRadius: 16, width: '100%', maxWidth: 780,
        maxHeight: '88vh', overflowY: 'auto', border: '1px solid var(--border)',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${meta.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={16} color={meta.color} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{meta.label} Run</div>
              <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text3)', marginTop: 1 }}>{run.run_id}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <StatusBadge status={run.status} />
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--bg3)', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 16 }}>×</button>
          </div>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Meta */}
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {[
              { label: 'Started', value: new Date(run.started_at).toLocaleString() },
              { label: 'Duration', value: run.duration_seconds ? `${run.duration_seconds}s` : '—' },
              { label: 'Status', value: run.status },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{value}</div>
              </div>
            ))}
          </div>

          {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><span className="spinner" style={{ width: 24, height: 24 }} /></div>}

          {/* Charts (analyst only) */}
          {detail?.charts?.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <BarChart2 size={13} color={meta.color} /> Visualizations
                <span className="badge badge-blue">{detail.charts.length}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {detail.charts.map(chart => (
                  <div key={chart} onClick={() => setLightbox(`/charts/${chart}`)}
                    style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', cursor: 'zoom-in' }}>
                    <img src={`/charts/${chart}`} alt={chart}
                      style={{ width: '100%', height: 160, objectFit: 'contain', background: '#020810', display: 'block' }} />
                    <div style={{ padding: '5px 8px', fontSize: 10, color: 'var(--text3)', background: 'rgba(255,255,255,0.02)' }}>
                      {chart.replace(/^[a-f0-9-]+_/, '').replace('.png', '').replaceAll('_', ' ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Report (analyst only) */}
          {detail?.report && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileText size={13} color="#d4920a" /> Business Report
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 16, fontSize: 12, lineHeight: 1.9, whiteSpace: 'pre-wrap', maxHeight: 320, overflowY: 'auto', color: 'var(--text2)' }}>
                {detail.report}
              </div>
            </div>
          )}

          {/* SQL result */}
          {detail?.result?.result && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Query Result</div>
              <pre style={{ background: 'var(--bg3)', borderRadius: 8, padding: 12, fontSize: 11, overflowX: 'auto', color: 'var(--text2)' }}>
                {typeof detail.result.result === 'string' ? detail.result.result : JSON.stringify(detail.result.result, null, 2)}
              </pre>
            </div>
          )}

          {/* Logs toggle */}
          {detail?.data_quality && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <button onClick={() => setShowLogs(!showLogs)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', color: 'var(--text2)', fontSize: 12, fontWeight: 600 }}>
                Execution Logs {showLogs ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </button>
              {showLogs && (
                <div className="terminal" style={{ marginTop: 8, maxHeight: 220, overflowY: 'auto', fontSize: 11 }}>
                  {detail.data_quality}
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {run.status === 'failed' && (
            <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(229,72,77,0.08)', border: '1px solid rgba(229,72,77,0.2)', fontSize: 12, color: 'var(--danger)' }}>
              Run failed — check backend terminal for traceback.
            </div>
          )}
        </div>
      </div>

      {lightbox && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}
          onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 10 }} />
        </div>
      )}
    </div>
  )
}

export default function AgentRuns() {
  const [runs, setRuns]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('all')
  const [selected, setSelected] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/agent/runs')
      setRuns(data)
    } catch (e) {}
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const filtered = filter === 'all' ? runs : runs.filter(r => r.agent_type === filter)

  const stats = {
    total:     runs.length,
    completed: runs.filter(r => r.status === 'completed').length,
    failed:    runs.filter(r => r.status === 'failed').length,
  }

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(56,139,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bot size={17} color="#388bff" />
          </div>
          <div>
            <h1 className="page-title">Agent Runs</h1>
            <p className="page-subtitle">History of all AI agent executions across every pipeline</p>
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={13} /> Refresh</button>
      </div>

      {/* Summary stats */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: 'Total Runs',  value: stats.total,     color: '#388bff', bg: 'rgba(56,139,255,0.1)' },
          { label: 'Completed',   value: stats.completed, color: '#2ea84a', bg: 'rgba(46,168,74,0.1)' },
          { label: 'Failed',      value: stats.failed,    color: '#e5484d', bg: 'rgba(229,72,77,0.1)' },
          { label: 'Success Rate', value: stats.total ? `${Math.round((stats.completed / stats.total) * 100)}%` : '—', color: '#06b6d4', bg: 'rgba(6,182,212,0.1)' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className="card" style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['all', 'analyst', 'sql', 'forecast', 'anomaly'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{
              padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer',
              background: filter === f ? '#388bff' : 'var(--bg3)',
              color: filter === f ? 'white' : 'var(--text2)',
              border: `1px solid ${filter === f ? '#388bff' : 'var(--border)'}`,
              transition: 'all 0.15s',
            }}>
            {f === 'all' ? 'All Agents' : AGENT_META[f]?.label ?? f}
            {f !== 'all' && <span style={{ marginLeft: 6, opacity: 0.7 }}>{runs.filter(r => r.agent_type === f).length}</span>}
          </button>
        ))}
      </div>

      {/* Runs table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700 }}>
          {filtered.length} Run{filtered.length !== 1 ? 's' : ''}
        </div>

        {loading ? (
          <div style={{ padding: 48, display: 'flex', justifyContent: 'center' }}>
            <span className="spinner" style={{ width: 28, height: 28 }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text3)' }}>
            No runs yet. Launch an agent to see results here.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Agent', 'Run ID', 'Status', 'Charts', 'Duration', 'Started'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(run => {
                  const meta = AGENT_META[run.agent_type] || AGENT_META.analyst
                  const Icon = meta.icon
                  return (
                    <tr key={run.run_id}
                      onClick={() => setSelected(run)}
                      style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '11px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 26, height: 26, borderRadius: 7, background: `${meta.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Icon size={12} color={meta.color} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 500 }}>{meta.label}</span>
                        </div>
                      </td>
                      <td style={{ padding: '11px 16px' }}>
                        <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text3)' }}>{run.run_id?.slice(0, 14)}…</span>
                      </td>
                      <td style={{ padding: '11px 16px' }}>
                        <StatusBadge status={run.status} />
                      </td>
                      <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text2)' }}>
                        {run.charts_count > 0 ? `${run.charts_count} charts` : '—'}
                      </td>
                      <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text2)', fontFamily: 'monospace' }}>
                        {run.duration_seconds ? `${run.duration_seconds}s` : '—'}
                      </td>
                      <td style={{ padding: '11px 16px', fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                        {new Date(run.started_at).toLocaleString()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && <RunDetail run={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
