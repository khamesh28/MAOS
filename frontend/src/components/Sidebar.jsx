import { useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Bot, Activity, FolderKanban,
  Clock, PieChart, BarChart3, Users, LogOut,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Database, TrendingUp, AlertTriangle, BarChart2,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTeam } from '../context/TeamContext'

const AGENT_CHILDREN = [
  { icon: BarChart2,     label: 'Data Analyst', path: '/agents/analyst' },
  { icon: Database,      label: 'SQL Agent',    path: '/agents/sql' },
  { icon: TrendingUp,    label: 'Forecasting',  path: '/agents/forecast' },
  { icon: AlertTriangle, label: 'Anomaly Det.', path: '/agents/anomaly' },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [agentsOpen, setAgentsOpen] = useState(true)
  const { user, logout } = useAuth()
  const { currentTeam, teams, selectTeam } = useTeam()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => { logout(); navigate('/login') }
  const isAgentActive = location.pathname.startsWith('/agents')

  return (
    <aside style={{
      width: collapsed ? 64 : 240,
      minWidth: collapsed ? 64 : 240,
      background: '#050b18',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.25s ease, min-width 0.25s ease',
      overflow: 'hidden',
      position: 'relative',
    }}>

      {/* Logo */}
      <div style={{
        padding: '20px 16px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{
          width: 32, height: 32,
          borderRadius: 10,
          background: '#388bff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 16,
          color: 'white',
        }}>G</div>
        {!collapsed && (
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, lineHeight: 1.2, color: '#f0f6ff' }}>Genpact AI Hub</div>
            <div style={{ fontSize: 10, color: '#3d5a7a', letterSpacing: '0.8px', textTransform: 'uppercase', marginTop: 2 }}>AI OPERATIONS</div>
          </div>
        )}
      </div>

      {/* Team Selector */}
      {!collapsed && currentTeam && (
        <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 10, color: '#3d5a7a', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6, fontWeight: 500 }}>Workspace</div>
          <select
            value={currentTeam.id}
            onChange={e => selectTeam(teams.find(t => t.id === e.target.value))}
            style={{
              width: '100%',
              background: '#080f1e',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              padding: '6px 10px',
              color: '#f0f6ff',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 10px', overflowY: 'auto' }}>

        {/* Overview */}
        <NavLink
          to="/dashboard"
          className={({ isActive }) => `sidebar-nav-link${isActive ? ' active' : ''}`}
          title={collapsed ? 'Overview' : ''}
        >
          <LayoutDashboard size={15} style={{ flexShrink: 0 }} />
          {!collapsed && <span>Overview</span>}
        </NavLink>

        {/* AI Agents — expandable section */}
        <button
          onClick={() => !collapsed && setAgentsOpen(o => !o)}
          title={collapsed ? 'AI Agents' : ''}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            width: '100%', padding: '8px 12px', borderRadius: 8, marginBottom: 1,
            background: isAgentActive ? 'rgba(56,139,255,0.08)' : 'transparent',
            borderLeft: `2px solid ${isAgentActive ? '#388bff' : 'transparent'}`,
            color: isAgentActive ? '#f0f6ff' : '#7d9cc0',
            fontSize: 13, fontWeight: isAgentActive ? 500 : 400,
            transition: 'all 0.2s', whiteSpace: 'nowrap', overflow: 'hidden',
          }}
          onMouseEnter={e => {
            if (!isAgentActive) {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
              e.currentTarget.style.color = '#f0f6ff'
            }
          }}
          onMouseLeave={e => {
            if (!isAgentActive) {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = '#7d9cc0'
            }
          }}
        >
          <Bot size={15} style={{ flexShrink: 0 }} />
          {!collapsed && (
            <>
              <span style={{ flex: 1, textAlign: 'left' }}>AI Agents</span>
              {agentsOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </>
          )}
        </button>

        {/* Agent children */}
        {!collapsed && agentsOpen && (
          <div style={{ paddingLeft: 12, marginBottom: 4 }}>
            {AGENT_CHILDREN.map(({ icon: Icon, label, path }) => (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) => `sidebar-sub-link${isActive ? ' active' : ''}`}
              >
                <Icon size={13} style={{ flexShrink: 0 }} />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        )}

        {/* Monitor — with live dot */}
        <NavLink
          to="/monitor"
          className={({ isActive }) => `sidebar-nav-link${isActive ? ' active' : ''}`}
          title={collapsed ? 'Monitor' : ''}
        >
          <Activity size={15} style={{ flexShrink: 0 }} />
          {!collapsed && (
            <>
              <span style={{ flex: 1 }}>Monitor</span>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: '#2ea84a',
                animation: 'livePulse 2s infinite',
                flexShrink: 0,
              }} />
            </>
          )}
        </NavLink>

        <NavLink to="/projects" className={({ isActive }) => `sidebar-nav-link${isActive ? ' active' : ''}`} title={collapsed ? 'Projects' : ''}>
          <FolderKanban size={15} style={{ flexShrink: 0 }} />
          {!collapsed && <span>Projects</span>}
        </NavLink>

        <NavLink to="/activity" className={({ isActive }) => `sidebar-nav-link${isActive ? ' active' : ''}`} title={collapsed ? 'Activity Log' : ''}>
          <Clock size={15} style={{ flexShrink: 0 }} />
          {!collapsed && <span>Activity Log</span>}
        </NavLink>

        <NavLink to="/analytics" className={({ isActive }) => `sidebar-nav-link${isActive ? ' active' : ''}`} title={collapsed ? 'Analytics' : ''}>
          <PieChart size={15} style={{ flexShrink: 0 }} />
          {!collapsed && <span>Analytics</span>}
        </NavLink>

        <NavLink to="/agent-runs" className={({ isActive }) => `sidebar-nav-link${isActive ? ' active' : ''}`} title={collapsed ? 'Agent Runs' : ''}>
          <BarChart3 size={15} style={{ flexShrink: 0 }} />
          {!collapsed && <span>Agent Runs</span>}
        </NavLink>

        <NavLink to="/team" className={({ isActive }) => `sidebar-nav-link${isActive ? ' active' : ''}`} title={collapsed ? 'Team' : ''}>
          <Users size={15} style={{ flexShrink: 0 }} />
          {!collapsed && <span>Team</span>}
        </NavLink>
      </nav>

      {/* User + Logout */}
      <div style={{ padding: '10px 10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {!collapsed && user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 6 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, #388bff, #5b6af0)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, flexShrink: 0, color: 'white',
            }}>
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f6ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
              <div style={{ fontSize: 11, color: '#3d5a7a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 6, padding: '7px 12px', borderRadius: 8,
            background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
            color: '#7d9cc0', fontSize: 12, transition: 'all 0.2s', cursor: 'pointer',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'; e.currentTarget.style.color = '#f0f6ff' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#7d9cc0' }}
        >
          <LogOut size={14} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          position: 'absolute', top: 24, right: -12,
          width: 24, height: 24, borderRadius: '50%',
          background: '#0c1628',
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#7d9cc0', zIndex: 10, transition: 'all 0.2s', cursor: 'pointer',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#f0f6ff' }}
        onMouseLeave={e => { e.currentTarget.style.color = '#7d9cc0' }}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  )
}
