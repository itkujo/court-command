import { BarChart3, Trophy, XCircle, Percent } from 'lucide-react'
import { Card } from '../../components/Card'
import type { PlayerStats } from './hooks'

interface Props {
  data: PlayerStats
}

const statCards = [
  {
    key: 'played' as const,
    label: 'Matches Played',
    icon: BarChart3,
    getValue: (s: PlayerStats) => s.matches_played,
  },
  {
    key: 'won' as const,
    label: 'Wins',
    icon: Trophy,
    getValue: (s: PlayerStats) => s.matches_won,
  },
  {
    key: 'lost' as const,
    label: 'Losses',
    icon: XCircle,
    getValue: (s: PlayerStats) => s.matches_lost,
  },
  {
    key: 'rate' as const,
    label: 'Win Rate',
    icon: Percent,
    getValue: (s: PlayerStats) => {
      if (s.matches_played === 0) return '0%'
      return `${Math.round((s.matches_won / s.matches_played) * 100)}%`
    },
  },
]

export function StatsSummary({ data }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {statCards.map(({ key, label, icon: Icon, getValue }) => (
        <Card key={key}>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-(--color-bg-hover) p-2">
              <Icon className="h-5 w-5 text-(--color-accent)" />
            </div>
            <div>
              <p className="text-2xl font-bold text-(--color-text-primary)">
                {getValue(data)}
              </p>
              <p className="text-xs text-(--color-text-muted)">{label}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
