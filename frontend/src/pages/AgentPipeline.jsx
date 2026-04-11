import { useState, useEffect, useRef } from 'react'
import { Upload, Bot, Play, CheckCircle, XCircle, FileText, BarChart2, RefreshCw, ChevronDown, ChevronUp, Terminal } from 'lucide-react'
import api from '../services/api'

export default function AgentPipeline() {
  const [file, setFile] = useState(null)
  const [running, setRunning] = useState(false)
  const [currentRun, setCurrentRun] = useState(null)
  const [pastRuns, setPastRuns] = useState([])
  const [phase, setPhase] = useState(0)
  const [showLogs, setShowLogs] = useState(false)
  const [selectedRun, setSelectedRun] = useState(null)
  const fileRef = useRef()
  const pollRef = useRef()
  const phaseTimer = useRef()

  useEffect(() => {
    loadPastRuns()
    return () => { clearInterval(pollRef.current); clearTimeout(phaseTimer.current) }
  }, [])

  const loadPastRuns = async () => {
    try {
      const { data } = await api.get('/agent/runs')
      setPastRuns(data)
    } catch (e) { console.error(e) }
  }

  const startPipeline = async () => {
    if (!file) return
    setRunning(true)
    setPhase(1)
    setCurrentRun(null)
    setSelectedRun(null)
    clearInterval(pollRef.current)

    // Auto-advance phase indicator for UX
    phaseTimer.current = setTimeout(() => setPhase(2), 5000)
    setTimeout(() => setPhase(3), 60000)

    try {
      const form = new FormData()
      form.append('file', file)
      const { data } = await api.post('/agent/run', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      pollRef.current = setInterval(async () => {
        try {
          const { data: status } = await api.get(`/agent/run/${data.run_id}`)
          setCurrentRun(status)
          if (status.status === 'completed') {
            clearInterval(pollRef.current)
            clearTimeout(phaseTimer.current)
            setRunning(false)
            setPhase(4)
            loadPastRuns()
          } else if (status.status === 'failed') {
            clearInterval(pollRef.current)
            clearTimeout(phaseTimer.current)
            setRunning(false)
            setPhase(0)
          }
        } catch (e) { console.error(e) }
      }, 5000)

    } catch (e) {
      console.error(e)
      setRunning(false)
      setPhase(0)
    }
  }

  const loadRunDetails = async (runId) => {
    try {
      const { data } = await api.get(`/agent/run/${runId}`)
      setSelectedRun(data)
      setCurrentRun(null)
    } catch (e) { console.error(e) }
  }

  const displayRun = currentRun || selectedRun

  const PHASES = [
    { label: 'Upload CSV', icon: Upload },
    { label: 'Data Analyst Agent — cleaning data & generating charts', icon: Bot },
    { label: 'Report Writer Agent — writing executive BI report', icon: FileText },
    { label: 'Pipeline Complete ✓', icon: CheckCircle },
  ]

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Agent Pipeline</h1>
        <p className="page-subtitle">Upload any CSV → 3 autonomous agents clean, visualize, and report using Groq (Llama 3.3 70B) via AutoGen</p>
      </div>

      {/* Architecture */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 14 }}>
          Agent Architecture — pyautogen 0.2.35 + Groq API
        </div>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
          {[
            { name: '🟢 Executive Manager', role: 'UserProxyAgent • Executes code • Validates output • Routes between agents', color: '#10b981' },
            { name: '🔵 Senior Data Analyst', role: 'AssistantAgent • LLM-powered • Writes Python • Cleans messy data • Generates 5 charts', color: 'var(--accent)' },
            { name: '🟡 Business Report Writer', role: 'AssistantAgent • LLM-powered • Reads insights • Writes 3-section BI report', color: 'var(--warning)' },
          ].map((agent, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
              <div style={{ flex: 1, background: 'var(--bg3)', border: `1px solid ${agent.color}25`, borderRadius: 10, padding: '14px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: agent.color, marginBottom: 4 }}>{agent.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.6 }}>{agent.role}</div>
              </div>
              {i < 2 && <div style={{ color: 'var(--text3)', fontSize: 20, flexShrink: 0 }}>→</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Upload + Status grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="card">
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>1. Upload Dataset (any CSV)</div>
          <div
            onClick={() => fileRef.current.click()}
            onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent)' }}
            onDragLeave={e => e.currentTarget.style.borderColor = file ? 'var(--success)' : 'var(--border2)'}
            onDrop={e => { e.preventDefault(); setFile(e.dataTransfer.files[0]); setCurrentRun(null); setPhase(0) }}
            style={{ border: `2px dashed ${file ? 'var(--success)' : 'var(--border2)'}`, borderRadius: 10, padding: '32px 20px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', background: file ? 'rgba(16,185,129,0.05)' : 'transparent' }}
          >
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { setFile(e.target.files[0]); setCurrentRun(null); setPhase(0) }} />
            {file ? (
              <>
                <CheckCircle size={30} color="var(--success)" style={{ marginBottom: 10 }} />
                <div style={{ fontWeight: 600, color: 'var(--success)', marginBottom: 4 }}>{file.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>{(file.size / 1024).toFixed(1)} KB · Click to change</div>
              </>
            ) : (
              <>
                <Upload size={30} color="var(--text3)" style={{ marginBottom: 10 }} />
                <div style={{ fontWeight: 500, marginBottom: 4 }}>Drop CSV here or click to browse</div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>Works with any tabular dataset</div>
              </>
            )}
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>2. Pipeline Status</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {PHASES.map((p, i) => {
              const done = phase > i + 1 || phase === 4
              const active = phase === i + 1 && running
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: done ? 'rgba(16,185,129,0.15)' : active ? 'rgba(79,142,255,0.15)' : 'var(--bg3)', border: `1px solid ${done ? 'var(--success)' : active ? 'var(--accent)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {done ? <CheckCircle size={14} color="var(--success)" /> : active ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <p.icon size={12} color="var(--text3)" />}
                  </div>
                  <span style={{ fontSize: 13, color: done ? 'var(--success)' : active ? 'var(--text)' : 'var(--text2)', fontWeight: active ? 600 : 400 }}>{p.label}</span>
                </div>
              )
            })}
          </div>

          {running && (
            <div style={{ background: 'rgba(79,142,255,0.08)', border: '1px solid rgba(79,142,255,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--accent)', marginBottom: 12, lineHeight: 1.6 }}>
              ⚡ Agents are actively working via Groq API...<br />
              This takes <strong>1–3 minutes</strong>. Page auto-updates every 5 seconds.
            </div>
          )}

          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 12 }} onClick={startPipeline} disabled={!file || running}>
            {running ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Agents Running...</> : <><Play size={14} /> Launch Pipeline</>}
          </button>
        </div>
      </div>

      {/* Results */}
      {displayRun?.status === 'completed' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 }}>
          {displayRun.charts?.length > 0 ? (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <BarChart2 size={16} color="var(--accent)" />
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>AI-Generated Visualizations</span>
                <span className="badge badge-blue">{displayRun.charts.length} charts</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {displayRun.charts.map(chart => (
                  <div key={chart} style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <img src={`/charts/${chart}`} alt={chart} style={{ width: '100%', height: 200, objectFit: 'contain', display: 'block', background: '#0d1320' }} onError={e => e.target.style.display = 'none'} />
                    <div style={{ padding: '7px 12px', fontSize: 11, color: 'var(--text2)', background: 'var(--bg3)' }}>
                      {chart.replace(/^[a-f0-9-]+_/, '').replace('.png', '').replaceAll('_', ' ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: 30, color: 'var(--text2)' }}>
              <p style={{ fontSize: 13 }}>⚠️ Charts were not saved. The agent may have used a different save path. Check audit logs below.</p>
            </div>
          )}

          {displayRun.report && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileText size={16} color="var(--warning)" />
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>AI-Generated Business Report</span>
                  <span className="badge badge-yellow">Report Writer Agent</span>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => {
                  const blob = new Blob([displayRun.report], { type: 'text/plain' })
                  const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
                  a.download = 'MAOS_Business_Report.txt'; a.click()
                }}>📥 Download</button>
              </div>
              <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: 20, fontSize: 13, lineHeight: 1.9, color: 'var(--text)', whiteSpace: 'pre-wrap', maxHeight: 500, overflowY: 'auto' }}>
                {displayRun.report}
              </div>
            </div>
          )}

          <div className="card">
            <button onClick={() => setShowLogs(!showLogs)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', color: 'var(--text)', width: '100%', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Terminal size={15} color="var(--text2)" />
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>Execution Traceability Logs (Data Quality Report)</span>
              </div>
              {showLogs ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showLogs && (
              <div style={{ marginTop: 14, background: '#050d0a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '14px 16px', fontFamily: 'monospace', fontSize: 12, color: '#10b981', whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto', lineHeight: 1.6 }}>
                {displayRun.data_quality || 'No execution log captured.'}
              </div>
            )}
          </div>
        </div>
      )}

      {displayRun?.status === 'failed' && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)', marginBottom: 8 }}>
            <XCircle size={16} /><span style={{ fontWeight: 600 }}>Pipeline Failed</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text2)' }}>Check backend terminal for full error traceback. Try a cleaner CSV and rerun.</p>
        </div>
      )}

      {/* Past Runs */}
      {pastRuns.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>Past Runs</span>
            <button className="btn-icon" onClick={loadPastRuns}><RefreshCw size={13} /></button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pastRuns.map(run => (
              <div key={run.run_id} onClick={() => loadRunDetails(run.run_id)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: (displayRun?.run_id === run.run_id) ? 'var(--card-hover)' : 'var(--bg3)', borderRadius: 8, cursor: 'pointer', border: `1px solid ${(displayRun?.run_id === run.run_id) ? 'var(--border2)' : 'transparent'}`, transition: 'all 0.15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {run.status === 'completed' ? <CheckCircle size={14} color="var(--success)" /> : run.status === 'failed' ? <XCircle size={14} color="var(--danger)" /> : <span className="spinner" style={{ width: 14, height: 14 }} />}
                  <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text2)' }}>{run.run_id.slice(0, 12)}...</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 11, color: 'var(--text2)' }}>{run.charts_count} charts</span>
                  <span style={{ fontSize: 11, color: 'var(--text2)' }}>{new Date(run.started_at).toLocaleDateString()}</span>
                  <span className={`badge ${run.status === 'completed' ? 'badge-green' : run.status === 'failed' ? 'badge-red' : 'badge-blue'}`}>{run.status}</span>
                </div>
              </div>
            ))}
          </div>
          {selectedRun && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text2)', textAlign: 'center' }}>↑ Showing results for selected run above</div>}
        </div>
      )}
    </div>
  )
}
