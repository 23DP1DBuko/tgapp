import { useCallback, useEffect, useState } from 'react'

import {
  listCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  reorderCampaigns,
} from '../../lib/firebase/campaigns'
import { triggerHapticFeedback } from '../../lib/telegram/webApp'
import type { Campaign, CampaignInput } from '../../types/campaign'

type CampaignAdminPanelProps = {
  initData: string
}

type ViewMode = 'list' | 'create' | 'edit'

const EMPTY_FORM: CampaignInput = {
  tag: '',
  headingPart1: '',
  headingPart2: '',
  subtitle: '',
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
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CampaignInput>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  async function loadAll() {
    try {
      setLoading(true)
      setError(null)
      const data = await listCampaigns(20)
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

  const showFeedback = useCallback(
    (tone: 'success' | 'error', message: string) => {
      setFeedback({ tone, message })
      setTimeout(() => setFeedback(null), 3000)
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
    setEditingId(null)
    const nextSortOrder = items.length > 0 ? Math.max(...items.map((c) => c.sortOrder)) + 1 : 0
    setForm({ ...EMPTY_FORM, sortOrder: nextSortOrder })
    setViewMode('create')
  }

  function startEdit(campaign: Campaign) {
    setEditingId(campaign.id)
    setForm({
      tag: campaign.tag,
      headingPart1: campaign.headingPart1,
      headingPart2: campaign.headingPart2,
      subtitle: campaign.subtitle,
      isActive: campaign.isActive,
      sortOrder: campaign.sortOrder,
    })
    setViewMode('edit')
  }

  function cancelForm() {
    setViewMode('list')
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function handleSave() {
    if (!form.tag.trim() || !form.headingPart1.trim()) {
      showFeedback('error', 'Tag and Heading Part 1 are required.')
      return
    }

    try {
      setSaving(true)

      if (viewMode === 'create') {
        await createCampaign(initData, form)
        showFeedback('success', 'Campaign created.')
      } else if (editingId) {
        await updateCampaign(initData, editingId, form)
        showFeedback('success', 'Campaign updated.')
      }

      triggerHapticFeedback('light')
      cancelForm()
      await loadAll()
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to save.')
    } finally {
      setSaving(false)
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

  // ── Render ──

  return (
    <article className="mt-4 rounded-[24px] border border-white/10 bg-[var(--shop-panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--shop-cream)]">
            Campaigns
          </h2>
          <span className="rounded-full border border-white/10 bg-white/8 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]">
            Carousel
          </span>
        </div>
        {viewMode === 'list' ? (
          <button
            type="button"
            onClick={startCreate}
            className="rounded-full bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white shadow-[0_4px_12px_rgba(139,61,255,0.35)]"
          >
            + New Slide
          </button>
        ) : null}
      </div>

      {/* ── Feedback ── */}
      {feedback ? (
        <div
          className={`mt-3 rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${
            feedback.tone === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
              : 'border-[var(--shop-red)]/30 bg-[var(--shop-red)]/10 text-[var(--shop-red)]'
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      {/* ── Error ── */}
      {error && viewMode === 'list' ? (
        <div className="mt-3 rounded-xl border border-[var(--shop-red)]/30 bg-[var(--shop-red)]/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shop-red)]">
          {error}
        </div>
      ) : null}

      {/* ── Create / Edit Form ── */}
      {viewMode !== 'list' ? (
        <div className="mt-4 space-y-3">
          {/* Tag */}
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--shop-muted)]">
              Tag
            </span>
            <input
              value={form.tag}
              onChange={(e) => handleFormChange('tag', e.target.value)}
              placeholder="e.g. Live Now"
              className="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-sm text-[var(--shop-cream)] outline-none placeholder:text-[var(--shop-muted)]/60 focus:border-[var(--shop-purple)] transition-colors"
            />
          </label>

          {/* Heading Part 1 & Part 2 in a row */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--shop-muted)]">
                Heading Part 1
              </span>
              <input
                value={form.headingPart1}
                onChange={(e) => handleFormChange('headingPart1', e.target.value)}
                placeholder="e.g. DROP 01"
                className="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-sm text-[var(--shop-cream)] outline-none placeholder:text-[var(--shop-muted)]/60 focus:border-[var(--shop-purple)] transition-colors"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--shop-muted)]">
                Heading Part 2
              </span>
              <input
                value={form.headingPart2}
                onChange={(e) => handleFormChange('headingPart2', e.target.value)}
                placeholder="e.g. AVAILABLE NOW"
                className="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-sm text-[var(--shop-cream)] outline-none placeholder:text-[var(--shop-muted)]/60 focus:border-[var(--shop-purple)] transition-colors"
              />
            </label>
          </div>

          {/* Subtitle */}
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--shop-muted)]">
              Subtitle
            </span>
            <input
              value={form.subtitle}
              onChange={(e) => handleFormChange('subtitle', e.target.value)}
              placeholder="e.g. Limited pieces • First come, first served"
              className="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-sm text-[var(--shop-cream)] outline-none placeholder:text-[var(--shop-muted)]/60 focus:border-[var(--shop-purple)] transition-colors"
            />
          </label>

          {/* Active toggle */}
          <div className="flex items-center justify-between rounded-2xl bg-white/8 px-4 py-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--shop-muted)]">
              Campaign Active
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={form.isActive}
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

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={cancelForm}
              className="flex-1 rounded-xl border border-white/10 bg-white/8 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)] transition-colors"
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
                  : viewMode === 'create'
                    ? 'bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] shadow-[0_4px_16px_rgba(139,61,255,0.3)]'
                    : 'border border-[var(--shop-purple)] bg-[var(--shop-purple)]/40'
              }`}
            >
              {saving
                ? 'Saving...'
                : viewMode === 'create'
                  ? 'Create Slide'
                  : 'Save Changes'}
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Campaign List ── */}
      {viewMode === 'list' ? (
        <div className="mt-4 space-y-2">
          {loading ? (
            <div className="rounded-2xl bg-white/8 px-4 py-4 text-center text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
              Loading campaigns...
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl bg-white/8 px-4 py-4 text-center text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
              {error ? 'Failed to load.' : 'No campaigns yet. Create your first slide.'}
            </div>
          ) : (
            items.map((campaign, index) => {
              return (
                <div
                  key={campaign.id}
                  className={`rounded-2xl border bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] transition-all border-white/10 ${campaign.isActive ? '' : 'opacity-50'}`}
                >
                  {/* Card header */}
                  <div className="flex items-center justify-between gap-2 px-3 pt-3">
                    <div className="flex items-center gap-2 overflow-hidden">
                      {/* Reorder buttons */}
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                          className="flex h-3.5 w-5 items-center justify-center rounded-[2px] text-[8px] text-[var(--shop-muted)] disabled:opacity-20"
                          aria-label="Move up"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveDown(index)}
                          disabled={index >= items.length - 1}
                          className="flex h-3.5 w-5 items-center justify-center rounded-[2px] text-[8px] text-[var(--shop-muted)] disabled:opacity-20"
                          aria-label="Move down"
                        >
                          ▼
                        </button>
                      </div>
                      <span className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-[var(--shop-cream)]">
                        {campaign.tag}
                      </span>
                      {campaign.isActive ? (
                        <span className="shrink-0 rounded-full bg-emerald-300/15 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-emerald-100">
                          Live
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-white/8 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-[var(--shop-muted)]">
                          Hidden
                        </span>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(campaign)}
                        className="rounded-lg border border-white/10 bg-white/8 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)] transition-colors"
                      >
                        Edit
                      </button>
                      {deleteConfirmId === campaign.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void handleDelete(campaign.id)}
                            className="rounded-lg bg-[var(--shop-red)] px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(null)}
                            className="rounded-lg border border-white/10 bg-white/8 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]"
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
                          className="rounded-lg px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)] transition-colors"
                          aria-label="Delete campaign"
                        >
                          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                            <path d="M5.5 2a.5.5 0 01.5-.5h4a.5.5 0 01.5.5v1H5.5V2zM4 3.5V2a2 2 0 012-2h4a2 2 0 012 2v1.5h2.5a.5.5 0 010 1h-1.05l-.89 8.89A2 2 0 0110.59 14H5.41a2 2 0 01-1.97-1.61L2.55 4.5H1.5a.5.5 0 010-1H4zm1.05 1l.88 8.44a1 1 0 00.98.81h4.18a1 1 0 00.98-.81L12.95 4.5H5.05z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Preview of heading + subtitle */}
                  <div className="px-3 pb-3 pt-1.5">
                    <p className="text-[11px] font-bold uppercase tracking-[-0.02em] text-white/80">
                      {campaign.headingPart1}<br />
                      <span className="text-[var(--shop-purple)]">{campaign.headingPart2}</span>
                    </p>
                    <p className="mt-0.5 text-[9px] uppercase tracking-[0.14em] text-[var(--shop-muted)]">
                      {campaign.subtitle}
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>
      ) : null}
    </article>
  )
}
