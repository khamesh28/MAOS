import { useState, useEffect } from 'react'
import { Plus, FolderKanban, MoreHorizontal, X, Circle, ArrowRight, CheckCircle2 } from 'lucide-react'
import { useTeam } from '../context/TeamContext'
import api from '../services/api'

const STATUSES = ['todo', 'in_progress', 'review', 'done']
const STATUS_LABELS = { todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done' }
const STATUS_COLORS = { todo: '#4a5568', in_progress: 'var(--accent)', review: 'var(--warning)', done: 'var(--success)' }
const PRIORITY_COLORS = { low: 'var(--success)', medium: 'var(--warning)', high: '#f97316', critical: 'var(--danger)' }

export default function Projects() {
  const { currentTeam } = useTeam()
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState(null)
  const [tasks, setTasks] = useState([])
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [newProject, setNewProject] = useState({ name: '', description: '', color: '#4f8eff' })
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium', work_item_type: 'task' })
  const [loading, setLoading] = useState(false)

  useEffect(() => { if (currentTeam) loadProjects() }, [currentTeam])
  useEffect(() => { if (selectedProject) loadTasks() }, [selectedProject])

  const loadProjects = async () => {
    try {
      const { data } = await api.get(`/teams/${currentTeam.id}/projects`)
      setProjects(data)
      if (data.length > 0 && !selectedProject) setSelectedProject(data[0])
    } catch (e) { console.error(e) }
  }

  const loadTasks = async () => {
    try {
      const { data } = await api.get(`/teams/${currentTeam.id}/projects/${selectedProject.id}/tasks`)
      setTasks(data)
    } catch (e) { console.error(e) }
  }

  const createProject = async () => {
    if (!newProject.name.trim()) return
    setLoading(true)
    try {
      await api.post(`/teams/${currentTeam.id}/projects`, newProject)
      await loadProjects()
      setShowProjectModal(false)
      setNewProject({ name: '', description: '', color: '#4f8eff' })
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const createTask = async () => {
    if (!newTask.title.trim()) return
    setLoading(true)
    try {
      await api.post(`/teams/${currentTeam.id}/projects/${selectedProject.id}/tasks`, { ...newTask, project_id: selectedProject.id })
      await loadTasks()
      setShowTaskModal(false)
      setNewTask({ title: '', description: '', priority: 'medium', work_item_type: 'task' })
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const updateTaskStatus = async (taskId, status) => {
    try {
      await api.patch(`/teams/${currentTeam.id}/projects/${selectedProject.id}/tasks/${taskId}`, { status })
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t))
    } catch (e) { console.error(e) }
  }

  const deleteTask = async (taskId) => {
    try {
      await api.delete(`/teams/${currentTeam.id}/projects/${selectedProject.id}/tasks/${taskId}`)
      setTasks(prev => prev.filter(t => t.id !== taskId))
    } catch (e) { console.error(e) }
  }

  const tasksByStatus = STATUSES.reduce((acc, s) => ({ ...acc, [s]: tasks.filter(t => t.status === s) }), {})

  return (
    <div className="page" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">{projects.length} projects in {currentTeam?.name}</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowProjectModal(true)}>
          <Plus size={14} /> New Project
        </button>
      </div>

      {/* Project tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
        {projects.map(p => (
          <button key={p.id} onClick={() => setSelectedProject(p)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderRadius: 8, border: `1px solid ${selectedProject?.id === p.id ? p.color : 'var(--border)'}`, background: selectedProject?.id === p.id ? `${p.color}18` : 'transparent', color: selectedProject?.id === p.id ? p.color : 'var(--text2)', fontSize: 13, fontWeight: selectedProject?.id === p.id ? 600 : 400, whiteSpace: 'nowrap', transition: 'all 0.15s', cursor: 'pointer' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
            {p.name}
            <span style={{ fontSize: 11, opacity: 0.7 }}>{p.task_count}</span>
          </button>
        ))}
        {projects.length === 0 && (
          <div className="empty-state" style={{ padding: '40px', width: '100%' }}>
            <FolderKanban size={32} />
            <h3>No projects yet</h3>
            <p>Create your first project to get started</p>
          </div>
        )}
      </div>

      {/* Kanban Board */}
      {selectedProject && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: selectedProject.color }} />
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>{selectedProject.name}</span>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowTaskModal(true)}>
              <Plus size={14} /> Add Task
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, flex: 1, overflowY: 'auto' }}>
            {STATUSES.map(status => (
              <div key={status} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLORS[status] }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{STATUS_LABELS[status]}</span>
                  </div>
                  <span style={{ fontSize: 11, background: 'var(--bg3)', padding: '1px 7px', borderRadius: 10, color: 'var(--text2)' }}>{tasksByStatus[status].length}</span>
                </div>

                {tasksByStatus[status].map(task => (
                  <div key={task.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', transition: 'border-color 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border2)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                    <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8, lineHeight: 1.4 }}>{task.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 10, color: PRIORITY_COLORS[task.priority], fontWeight: 600, textTransform: 'uppercase' }}>{task.priority}</span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {status !== 'done' && (
                          <button onClick={() => updateTaskStatus(task.id, STATUSES[STATUSES.indexOf(status) + 1])}
                            style={{ background: 'none', color: 'var(--text2)', padding: 2 }} title="Move forward">
                            <ArrowRight size={11} />
                          </button>
                        )}
                        <button onClick={() => deleteTask(task.id)} style={{ background: 'none', color: 'var(--text3)', padding: 2 }} title="Delete">
                          <X size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {/* New Project Modal */}
      {showProjectModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowProjectModal(false)}>
          <div className="modal">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 className="modal-title" style={{ marginBottom: 0 }}>New Project</h2>
              <button className="btn-icon" onClick={() => setShowProjectModal(false)}><X size={14} /></button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label className="input-label">Project Name</label>
              <input className="input" placeholder="e.g. Q2 Analytics Pipeline" value={newProject.name} onChange={e => setNewProject(p => ({...p, name: e.target.value}))} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label className="input-label">Description</label>
              <input className="input" placeholder="What is this project about?" value={newProject.description} onChange={e => setNewProject(p => ({...p, description: e.target.value}))} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label className="input-label">Color</label>
              <input type="color" value={newProject.color} onChange={e => setNewProject(p => ({...p, color: e.target.value}))} style={{ width: 48, height: 36, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', cursor: 'pointer', padding: 2 }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowProjectModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createProject} disabled={loading}>
                {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Task Modal */}
      {showTaskModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowTaskModal(false)}>
          <div className="modal">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 className="modal-title" style={{ marginBottom: 0 }}>New Task</h2>
              <button className="btn-icon" onClick={() => setShowTaskModal(false)}><X size={14} /></button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label className="input-label">Title</label>
              <input className="input" placeholder="Task title" value={newTask.title} onChange={e => setNewTask(p => ({...p, title: e.target.value}))} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label className="input-label">Description</label>
              <input className="input" placeholder="Optional description" value={newTask.description} onChange={e => setNewTask(p => ({...p, description: e.target.value}))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div>
                <label className="input-label">Priority</label>
                <select className="input" value={newTask.priority} onChange={e => setNewTask(p => ({...p, priority: e.target.value}))}>
                  {['low','medium','high','critical'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Type</label>
                <select className="input" value={newTask.work_item_type} onChange={e => setNewTask(p => ({...p, work_item_type: e.target.value}))}>
                  {['task','bug','story','feature','epic'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowTaskModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createTask} disabled={loading}>
                {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Create Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
