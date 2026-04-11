import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'
import { useAuth } from './AuthContext'

const TeamContext = createContext()

export function TeamProvider({ children }) {
  const { isAuthenticated } = useAuth()
  const [teams, setTeams] = useState([])
  const [currentTeam, setCurrentTeam] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isAuthenticated) loadTeams()
  }, [isAuthenticated])

  const loadTeams = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/teams')
      setTeams(data)
      const savedId = localStorage.getItem('currentTeamId')
      const saved = data.find(t => t.id === savedId)
      setCurrentTeam(saved || data[0] || null)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const selectTeam = (team) => {
    setCurrentTeam(team)
    localStorage.setItem('currentTeamId', team.id)
  }

  const createTeam = async (name, description) => {
    const { data } = await api.post('/teams', { name, description })
    await loadTeams()
    return data
  }

  return (
    <TeamContext.Provider value={{ teams, currentTeam, loading, loadTeams, selectTeam, createTeam }}>
      {children}
    </TeamContext.Provider>
  )
}

export const useTeam = () => useContext(TeamContext)
