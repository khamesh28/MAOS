import { useState, useRef } from 'react'
import { Upload, AlertTriangle, Play, CheckCircle, XCircle, ShieldAlert } from 'lucide-react'
import api from '../services/api'
import GraphViewer from '../components/GraphViewer'
import AgentSkeleton from '../components/AgentSkeleton'

const SEVERITY_STYLE = {
  high:   { bg: 'rgba(229,72,77,0.12)',   color: '#e5484d', label: 'HIGH' },
  medium: { bg: 'rgba(212,146,10,0.12)',  color: '#d4920a', label: 'MEDIUM' },
  low:    { bg: 'rgba(6,182,212,0.12)',   color: '#06b6d4', label: 'LOW' },
}

export default function AnomalyAgent() {
  const [file, setFile]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState(null)
  const [error, setError]     = useState('')
  const fileRef = useRef()

  const run = async () => {
    if (!file) return
    setLoading(true); setError(''); setResult(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const { data } = await api.post('/agent/anomaly', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      })
      setResult(data)
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Anomaly detection failed')
    } finally {
      setLoading(false)
    }
  }

  const high   = result?.anomalies?.filter(a => a.severity === 'high').length ?? 0
  const medium = result?.anomalies?.filter(a => a.severity === 'medium').length ?? 0
  const low    = result?.anomalies?.filter(a => a.severity === 'low').length ?? 0

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(229,72,77,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={16} color="var(--danger)" />
          </div>
          <div>
            <h1 className="page-title">Anomaly Detection Agent</h1>
            <p className="page-subtitle">Upload any CSV → LangGraph Z-score analysis flags statistical outliers → LLM explains in business terms</p>
          </div>
        </div>
      </div>

      {/* Architecture */}
      <div className="card" style={{ marginBottom: 20, borderColor: 'rgba(229,72,77,0.2)', background: 'rgba(229,72,77,0.03)' }}>
        <div style={{ fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
          LangGraph Pipeline
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          {['START', '→', 'stats_analyzer', '→', 'anomaly_flagging', '→', 'chart_gen', '→', 'llm_explainer', '→', 'summary_writer', '→', 'END'].map((n, i) => (
            <span key={i} style={{
              fontSize: 11,
              color: n === '→' ? 'var(--text3)' : 'var(--danger)',
              background: n === '→' ? 'none' : 'rgba(229,72,77,0.1)',
              padding: n === '→' ? '0' : '2px 7px',
              borderRadius: 4,
              fontFamily: n === '→' ? 'inherit' : 'monospace',
            }}>{n}</span>
          ))}
          <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 4 }}>· IQR + Z-score (|z| &gt; 2.5)</span>
        </div>
      </div>

      <GraphViewer agentType="anomaly" />

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, alignItems: 'start' }}>
        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Upload Dataset</div>
            <div
              onClick={() => fileRef.current.click()}
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--danger)' }}
              onDragLeave={e => e.currentTarget.style.borderColor = file ? 'var(--success)' : 'var(--border2)'}
              onDrop={e => { e.preventDefault(); setFile(e.dataTransfer.files[0]); setResult(null) }}
              style={{
                border: `2px dashed ${file ? 'var(--success)' : 'var(--border2)'}`,
                borderRadius: 9, padding: '24px 16px', textAlign: 'center', cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }}
                onChange={e => { setFile(e.target.files[0]); setResult(null) }} />
              {file ? (
                <>
                  <CheckCircle size={24} color="var(--success)" style={{ marginBottom: 6 }} />
                  <div style={{ fontWeight: 600, color: 'var(--success)', fontSize: 12 }}>{file.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{(file.size / 1024).toFixed(1)} KB</div>
                </>
              ) : (
                <>
                  <Upload size={24} color="var(--text3)" style={{ marginBottom: 6 }} />
                  <div style={{ fontSize: 12, fontWeight: 500 }}>Drop CSV or click</div>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>Any numeric columns</div>
                </>
              )}
            </div>

            <button
              className="btn"
              style={{ width: '100%', justifyContent: 'center', padding: 10, marginTop: 12, background: 'var(--danger)', color: 'white', fontWeight: 700 }}
              onClick={run}
              disabled={!file || loading}
            >
              {loading ? <><span className="spinner" style={{ width: 13, height: 13 }} /> Scanning...</> : <><ShieldAlert size={13} /> Scan for Anomalies</>}
            </button>
          </div>

          {/* Method note */}
          <div className="card" style={{ background: 'rgba(229,72,77,0.04)', borderColor: 'rgba(229,72,77,0.15)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)', marginBottom: 8 }}>Detection Method</div>
            <ul style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 2, paddingLeft: 14 }}>
              <li>Z-score per numeric column</li>
              <li>Threshold: |z| &gt; 2.5</li>
              <li>High severity: |z| &gt; 4.0</li>
              <li>Medium: |z| &gt; 3.0</li>
              <li>Low: |z| &gt; 2.5</li>
              <li>LLM explains top 5</li>
            </ul>
          </div>
        </div>

        {/* Right: results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {loading && <AgentSkeleton accentColor="#e5484d" />}

          {error && (
            <div className="card" style={{ borderColor: 'rgba(229,72,77,0.3)', background: 'rgba(229,72,77,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)', marginBottom: 6 }}>
                <XCircle size={14} /><span style={{ fontWeight: 600 }}>Detection Failed</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text2)' }}>{error}</p>
            </div>
          )}

          {result && !loading && (
            <>
              {/* Summary banner */}
              <div style={{
                padding: '16px 20px', borderRadius: 12,
                background: result.total_flagged > 0 ? 'rgba(229,72,77,0.08)' : 'rgba(46,168,74,0.08)',
                border: `1px solid ${result.total_flagged > 0 ? 'rgba(229,72,77,0.25)' : 'rgba(46,168,74,0.25)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: result.total_flagged > 0 ? 'var(--danger)' : 'var(--success)', marginBottom: 4 }}>
                    {result.total_flagged} Anomalies Found
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                    across {new Set(result.anomalies?.map(a => a.column) ?? []).size} column(s) · Z-score threshold: |z| &gt; 2.5
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {[
                    { label: 'High', val: high,   color: 'var(--danger)'  },
                    { label: 'Med',  val: medium,  color: 'var(--warning)' },
                    { label: 'Low',  val: low,     color: 'var(--accent3)' },
                  ].map(s => (
                    <div key={s.label} style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: s.color }}>{s.val}</div>
                      <div style={{ fontSize: 10, color: 'var(--text2)' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chart */}
              {result.chart_b64 && (
                <div className="card" style={{ borderColor: 'rgba(229,72,77,0.15)', padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: 12 }}>Anomaly Distribution Chart</div>
                  <img
                    src={`data:image/png;base64,${result.chart_b64}`}
                    alt="Anomaly Chart"
                    style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border)' }}
                  />
                </div>
              )}

              {/* Executive Summary */}
              {result.summary && (
                <div className="card" style={{ borderColor: 'rgba(229,72,77,0.15)', background: 'rgba(229,72,77,0.03)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: 10, color: 'var(--danger)' }}>
                    Executive Summary
                  </div>
                  <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text)' }}>{result.summary}</p>
                </div>
              )}

              {/* Anomaly Table */}
              {result.anomalies?.length > 0 && (
                <div className="card">
                  <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: 12 }}>
                    Flagged Anomalies ({result.anomalies.length})
                  </div>
                  <div style={{ overflowY: 'auto', maxHeight: 400 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          {['Row', 'Column', 'Value', 'Z-Score', 'Severity', 'Explanation'].map(h => (
                            <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text2)', fontWeight: 600, fontSize: 11 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.anomalies.map((a, i) => {
                          const sv = SEVERITY_STYLE[a.severity] || SEVERITY_STYLE.low
                          return (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(56,139,255,0.03)' }}>
                              <td style={{ padding: '8px 12px', color: 'var(--text3)', fontFamily: 'monospace' }}>{a.row_index}</td>
                              <td style={{ padding: '8px 12px', color: 'var(--text2)' }}>{a.column}</td>
                              <td style={{ padding: '8px 12px', color: 'var(--danger)', fontFamily: 'monospace', fontWeight: 600 }}>{a.value}</td>
                              <td style={{ padding: '8px 12px', color: 'var(--warning)', fontFamily: 'monospace' }}>{a.zscore}</td>
                              <td style={{ padding: '8px 12px' }}>
                                <span style={{ padding: '2px 7px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: sv.bg, color: sv.color }}>{sv.label}</span>
                              </td>
                              <td style={{ padding: '8px 12px', color: 'var(--text2)', fontSize: 11, maxWidth: 220 }}>
                                {a.explanation || '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {!result && !loading && !error && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60 }}>
              <AlertTriangle size={40} color="var(--text3)" style={{ marginBottom: 14 }} />
              <p style={{ color: 'var(--text2)', fontSize: 13, textAlign: 'center', lineHeight: 1.7 }}>
                Upload a CSV and click "Scan for Anomalies".<br />
                The LangGraph agent will use Z-score analysis to find statistical outliers<br />
                and explain them in plain business language.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
