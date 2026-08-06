import { useEffect, useRef, useState } from 'react'

import {
  PRODUCT_CATEGORIES,
  type Product,
  type ProductCategory,
} from '../../types/product'
import {
  createProduct,
  deleteProduct,
  deleteSoldProducts,
  updateProduct,
} from '../../lib/firebase/products'
import {
  deleteProductImages,
  uploadProductImages,
} from '../../lib/firebase/storage'
import { classifyAdminError, formatAdminErrorMessage, type AdminErrorKind } from '../../lib/retry'
import { CustomSelect } from '../ui/CustomSelect'
import { Input } from '../ui/Input'

type ProductAdminPanelProps = {
  initData: string
  products: Product[]
  onProductsChanged: () => void
}

type ProductFormState = {
  name: string
  description: string
  category: ProductCategory
  brandNames: string
  price: string
  isAvailable: boolean
  isLimitedLabel: string
  upcoming: boolean
  earlyAccessAt: string
  publicAt: string
}

type GalleryItem =
  | {
      id: string
      kind: 'existing'
      imageUrl: string
    }
  | {
      id: string
      kind: 'pending'
      file: File
      previewUrl: string
    }

const initialFormState: ProductFormState = {
  name: '',
  description: '',
  category: 'hoodies',
  brandNames: 'YungWear',
  price: '',
  isAvailable: true,
  isLimitedLabel: '',
  upcoming: false,
  earlyAccessAt: '',
  publicAt: '',
}

