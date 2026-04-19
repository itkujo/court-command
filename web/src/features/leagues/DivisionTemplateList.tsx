import { useState } from 'react'
import type { DivisionTemplate } from './hooks'
import { useListDivisionTemplates, useDeleteDivisionTemplate } from './hooks'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { EmptyState } from '../../components/EmptyState'
import { Skeleton } from '../../components/Skeleton'
import { Badge } from '../../components/Badge'
import { DivisionTemplateForm } from './DivisionTemplateForm'
import { useToast } from '../../components/Toast'
import { LayoutTemplate, Pencil, Trash2 } from 'lucide-react'

interface Props {
  leagueId: number
}

export function DivisionTemplateList({ leagueId }: Props) {
  const { toast } = useToast()
  const { data: templates, isLoading, error } = useListDivisionTemplates(leagueId)
  const deleteTemplate = useDeleteDivisionTemplate(leagueId)

  const [showCreate, setShowCreate] = useState(false)
  const [editTemplate, setEditTemplate] = useState<DivisionTemplate | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DivisionTemplate | null>(null)

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteTemplate.mutateAsync(deleteTarget.id)
      toast('success', 'Template deleted')
      setDeleteTarget(null)
    } catch (err) {
      toast('error', (err as Error).message || 'Failed to delete template')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-(--color-text-primary)">
            Division Templates
          </h2>
          <p className="text-sm text-(--color-text-secondary) mt-1">
            These templates are cloned into tournaments created within this league.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>Create Template</Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          title="Failed to load templates"
          description={(error as Error).message}
        />
      ) : !templates || templates.length === 0 ? (
        <EmptyState
          icon={<LayoutTemplate className="h-12 w-12" />}
          title="No templates yet"
          description="Create reusable division configurations to speed up tournament setup."
          action={
            <Button onClick={() => setShowCreate(true)}>Create Template</Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <Card key={template.id}>
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-(--color-text-primary)">
                    {template.name}
                  </h3>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEditTemplate(template)}
                      className="p-1 text-(--color-text-secondary) hover:text-cyan-400"
                      aria-label={`Edit ${template.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(template)}
                      className="p-1 text-(--color-text-secondary) hover:text-red-400"
                      aria-label={`Delete ${template.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mb-2">
                  <Badge variant="default">{template.format.replace(/_/g, ' ')}</Badge>
                  <Badge variant="default">
                    {template.bracket_format.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <div className="text-sm text-(--color-text-secondary) space-y-1">
                  <div>Gender: {template.gender_restriction}</div>
                  <div>
                    Max Teams: {template.max_teams ?? 'No limit'}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Division Template"
      >
        <DivisionTemplateForm
          leagueId={leagueId}
          onClose={() => setShowCreate(false)}
        />
      </Modal>

      <Modal
        open={editTemplate !== null}
        onClose={() => setEditTemplate(null)}
        title="Edit Division Template"
      >
        {editTemplate && (
          <DivisionTemplateForm
            leagueId={leagueId}
            template={editTemplate}
            onClose={() => setEditTemplate(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Template"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        loading={deleteTemplate.isPending}
      />
    </div>
  )
}
