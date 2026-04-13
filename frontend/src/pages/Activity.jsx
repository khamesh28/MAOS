import { useState, useEffect } from 'react'
import { Plus, X, Clock, Users, CheckSquare, Save } from 'lucide-react'
import { useTeam } from '../context/TeamContext'
import api from '../services/api'

const MOODS = ['😞', '😕', '😐', '🙂', '😄']

export default function Activity() {
  const { currentTeam } = useTeam()
  const [activity, setActivity] = useState({ meetings: [], tasks: [], notes: '', mood: 3 })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  useEffect(() => { if (currentTeam) loadToday() }, [currentTeam])

  const loadToday = async () => {
    try {
      const { data } = await api.get(`/teams/${currentTeam.id}/activities/today`)
      setActivity({ meetings: data.meetings || [], tasks: data.tasks || [], notes: data.notes || '', mood: data.mood || 3 })
    } catch (e) { console.error(e) }
  }

  const save = async () => {
    setSaving(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      await api.post(`/teams/${currentTeam.id}/activities`, { ...activity, date: today })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  const addMeeting = () => setActivity(p => ({ ...p, meetings: [...p.meetings, { title: '', duration: 30, summary: '' }] }))
  const addTask    = () => setActivity(p => ({ ...p, tasks: [...p.tasks, { title: '', hours: 1, description: '' }] }))
  const removeMeeting = (i) => setActivity(p => ({ ...p, meetings: p.meetings.filter((_, j) => j !== i) }))
  const removeTask    = (i) => setActivity(p => ({ ...p, tasks: p.tasks.filter((_, j) => j !== i) }))
  const updateMeeting = (i, field, val) => setActivity(p => ({ ...p, meetings: p.meetings.map((m, j) => j === i ? { ...m, [field]: val } : m) }))
  const updateTask    = (i, field, val) => setActivity(p => ({ ...p, tasks: p.tasks.map((t, j) => j === i ? { ...t, [field]: val } : t) }))

  const totalHours = activity.tasks.reduce((s, t) => s + (parseFloat(t.hours) || 0), 0) + activity.meetings.reduce((s, m) => s + (parseInt(m.duration) || 0) / 60, 0)

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Daily Activity Log</h1>
          <p className="page-subtitle">{today}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 14px', fontSize: 13 }}>
            <span style={{ color: 'var(--text2)' }}>Total: </span>
            <span style={{ fontWeight: 700, color: 'var(--text)' }}>{totalHours.toFixed(1)}h</span>
          </div>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
            {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : saved ? '✓ Saved!' : <><Save size={13} /> Save</>}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Meetings */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={15} color="var(--accent)" />
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>Meetings</span>
              <span className="badge badge-blue">{activity.meetings.length}</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={addMeeting}><Plus size={12} /> Add</button>
          </div>
          {activity.meetings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text3)', fontSize: 13 }}>No meetings today</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {activity.meetings.map((m, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                    <input className="input" placeholder="Meeting title" value={m.title} onChange={e => updateMeeting(i, 'title', e.target.value)} style={{ flex: 2 }} />
                    <input className="input" type="number" placeholder="min" value={m.duration} onChange={e => updateMeeting(i, 'duration', e.target.value)} style={{ flex: 1 }} />
                    <button onClick={() => removeMeeting(i)} style={{ background: 'none', color: 'var(--text3)', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text3)'}><X size={13} /></button>
                  </div>
                  <input className="input" placeholder="Summary (optional)" value={m.summary} onChange={e => updateMeeting(i, 'summary', e.target.value)} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tasks */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckSquare size={15} color="var(--success)" />
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>Tasks Worked On</span>
              <span className="badge badge-green">{activity.tasks.length}</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={addTask}><Plus size={12} /> Add</button>
          </div>
          {activity.tasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text3)', fontSize: 13 }}>No tasks logged yet</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {activity.tasks.map((t, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                    <input className="input" placeholder="Task title" value={t.title} onChange={e => updateTask(i, 'title', e.target.value)} style={{ flex: 2 }} />
                    <input className="input" type="number" step="0.5" placeholder="hrs" value={t.hours} onChange={e => updateTask(i, 'hours', e.target.value)} style={{ flex: 1 }} />
                    <button onClick={() => removeTask(i)} style={{ background: 'none', color: 'var(--text3)', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text3)'}><X size={13} /></button>
                  </div>
                  <input className="input" placeholder="What did you do?" value={t.description} onChange={e => updateTask(i, 'description', e.target.value)} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Notes + Mood */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginTop: 16 }}>
        <div className="card">
          <label style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, color: 'var(--text)', display: 'block', marginBottom: 10 }}>Notes</label>
          <textarea className="input" placeholder="Any notes, blockers, or highlights from today..." value={activity.notes} onChange={e => setActivity(p => ({ ...p, notes: e.target.value }))} style={{ resize: 'vertical', minHeight: 80 }} />
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, marginBottom: 16, color: 'var(--text2)' }}>How was your day?</div>
          <div style={{ fontSize: 36, marginBottom: 12 }}>{MOODS[activity.mood - 1]}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {MOODS.map((m, i) => (
              <button key={i} onClick={() => setActivity(p => ({ ...p, mood: i + 1 }))}
                style={{ fontSize: 22, background: 'none', opacity: activity.mood === i + 1 ? 1 : 0.3, transition: 'all 0.15s' }}>
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
