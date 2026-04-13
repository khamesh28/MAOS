/**
 * GraphViewer — renders a LangGraph Mermaid diagram in a toggleable panel.
 * Uses mermaid.js from CDN (loaded once per page on first open).
 * Props: agentType — "sql" | "forecast" | "anomaly" | "supervisor"
 */
import { useState, useEffect, useRef } from 'react'
import { GitBranch, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import api from '../services/api'

let mermaidLoaded = false
let mermaidReady  = false

function loadMermaid() {
  if (mermaidLoaded) return Promise.resolve()
  mermaidLoaded = true
  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js'
    script.onload = () => {
      window.mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        themeVariables: {
          primaryColor:        '#0a1628',
          primaryTextColor:    '#e8f0fe',
          primaryBorderColor:  '#0052cc',
          lineColor:           '#0066ff',
          secondaryColor:      '#0f1e35',
          tertiaryColor:       '#060d1a',
          background:          '#060d1a',
          mainBkg:             '#0a1628',
          nodeBorder:          '#0052cc',
          clusterBkg:          '#0f1e35',
          titleColor:          '#e8f0fe',
          edgeLabelBackground: '#0f1e35',
          fontFamily:          'monospace',
          fontSize:            '13px',
        },
        flowchart: { htmlLabels: true, curve: 'linear' },
      })
      mermaidReady = true
      resolve()
    }
    document.head.appendChild(script)
  })
}

const AGENT_COLORS = {
  sql:        { border: 'rgba(91,106,240,0.2)',  bg: 'rgba(91,106,240,0.02)',  icon: '#a5b4fc' },
  forecast:   { border: 'rgba(46,168,74,0.2)',   bg: 'rgba(46,168,74,0.02)',   icon: '#2ea84a' },
  anomaly:    { border: 'rgba(229,72,77,0.2)',   bg: 'rgba(229,72,77,0.02)',   icon: '#e5484d' },
  supervisor: { border: 'rgba(212,146,10,0.2)',  bg: 'rgba(212,146,10,0.02)', icon: '#d4920a' },
}

export default function GraphViewer({ agentType }) {
  const [open, setOpen]         = useState(false)
  const [mermaid, setMermaid]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [rendered, setRendered] = useState(false)
  const containerRef = useRef(null)
  const idRef = useRef(`graph-${agentType}-${Math.random().toString(36).slice(2)}`)
  const theme = AGENT_COLORS[agentType] || { border: 'rgba(56,139,255,0.2)', bg: 'rgba(56,139,255,0.02)', icon: '#388bff' }

  const fetchAndRender = async () => {
    if (mermaid && rendered) return  // already done
    setLoading(true)
    try {
      const { data } = await api.get(`/agent/${agentType}/graph`)
      setMermaid(data.mermaid)
    } catch (e) {
      setMermaid('graph TD;\n  A[Error loading graph]')
    } finally {
      setLoading(false)
    }
  }

  // Render mermaid when mermaid string is ready and panel is open
  useEffect(() => {
    if (!open || !mermaid || !containerRef.current) return

    loadMermaid().then(async () => {
      if (!containerRef.current) return
      try {
        const id = idRef.current
        const { svg } = await window.mermaid.render(id, mermaid)
        if (containerRef.current) {
          containerRef.current.innerHTML = svg
          setRendered(true)
        }
      } catch (e) {
        if (containerRef.current) {
          containerRef.current.innerHTML = `<pre style="color:var(--danger);font-size:11px">${mermaid}</pre>`
        }
      }
    })
  }, [open, mermaid])

  const handleToggle = () => {
    const next = !open
    setOpen(next)
    if (next && !mermaid) fetchAndRender()
  }

  return (
    <div className="card" style={{ marginBottom: 16, borderColor: theme.border, background: theme.bg }}>
      <button
        onClick={handleToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          width: '100%', background: 'none', color: 'var(--text)',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7,
            background: `${theme.icon}18`, display: 'flex',
            alignItems: 'center', justifyContent: 'center' }}>
            <GitBranch size={13} color={theme.icon} />
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13 }}>
            View State Machine
          </span>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>
            · compiled LangGraph topology
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {loading && <span className="spinner" style={{ width: 11, height: 11 }} />}
          {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </div>
      </button>

      {open && (
        <div style={{ marginTop: 16 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text3)',
              fontSize: 12 }}>
              Loading graph topology...
            </div>
          ) : (
            <>
              {/* Mermaid render target */}
              <div
                ref={containerRef}
                style={{
                  background: 'var(--bg3)', borderRadius: 10, padding: 20,
                  border: `1px solid ${theme.border}`, overflowX: 'auto',
                  minHeight: 120,
                }}
              />
              {/* Raw Mermaid toggle */}
              <details style={{ marginTop: 10 }}>
                <summary style={{ fontSize: 11, color: 'var(--text3)', cursor: 'pointer',
                  padding: '4px 0' }}>
                  Raw Mermaid source
                </summary>
                <pre style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text2)',
                  background: 'var(--bg3)', padding: '10px 14px', borderRadius: 8,
                  overflowX: 'auto', marginTop: 6, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {mermaid}
                </pre>
              </details>
              <button
                onClick={() => { setRendered(false); setMermaid(''); fetchAndRender() }}
                className="btn btn-ghost"
                style={{ marginTop: 8, fontSize: 11, padding: '4px 10px' }}
              >
                <RefreshCw size={11} /> Refresh
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