export function ProductAdminPanel({
  initData,
  products,
  onProductsChanged,
}: ProductAdminPanelProps) {
  const [form, setForm] = useState<ProductFormState>(initialFormState)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const [feedbackTone, setFeedbackTone] = useState<'success' | 'error'>('success')
  const [feedbackErrorKind, setFeedbackErrorKind] = useState<AdminErrorKind | null>(null)
  const [showSlowSaveHint, setShowSlowSaveHint] = useState(false)
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([])
  const [removedExistingImageUrls, setRemovedExistingImageUrls] = useState<string[]>([])
  const [selectedProductId, setSelectedProductId] = useState<string>('new')
  const [productView, setProductView] = useState<'all' | 'available' | 'sold'>('all')
  const [activeDraggedGalleryItemId, setActiveDraggedGalleryItemId] = useState<string | null>(
    null,
  )
  const dragPointerIdRef = useRef<number | null>(null)

  // Slow-save hint: if the form has been submitting for >15s, show a "still working" message.
  useEffect(() => {
    if (!isSubmitting) {
      setShowSlowSaveHint(false)
      return
    }

    const timer = setTimeout(() => setShowSlowSaveHint(true), 15_000)
    return () => clearTimeout(timer)
  }, [isSubmitting])

  const selectedProduct =
    selectedProductId === 'new'
      ? null
      : products.find((product) => product.id === selectedProductId) ?? null
  const filteredProducts = products.filter((product) => {
    if (productView === 'available') {
      return product.isAvailable
    }

    if (productView === 'sold') {
      return !product.isAvailable
    }

    return true
  })
  const soldProducts = products.filter((product) => !product.isAvailable)

  useEffect(() => {
    return () => {
      cleanupPendingPreviewUrls(galleryItems)
    }
  }, [galleryItems])

  function resetToCreateMode() {
    setSelectedProductId('new')
    setForm(initialFormState)
    setRemovedExistingImageUrls([])
    setGalleryItems((currentItems) => {
      cleanupPendingPreviewUrls(currentItems)
      return []
    })
  }

  function applyProductToForm(product: Product) {
    setForm({
      name: product.name,
      description: product.description,
      category: product.category,
      brandNames: product.brandNames.join(', '),
      price: String(product.price),
      isAvailable: product.isAvailable,
      isLimitedLabel: product.isLimitedLabel ?? '',
      upcoming: product.upcoming ?? false,
      earlyAccessAt: product.earlyAccessAt ? formatTimestampForDatetimeLocal(product.earlyAccessAt) : '',
      publicAt: product.publicAt ? formatTimestampForDatetimeLocal(product.publicAt) : '',
    })
    setRemovedExistingImageUrls([])
    setGalleryItems((currentItems) => {
      cleanupPendingPreviewUrls(currentItems)
      return product.images.map((imageUrl, index) => ({
        id: `existing-${product.id}-${index}`,
        kind: 'existing' as const,
        imageUrl,
      }))
    })
  }

  function handleProductSelection(productId: string) {
    setSelectedProductId(productId)
    setFeedbackMessage(null)
    setFeedbackErrorKind(null)

    if (productId === 'new') {
      resetToCreateMode()
      return
    }

    const product = products.find((item) => item.id === productId)

    if (product) {
      applyProductToForm(product)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedName = form.name.trim()
    const trimmedDescription = form.description.trim()
    const parsedPrice = Number(form.price)
    const brandNames = form.brandNames
      .split(',')
      .map((brand) => brand.trim())
      .filter(Boolean)

    if (!trimmedName || !trimmedDescription || Number.isNaN(parsedPrice)) {
      setFeedbackTone('error')
      setFeedbackErrorKind('validation')
      setFeedbackMessage('Name, description, and a valid price are required.')
      return
    }

    setIsSubmitting(true)
    setFeedbackMessage(null)
    setFeedbackErrorKind(null)

    try {
      const pendingGalleryItems = galleryItems.filter(
        (item): item is Extract<GalleryItem, { kind: 'pending' }> =>
          item.kind === 'pending',
      )
      const uploadedImageUrls =
        pendingGalleryItems.length > 0
          ? await uploadProductImages(
              initData,
              pendingGalleryItems.map((item) => item.file),
            )
          : []
      let uploadedImageIndex = 0
      const nextImages = galleryItems.flatMap((item) => {
        if (item.kind === 'existing') {
          return item.imageUrl
        }

        const uploadedImageUrl = uploadedImageUrls[uploadedImageIndex]
        uploadedImageIndex += 1

        return uploadedImageUrl ? [uploadedImageUrl] : []
      })

      if (nextImages.length === 0) {
        setIsSubmitting(false)
        setFeedbackTone('error')
        setFeedbackErrorKind('validation')
        setFeedbackMessage('At least one product image is required before saving.')
        return
      }

      const payload = {
        name: trimmedName,
        description: trimmedDescription,
        category: form.category,
        brandNames,
        price: parsedPrice,
        isAvailable: form.isAvailable,
        images: nextImages,
        isLimitedLabel: form.isLimitedLabel.trim() || undefined,
        upcoming: form.upcoming,
        earlyAccessAt: form.earlyAccessAt || null,
        publicAt: form.publicAt || null,
      }

      if (selectedProduct) {
        await updateProduct(initData, selectedProduct.id, payload)
        await deleteProductImages(initData, removedExistingImageUrls)
      } else {
        await createProduct(initData, payload)
      }

      if (selectedProduct) {
        // Reconstruct the form from saved payload, but keep Timestamp-typed fields from the original
        applyProductToForm({
          ...selectedProduct,
          ...payload,
          earlyAccessAt: selectedProduct.earlyAccessAt,
          publicAt: selectedProduct.publicAt,
        })
      } else {
        resetToCreateMode()
      }

      setFeedbackTone('success')
      setFeedbackMessage(
        selectedProduct
          ? 'Product updated in Firestore.'
          : 'Product created in Firestore.',
      )
      onProductsChanged()
    } catch (error) {
      const kind = classifyAdminError(error)
      setFeedbackTone('error')
      setFeedbackErrorKind(kind)
      setFeedbackMessage(formatAdminErrorMessage(kind, error))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeleteProduct() {
    if (!selectedProduct) {
      return
    }

    const shouldDelete = window.confirm(
      `Delete "${selectedProduct.name}" from Firestore?`,
    )

    if (!shouldDelete) {
      return
    }

    setIsSubmitting(true)
    setFeedbackMessage(null)
    setFeedbackErrorKind(null)

    try {
      await deleteProductImages(initData, selectedProduct.images)
      await deleteProduct(initData, selectedProduct.id)
      resetToCreateMode()
      setFeedbackTone('success')
      setFeedbackMessage('Product and its saved Storage images were deleted.')
      onProductsChanged()
    } catch (error) {
      const kind = classifyAdminError(error)
      setFeedbackTone('error')
      setFeedbackErrorKind(kind)
      setFeedbackMessage(formatAdminErrorMessage(kind, error))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeleteSoldProducts() {
    if (soldProducts.length === 0) {
      return
    }

    const shouldDelete = window.confirm(
      `Delete all sold products (${soldProducts.length}) from Firestore?`,
    )

    if (!shouldDelete) {
      return
    }

    setIsSubmitting(true)
    setFeedbackMessage(null)
    setFeedbackErrorKind(null)

    try {
      const soldProductImages = soldProducts.flatMap((product) => product.images)

      await deleteProductImages(initData, soldProductImages)
      await deleteSoldProducts(initData, products)
      resetToCreateMode()
      setFeedbackTone('success')
      setFeedbackMessage('All sold products and their saved Storage images were deleted.')
      onProductsChanged()
    } catch (error) {
      const kind = classifyAdminError(error)
      setFeedbackTone('error')
      setFeedbackErrorKind(kind)
      setFeedbackMessage(formatAdminErrorMessage(kind, error))
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleRemoveExistingImage(imageUrl: string) {
    setRemovedExistingImageUrls((currentUrls) =>
      currentUrls.includes(imageUrl) ? currentUrls : [...currentUrls, imageUrl],
    )
    setGalleryItems((currentItems) =>
      currentItems.filter(
        (currentItem) =>
          !(currentItem.kind === 'existing' && currentItem.imageUrl === imageUrl),
      ),
    )
  }

  function handleRemovePendingImage(itemId: string) {
    setGalleryItems((currentItems) => {
      const removedItem = currentItems.find((item) => item.id === itemId)

      if (removedItem?.kind === 'pending') {
        URL.revokeObjectURL(removedItem.previewUrl)
      }

      return currentItems.filter((currentItem) => currentItem.id !== itemId)
    })
  }

  function handleMoveGalleryItem(fromIndex: number, toIndex: number) {
    setGalleryItems((currentFiles) => {
      if (
        fromIndex < 0
        || toIndex < 0
        || fromIndex >= currentFiles.length
        || toIndex >= currentFiles.length
      ) {
        return currentFiles
      }

      const nextFiles = [...currentFiles]
      const [movedFile] = nextFiles.splice(fromIndex, 1)
      nextFiles.splice(toIndex, 0, movedFile)

      return nextFiles
    })
  }

  function handleGalleryPointerStart(itemId: string, pointerId: number) {
    dragPointerIdRef.current = pointerId
    setActiveDraggedGalleryItemId(itemId)
  }

  function handleGalleryPointerMove(clientX: number, clientY: number) {
    if (!activeDraggedGalleryItemId) {
      return
    }

    const dropTarget = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>(
      '[data-gallery-item-id]',
    )
    const targetItemId = dropTarget?.dataset.galleryItemId

    if (!targetItemId || targetItemId === activeDraggedGalleryItemId) {
      return
    }

    const fromIndex = galleryItems.findIndex((item) => item.id === activeDraggedGalleryItemId)
    const toIndex = galleryItems.findIndex((item) => item.id === targetItemId)

    if (fromIndex === -1 || toIndex === -1) {
      return
    }

    handleMoveGalleryItem(fromIndex, toIndex)
    setActiveDraggedGalleryItemId(targetItemId)
  }

  function handleGalleryPointerEnd() {
    dragPointerIdRef.current = null
    setActiveDraggedGalleryItemId(null)
  }

  function handlePendingFileSelection(files: FileList | null) {
    if (!files) {
      return
    }

    const nextPendingItems = Array.from(files).map((file, index) => ({
      id: `pending-${file.name}-${file.size}-${Date.now()}-${index}`,
      kind: 'pending' as const,
      file,
      previewUrl: URL.createObjectURL(file),
    }))

    setGalleryItems((currentItems) => [...currentItems, ...nextPendingItems])
  }

  return (
    <article className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(35,16,37,0.94),rgba(22,10,24,0.96))] p-5 shadow-[0_25px_70px_rgba(0,0,0,0.35)]">
      {/* ── Header: title + destructive actions ── */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
          Product Admin
        </p>
        <div className="flex items-center gap-2">
          {soldProducts.length > 0 ? (
            <button
              type="button"
              onClick={handleDeleteSoldProducts}
              disabled={isSubmitting}
              className="rounded-full border border-[var(--shop-red)]/30 bg-[var(--shop-red)]/12 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)] transition-opacity disabled:opacity-50"
            >
              Clear Sold ({soldProducts.length})
            </button>
          ) : null}
          <span className="rounded-full bg-[var(--shop-red)]/22 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-cream)]">
            Live
          </span>
        </div>
      </div>

      {/* ── View filter pills ── */}
      <div className="mt-4 flex gap-2">
        {(['all', 'available', 'sold'] as const).map((view) => (
          <button
            key={view}
            type="button"
            onClick={() => setProductView(view)}
            className={`rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${
              productView === view
                ? 'bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] text-white'
                : 'bg-white/8 text-[var(--shop-muted)]'
            }`}
          >
            {view}
          </button>
        ))}
      </div>

      <form className="mt-4 space-y-4" onSubmit={handleSubmit}>

        <label className="block">
          <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-500">
            Mode
          </span>
          <CustomSelect
            value={selectedProductId}
            options={[
              { value: 'new', label: 'Create new product' },
              ...filteredProducts.map((p) => ({
                value: p.id,
                label: `Edit: ${p.name}`,
              })),
            ]}
            onChange={handleProductSelection}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-500">
            Product Name
          </span>
          <Input
            size="md"
            focusColor="red"
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="YungWear Heavyweight Hoodie"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-500">
            Description
          </span>
          <Input
            size="md"
            focusColor="red"
            multiline
            value={form.description}
            onChange={(event) => {
              setForm((current) => ({ ...current, description: event.target.value }))
              event.target.style.height = 'auto'
              event.target.style.height = `${event.target.scrollHeight}px`
            }}
            placeholder="Oversized hoodie for the first drop."
            className="resize-none overflow-hidden"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-500">
              Category
            </span>
            <CustomSelect
              value={form.category}
              options={PRODUCT_CATEGORIES.map((cat) => ({
                value: cat,
                label: cat,
              }))}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  category: value as ProductCategory,
                }))
              }
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-500">
              Price EUR
            </span>
            <Input
              size="md"
              focusColor="red"
              value={form.price}
              onChange={(event) =>
                setForm((current) => ({ ...current, price: event.target.value }))
              }
              inputMode="decimal"
              placeholder="120"
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-500">
            Brands
          </span>
          <Input
            size="md"
            focusColor="red"
            value={form.brandNames}
            onChange={(event) =>
              setForm((current) => ({ ...current, brandNames: event.target.value }))
            }
            placeholder="YungWear, Capsule Line"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-500">
            Product Images
          </span>

          {/* Dashed dropzone */}
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/14 bg-white/6 px-4 py-6 transition-colors hover:border-white/25">
            <svg viewBox="0 0 24 24" fill="currentColor" className="mb-2 h-6 w-6 shrink-0 text-[var(--shop-muted)]" aria-hidden="true">
          <g transform="translate(2, 2)">

              <path d="M9.25 13.25a.75.75 0 001.5 0V4.636l2.955 3.129a.75.75 0 001.09-1.03l-4.25-4.5a.75.75 0 00-1.09 0l-4.25 4.5a.75.75 0 101.09 1.03L9.25 4.636V13.25z" />
              <path fillRule="evenodd" d="M3.5 12.75a.75.75 0 01.75.75v2.25a1 1 0 001 1h9.5a1 1 0 001-1V13.5a.75.75 0 011.5 0v2.25a2.5 2.5 0 01-2.5 2.5h-9.5a2.5 2.5 0 01-2.5-2.5V13.5a.75.75 0 01.75-.75z" clipRule="evenodd" />
            
          </g>
        </svg>
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]">
              Add Images
            </span>
            <span className="mt-1 text-[10px] text-[var(--shop-muted)]/60">
              Tap to browse or drag here
            </span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => handlePendingFileSelection(event.target.files)}
              className="hidden"
            />
          </label>
        </label>

        {galleryItems.length > 0 ? (
          <div className="rounded-[24px] border border-white/10 bg-white/6 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
              Editable Gallery
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {galleryItems.map((item, index) => (
                <GalleryImageCard
                  key={item.id}
                  item={item}
                  index={index}
                  isDragging={activeDraggedGalleryItemId === item.id}
                  dragPointerId={dragPointerIdRef.current}
                  onPointerStart={handleGalleryPointerStart}
                  onPointerMove={handleGalleryPointerMove}
                  onPointerEnd={handleGalleryPointerEnd}
                  onRemoveExisting={handleRemoveExistingImage}
                  onRemovePending={handleRemovePendingImage}
                />
              ))}
            </div>
          </div>
        ) : null}

        <label className="block">
          <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-500">
            Limited Label
          </span>
          <Input
            size="md"
            focusColor="red"
            value={form.isLimitedLabel}
            onChange={(event) =>
              setForm((current) => ({ ...current, isLimitedLabel: event.target.value }))
            }
            placeholder="Limited Drop"
          />
        </label>

        <label className="flex cursor-pointer items-center justify-between rounded-2xl bg-white/8 px-4 py-3">
          <span className="text-sm text-[var(--shop-cream)]">Product is available</span>            <button
            type="button"
            role="switch"
            aria-checked={form.isAvailable}
            aria-label="Toggle product availability"
            onClick={() =>
              setForm((current) => ({ ...current, isAvailable: !current.isAvailable }))
            }
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
              form.isAvailable ? 'bg-[var(--shop-purple)]' : 'bg-white/15'
            }`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-all duration-200 ${
                form.isAvailable ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </label>

        {/* Upcoming toggle — only when not available */}
        {!form.isAvailable ? (
          <label className="flex cursor-pointer items-center justify-between rounded-2xl bg-white/8 px-4 py-3">
            <span className="text-sm text-[var(--shop-cream)]">Mark as Upcoming</span>
            <button
              type="button"
              role="switch"
              aria-checked={form.upcoming}
              aria-label="Toggle upcoming status"
              onClick={() =>
                setForm((current) => ({ ...current, upcoming: !current.upcoming }))
              }
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
                form.upcoming ? 'bg-amber-500' : 'bg-white/15'
              }`}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-all duration-200 ${
                  form.upcoming ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </label>
        ) : (
          <input type="hidden" value={String(form.upcoming)} />
        )}

        {/* Early Access scheduling — only when product is available */}
        {form.isAvailable ? (
          <div className="space-y-3 rounded-2xl border border-amber-500/20 bg-amber-500/6 px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-400">
              Early Access Scheduling
            </p>
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                Early Access Start
              </span>
              <Input
                size="md"
                focusColor="red"
                type="datetime-local"
                value={form.earlyAccessAt}
                onChange={(event) =>
                  setForm((current) => ({ ...current, earlyAccessAt: event.target.value }))
                }
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                Public Release
              </span>
              <Input
                size="md"
                focusColor="red"
                type="datetime-local"
                value={form.publicAt}
                onChange={(event) =>
                  setForm((current) => ({ ...current, publicAt: event.target.value }))
                }
              />
            </label>
            <p className="text-[10px] leading-relaxed text-stone-500">
              Set an early access window where only users with at least 1 referral can purchase. After the public release time, everyone can buy.
            </p>
          </div>
        ) : null}

        {/* Slow-save hint — shown after 15s of submitting */}
        {showSlowSaveHint ? (
          <p className="rounded-2xl bg-amber-500/12 px-4 py-3 text-sm text-amber-200">
            Save is still in progress. Large images can take up to a minute to upload.
          </p>
        ) : null}

        {feedbackMessage ? (
          <div
            className={`rounded-2xl px-4 py-3 text-sm ${
              feedbackTone === 'success'
                ? 'bg-emerald-300/18 text-emerald-100'
                : 'bg-[var(--shop-red)]/18 text-[var(--shop-cream)]'
            }`}
          >
            <p>{feedbackMessage}</p>
            {/* Retry button for recoverable errors */}
            {feedbackTone === 'error' && feedbackErrorKind && feedbackErrorKind !== 'validation' ? (
              <button
                type="button"
                onClick={(event) => {
                  // Re-trigger the form submit
                  event.preventDefault()
                  const form = (event.currentTarget as HTMLElement).closest('form')
                  if (form) form.requestSubmit()
                }}
                className="mt-2 w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition-colors hover:bg-white/18"
              >
                Try Again
              </button>
            ) : null}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full rounded-2xl px-4 py-3 text-sm font-bold uppercase tracking-[0.2em] transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
            selectedProduct
              ? 'border-2 border-[var(--shop-purple)] bg-[var(--shop-purple)]/12 text-[var(--shop-purple)]'
              : 'bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] text-white shadow-[0_8px_24px_rgba(139,61,255,0.3)]'
          }`}
        >
          {isSubmitting
            ? 'Saving...'
            : selectedProduct
              ? 'SAVE CHANGES'
              : 'CREATE PRODUCT'}
        </button>

        {selectedProduct ? (
          <button
            type="button"
            onClick={handleDeleteProduct}
            disabled={isSubmitting}
            className="w-full rounded-2xl border border-[var(--shop-red)]/30 bg-[var(--shop-red)]/12 px-4 py-3 text-sm font-semibold text-[var(--shop-cream)] transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
          >
            Delete Product
          </button>
        ) : null}
      </form>
    </article>
  )
}

type PendingImageCardProps = {
  item: GalleryItem
  index: number
  isDragging: boolean
  dragPointerId: number | null
  onPointerStart: (itemId: string, pointerId: number) => void
  onPointerMove: (clientX: number, clientY: number) => void
  onPointerEnd: () => void
  onRemoveExisting: (imageUrl: string) => void
  onRemovePending: (itemId: string) => void
}

function GalleryImageCard({
  item,
  index,
  isDragging,
  dragPointerId,
  onPointerStart,
  onPointerMove,
  onPointerEnd,
  onRemoveExisting,
  onRemovePending,
}: PendingImageCardProps) {
  const imageSrc = item.kind === 'existing' ? item.imageUrl : item.previewUrl
  const imageLabel = item.kind === 'existing' ? `Saved Image ${index + 1}` : `Pending Upload ${index + 1}`
  const imageName =
    item.kind === 'existing'
      ? `Saved image ${index + 1}`
      : item.file.name

  return (
    <article
      data-gallery-item-id={item.id}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        onPointerStart(item.id, event.pointerId)
      }}
      onPointerMove={(event) => {
        if (dragPointerId !== event.pointerId) {
          return
        }

        onPointerMove(event.clientX, event.clientY)
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }

        onPointerEnd()
      }}
      onPointerCancel={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }

        onPointerEnd()
      }}
      className={`overflow-hidden rounded-[20px] border bg-black/10 transition-opacity ${
        isDragging
          ? 'border-[var(--shop-red)] opacity-60 shadow-[0_0_0_2px_rgba(255,77,90,0.2)]'
          : 'border-white/10'
      }`}
      style={{ touchAction: 'none' }}
    >
      <div className="aspect-[3/4] w-full bg-black/20">
        <img
          src={imageSrc}
          alt={imageLabel}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs text-[var(--shop-muted)]">{imageName}</p>
          <span className="rounded-full bg-white/8 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)]">
            Move
          </span>
        </div>
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-cream)]/70">
          {item.kind === 'existing' ? 'Saved' : 'Pending'} · Position {index + 1}
        </p>
        <button
          type="button"
          onPointerDown={(event) => {
            event.stopPropagation()
          }}
          onClick={() =>
            item.kind === 'existing'
              ? onRemoveExisting(item.imageUrl)
              : onRemovePending(item.id)
          }
          className="mt-2 w-full rounded-2xl border border-[var(--shop-red)]/30 bg-[var(--shop-red)]/12 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)]"
        >
          {item.kind === 'existing' ? 'Remove Image' : 'Remove Upload'}
        </button>
      </div>
    </article>
  )
}

function cleanupPendingPreviewUrls(items: GalleryItem[]) {
  items.forEach((item) => {
    if (item.kind === 'pending') {
      URL.revokeObjectURL(item.previewUrl)
    }
  })
}

function formatTimestampForDatetimeLocal(
  value: { toMillis?: () => number; seconds?: number } | string | null | undefined,
): string {
  if (!value) return ''

  let ms: number

  if (typeof value === 'string') {
    ms = new Date(value).getTime()
  } else if (typeof value.toMillis === 'function') {
    ms = value.toMillis()
  } else if (typeof value.seconds === 'number') {
    ms = value.seconds * 1000
  } else {
    return ''
  }

  if (!Number.isFinite(ms)) return ''

  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

