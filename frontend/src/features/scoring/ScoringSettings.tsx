// frontend/src/features/scoring/ScoringSettings.tsx
import { Card } from '../../components/Card'
import { useScoringPrefs } from './useScoringPrefs'

interface ToggleRowProps {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}

function ToggleRow({ label, description, checked, onChange }: ToggleRowProps) {
  return (
    <label className="flex items-start justify-between gap-4 py-3 cursor-pointer">
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-(--color-text-primary)">
          {label}
        </span>
        <span className="block text-xs text-(--color-text-secondary) mt-0.5">
          {description}
        </span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-5 w-5 accent-cyan-500"
      />
    </label>
  )
}

export function ScoringSettings() {
  const { prefs, setKeyboard, setHaptic, setSound } = useScoringPrefs()

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-(--color-text-primary)">
          Scoring Settings
        </h1>
        <p className="text-sm text-(--color-text-secondary)">
          Adjust how the referee and scorekeeper consoles behave on this device.
        </p>
      </header>

      <Card className="px-4 py-0 divide-y divide-(--color-border)">
        <ToggleRow
          label="Keyboard shortcuts"
          description="1 / 2 to score, S for side-out, Z to undo, T for timeout. Disabled while typing in input fields."
          checked={prefs.keyboard}
          onChange={setKeyboard}
        />
        <ToggleRow
          label="Haptic feedback"
          description="Short vibration on point, side-out, and undo (mobile only)."
          checked={prefs.haptic}
          onChange={setHaptic}
        />
        <ToggleRow
          label="Sound feedback"
          description="Brief tick sound on each scoring action."
          checked={prefs.sound}
          onChange={setSound}
        />
      </Card>

      <p className="text-xs text-(--color-text-muted)">
        Preferences are stored in this browser only. Sign-in does not sync them.
      </p>
    </div>
  )
}
