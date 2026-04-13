import { useState, useRef } from 'react'
import { Upload, TrendingUp, Play, CheckCircle, XCircle, Download, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react'
import api from '../services/api'
import GraphViewer from '../components/GraphViewer'
import AgentSkeleton from '../components/AgentSkeleton'

export default function ForecastAgent() {
  const [file, setFile]           = useState(null)
  const [loading, setLoading]     = useState(false)
  const [result, setResult]       = useState(null)
  const [error, setError]         = useState('')
  const [showTable, setShowTable] = useState(false)
  const fileRef = useRef()

  const run = async () => {
    if (!file) return
    setLoading(true); setError(''); setResult(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const { data } = await api.post('/agent/forecast', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      })
      setResult(data)
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Forecast agent failed')
    } finally {
      setLoading(false)
    }
  }

  const downloadForecast = () => {
    if (!result?.forecast) return
    const csv = ['date,value', ...result.forecast.map(r => `${r.date},${r.value}`)].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'genpact_forecast.csv'
    a.click()
  }

  const insights = result?.insights
    ? result.insights.split('\n').filter(l => l.trim())
    : []

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(46,168,74,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={16} color="var(--success)" />
          </div>
          <div>
            <h1 className="page-title">Forecasting Agent</h1>
            <p className="page-subtitle">Upload a time-series CSV → LangGraph auto-detects date & value columns → LinearRegression 30-day forecast + LLM insights</p>
          </div>
        </div>
      </div>

      {/* Architecture */}
      <div className="card" style={{ marginBottom: 20, borderColor: 'rgba(46,168,74,0.2)', background: 'rgba(46,168,74,0.03)' }}>
        <div style={{ fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
          LangGraph Pipeline
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          {['START', '→', 'data_inspector', '→', 'data_cleaner', '→', 'forecaster', '→', 'chart_generator', '→', 'insight_generator', '→', 'END'].map((n, i) => (
            <span key={i} style={{
              fontSize: 11,
              color: n === '→' ? 'var(--text3)' : 'var(--success)',
              background: n === '→' ? 'none' : 'rgba(46,168,74,0.1)',
              padding: n === '→' ? '0' : '2px 7px',
              borderRadius: 4,
              fontFamily: n === '→' ? 'inherit' : 'monospace',
            }}>{n}</span>
          ))}
        </div>
      </div>

      <GraphViewer agentType="forecast" />

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, alignItems: 'start' }}>
        {/* Left: upload + run */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Upload Time-Series CSV</div>
            <div
              onClick={() => fileRef.current.click()}
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--success)' }}
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
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>Needs a date + numeric column</div>
                </>
              )}
            </div>

            {result && (
              <div style={{
                marginTop: 12, padding: '10px 12px', borderRadius: 8,
                background: 'rgba(46,168,74,0.08)', border: '1px solid rgba(46,168,74,0.2)',
                fontSize: 12, color: 'var(--success)',
              }}>
                ✓ Detected:<br />
                <strong>Date:</strong> {result.date_col}<br />
                <strong>Value:</strong> {result.value_col}
              </div>
            )}

            <button
              className="btn"
              style={{ width: '100%', justifyContent: 'center', padding: 10, marginTop: 12, background: 'var(--success)', color: '#060d1a', fontWeight: 700 }}
              onClick={run}
              disabled={!file || loading}
            >
              {loading ? <><span className="spinner" style={{ width: 13, height: 13, borderTopColor: '#060d1a' }} /> Forecasting...</> : <><Play size={13} /> Run Forecast</>}
            </button>
          </div>

          {result?.forecast?.length > 0 && (
            <button
              className="btn btn-ghost"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={downloadForecast}
            >
              <Download size={13} /> Download Forecast CSV
            </button>
          )}
        </div>

        {/* Right: results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {loading && <AgentSkeleton accentColor="#2ea84a" />}

          {error && (
            <div className="card" style={{ borderColor: 'rgba(229,72,77,0.3)', background: 'rgba(229,72,77,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)', marginBottom: 6 }}>
                <XCircle size={14} /><span style={{ fontWeight: 600 }}>Forecast Failed</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text2)' }}>{error}</p>
            </div>
          )}

          {result && !loading && (
            <>
              {/* Chart */}
              {result.chart_b64 && (
                <div className="card" style={{ borderColor: 'rgba(46,168,74,0.2)', padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TrendingUp size={14} color="var(--success)" />
                    30-Day Forecast Chart
                  </div>
                  <img
                    src={`data:image/png;base64,${result.chart_b64}`}
                    alt="Forecast Chart"
                    style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border)' }}
                  />
                </div>
              )}

              {/* LLM Insights */}
              {insights.length > 0 && (
                <div className="card" style={{ borderColor: 'rgba(6,182,212,0.15)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Lightbulb size={14} color="var(--accent3)" />
                    LLM Business Insights
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {insights.slice(0, 3).map((insight, i) => (
                      <div key={i} style={{
                        padding: '12px 14px', borderRadius: 9,
                        background: 'rgba(6,182,212,0.06)',
                        border: '1px solid rgba(6,182,212,0.15)',
                        fontSize: 13, lineHeight: 1.7,
                      }}>
                        <span style={{ color: 'var(--accent3)', fontWeight: 600, marginRight: 6 }}>{i + 1}.</span>
                        {insight.replace(/^\d+\.\s*/, '')}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Forecast table (collapsible) */}
              {result.forecast?.length > 0 && (
                <div className="card">
                  <button
                    onClick={() => setShowTable(!showTable)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', color: 'var(--text)', width: '100%', justifyContent: 'space-between' }}
                  >
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>
                      30-Day Forecast Values
                    </span>
                    {showTable ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                  {showTable && (
                    <div style={{ marginTop: 12, overflowY: 'auto', maxHeight: 320 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border)' }}>
                            <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text2)', fontWeight: 600, fontSize: 11 }}>DATE</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text2)', fontWeight: 600, fontSize: 11 }}>FORECASTED {result.value_col?.toUpperCase()}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.forecast.map((row, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(56,139,255,0.03)' }}>
                              <td style={{ padding: '7px 12px', color: 'var(--text2)' }}>{row.date}</td>
                              <td style={{ padding: '7px 12px', textAlign: 'right', color: 'var(--success)', fontFamily: 'monospace', fontWeight: 600 }}>{row.value.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {!result && !loading && !error && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60 }}>
              <TrendingUp size={40} color="var(--text3)" style={{ marginBottom: 14 }} />
              <p style={{ color: 'var(--text2)', fontSize: 13, textAlign: 'center', lineHeight: 1.7 }}>
                Upload a CSV with a date column and numeric values.<br />
                The LangGraph forecasting agent will auto-detect and run a 30-day projection.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
