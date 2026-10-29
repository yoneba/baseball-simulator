import { createBrowserRouter, Navigate } from 'react-router'
import { Layout } from './Layout'
import { TeamsPage } from '../features/teams/TeamsPage'
import { TeamEditorPage } from '../features/teams/TeamEditorPage'
import { PlayerEditorPage } from '../features/teams/PlayerEditorPage'
import { GamePage } from '../features/game/GamePage'
import { RecordsPage } from '../features/game/RecordsPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/teams" replace /> },
      { path: 'teams', element: <TeamsPage /> },
      { path: 'teams/:teamId', element: <TeamEditorPage /> },
      { path: 'teams/:teamId/players/:playerId', element: <PlayerEditorPage /> },
      { path: 'game', element: <GamePage /> },
      { path: 'records', element: <RecordsPage /> },
    ],
  },
])
