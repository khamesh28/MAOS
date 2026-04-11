import { useState, useEffect } from 'react'
import { Users, Plus, X, Crown, Shield, User } from 'lucide-react'
import { useTeam } from '../context/TeamContext'
import api from '../services/api'

const ROLE_ICONS = { admin: Crown, manager: Shield, member: User, viewer: User }
const ROLE_COLORS = { admin: 'var(--warning)', manager: 'var(--accent)', member: 'var(--success)', viewer: 'var(--text2)' }

export default function Team() {
  const { currentTeam, teams, createTeam } = useTeam()
  const [members, setMembers] = useState([])
  const [showInvite, setShowInvite] = useState(false)
  const [showCreateTeam, setShowCreateTeam] = useState(false)
  const [invite, setInvite] = useState({ email: '', role: 'member' })
  const [newTeam, setNewTeam] = useState({ name: '', description: '' })
  const [loading, setLoading] = useState(false)

  useEffect(() => { if (currentTeam) loadMembers() }, [currentTeam])

  const loadMembers = async () => {
    try {
      const { data } = await api.get(`/teams/${currentTeam.id}/members`)
      setMembers(data)
    } catch (e) { console.error(e) }
  }

  const addMember = async () => {
    if (!invite.email.trim()) return
    setLoading(true)
    try {
      await api.post(`/teams/${currentTeam.id}/members`, invite)
      await loadMembers()
      setShowInvite(false)
      setInvite({ email: '', role: 'member' })
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to add member')
    } finally { setLoading(false) }
  }

  const handleCreateTeam = async () => {
    if (!newTeam.name.trim()) return
    setLoading(true)
    try {
      await createTeam(newTeam.name, newTeam.description)
      setShowCreateTeam(false)
      setNewTeam({ name: '', description: '' })
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Team</h1>
          <p className="page-subtitle">{members.length} members in {currentTeam?.name}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowCreateTeam(true)}><Plus size={13} /> New Team</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowInvite(true)}><Plus size={13} /> Invite Member</button>
        </div>
      </div>

      {/* All Teams */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Your Teams</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {teams.map(t => (
            <div key={t.id} style={{ background: 'var(--bg3)', border: `1px solid ${t.id === currentTeam?.id ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8, padding: '8px 14px', fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>{t.name}</span>
              <span className={`badge badge-${t.role === 'admin' ? 'yellow' : 'blue'}`} style={{ marginLeft: 8 }}>{t.role}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Members */}
      <div className="card">
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Members</h3>
        {members.length === 0 ? (
          <div className="empty-state"><Users size={28} /><h3>No members yet</h3><p>Invite someone to get started</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {members.map(m => {
              const RoleIcon = ROLE_ICONS[m.role] || User
              return (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg3)', borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--accent2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>
                      {m.name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text2)' }}>{m.email}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <RoleIcon size={13} color={ROLE_COLORS[m.role]} />
                    <span style={{ fontSize: 12, color: ROLE_COLORS[m.role], fontWeight: 600, textTransform: 'capitalize' }}>{m.role}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowInvite(false)}>
          <div className="modal">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 className="modal-title" style={{ marginBottom: 0 }}>Invite Member</h2>
              <button className="btn-icon" onClick={() => setShowInvite(false)}><X size={14} /></button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label className="input-label">Email Address</label>
              <input className="input" type="email" placeholder="colleague@company.com" value={invite.email} onChange={e => setInvite(p => ({...p, email: e.target.value}))} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label className="input-label">Role</label>
              <select className="input" value={invite.role} onChange={e => setInvite(p => ({...p, role: e.target.value}))}>
                {['admin','manager','member','viewer'].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowInvite(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addMember} disabled={loading}>
                {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Send Invite'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Team Modal */}
      {showCreateTeam && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCreateTeam(false)}>
          <div className="modal">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 className="modal-title" style={{ marginBottom: 0 }}>Create Team</h2>
              <button className="btn-icon" onClick={() => setShowCreateTeam(false)}><X size={14} /></button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label className="input-label">Team Name</label>
              <input className="input" placeholder="e.g. AI Research Team" value={newTeam.name} onChange={e => setNewTeam(p => ({...p, name: e.target.value}))} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label className="input-label">Description</label>
              <input className="input" placeholder="What does this team work on?" value={newTeam.description} onChange={e => setNewTeam(p => ({...p, description: e.target.value}))} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowCreateTeam(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateTeam} disabled={loading}>
                {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Create Team'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
