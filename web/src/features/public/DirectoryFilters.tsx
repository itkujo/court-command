import { SearchInput } from '../../components/SearchInput'
import { Select } from '../../components/Select'

interface StatusOption {
  value: string
  label: string
}

interface DirectoryFiltersProps {
  query: string
  onQueryChange: (query: string) => void
  statusOptions?: StatusOption[]
  selectedStatus?: string
  onStatusChange?: (status: string) => void
}

export function DirectoryFilters({
  query,
  onQueryChange,
  statusOptions,
  selectedStatus,
  onStatusChange,
}: DirectoryFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <SearchInput
        placeholder="Search..."
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        className="w-full sm:w-64"
      />
      {statusOptions && statusOptions.length > 0 && onStatusChange && (
        <Select
          value={selectedStatus ?? ''}
          onChange={(e) => onStatusChange(e.target.value)}
          className="w-full sm:w-48"
        >
          <option value="">All statuses</option>
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      )}
    </div>
  )
}
