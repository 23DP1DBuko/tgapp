import { useCallback, useEffect, useRef, useState } from 'react'

import {
  listCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  reorderCampaigns,
} from '../../lib/firebase/campaigns'
import { uploadBannerImage } from '../../lib/firebase/storage'
import { triggerHapticFeedback } from '../../lib/telegram/webApp'
import type { Campaign, CampaignInput } from '../../types/campaign'
import { AdminFeedbackBanner } from '../ui/AdminFeedbackBanner'

type CampaignAdminPanelProps = {
  initData: string
}

type ViewMode = 'list' | 'form'

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']

const EMPTY_FORM: CampaignInput = {
  tag: '',
  headingPart1: '',
  headingPart2: '',
  subtitle: '',
  imageUrl: '',
  isActive: true,
  sortOrder: 0,
}

export function CampaignAdminPanel({ initData }: CampaignAdminPanelProps) {
  const [items, setItems] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error'
    message: string
  } | null>(null)
  const [feedbackRetryable, setFeedbackRetryable] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)
  const [form, setForm] = useState<CampaignInput>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null)
  const [, setIsUploading] = useState(false)
  const formRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function loadAll() {
    try {
      setLoading(true)
      setError(null)
      const data = await listCampaigns(50)
      setItems(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaigns.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
  }, [])

  // Track the auto-dismiss timer so newer feedback cancels older pending
  // dismissals (otherwise an old timer could hide a retryable error early).
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showFeedback = useCallback(
    (tone: 'success' | 'error', message: string, retryable = false) => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current)
        dismissTimerRef.current = null
      }
      setFeedback({ tone, message })
      setFeedbackRetryable(retryable)
      // Retryable errors persist so the user has time to act on the retry
      if (!retryable) {
        dismissTimerRef.current = setTimeout(() => {
          dismissTimerRef.current = null
          setFeedback(null)
        }, 3000)
      }
    },
    [],
  )

  function handleFormChange<K extends keyof CampaignInput>(
    field: K,
    value: CampaignInput[K],
  ) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function startCreate() {
    setEditingCampaign(null)
    const nextSortOrder =
      items.length > 0 ? Math.max(...items.map((c) => c.sortOrder)) + 1 : 0
    setForm({ ...EMPTY_FORM, sortOrder: nextSortOrder })
    setSelectedFile(null)
    setLocalPreviewUrl(null)
    setIsUploading(false)
    setViewMode('form')
  }

  function startEdit(campaign: Campaign) {
    setEditingCampaign(campaign)
    setForm({
      tag: campaign.tag,
      headingPart1: campaign.headingPart1,
      headingPart2: campaign.headingPart2,
      subtitle: campaign.subtitle,
      imageUrl: campaign.imageUrl,
      isActive: campaign.isActive,
      sortOrder: campaign.sortOrder,
    })
    setSelectedFile(null)
    setLocalPreviewUrl(null)
    setIsUploading(false)
    setViewMode('form')
  }

  function cancelForm() {
    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl)
    }
    setViewMode('list')
    setEditingCampaign(null)
    setForm(EMPTY_FORM)
    setSelectedFile(null)
    setLocalPreviewUrl(null)
    setIsUploading(false)
  }

  function handleFileSelect(file: File | null) {
    // Clean up previous preview
    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl)
    }

    if (!file) {
      setSelectedFile(null)
      setLocalPreviewUrl(null)
      return
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      showFeedback('error', 'Only PNG, JPG, and WebP images are allowed.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      showFeedback('error', 'Image must be under 5 MB.')
      return
    }

    setSelectedFile(file)
    setLocalPreviewUrl(URL.createObjectURL(file))
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault()
    const droppedFile = event.dataTransfer.files[0]
    if (droppedFile) {
      handleFileSelect(droppedFile)
    }
  }

  function handleDragOver(event: React.DragEvent) {
    event.preventDefault()
  }

  async function handleSave() {
    if (!form.tag.trim()) {
      showFeedback('error', 'Tag is required.')
      return
    }
    if (!form.headingPart1.trim()) {
      showFeedback('error', 'Heading (Part 1) is required.')
      return
    }

    try {
      setSaving(true)

      let finalImageUrl = form.imageUrl.trim()

      // If a new file was selected, upload it first
      if (selectedFile) {
        setIsUploading(true)
        showFeedback('success', 'Uploading image...')
        try {
          finalImageUrl = await uploadBannerImage(initData, selectedFile)
          setForm((prev) => ({ ...prev, imageUrl: finalImageUrl }))
        } catch {
          showFeedback('error', 'Failed to upload image. Please try again.')
          setSaving(false)
          setIsUploading(false)
          return
        }
        setIsUploading(false)
      }

      const payload = { ...form, imageUrl: finalImageUrl }

      if (editingCampaign) {
        await updateCampaign(initData, editingCampaign.id, payload)
        showFeedback('success', 'Campaign updated.')
      } else {
        await createCampaign(initData, payload)
        showFeedback('success', 'Campaign created.')
      }

      triggerHapticFeedback('light')
      cancelForm()
      await loadAll()
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to save.', true)
    } finally {
      setSaving(false)
      setIsUploading(false)
    }
  }

  async function handleDelete(campaignId: string) {
    try {
      setSaving(true)
      await deleteCampaign(initData, campaignId)
      triggerHapticFeedback('light')
      setDeleteConfirmId(null)
      showFeedback('success', 'Campaign deleted.')
      await loadAll()
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to delete.')
    } finally {
      setSaving(false)
    }
  }

  async function handleMoveUp(index: number) {
    if (index === 0) return
    const newItems = [...items]
    ;[newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]]
    setItems(newItems)
    await reorderCampaigns(initData, newItems.map((c) => c.id))
  }

  async function handleMoveDown(index: number) {
    if (index >= items.length - 1) return
    const newItems = [...items]
    ;[newItems[index + 1], newItems[index]] = [newItems[index], newItems[index + 1]]
    setItems(newItems)
    await reorderCampaigns(initData, newItems.map((c) => c.id))
  }

  const activeCount = items.filter((c) => c.isActive).length

  // ── Render ──

  return (
    <article className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(28,14,34,0.94),rgba(18,10,22,0.96))] p-5 shadow-[0_25px_70px_rgba(0,0,0,0.35)]">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
            Campaign Manager
          </p>
          {!loading && items.length > 0 ? (
            <p className="mt-1 text-[10px] text-[var(--shop-muted)]/60">
              {activeCount} active · {items.length - activeCount} inactive
            </p>
          ) : null}
        </div>
        <span className="rounded-full bg-[var(--shop-purple)]/22 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-cream)]">
          {items.length} Campaigns
        </span>
      </div>

      {/* ── Feedback ── */}
      {feedback ? (
        <AdminFeedbackBanner
          tone={feedback.tone}
          message={feedback.message}
          className="mt-3"
          onRetry={feedbackRetryable ? () => void handleSave() : undefined}
        />
      ) : null}

      {/* ── Error ── */}
      {error && viewMode === 'list' ? (
        <div className="mt-3 rounded-xl border border-[var(--shop-red)]/30 bg-[var(--shop-red)]/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shop-red)]">
          {error}
        </div>
      ) : null}

      {/* ── Form Module (create / edit) ── */}
      {viewMode === 'form' ? (
        <div ref={formRef} className="mt-4 space-y-4 rounded-[24px] border border-white/10 bg-[var(--shop-panel-solid)] p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--shop-cream)]">
              {editingCampaign ? 'Edit Campaign' : 'New Campaign'}
            </p>
            <button
              type="button"
              onClick={cancelForm}
              className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]"
            >
              Cancel
            </button>
          </div>

          {/* Tag */}
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--shop-muted)]">
              Tag <span className="text-[var(--shop-red)]">*</span>
            </span>
            <input
              value={form.tag}
              onChange={(e) => handleFormChange('tag', e.target.value)}
              placeholder="e.g. DROP 02 / SEASON 2"
              className="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-sm text-[var(--shop-cream)] outline-none placeholder:text-[var(--shop-muted)]/60 focus:border-[var(--shop-purple)] transition-colors"
            />
          </label>

          {/* Heading Part 1 */}
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--shop-muted)]">
              Heading Part 1 <span className="text-[var(--shop-red)]">*</span>
            </span>
            <input
              value={form.headingPart1}
              onChange={(e) => handleFormChange('headingPart1', e.target.value)}
              placeholder="e.g. LIMITED EDITION"
              className="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-sm text-[var(--shop-cream)] outline-none placeholder:text-[var(--shop-muted)]/60 focus:border-[var(--shop-purple)] transition-colors"
            />
          </label>

          {/* Heading Part 2 */}
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--shop-muted)]">
              Heading Part 2
            </span>
            <input
              value={form.headingPart2}
              onChange={(e) => handleFormChange('headingPart2', e.target.value)}
              placeholder="e.g. HOODIE BUNDLE"
              className="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-sm text-[var(--shop-cream)] outline-none placeholder:text-[var(--shop-muted)]/60 focus:border-[var(--shop-purple)] transition-colors"
            />
          </label>

          {/* Subtitle */}
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--shop-muted)]">
              Subtitle
            </span>
            <input
              value={form.subtitle}
              onChange={(e) => handleFormChange('subtitle', e.target.value)}
              placeholder="e.g. Premium streetwear — available now"
              className="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-sm text-[var(--shop-cream)] outline-none placeholder:text-[var(--shop-muted)]/60 focus:border-[var(--shop-purple)] transition-colors"
            />
          </label>

          {/* Campaign Image Upload */}
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--shop-muted)]">
              Campaign Image
            </span>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null
                handleFileSelect(file)
                e.target.value = ''
              }}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[var(--shop-accent-purple)]/30 bg-white/[0.03] px-4 py-8 text-center transition-all hover:border-[var(--shop-accent-purple)]/60 hover:bg-white/[0.05]"
              aria-label="Upload campaign image (click or drag and drop)"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-8 w-8 shrink-0 text-[var(--shop-accent-purple)]/50"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <div>
                <p className="text-xs font-semibold tracking-[0.18em] text-[var(--shop-muted)]/80">
                  Upload campaign image
                </p>
                <p className="mt-1 text-[10px] text-[var(--shop-muted)]/50">
                  PNG, JPG, WebP
                </p>
              </div>
            </button>
          </label>

          {/* Image preview */}
          {localPreviewUrl ? (
            <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
              <img
                src={localPreviewUrl}
                alt="Campaign preview"
                loading="lazy"
                decoding="async"
                className="aspect-video w-full object-cover"
              />
              <div className="flex items-center justify-between border-t border-white/10 bg-white/6 px-3 py-2">
                <p className="truncate text-[10px] font-semibold text-[var(--shop-muted)]">
                  {selectedFile?.name}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl)
                    setSelectedFile(null)
                    setLocalPreviewUrl(null)
                  }}
                  className="shrink-0 rounded-lg border border-white/10 bg-white/8 px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-[var(--shop-muted)]"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : null}

          {/* Show existing image when editing but no new file selected */}
          {!localPreviewUrl && form.imageUrl.trim() && editingCampaign ? (
            <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
              <img
                src={form.imageUrl.trim()}
                alt="Existing campaign image"
                loading="lazy"
                decoding="async"
                className="aspect-video w-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
              <div className="border-t border-white/10 bg-white/6 px-3.5 py-2.5 text-[11px] text-[var(--shop-muted)]/60">
                Existing image (upload a new file to replace)
              </div>
            </div>
          ) : null}

          {/* Active toggle */}
          <div className="flex items-center justify-between rounded-2xl bg-white/8 px-4 py-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--shop-muted)]">
              Campaign Visible
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={form.isActive}
              aria-label="Toggle campaign visibility"
              onClick={() => handleFormChange('isActive', !form.isActive)}
              className={`relative h-6 w-10 rounded-full transition-colors duration-200 ${
                form.isActive ? 'bg-[var(--shop-purple)]' : 'bg-white/15'
              }`}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                  form.isActive ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Sort Order */}
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--shop-muted)]">
              Sort Order
            </span>
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) => handleFormChange('sortOrder', parseInt(e.target.value, 10) || 0)}
              min={0}
              className="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-sm text-[var(--shop-cream)] outline-none focus:border-[var(--shop-purple)] transition-colors"
            />
          </label>

          {/* Save & Cancel buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={cancelForm}
              disabled={saving}
              className="flex-1 rounded-xl border border-white/10 bg-white/8 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)] transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className={`flex-1 rounded-xl px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white transition-all ${
                saving
                  ? 'bg-white/15 text-[var(--shop-muted)]'
                  : editingCampaign
                    ? 'border border-[var(--shop-purple)] bg-[var(--shop-purple)]/40'
                    : 'bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] shadow-[0_4px_16px_rgba(139,61,255,0.3)]'
              }`}
            >
              {saving ? 'Saving...' : editingCampaign ? 'Save Changes' : 'Create Campaign'}
            </button>
          </div>
        </div>
      ) : null}

      {/* ── "+ Add New Campaign" action card ── */}
      {viewMode === 'list' ? (
        <button
          type="button"
          onClick={() => {
            triggerHapticFeedback('light')
            startCreate()
          }}
          className="mt-4 flex w-full items-center gap-4 rounded-2xl border-2 border-dashed border-white/12 bg-[var(--shop-panel-solid)] px-5 py-6 text-left transition-all hover:border-white/25"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/8">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 shrink-0 text-[var(--shop-purple)]" aria-hidden="true">
              <g transform="translate(2, 2)">
                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
              </g>
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold tracking-[-0.02em] text-[var(--shop-cream)]">
              Add New Campaign
            </p>
            <p className="mt-0.5 text-xs text-[var(--shop-muted)]">
              tag · heading · subtitle · visibility
            </p>
          </div>
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className="ml-auto h-5 w-5 shrink-0 text-[var(--shop-muted)]"
            aria-hidden="true"
          >
            <g transform="translate(2, 2)">
              <path
                fillRule="evenodd"
                d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                clipRule="evenodd"
              />
            </g>
          </svg>
        </button>
      ) : null}

      {/* ── Campaigns List ── */}
      {viewMode === 'list' ? (
        <div className="mt-4 space-y-3">
          {/* Loading state */}
          {loading ? (
            <div className="rounded-2xl bg-white/8 px-4 py-4 text-center text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
              Loading campaigns...
            </div>
          ) : null}

          {/* Empty state */}
          {!loading && !error && items.length === 0 ? (
            <div className="rounded-2xl bg-white/8 px-4 py-8 text-center text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
              No campaigns yet. Tap above to create your first one.
            </div>
          ) : null}

          {/* Campaign rows */}
          {!loading && !error
            ? items.map((campaign, index) => (                  <div
                    key={campaign.id}
                    className={`group flex flex-wrap items-center gap-2 rounded-2xl border bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-3 transition-all ${
                      campaign.isActive ? 'border-white/10' : 'border-white/6 opacity-55'
                    }`}
                  >
                  {/* Reorder arrows */}
                  <div className="flex shrink-0 flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className="flex h-6 w-6 items-center justify-center rounded-[4px] text-[9px] text-[var(--shop-muted)] transition-colors hover:text-white disabled:opacity-20"
                      aria-label="Move up"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveDown(index)}
                      disabled={index >= items.length - 1}
                      className="flex h-6 w-6 items-center justify-center rounded-[4px] text-[9px] text-[var(--shop-muted)] transition-colors hover:text-white disabled:opacity-20"
                      aria-label="Move down"
                    >
                      ▼
                    </button>
                  </div>

                  {/* Image thumbnail */}
                  <div className="w-20 shrink-0 overflow-hidden rounded-xl bg-black/30 sm:w-24">
                    <div className="aspect-video w-full">
                      {campaign.imageUrl ? (
                        <img
                          src={campaign.imageUrl}
                          alt={campaign.headingPart1}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[8px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]">
                          No Img
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tag badge + heading */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {campaign.tag ? (
                        <span className="shrink-0 rounded-full bg-[var(--shop-purple)]/18 px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.14em] text-[var(--shop-purple)]">
                          {campaign.tag}
                        </span>
                      ) : null}
                      {!campaign.isActive ? (
                        <span className="shrink-0 rounded-full bg-white/8 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-[var(--shop-muted)]">
                          Hidden
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-sm font-bold tracking-[-0.02em] text-[var(--shop-cream)]">
                      {campaign.headingPart1}
                      {campaign.headingPart2 ? (
                        <span className="text-[var(--shop-purple)]">
                          {' '}{campaign.headingPart2}
                        </span>
                      ) : null}
                    </p>
                    {campaign.subtitle ? (
                      <p className="mt-0.5 truncate text-xs text-[var(--shop-muted)]/70">
                        {campaign.subtitle}
                      </p>
                    ) : null}
                    <p className="mt-0.5 text-[9px] text-[var(--shop-muted)]/50">
                      Sort: {campaign.sortOrder} · Created:{' '}
                      {campaign.createdAt
                        ? new Date(campaign.createdAt).toLocaleDateString()
                        : '—'}
                    </p>
                  </div>

                  {/* Action buttons group — ml-auto keeps them right-aligned;
                      on narrow screens the wrap moves them to their own line
                      instead of overflowing the card. */}
                  <div className="ml-auto flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHapticFeedback('light')
                        startEdit(campaign)
                      }}
                      className="rounded-lg border border-white/12 bg-white/8 px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)] transition-colors hover:bg-white/14"
                    >
                      Edit
                    </button>

                    {deleteConfirmId === campaign.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void handleDelete(campaign.id)}
                          className="rounded-lg bg-[var(--shop-red)] px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          className="rounded-lg border border-white/10 bg-white/8 px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          triggerHapticFeedback('light')
                          setDeleteConfirmId(campaign.id)
                        }}
                        className="rounded-lg border border-white/12 bg-white/8 px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)] transition-colors hover:border-[var(--shop-red)]/30 hover:bg-[var(--shop-red)]/12 hover:text-[var(--shop-red)]"
                        aria-label="Delete campaign"
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
                          <g transform="translate(4, 4)">
                            <path d="M5.5 2a.5.5 0 01.5-.5h4a.5.5 0 01.5.5v1H5.5V2zM4 3.5V2a2 2 0 012-2h4a2 2 0 012 2v1.5h2.5a.5.5 0 010 1h-1.05l-.89 8.89A2 2 0 0110.59 14H5.41a2 2 0 01-1.97-1.61L2.55 4.5H1.5a.5.5 0 010-1H4zm1.05 1l.88 8.44a1 1 0 00.98.81h4.18a1 1 0 00.98-.81L12.95 4.5H5.05z" />
                          </g>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))
            : null}
        </div>
      ) : null}
    </article>
  )
}
