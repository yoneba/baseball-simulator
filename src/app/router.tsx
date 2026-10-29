import { createBrowserRouter, Navigate } from 'react-router'
import { Layout } from './Layout'
import { TeamsPage } from '../features/teams/TeamsPage'
import { TeamEditorPage } from '../features/teams/TeamEditorPage'
import { PlayerEditorPage } from '../features/teams/PlayerEditorPage'
import { LineupEditorPage } from '../features/lineup/LineupEditorPage'
import { GamePage } from '../features/game/GamePage'
import { RecordsPage } from '../features/game/RecordsPage'
import { RecordDetailPage } from '../features/game/RecordDetailPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/teams" replace /> },
      { path: 'teams', element: <TeamsPage /> },
      { path: 'teams/:teamId', element: <TeamEditorPage /> },
      { path: 'teams/:teamId/players/:playerId', element: <PlayerEditorPage /> },
      { path: 'teams/:teamId/lineup', element: <LineupEditorPage /> },
      { path: 'game', element: <GamePage /> },
      { path: 'records', element: <RecordsPage /> },
      { path: 'records/:gameId', element: <RecordDetailPage /> },
    ],
  },
])
