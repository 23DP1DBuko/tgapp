import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  listBannerSlides,
  createBannerSlide,
  updateBannerSlide,
  deleteBannerSlide,
  reorderBannerSlides,
} from '../../lib/firebase/bannerSlides'
import { uploadBannerImage } from '../../lib/firebase/storage'
import { triggerHapticFeedback } from '../../lib/telegram/webApp'
import type { BannerSlide, BannerSlideInput } from '../../types/bannerSlide'

type CarouselManagerPanelProps = {
  initData: string
}

type ViewMode = 'list' | 'form'

const EMPTY_FORM: BannerSlideInput = {
  imageUrl: '',
  badgeText: '',
  headline: '',
  subheading: '',
  caption: '',
  isActive: true,
  sortOrder: 0,
}

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']

export function CarouselManagerPanel({ initData }: CarouselManagerPanelProps) {
  const [items, setItems] = useState<BannerSlide[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error'
    message: string
  } | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [editingSlide, setEditingSlide] = useState<BannerSlide | null>(null)
  const [form, setForm] = useState<BannerSlideInput>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const formRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function loadAll() {
    try {
      setLoading(true)
      setError(null)
      const data = await listBannerSlides(20)
      setItems(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load banner slides.')
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

  function handleFormChange<K extends keyof BannerSlideInput>(
    field: K,
    value: BannerSlideInput[K],
  ) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function startCreate() {
    setEditingSlide(null)
    const nextSortOrder =
      items.length > 0 ? Math.max(...items.map((s) => s.sortOrder)) + 1 : 0
    setForm({ ...EMPTY_FORM, sortOrder: nextSortOrder })
    setSelectedFile(null)
    setLocalPreviewUrl(null)
    setIsUploading(false)
    setViewMode('form')
  }

  function startEdit(slide: BannerSlide) {
    setEditingSlide(slide)
    setForm({
      imageUrl: slide.imageUrl,
      badgeText: slide.badgeText,
      headline: slide.headline,
      subheading: slide.subheading,
      caption: slide.caption,
      isActive: slide.isActive,
      sortOrder: slide.sortOrder,
    })
    setSelectedFile(null)
    setLocalPreviewUrl(null)
    setIsUploading(false)
    setViewMode('form')
  }

  function handleCancelFormCleanup() {
    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl)
    }
    setViewMode('list')
    setEditingSlide(null)
    setForm(EMPTY_FORM)
    setSelectedFile(null)
    setLocalPreviewUrl(null)
    setIsUploading(false)
  }

  const cancelForm = handleCancelFormCleanup

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
    const hasFile = selectedFile !== null
    const hasUrl = form.imageUrl.trim().length > 0

    if (!hasFile && !hasUrl) {
      showFeedback('error', 'Please upload a banner image or provide an existing image URL.')
      return
    }

    if (!form.headline.trim()) {
      showFeedback('error', 'Headline is required.')
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

      if (editingSlide) {
        await updateBannerSlide(editingSlide.id, payload)
        showFeedback('success', 'Banner slide updated.')
      } else {
        await createBannerSlide(payload)
        showFeedback('success', 'Banner slide created.')
      }

      triggerHapticFeedback('light')
      handleCancelFormCleanup()
      await loadAll()
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to save.')
    } finally {
      setSaving(false)
      setIsUploading(false)
    }
  }

  async function handleDelete(slideId: string) {
    try {
      setSaving(true)
      await deleteBannerSlide(slideId)
      triggerHapticFeedback('light')
      setDeleteConfirmId(null)
      showFeedback('success', 'Banner slide deleted.')
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
    await reorderBannerSlides(newItems.map((s) => s.id))
  }

  async function handleMoveDown(index: number) {
    if (index >= items.length - 1) return
    const newItems = [...items]
    ;[newItems[index + 1], newItems[index]] = [newItems[index], newItems[index + 1]]
    setItems(newItems)
    await reorderBannerSlides(newItems.map((s) => s.id))
  }

  const activeSlides = useMemo(
    () => items.filter((s) => s.isActive).length,
    [items],
  )

  return (
    <article className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(28,14,34,0.94),rgba(18,10,22,0.96))] p-5 shadow-[0_25px_70px_rgba(0,0,0,0.35)]">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
            Carousel Manager
          </p>
          {!loading && items.length > 0 ? (
            <p className="mt-1 text-[10px] text-[var(--shop-muted)]/60">
              {activeSlides} active · {items.length - activeSlides} hidden
            </p>
          ) : null}
        </div>
        <span className="rounded-full bg-[var(--shop-purple)]/22 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-cream)]">
          Hero Slides
        </span>
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

      {/* ── Form Module (create / edit) ── */}
      {viewMode === 'form' ? (
        <div ref={formRef} className="mt-4 space-y-4 rounded-[24px] border border-white/10 bg-[#1C1622] p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--shop-cream)]">
              {editingSlide ? 'Edit Slide' : 'New Slide'}
            </p>
            <button
              type="button"
              onClick={cancelForm}
              className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]"
            >
              Cancel
            </button>
          </div>

          {/* File Upload Dropzone */}
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--shop-muted)]">
              Banner Image <span className="text-[var(--shop-red)]">*</span>
            </span>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null
                handleFileSelect(file)
                // Reset so the same file can be re-selected
                e.target.value = ''
              }}
            />

            {/* Dropzone UI */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  fileInputRef.current?.click()
                }
              }}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[#A855F7]/30 bg-white/[0.03] px-4 py-8 text-center transition-all hover:border-[#A855F7]/60 hover:bg-white/[0.05]"
            >
              {/* File icon */}
              <svg
                viewBox="0 0 24 24"
                className="h-8 w-8 text-[#A855F7]/50"
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
                  Upload local file
                </p>
                <p className="mt-1 text-[10px] text-[var(--shop-muted)]/50">
                  PNG, JPG, WebP
                </p>
              </div>
            </div>
          </label>

          {/* Local file preview (when a file is selected) */}
          {localPreviewUrl ? (
            <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
              <img
                src={localPreviewUrl}
                alt="Slide preview"
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

          {/* Fallback: show existing imageUrl if editing but no new file selected */}
          {!localPreviewUrl && form.imageUrl.trim() && editingSlide ? (
            <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
              <img
                src={form.imageUrl.trim()}
                alt="Existing slide"
                className="aspect-video w-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
              <div className="border-t border-white/10 bg-white/6 px-3 py-2 text-[10px] text-[var(--shop-muted)]/60">
                Existing image (upload a new file to replace)
              </div>
            </div>
          ) : null}

          {/* Badge Text */}
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--shop-muted)]">
              Badge Text
            </span>
            <input
              value={form.badgeText}
              onChange={(e) => handleFormChange('badgeText', e.target.value)}
              placeholder="e.g. COMING SOON / LIVE NOW"
              className="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-sm text-[var(--shop-cream)] outline-none placeholder:text-[var(--shop-muted)]/60 focus:border-[var(--shop-purple)] transition-colors"
            />
          </label>

          {/* Headline & Subheading side by side */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--shop-muted)]">
                Headline <span className="text-[var(--shop-red)]">*</span>
              </span>
              <input
                value={form.headline}
                onChange={(e) => handleFormChange('headline', e.target.value)}
                placeholder="e.g. DROP 01"
                className="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-sm text-[var(--shop-cream)] outline-none placeholder:text-[var(--shop-muted)]/60 focus:border-[var(--shop-purple)] transition-colors"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--shop-muted)]">
                Subheading
              </span>
              <input
                value={form.subheading}
                onChange={(e) => handleFormChange('subheading', e.target.value)}
                placeholder="e.g. AVAILABLE NOW"
                className="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-sm text-[var(--shop-cream)] outline-none placeholder:text-[var(--shop-muted)]/60 focus:border-[var(--shop-purple)] transition-colors"
              />
            </label>
          </div>

          {/* Caption */}
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--shop-muted)]">
              Caption
            </span>
            <input
              value={form.caption}
              onChange={(e) => handleFormChange('caption', e.target.value)}
              placeholder="e.g. Limited pieces • First come, first served"
              className="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-sm text-[var(--shop-cream)] outline-none placeholder:text-[var(--shop-muted)]/60 focus:border-[var(--shop-purple)] transition-colors"
            />
          </label>

          {/* Active toggle */}
          <div className="flex items-center justify-between rounded-2xl bg-white/8 px-4 py-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--shop-muted)]">
              Slide Visible
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
              disabled={saving || isUploading}
              className={`flex-1 rounded-xl px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white transition-all ${
                saving || isUploading
                  ? 'bg-white/15 text-[var(--shop-muted)]'
                  : editingSlide
                    ? 'border border-[var(--shop-purple)] bg-[var(--shop-purple)]/40'
                    : 'bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] shadow-[0_4px_16px_rgba(139,61,255,0.3)]'
              }`}
            >
              {isUploading
                ? 'Uploading...'
                : saving
                  ? 'Saving...'
                  : editingSlide
                    ? 'Save Changes'
                    : 'Create Slide'}
            </button>
          </div>
        </div>
      ) : null}

      {/* ── "+ Add New Banner Slide" action card ── */}
      {viewMode === 'list' ? (
        <button
          type="button"
          onClick={() => {
            triggerHapticFeedback('light')
            startCreate()
          }}
          className="mt-4 flex w-full items-center gap-4 rounded-2xl border-2 border-dashed border-white/12 bg-[#1C1622] px-5 py-6 text-left transition-all hover:border-white/25"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/8">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-[var(--shop-purple)]" aria-hidden="true">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold tracking-[-0.02em] text-[var(--shop-cream)]">
              Add New Banner Slide
            </p>
            <p className="mt-0.5 text-xs text-[var(--shop-muted)]">
              image · badge · headline · subheading · caption
            </p>
          </div>
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="ml-auto h-5 w-5 shrink-0 text-[var(--shop-muted)]"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      ) : null}

      {/* ── Slides List ── */}
      {viewMode === 'list' ? (
        <div className="mt-4 space-y-3">
          {/* Loading state */}
          {loading ? (
            <div className="rounded-2xl bg-white/8 px-4 py-4 text-center text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
              Loading slides...
            </div>
          ) : null}

          {/* Empty state */}
          {!loading && !error && items.length === 0 ? (
            <div className="rounded-2xl bg-white/8 px-4 py-8 text-center text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
              No banner slides yet. Tap above to create your first one.
            </div>
          ) : null}

          {/* Slide rows */}
          {!loading && !error
            ? items.map((slide, index) => (
                <div
                  key={slide.id}
                  className={`group flex items-center gap-4 rounded-2xl border bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-3 transition-all ${
                    slide.isActive ? 'border-white/10' : 'border-white/6 opacity-55'
                  }`}
                >
                  {/* Reorder arrows */}
                  <div className="flex shrink-0 flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className="flex h-4 w-5 items-center justify-center rounded-[2px] text-[8px] text-[var(--shop-muted)] transition-colors hover:text-white disabled:opacity-20"
                      aria-label="Move up"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveDown(index)}
                      disabled={index >= items.length - 1}
                      className="flex h-4 w-5 items-center justify-center rounded-[2px] text-[8px] text-[var(--shop-muted)] transition-colors hover:text-white disabled:opacity-20"
                      aria-label="Move down"
                    >
                      ▼
                    </button>
                  </div>

                  {/* Image thumbnail — landscape aspect-video */}
                  <div className="w-28 shrink-0 overflow-hidden rounded-xl bg-black/30 sm:w-36">
                    <div className="aspect-video w-full">
                      {slide.imageUrl ? (
                        <img
                          src={slide.imageUrl}
                          alt={slide.headline}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]">
                          No Img
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Headline + subheading center */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-bold tracking-[-0.02em] text-[var(--shop-cream)]">
                        {slide.headline}
                      </p>
                      {!slide.isActive ? (
                        <span className="shrink-0 rounded-full bg-white/8 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-[var(--shop-muted)]">
                          Hidden
                        </span>
                      ) : null}
                    </div>
                    {slide.subheading ? (
                      <p className="mt-0.5 truncate text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shop-purple)]">
                        {slide.subheading}
                      </p>
                    ) : null}
                    {slide.badgeText ? (
                      <p className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--shop-muted)]/70">
                        {slide.badgeText}
                      </p>
                    ) : null}
                    {slide.caption ? (
                      <p className="mt-0.5 hidden truncate text-[10px] text-[var(--shop-muted)]/50 sm:block">
                        {slide.caption}
                      </p>
                    ) : null}
                  </div>

                  {/* Action buttons group */}
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHapticFeedback('light')
                        startEdit(slide)
                      }}
                      className="rounded-lg border border-white/12 bg-white/8 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)] transition-colors hover:bg-white/14"
                    >
                      Edit
                    </button>

                    {deleteConfirmId === slide.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void handleDelete(slide.id)}
                          className="rounded-lg bg-[var(--shop-red)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          className="rounded-lg border border-white/10 bg-white/8 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          triggerHapticFeedback('light')
                          setDeleteConfirmId(slide.id)
                        }}
                        className="rounded-lg border border-white/12 bg-white/8 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)] transition-colors hover:border-[var(--shop-red)]/30 hover:bg-[var(--shop-red)]/12 hover:text-[var(--shop-red)]"
                        aria-label="Delete banner slide"
                      >
                        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                          <path d="M5.5 2a.5.5 0 01.5-.5h4a.5.5 0 01.5.5v1H5.5V2zM4 3.5V2a2 2 0 012-2h4a2 2 0 012 2v1.5h2.5a.5.5 0 010 1h-1.05l-.89 8.89A2 2 0 0110.59 14H5.41a2 2 0 01-1.97-1.61L2.55 4.5H1.5a.5.5 0 010-1H4zm1.05 1l.88 8.44a1 1 0 00.98.81h4.18a1 1 0 00.98-.81L12.95 4.5H5.05z" />
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
