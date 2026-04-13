import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart2, Database, TrendingUp, AlertTriangle, FileText, Activity, Zap, CheckCircle, Clock, ArrowRight } from 'lucide-react'
import api from '../services/api'

const AGENTS = [
  {
    key: 'analyst',
    name: 'Data Analyst',
    desc: 'Upload any CSV → 3-agent AutoGen pipeline cleans data, generates 5 BI charts, writes executive report.',
    icon: BarChart2,
    color: '#388bff',
    bg: 'rgba(56,139,255,0.06)',
    border: 'rgba(56,139,255,0.18)',
    framework: 'AutoGen',
    frameworkColor: '#388bff',
    path: '/agents/analyst',
  },
  {
    key: 'sql',
    name: 'SQL Agent',
    desc: 'Ask natural language questions about your CSV data. LangGraph generates pandas queries and explains results.',
    icon: Database,
    color: '#5b6af0',
    bg: 'rgba(91,106,240,0.06)',
    border: 'rgba(91,106,240,0.18)',
    framework: 'LangGraph',
    frameworkColor: '#5b6af0',
    path: '/agents/sql',
  },
  {
    key: 'forecast',
    name: 'Forecasting',
    desc: 'Auto-detect time series in your CSV and generate a 30-day LinearRegression forecast with LLM insights.',
    icon: TrendingUp,
    color: '#2ea84a',
    bg: 'rgba(46,168,74,0.06)',
    border: 'rgba(46,168,74,0.18)',
    framework: 'LangGraph',
    frameworkColor: '#5b6af0',
    path: '/agents/forecast',
  },
  {
    key: 'anomaly',
    name: 'Anomaly Detection',
    desc: 'Z-score analysis flags statistical outliers across all numeric columns. LLM explains findings in business terms.',
    icon: AlertTriangle,
    color: '#e5484d',
    bg: 'rgba(229,72,77,0.06)',
    border: 'rgba(229,72,77,0.18)',
    framework: 'LangGraph',
    frameworkColor: '#5b6af0',
    path: '/agents/anomaly',
  },
  {
    key: 'report',
    name: 'Report Writer',
    desc: 'AutoGen Business Report Writer agent generates 3-section executive BI reports from data insights.',
    icon: FileText,
    color: '#06b6d4',
    bg: 'rgba(6,182,212,0.06)',
    border: 'rgba(6,182,212,0.18)',
    framework: 'AutoGen',
    frameworkColor: '#388bff',
    path: '/agents/analyst',
  },
]

export default function AgentsHub() {
  const [stats, setStats] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/agent/monitor').then(r => setStats(r.data)).catch(() => {})
  }, [])

  const agentRunCount = (key) => stats?.runs_by_agent?.[key] ?? 0
  const successRate = stats?.success_rate ?? 0

  return (
    <div className="page">
      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(56,139,255,0.08) 0%, rgba(91,106,240,0.05) 100%)',
        border: '1px solid rgba(56,139,255,0.15)',
        borderRadius: 'var(--radius)',
        padding: '36px 40px',
        marginBottom: 28,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -80, right: -80,
          width: 320, height: 320,
          background: 'radial-gradient(circle, rgba(56,139,255,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: '#388bff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, color: 'white',
          }}>G</div>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, lineHeight: 1.2, color: '#f0f6ff', letterSpacing: '-0.3px' }}>
              Genpact AI Hub
            </h1>
            <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 3 }}>
              Autonomous Intelligence Platform — AutoGen + LangGraph
            </p>
          </div>
        </div>
        <p style={{ color: 'var(--text2)', fontSize: 13, maxWidth: 560, lineHeight: 1.8 }}>
          Two AI frameworks. Six intelligent agents. One enterprise platform.
          Upload your data and let autonomous agents analyze, forecast, detect anomalies, and write reports.
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          {[
            { label: 'pyautogen 0.2.35', color: '#388bff', bg: 'rgba(56,139,255,0.1)', border: 'rgba(56,139,255,0.2)' },
            { label: 'LangGraph 1.x',    color: '#5b6af0', bg: 'rgba(91,106,240,0.1)', border: 'rgba(91,106,240,0.2)' },
            { label: 'Groq Llama 3.3',   color: '#06b6d4', bg: 'rgba(6,182,212,0.1)',  border: 'rgba(6,182,212,0.2)' },
          ].map(b => (
            <span key={b.label} style={{
              padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
              background: b.bg, color: b.color, border: `1px solid ${b.border}`,
            }}>{b.label}</span>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
          {[
            { label: 'Total Runs',    value: stats.total_runs,            icon: Zap,         color: '#388bff', bg: 'rgba(56,139,255,0.1)' },
            { label: 'Active Agents', value: 4,                           icon: Activity,    color: '#2ea84a', bg: 'rgba(46,168,74,0.1)' },
            { label: 'Success Rate',  value: `${successRate}%`,           icon: CheckCircle, color: '#2ea84a', bg: 'rgba(46,168,74,0.1)' },
            { label: 'Avg Duration',  value: `${stats.avg_duration_seconds}s`, icon: Clock, color: '#d4920a', bg: 'rgba(212,146,10,0.1)' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px' }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={16} color={color} />
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{value}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Agent Cards 3×2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {AGENTS.map(agent => {
          const Icon = agent.icon
          const runs = agentRunCount(agent.key)
          return (
            <div
              key={agent.key}
              onClick={() => navigate(agent.path)}
              style={{
                background: 'linear-gradient(145deg, #0c1628 0%, #080f1e 100%)',
                border: `1px solid ${agent.border}`,
                borderLeft: `3px solid ${agent.color}`,
                borderRadius: 'var(--radius)',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                padding: '20px',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = agent.color
                e.currentTarget.style.borderLeftColor = agent.color
                e.currentTarget.style.boxShadow = `0 8px 32px ${agent.color}18`
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = agent.border
                e.currentTarget.style.borderLeftColor = agent.color
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: agent.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={18} color={agent.color} />
                </div>
                <span style={{
                  padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600,
                  background: `${agent.frameworkColor}15`,
                  color: agent.frameworkColor,
                  border: `1px solid ${agent.frameworkColor}25`,
                }}>{agent.framework}</span>
              </div>

              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, marginBottom: 8, color: agent.color }}>
                {agent.name}
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 16 }}>
                {agent.desc}
              </p>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                  {runs > 0 ? `${runs} runs` : 'No runs yet'}
                </span>
                <button
                  onClick={e => { e.stopPropagation(); navigate(agent.path) }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: agent.color, color: 'white', border: 'none', cursor: 'pointer',
                    transition: 'opacity 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  Launch <ArrowRight size={11} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
