import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useGetDivision, useGetTournament } from './hooks'
import { TabLayout } from '../../components/TabLayout'
import { Skeleton } from '../../components/Skeleton'
import { EmptyState } from '../../components/EmptyState'
import { Button } from '../../components/Button'
import { StatusBadge } from '../../components/StatusBadge'
import { DivisionOverview } from './DivisionOverview'
import { DivisionRegistrations } from './DivisionRegistrations'
import { DivisionSeeds } from './DivisionSeeds'
import { DivisionBracket } from './DivisionBracket'
import { ChevronLeft } from 'lucide-react'

interface DivisionDetailProps {
  tournamentId: string
  divisionId: string
}

export function DivisionDetail({
  tournamentId,
  divisionId,
}: DivisionDetailProps) {
  const [activeTab, setActiveTab] = useState('overview')
  const { data: tournament } = useGetTournament(tournamentId)
  const {
    data: division,
    isLoading,
    error,
  } = useGetDivision(tournamentId, divisionId)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error || !division) {
    return (
      <EmptyState
        title="Failed to load division"
        description={(error as Error)?.message || 'Division not found.'}
        action={
          <Link to="/tournaments/$tournamentId" params={{ tournamentId }}>
            <Button variant="secondary">Back to Tournament</Button>
          </Link>
        }
      />
    )
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'registrations', label: 'Registrations' },
    { id: 'seeds', label: 'Seeds' },
    { id: 'bracket', label: 'Bracket' },
  ]

  return (
    <div>
      <div className="mb-6">
        <Link
          to="/tournaments/$tournamentId"
          params={{ tournamentId }}
          className="inline-flex items-center gap-1 text-sm text-(--color-text-secondary) hover:text-(--color-text-primary) mb-3"
        >
          <ChevronLeft className="h-4 w-4" />
          {tournament ? tournament.name : 'Back to Tournament'}
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-(--color-text-primary)">
            {division.name}
          </h1>
          <StatusBadge status={division.status} type="division" />
        </div>
      </div>

      <TabLayout tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === 'overview' && (
          <DivisionOverview
            tournamentId={tournamentId}
            divisionId={divisionId}
            division={division}
          />
        )}
        {activeTab === 'registrations' && (
          <DivisionRegistrations
            tournamentId={tournamentId}
            divisionId={divisionId}
            division={division}
          />
        )}
        {activeTab === 'seeds' && (
          <DivisionSeeds divisionId={divisionId} />
        )}
        {activeTab === 'bracket' && (
          <DivisionBracket
            division={division}
            divisionId={divisionId}
            tournamentId={tournamentId}
          />
        )}
      </TabLayout>
    </div>
  )
}
