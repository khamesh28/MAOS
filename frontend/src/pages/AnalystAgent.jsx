import { useState, useEffect, useRef } from 'react'
import { Upload, Play, CheckCircle, XCircle, FileText, BarChart2,
         RefreshCw, ChevronDown, ChevronUp, ZoomIn } from 'lucide-react'
import jsPDF from 'jspdf'
import api from '../services/api'

const AGENT_COLOR = '#388bff'

export default function AnalystAgent() {
  const [file, setFile]               = useState(null)
  const [running, setRunning]         = useState(false)
  const [currentRun, setCurrentRun]   = useState(null)
  const [selectedRun, setSelectedRun] = useState(null)
  const [pastRuns, setPastRuns]       = useState([])
  const [showLogs, setShowLogs]       = useState(false)
  const [lightbox, setLightbox]       = useState(null)
  const [exporting, setExporting]     = useState(false)
  const [elapsed, setElapsed]         = useState(0)

  const fileRef    = useRef()
  const resultsRef = useRef()
  const timerRef   = useRef(null)

  useEffect(() => { loadPastRuns() }, [])

  const loadPastRuns = async () => {
    try {
      const { data } = await api.get('/agent/runs')
      setPastRuns(data.filter(r => !r.agent_type || r.agent_type === 'analyst'))
    } catch (e) {}
  }

  const launch = async () => {
    if (!file || running) return
    setRunning(true); setCurrentRun(null); setSelectedRun(null); setElapsed(0)

    // Show elapsed timer while waiting
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)

    try {
      const form = new FormData()
      form.append('file', file)
      // Blocking call — waits until pipeline fully completes (same as Streamlit)
      const { data } = await api.post('/agent/run', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 600000,  // 10 min timeout
      })
      setCurrentRun(data)
      loadPastRuns()
    } catch (e) {
      setCurrentRun({ status: 'failed', error: e?.response?.data?.detail || e.message })
    } finally {
      clearInterval(timerRef.current)
      setRunning(false)
    }
  }

  const viewRun = async (id) => {
    try {
      const { data } = await api.get(`/agent/run/${id}`)
      setSelectedRun(data); setCurrentRun(null)
    } catch (e) {}
  }

  const exportPDF = async () => {
    const run = currentRun || selectedRun
    if (!run) return
    setExporting(true)
    try {


      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageW = 210
      const margin = 14

      // Title
      pdf.setFontSize(20)
      pdf.setTextColor(0, 82, 204)
      pdf.text('Genpact AI Hub', margin, 20)
      pdf.setFontSize(13)
      pdf.setTextColor(60, 60, 60)
      pdf.text('Data Analyst Agent — AI-Generated Report', margin, 28)
      pdf.setFontSize(9)
      pdf.setTextColor(120, 120, 120)
      pdf.text(`Generated: ${new Date().toLocaleString()}  |  Run: ${run.run_id?.slice(0, 12)}...`, margin, 34)
      pdf.setDrawColor(0, 82, 204)
      pdf.setLineWidth(0.5)
      pdf.line(margin, 37, pageW - margin, 37)

      let y = 44

      // Charts
      if (run.charts?.length > 0) {
        pdf.setFontSize(13)
        pdf.setTextColor(0, 82, 204)
        pdf.text('AI-Generated Visualizations', margin, y)
        y += 6

        const imgW = (pageW - margin * 2 - 4) / 2
        const imgH = 55
        let col = 0

        for (const chart of run.charts) {
          try {
            const img = new Image()
            img.crossOrigin = 'anonymous'
            await new Promise((res, rej) => {
              img.onload = res; img.onerror = rej
              img.src = `/charts/${chart}`
            })
            const canvas = document.createElement('canvas')
            canvas.width = img.naturalWidth; canvas.height = img.naturalHeight
            canvas.getContext('2d').drawImage(img, 0, 0)
            const imgData = canvas.toDataURL('image/png')

            const x = margin + col * (imgW + 4)
            if (y + imgH > 285) { pdf.addPage(); y = 14 }
            pdf.addImage(imgData, 'PNG', x, y, imgW, imgH)

            // caption
            pdf.setFontSize(7)
            pdf.setTextColor(100, 100, 100)
            const label = chart.replace(/^[a-f0-9-]+_/, '').replace('.png', '').replaceAll('_', ' ')
            pdf.text(label, x + imgW / 2, y + imgH + 3, { align: 'center' })

            col++
            if (col === 2) { col = 0; y += imgH + 8 }
          } catch (e) {}
        }
        if (col === 1) y += imgH + 8
        y += 4
      }

      // Report
      if (run.report) {
        if (y + 20 > 285) { pdf.addPage(); y = 14 }
        pdf.setDrawColor(0, 82, 204)
        pdf.line(margin, y, pageW - margin, y)
        y += 6
        pdf.setFontSize(13)
        pdf.setTextColor(0, 82, 204)
        pdf.text('AI-Generated Business Report', margin, y)
        y += 7
        pdf.setFontSize(9)
        pdf.setTextColor(40, 40, 40)
        const lines = pdf.splitTextToSize(run.report, pageW - margin * 2)
        for (const line of lines) {
          if (y > 285) { pdf.addPage(); y = 14 }
          pdf.text(line, margin, y)
          y += 4.5
        }
      }

      // Footer
      const pages = pdf.internal.getNumberOfPages()
      for (let i = 1; i <= pages; i++) {
        pdf.setPage(i)
        pdf.setFontSize(8)
        pdf.setTextColor(150, 150, 150)
        pdf.text(`Genpact AI Hub  |  Page ${i} of ${pages}`, pageW / 2, 293, { align: 'center' })
      }

      pdf.save(`Genpact_AI_Report_${new Date().toISOString().slice(0,10)}.pdf`)
    } catch (e) { console.error(e) }
    setExporting(false)
  }

  const displayRun = currentRun || selectedRun

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(56,139,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart2 size={17} color={AGENT_COLOR} />
          </div>
          <div>
            <h1 className="page-title">Data Analyst Agent</h1>
            <p className="page-subtitle">Upload a CSV → 3 AutoGen agents clean, visualize, and report</p>
          </div>
        </div>
      </div>

      {/* Agent Architecture */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12 }}>
          Architecture — pyautogen 0.2.35
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {[
            { name: 'Executive Manager',     role: 'Executes code · Validates output', color: '#2ea84a' },
            { name: 'Senior Data Analyst',   role: 'Cleans data · Generates 5 charts', color: AGENT_COLOR },
            { name: 'Business Report Writer',role: 'Writes 3-section BI report', color: '#d4920a' },
          ].map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: `1px solid ${a.color}25`, borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: a.color, marginBottom: 2 }}>{a.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text2)' }}>{a.role}</div>
              </div>
              {i < 2 && <span style={{ color: 'var(--text3)', fontSize: 16 }}>→</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Upload + Launch */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="card">
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>1. Upload Dataset</div>
          <div
            onClick={() => fileRef.current.click()}
            onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = AGENT_COLOR }}
            onDragLeave={e => e.currentTarget.style.borderColor = file ? 'var(--success)' : 'rgba(255,255,255,0.1)'}
            onDrop={e => { e.preventDefault(); setFile(e.dataTransfer.files[0]); setCurrentRun(null) }}
            style={{ border: `2px dashed ${file ? 'var(--success)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 12, padding: '28px 20px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }}
              onChange={e => { setFile(e.target.files[0]); setCurrentRun(null) }} />
            {file ? (
              <>
                <CheckCircle size={28} color="var(--success)" style={{ marginBottom: 8 }} />
                <div style={{ fontWeight: 600, color: 'var(--success)', marginBottom: 4 }}>{file.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>{(file.size / 1024).toFixed(1)} KB · Click to change</div>
              </>
            ) : (
              <>
                <Upload size={28} color="var(--text3)" style={{ marginBottom: 8 }} />
                <div style={{ color: 'var(--text2)', marginBottom: 4 }}>Drop CSV or click to browse</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>Columns: Date, Region, Product_Category, Revenue, Units_Sold</div>
              </>
            )}
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>2. Run Pipeline</div>
          {running ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
              <span className="spinner" style={{ width: 36, height: 36 }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>Agents running...</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: AGENT_COLOR, marginTop: 6, fontFamily: 'monospace' }}>
                  {String(Math.floor(elapsed / 60)).padStart(2,'0')}:{String(elapsed % 60).padStart(2,'0')}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Phase 1: cleaning + charts → Phase 2: report</div>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.8 }}>
                <div>① Manager sends task to Data Analyst</div>
                <div>② Analyst cleans data, generates 5 charts</div>
                <div>③ Report Writer produces executive BI report</div>
              </div>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 12, marginTop: 12 }}
                onClick={launch} disabled={!file}>
                <Play size={13} /> Launch Pipeline
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {displayRun?.status === 'completed' && (
        <div ref={resultsRef} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>

          {/* Charts */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BarChart2 size={15} color={AGENT_COLOR} />
                <span style={{ fontWeight: 700, fontSize: 15 }}>AI-Generated Visualizations</span>
                <span className="badge badge-blue">{displayRun.charts?.length || 0} charts</span>
              </div>
              <button className="btn btn-primary btn-sm"
                onClick={exportPDF} disabled={exporting}
                style={{ gap: 6, padding: '7px 14px' }}>
                {exporting
                  ? <><span className="spinner" style={{ width: 11, height: 11 }} /> Exporting...</>
                  : <>📄 Export PDF</>}
              </button>
            </div>

            {displayRun.charts?.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                {displayRun.charts.map(chart => (
                  <div key={chart} onClick={() => setLightbox(`/charts/${chart}`)}
                    style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', cursor: 'zoom-in', position: 'relative' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(56,139,255,0.3)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}
                  >
                    <img src={`/charts/${chart}`} alt={chart}
                      style={{ width: '100%', height: 220, objectFit: 'contain', display: 'block', background: '#020810' }}
                      onError={e => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'flex' }} />
                    <div style={{ display: 'none', height: 220, alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 12 }}>
                      Chart not saved
                    </div>
                    <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: 4 }}>
                      <ZoomIn size={11} color="white" />
                    </div>
                    <div style={{ padding: '6px 10px', fontSize: 11, color: 'var(--text3)', background: 'rgba(255,255,255,0.02)' }}>
                      {chart.replace(/^[a-f0-9-]+_/, '').replace('.png', '').replaceAll('_', ' ')}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>
                No charts were saved. Check execution logs below.
              </div>
            )}
          </div>

          {/* Report */}
          {displayRun.report && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileText size={15} color="#d4920a" />
                  <span style={{ fontWeight: 700, fontSize: 15 }}>AI-Generated Business Report</span>
                  <span className="badge badge-yellow">Report Writer Agent</span>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => {
                  const a = document.createElement('a')
                  a.href = URL.createObjectURL(new Blob([displayRun.report], { type: 'text/plain' }))
                  a.download = 'Genpact_AI_Report.txt'; a.click()
                }}>Download .txt</button>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 18, fontSize: 13, lineHeight: 1.9, whiteSpace: 'pre-wrap', maxHeight: 500, overflowY: 'auto' }}>
                {displayRun.report}
              </div>
            </div>
          )}

          {/* Logs */}
          <div className="card">
            <button onClick={() => setShowLogs(!showLogs)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', color: 'var(--text)' }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>Execution Logs</span>
              {showLogs ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            {showLogs && (
              <div className="terminal" style={{ marginTop: 12, maxHeight: 300, overflowY: 'auto' }}>
                {displayRun.data_quality || 'No logs captured.'}
              </div>
            )}
          </div>
        </div>
      )}

      {displayRun?.status === 'failed' && (
        <div className="card" style={{ marginBottom: 20, borderColor: 'rgba(229,72,77,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)' }}>
            <XCircle size={15} /><span style={{ fontWeight: 600 }}>Pipeline Failed</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 6 }}>Check backend terminal for the full traceback.</p>
        </div>
      )}

      {/* Past Runs */}
      {pastRuns.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Past Runs</span>
            <button className="btn-icon" onClick={loadPastRuns}><RefreshCw size={13} /></button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {pastRuns.slice(0, 8).map(run => (
              <div key={run.run_id} onClick={() => viewRun(run.run_id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '9px 14px', borderRadius: 8, cursor: 'pointer',
                  background: displayRun?.run_id === run.run_id ? 'rgba(56,139,255,0.08)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${displayRun?.run_id === run.run_id ? 'rgba(56,139,255,0.2)' : 'transparent'}`,
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {run.status === 'completed' ? <CheckCircle size={13} color="var(--success)" />
                    : run.status === 'failed' ? <XCircle size={13} color="var(--danger)" />
                    : <span className="spinner" style={{ width: 13, height: 13 }} />}
                  <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text3)' }}>{run.run_id.slice(0, 12)}...</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {run.charts_count > 0 && <span style={{ fontSize: 11, color: 'var(--text3)' }}>{run.charts_count} charts</span>}
                  {run.duration_seconds && <span style={{ fontSize: 11, color: 'var(--text3)' }}>{run.duration_seconds}s</span>}
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>{new Date(run.started_at).toLocaleDateString()}</span>
                  <span className={`badge ${run.status === 'completed' ? 'badge-green' : run.status === 'failed' ? 'badge-red' : 'badge-blue'}`}>{run.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="modal-overlay" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="chart" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12 }} />
        </div>
      )}
    </div>
  )
}
