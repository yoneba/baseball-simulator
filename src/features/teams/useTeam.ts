import { useParams } from 'react-router'
import type { Team } from '../../domain/types'
import { useStore } from '../../store/context'

/** The team named by the :teamId route param, and a function to save changes to it. */
export function useTeam(): [Team | undefined, (team: Team) => void] {
  const { teamId } = useParams()
  const { data, dispatch } = useStore()
  const team = data.teams.find((t) => t.id === teamId)
  return [team, (next: Team) => dispatch({ type: 'upsertTeam', team: next })]
}
