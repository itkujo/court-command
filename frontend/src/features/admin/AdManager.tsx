import { useState } from 'react'
import {
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Image,
  Code2,
  GripVertical,
  ExternalLink,
} from 'lucide-react'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { Select } from '../../components/Select'
import { Textarea } from '../../components/Textarea'
import { FormField } from '../../components/FormField'
import { Modal } from '../../components/Modal'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Card } from '../../components/Card'
import { Badge } from '../../components/Badge'
import { Skeleton, SkeletonTable } from '../../components/Skeleton'
import { useToast } from '../../components/Toast'
import {
  useAllAds,
  useCreateAd,
  useDeleteAd,
  useToggleAd,
  useUpdateAd,
  type AdConfig,
} from './ad-hooks'
import { ImageUpload } from '../../components/ImageUpload'

const SIZE_OPTIONS = [
  { value: 'leaderboard', label: 'Leaderboard (728x90)' },
  { value: 'mobile-banner', label: 'Mobile Banner (320x50)' },
  { value: 'medium-rectangle', label: 'Medium Rectangle (300x250)' },
  { value: 'skyscraper', label: 'Skyscraper (160x600)' },
  { value: 'billboard', label: 'Billboard (970x250)' },
]

export function AdManager() {
  const { data: ads, isLoading, error, refetch } = useAllAds()
  const deleteAd = useDeleteAd()
  const toggleAd = useToggleAd()
  const { toast } = useToast()

  const [showCreate, setShowCreate] = useState(false)
  const [editAd, setEditAd] = useState<AdConfig | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdConfig | null>(null)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <SkeletonTable rows={3} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-6 text-center">
        <p className="text-red-400">Failed to load ads</p>
        <Button variant="secondary" className="mt-3" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    )
  }

  const activeAds = ads?.filter(a => a.is_active) ?? []
  const inactiveAds = ads?.filter(a => !a.is_active) ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-(--color-text-primary)">
            Ad Management
          </h2>
          <p className="text-sm text-(--color-text-muted) mt-1">
            Manage advertisements displayed across the site. Use custom images or embed third-party ad code (Google AdSense, etc.).
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Create Ad
        </Button>
      </div>

      {/* Active Ads */}
      <div>
        <h3 className="text-sm font-medium text-(--color-text-muted) mb-3 uppercase tracking-wider">
          Active ({activeAds.length})
        </h3>
        {activeAds.length === 0 ? (
          <Card>
            <p className="text-center text-(--color-text-muted) py-4">
              No active ads. Create one to get started.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {activeAds.map(ad => (
              <AdCard
                key={ad.id}
                ad={ad}
                onEdit={() => setEditAd(ad)}
                onDelete={() => setDeleteTarget(ad)}
                onToggle={() => {
                  toggleAd.mutate(
                    { id: ad.id, is_active: false },
                    {
                      onSuccess: () => toast('success', `"${ad.name}" deactivated`),
                      onError: () => toast('error', 'Failed to deactivate ad'),
                    }
                  )
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Inactive Ads */}
      {inactiveAds.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-(--color-text-muted) mb-3 uppercase tracking-wider">
            Inactive ({inactiveAds.length})
          </h3>
          <div className="space-y-3 opacity-60">
            {inactiveAds.map(ad => (
              <AdCard
                key={ad.id}
                ad={ad}
                onEdit={() => setEditAd(ad)}
                onDelete={() => setDeleteTarget(ad)}
                onToggle={() => {
                  toggleAd.mutate(
                    { id: ad.id, is_active: true },
                    {
                      onSuccess: () => toast('success', `"${ad.name}" activated`),
                      onError: () => toast('error', 'Failed to activate ad'),
                    }
                  )
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Create Modal */}
      <AdFormModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Ad"
      />

      {/* Edit Modal */}
      {editAd && (
        <AdFormModal
          open={!!editAd}
          onClose={() => setEditAd(null)}
          title="Edit Ad"
          ad={editAd}
        />
      )}

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return
          deleteAd.mutate(deleteTarget.id, {
            onSuccess: () => {
              toast('success', `"${deleteTarget.name}" deleted`)
              setDeleteTarget(null)
            },
            onError: () => toast('error', 'Failed to delete ad'),
          })
        }}
        title="Delete Ad"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmText="Delete"
        loading={deleteAd.isPending}
      />
    </div>
  )
}

// ---- Ad Card ----

interface AdCardProps {
  ad: AdConfig
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
}

function AdCard({ ad, onEdit, onDelete, onToggle }: AdCardProps) {
  return (
    <Card>
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 flex items-center text-(--color-text-muted)">
          <GripVertical className="h-4 w-4" />
        </div>

        {/* Preview */}
        <div className="flex-shrink-0 w-24 h-16 rounded border border-(--color-border) overflow-hidden bg-(--color-bg-primary) flex items-center justify-center">
          {ad.ad_type === 'image' && ad.image_url ? (
            <img src={ad.image_url} alt={ad.alt_text ?? ad.name} className="w-full h-full object-cover" />
          ) : ad.ad_type === 'embed' ? (
            <Code2 className="h-6 w-6 text-(--color-text-muted)" />
          ) : (
            <Image className="h-6 w-6 text-(--color-text-muted)" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-(--color-text-primary) truncate">
              {ad.name || 'Untitled'}
            </span>
            <Badge variant={ad.ad_type === 'embed' ? 'info' : 'default'}>
              {ad.ad_type === 'embed' ? 'Embed' : 'Image'}
            </Badge>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-(--color-text-muted)">
            <span>Slot: {ad.slot_name || 'all'}</span>
            <span>Order: {ad.sort_order}</span>
            {ad.sizes.length > 0 && (
              <span>Sizes: {ad.sizes.join(', ')}</span>
            )}
            {ad.link_url && (
              <a
                href={ad.link_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-(--color-accent) hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Link
              </a>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={onToggle}
            title={ad.is_active ? 'Deactivate' : 'Activate'}
          >
            {ad.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="secondary" size="sm" onClick={onEdit}>
            Edit
          </Button>
          <Button variant="danger" size="sm" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  )
}

// ---- Ad Form Modal ----

interface AdFormModalProps {
  open: boolean
  onClose: () => void
  title: string
  ad?: AdConfig
}

function AdFormModal({ open, onClose, title, ad }: AdFormModalProps) {
  const isEditing = !!ad
  const createAd = useCreateAd()
  const updateAd = useUpdateAd(ad?.id ?? 0)
  const { toast } = useToast()

  const [name, setName] = useState(ad?.name ?? '')
  const [slotName, setSlotName] = useState(ad?.slot_name ?? 'all')
  const [adType, setAdType] = useState<'image' | 'embed'>(ad?.ad_type ?? 'image')
  const [imageUrl, setImageUrl] = useState(ad?.image_url ?? '')
  const [linkUrl, setLinkUrl] = useState(ad?.link_url ?? '')
  const [altText, setAltText] = useState(ad?.alt_text ?? '')
  const [embedCode, setEmbedCode] = useState(ad?.embed_code ?? '')
  const [isActive, setIsActive] = useState(ad?.is_active ?? true)
  const [sortOrder, setSortOrder] = useState(String(ad?.sort_order ?? 0))
  const [selectedSizes, setSelectedSizes] = useState<string[]>(ad?.sizes ?? [])

  function handleSizeToggle(size: string) {
    setSelectedSizes(prev =>
      prev.includes(size)
        ? prev.filter(s => s !== size)
        : [...prev, size]
    )
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast('error', 'Name is required')
      return
    }

    const payload = {
      name: name.trim(),
      slot_name: slotName,
      ad_type: adType,
      image_url: adType === 'image' ? imageUrl || undefined : undefined,
      link_url: linkUrl || undefined,
      alt_text: altText || undefined,
      embed_code: adType === 'embed' ? embedCode || undefined : undefined,
      is_active: isActive,
      sort_order: Number(sortOrder) || 0,
      sizes: selectedSizes,
    }

    try {
      if (isEditing) {
        await updateAd.mutateAsync(payload)
        toast('success', `"${name}" updated`)
      } else {
        await createAd.mutateAsync(payload)
        toast('success', `"${name}" created`)
      }
      onClose()
    } catch {
      toast('error', `Failed to ${isEditing ? 'update' : 'create'} ad`)
    }
  }

  const isPending = createAd.isPending || updateAd.isPending

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        <FormField label="Name" required>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="RelentNet Banner"
          />
        </FormField>

        <FormField label="Ad Type" required>
          <div className="flex gap-2">
            <Button
              variant={adType === 'image' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setAdType('image')}
            >
              <Image className="h-4 w-4 mr-1" />
              Custom Image
            </Button>
            <Button
              variant={adType === 'embed' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setAdType('embed')}
            >
              <Code2 className="h-4 w-4 mr-1" />
              Embed Code
            </Button>
          </div>
        </FormField>

        {adType === 'image' ? (
          <>
            <FormField label="Image">
              <ImageUpload
                value={imageUrl}
                onChange={(url) => setImageUrl(url ?? '')}
                label="Ad Image"
              />
            </FormField>
            <FormField label="Link URL">
              <Input
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                placeholder="https://relentnet.com"
              />
            </FormField>
            <FormField label="Alt Text">
              <Input
                value={altText}
                onChange={e => setAltText(e.target.value)}
                placeholder="Visit RelentNet"
              />
            </FormField>
          </>
        ) : (
          <>
            <FormField label="Embed Code">
              <Textarea
                value={embedCode}
                onChange={e => setEmbedCode(e.target.value)}
                placeholder={'<script async src="https://pagead2.googlesyndication.com/..."></script>\n<ins class="adsbygoogle" ...></ins>'}
                rows={6}
              />
              <p className="text-xs text-(--color-text-muted) mt-1">
                Paste your Google AdSense, Carbon Ads, or any embed code here. The code will be rendered directly in the ad slot.
              </p>
            </FormField>
            <FormField label="Link URL (optional)">
              <Input
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
              />
            </FormField>
          </>
        )}

        <FormField label="Target Sizes">
          <p className="text-xs text-(--color-text-muted) mb-2">
            Select which ad slot sizes this ad should appear in. Leave empty to show in all sizes.
          </p>
          <div className="flex flex-wrap gap-2">
            {SIZE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSizeToggle(opt.value)}
                className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                  selectedSizes.includes(opt.value)
                    ? 'bg-(--color-accent) text-white border-(--color-accent)'
                    : 'bg-(--color-bg-primary) text-(--color-text-secondary) border-(--color-border) hover:border-(--color-accent)'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Slot Name">
            <Select value={slotName} onChange={e => setSlotName(e.target.value)}>
              <option value="all">All Slots</option>
              <option value="header">Header</option>
              <option value="sidebar">Sidebar</option>
              <option value="inline">Inline</option>
              <option value="footer">Footer</option>
            </Select>
          </FormField>
          <FormField label="Sort Order">
            <Input
              type="number"
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value)}
              placeholder="0"
            />
          </FormField>
        </div>

        <FormField label="Status">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-(--color-text-primary)">Active</span>
          </label>
        </FormField>

        {/* Preview */}
        {adType === 'image' && imageUrl && (
          <div>
            <p className="text-xs font-medium text-(--color-text-muted) mb-2 uppercase tracking-wider">Preview</p>
            <div className="rounded-lg border border-(--color-border) overflow-hidden bg-(--color-bg-primary) p-2">
              <img
                src={imageUrl}
                alt={altText || name}
                className="max-h-40 mx-auto object-contain rounded"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-(--color-border)">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending
            ? (isEditing ? 'Saving...' : 'Creating...')
            : (isEditing ? 'Save Changes' : 'Create Ad')}
        </Button>
      </div>
    </Modal>
  )
}
