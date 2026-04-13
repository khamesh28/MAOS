import { useState, useRef, useEffect } from 'react'
import { Upload, Database, Send, CheckCircle, XCircle, ChevronRight, Lightbulb, RotateCcw, MessageSquare } from 'lucide-react'
import api from '../services/api'
import GraphViewer from '../components/GraphViewer'
import AgentSkeleton from '../components/AgentSkeleton'

const AGENT_COLOR = '#5b6af0'
const AGENT_RGBA  = 'rgba(91,106,240,'

const EXAMPLE_QUESTIONS = [
  'What is the total revenue by region?',
  'Which product has the highest sales?',
  'Show me the top 5 rows by revenue',
  'What is the average order value?',
  'How many records are in each category?',
]

const newSessionId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

export default function SQLAgent() {
  const [file, setFile]           = useState(null)
  const [question, setQuestion]   = useState('')
  const [loading, setLoading]     = useState(false)
  const [messages, setMessages]   = useState([])
  const [sessionId, setSessionId] = useState(newSessionId)
  const [turnCount, setTurnCount] = useState(0)
  const fileRef  = useRef()
  const chatRef  = useRef()
  const inputRef = useRef()

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages, loading])

  const run = async () => {
    if (!file || !question.trim() || loading) return
    const q = question.trim()
    setQuestion('')
    setLoading(true)
    setMessages(prev => [...prev, { role: 'user', question: q }])
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('question', q)
      form.append('session_id', sessionId)
      const { data } = await api.post('/agent/sql', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setTurnCount(t => t + 1)
      setMessages(prev => [...prev, {
        role:        'assistant',
        question:    q,
        query:       data.query,
        result:      data.result,
        explanation: data.explanation,
        error:       data.error,
        status:      data.status,
        turn:        turnCount + 1,
      }])
    } catch (e) {
      setMessages(prev => [...prev, {
        role:  'assistant',
        error: e.response?.data?.detail || e.message || 'Agent failed',
        status: 'failed',
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const startNewSession = () => {
    setSessionId(newSessionId())
    setMessages([])
    setTurnCount(0)
    setQuestion('')
  }

  const handleKeyDown = e => {
    // Cmd/Ctrl+Enter always submits
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); run(); return }
    // Plain Enter submits if the question is a single line (no newlines yet)
    if (e.key === 'Enter' && !e.shiftKey && !question.includes('\n')) { e.preventDefault(); run() }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: `${AGENT_RGBA}0.15)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Database size={16} color={AGENT_COLOR} />
          </div>
          <div>
            <h1 className="page-title">SQL Agent</h1>
            <p className="page-subtitle">Ask natural language questions about your CSV data — LangGraph with MemorySaver remembers your conversation</p>
          </div>
        </div>
      </div>

      {/* Architecture callout */}
      <div className="card" style={{ marginBottom: 20, borderColor: `${AGENT_RGBA}0.2)`, background: `${AGENT_RGBA}0.05)` }}>
        <div style={{ fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
          LangGraph State Machine + MemorySaver
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {[
            { name: 'START',           color: 'var(--text3)' },
            { name: '→',              color: 'var(--text3)' },
            { name: 'sql_generator',   color: AGENT_COLOR },
            { name: '→',              color: 'var(--text3)' },
            { name: 'sql_executor',    color: AGENT_COLOR },
            { name: '→ (success)',     color: 'var(--text3)' },
            { name: 'result_explainer',color: AGENT_COLOR },
            { name: '→',              color: 'var(--text3)' },
            { name: 'END',             color: 'var(--text3)' },
          ].map((n, i) => (
            <span key={i} style={{
              fontSize: 12, color: n.color,
              background: n.name.startsWith('→') || n.name === 'START' || n.name === 'END' ? 'none' : `${AGENT_RGBA}0.1)`,
              padding: n.name.startsWith('→') || n.name === 'START' || n.name === 'END' ? '0' : '2px 8px',
              borderRadius: 4,
              fontFamily: n.name.startsWith('→') || n.name === 'START' || n.name === 'END' ? 'inherit' : 'monospace',
            }}>{n.name}</span>
          ))}
          <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 8 }}>
            · MemorySaver checkpoint per session · error_handler retries on failure
          </span>
        </div>
      </div>

      <GraphViewer agentType="sql" />

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, alignItems: 'start' }}>

        {/* Left sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* File upload */}
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Upload CSV</div>
            <div
              onClick={() => fileRef.current.click()}
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = AGENT_COLOR }}
              onDragLeave={e => { e.currentTarget.style.borderColor = file ? 'var(--success)' : 'var(--border2)' }}
              onDrop={e => { e.preventDefault(); setFile(e.dataTransfer.files[0]); startNewSession() }}
              style={{
                border: `2px dashed ${file ? 'var(--success)' : 'var(--border2)'}`,
                borderRadius: 9, padding: '20px', textAlign: 'center', cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }}
                onChange={e => { setFile(e.target.files[0]); startNewSession() }} />
              {file ? (
                <>
                  <CheckCircle size={22} color="var(--success)" style={{ marginBottom: 6 }} />
                  <div style={{ fontWeight: 600, color: 'var(--success)', fontSize: 12 }}>{file.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{(file.size / 1024).toFixed(1)} KB</div>
                </>
              ) : (
                <>
                  <Upload size={22} color="var(--text3)" style={{ marginBottom: 6 }} />
                  <div style={{ fontSize: 12, fontWeight: 500 }}>Drop CSV or click</div>
                </>
              )}
            </div>
          </div>

          {/* Session info */}
          <div className="card" style={{ background: `${AGENT_RGBA}0.04)`, borderColor: `${AGENT_RGBA}0.15)` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: 5 }}>
                <MessageSquare size={12} />
                Session Memory
              </div>
              <button
                onClick={startNewSession}
                className="btn btn-ghost"
                style={{ fontSize: 11, padding: '3px 8px', gap: 4 }}
                title="Clear history and start a new conversation"
              >
                <RotateCcw size={11} /> New Session
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.8 }}>
              <div>Turns: <span style={{ color: 'var(--text)', fontWeight: 600 }}>{turnCount}</span></div>
              <div style={{ marginTop: 2, wordBreak: 'break-all', color: 'var(--text3)' }}>
                ID: <span style={{ fontFamily: 'monospace', fontSize: 10 }}>{sessionId.slice(0, 12)}…</span>
              </div>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6, lineHeight: 1.6 }}>
              Memory is <strong style={{ color: 'var(--warning)' }}>session-based</strong> — persists until server restart. Follow-up questions remember prior results via LangGraph MemorySaver.
            </p>
          </div>

          {/* Example chips */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Lightbulb size={13} color="var(--warning)" />
              <span style={{ fontSize: 12, fontWeight: 600 }}>Example Questions</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {EXAMPLE_QUESTIONS.map(q => (
                <button
                  key={q}
                  onClick={() => { setQuestion(q); inputRef.current?.focus() }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 10px', borderRadius: 7, cursor: 'pointer',
                    background: question === q ? `${AGENT_RGBA}0.1)` : 'var(--bg3)',
                    border: `1px solid ${question === q ? `${AGENT_RGBA}0.3)` : 'transparent'}`,
                    color: question === q ? '#a5b4fc' : 'var(--text2)',
                    fontSize: 12, textAlign: 'left', transition: 'all 0.15s',
                  }}
                >
                  <ChevronRight size={11} />
                  <span>{q}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: chat panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div className="card" style={{ padding: 0, borderColor: `${AGENT_RGBA}0.2)`, overflow: 'hidden' }}>

            {/* Chat header */}
            <div style={{
              padding: '14px 18px', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: `${AGENT_RGBA}0.04)`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Database size={14} color="#a5b4fc" />
                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-display)' }}>
                  Conversation
                </span>
                {turnCount > 0 && (
                  <span style={{
                    fontSize: 10, padding: '1px 7px', borderRadius: 20,
                    background: `${AGENT_RGBA}0.15)`, color: '#a5b4fc', fontWeight: 600,
                  }}>
                    {turnCount} {turnCount === 1 ? 'turn' : 'turns'}
                  </span>
                )}
              </div>
              {messages.length > 0 && (
                <button
                  onClick={startNewSession}
                  className="btn btn-ghost"
                  style={{ fontSize: 11, padding: '3px 8px', gap: 4 }}
                >
                  <RotateCcw size={11} /> New Session
                </button>
              )}
            </div>

            {/* Messages area */}
            <div
              ref={chatRef}
              style={{
                minHeight: 380, maxHeight: 520, overflowY: 'auto',
                padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 16,
              }}
            >
              {messages.length === 0 && loading && (
                <div style={{ padding: '8px 0' }}>
                  <AgentSkeleton accentColor={AGENT_COLOR} />
                </div>
              )}

              {messages.length === 0 && !loading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 320 }}>
                  <Database size={40} color="var(--text3)" style={{ marginBottom: 14 }} />
                  <p style={{ color: 'var(--text2)', fontSize: 13, textAlign: 'center', lineHeight: 1.7 }}>
                    {file
                      ? <>Ask a question about <strong style={{ color: 'var(--text)' }}>{file.name}</strong>.<br />Follow-up questions will remember earlier results.</>
                      : <>Upload a CSV, then ask questions.<br />Follow-up questions will remember earlier results.</>
                    }
                  </p>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i}>
                  {msg.role === 'user' ? (
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <div style={{
                        maxWidth: '75%', padding: '10px 14px', borderRadius: '14px 14px 4px 14px',
                        background: `${AGENT_RGBA}0.18)`, border: `1px solid ${AGENT_RGBA}0.3)`,
                        fontSize: 13, color: 'var(--text)', lineHeight: 1.6,
                      }}>
                        {msg.question}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: '90%' }}>
                      {msg.error && !msg.query ? (
                        <div style={{
                          padding: '10px 14px', borderRadius: '4px 14px 14px 14px',
                          background: 'rgba(229,72,77,0.08)', border: '1px solid rgba(229,72,77,0.2)',
                          display: 'flex', alignItems: 'center', gap: 8,
                        }}>
                          <XCircle size={13} color="var(--danger)" />
                          <span style={{ fontSize: 12, color: 'var(--danger)' }}>{msg.error}</span>
                        </div>
                      ) : (
                        <>
                          {msg.query && (
                            <div style={{
                              background: 'var(--bg3)', borderRadius: '4px 14px 14px 14px',
                              border: `1px solid ${AGENT_RGBA}0.2)`, padding: '10px 14px',
                            }}>
                              <div style={{ fontSize: 10, color: '#a5b4fc', fontWeight: 600, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Pandas Query
                              </div>
                              <div style={{
                                fontFamily: 'monospace', fontSize: 12, color: '#b8c0ff',
                                whiteSpace: 'pre-wrap', lineHeight: 1.6,
                              }}>
                                {msg.query}
                              </div>
                            </div>
                          )}

                          {msg.result && (
                            <div style={{
                              background: 'var(--bg2)', borderRadius: 10,
                              border: '1px solid var(--border)', padding: '10px 14px',
                            }}>
                              <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Result
                              </div>
                              <div style={{
                                fontFamily: 'monospace', fontSize: 12, color: 'var(--text)',
                                whiteSpace: 'pre-wrap', maxHeight: 220, overflowY: 'auto', lineHeight: 1.7,
                              }}>
                                {msg.result}
                              </div>
                            </div>
                          )}

                          {msg.explanation && (
                            <div style={{
                              padding: '10px 14px', borderRadius: 10,
                              background: 'rgba(46,168,74,0.05)', border: '1px solid rgba(46,168,74,0.15)',
                              display: 'flex', gap: 8,
                            }}>
                              <Lightbulb size={13} color="var(--success)" style={{ marginTop: 2, flexShrink: 0 }} />
                              <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text)', margin: 0 }}>
                                {msg.explanation}
                              </p>
                            </div>
                          )}

                          {msg.error && msg.query && (
                            <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(212,146,10,0.06)', border: '1px solid rgba(212,146,10,0.2)' }}>
                              <p style={{ fontSize: 11, color: 'var(--warning)', margin: 0 }}>⚠ {msg.error}</p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 4, padding: '10px 14px', background: 'var(--bg3)', borderRadius: '4px 14px 14px 14px', border: '1px solid var(--border)' }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: '#a5b4fc',
                        animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                      }} />
                    ))}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>Generating query...</span>
                </div>
              )}
            </div>

            {/* Input bar */}
            <div style={{
              padding: '12px 18px', borderTop: '1px solid var(--border)',
              display: 'flex', gap: 10, alignItems: 'flex-end',
              background: 'var(--bg2)',
            }}>
              <textarea
                ref={inputRef}
                className="input"
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={file ? 'Ask a question… (Enter or ⌘+Enter to send)' : 'Upload a CSV first…'}
                rows={2}
                disabled={!file || loading}
                style={{ flex: 1, resize: 'none', margin: 0, fontSize: 13 }}
              />
              <button
                onClick={run}
                disabled={!file || !question.trim() || loading}
                style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: file && question.trim() && !loading ? AGENT_COLOR : 'var(--bg3)',
                  border: `1px solid ${AGENT_RGBA}0.3)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: file && question.trim() && !loading ? 'pointer' : 'not-allowed',
                  transition: 'all 0.15s',
                }}
              >
                {loading
                  ? <span className="spinner" style={{ width: 14, height: 14 }} />
                  : <Send size={14} color={file && question.trim() ? 'white' : 'var(--text3)'} />
                }
              </button>
            </div>
          </div>

          <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'right', marginTop: 6, paddingRight: 2 }}>
            Enter to send · ⌘+Enter in multi-line · New Session clears memory
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
