import { useEffect, useState } from 'react'

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

type ProductAdminPanelProps = {
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
}

export function ProductAdminPanel({
  products,
  onProductsChanged,
}: ProductAdminPanelProps) {
  const [form, setForm] = useState<ProductFormState>(initialFormState)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const [feedbackTone, setFeedbackTone] = useState<'success' | 'error'>('success')
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([])
  const [removedExistingImageUrls, setRemovedExistingImageUrls] = useState<string[]>([])
  const [selectedProductId, setSelectedProductId] = useState<string>('new')
  const [productView, setProductView] = useState<'all' | 'available' | 'sold'>('all')

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
      setFeedbackMessage('Name, description, and a valid price are required.')
      return
    }

    setIsSubmitting(true)
    setFeedbackMessage(null)

    try {
      const pendingGalleryItems = galleryItems.filter(
        (item): item is Extract<GalleryItem, { kind: 'pending' }> =>
          item.kind === 'pending',
      )
      const uploadedImageUrls =
        pendingGalleryItems.length > 0
          ? await uploadProductImages(pendingGalleryItems.map((item) => item.file))
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

      const payload = {
        name: trimmedName,
        description: trimmedDescription,
        category: form.category,
        brandNames,
        price: parsedPrice,
        isAvailable: form.isAvailable,
        images: nextImages,
        isLimitedLabel: form.isLimitedLabel.trim() || undefined,
      }

      if (selectedProduct) {
        await updateProduct(selectedProduct.id, payload)
        await deleteProductImages(removedExistingImageUrls)
      } else {
        await createProduct(payload)
      }

      if (selectedProduct) {
        applyProductToForm({
          ...selectedProduct,
          ...payload,
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
      setFeedbackTone('error')
      setFeedbackMessage(
        error instanceof Error ? error.message : 'Failed to create product.',
      )
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

    try {
      await deleteProductImages(selectedProduct.images)
      await deleteProduct(selectedProduct.id)
      resetToCreateMode()
      setFeedbackTone('success')
      setFeedbackMessage('Product and its saved Storage images were deleted.')
      onProductsChanged()
    } catch (error) {
      setFeedbackTone('error')
      setFeedbackMessage(
        error instanceof Error ? error.message : 'Failed to delete product.',
      )
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

    try {
      const soldProductImages = soldProducts.flatMap((product) => product.images)

      await deleteProductImages(soldProductImages)
      await deleteSoldProducts(products)
      resetToCreateMode()
      setFeedbackTone('success')
      setFeedbackMessage('All sold products and their saved Storage images were deleted.')
      onProductsChanged()
    } catch (error) {
      setFeedbackTone('error')
      setFeedbackMessage(
        error instanceof Error ? error.message : 'Failed to delete sold products.',
      )
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
            Admin Panel
          </p>
          <p className="mt-3 text-sm leading-6 text-[var(--shop-muted)]">
            Create, edit, and delete products directly from the app. This is intentionally simple and does not include admin auth yet.
          </p>
        </div>
        <span className="rounded-full bg-[var(--shop-red)]/22 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--shop-cream)]">
          MVP
        </span>
      </div>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
        <div className="flex flex-wrap gap-2">
          {(['all', 'available', 'sold'] as const).map((view) => (
            <button
              key={view}
              type="button"
              onClick={() => setProductView(view)}
              className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${
                productView === view
                  ? 'bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] text-white'
                  : 'bg-white/8 text-[var(--shop-muted)]'
              }`}
            >
              {view}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
            Mode
          </span>
          <select
            value={selectedProductId}
            onChange={(event) => handleProductSelection(event.target.value)}
            className={inputClassName}
          >
            <option value="new">Create new product</option>
            {filteredProducts.map((product) => (
              <option key={product.id} value={product.id}>
                Edit: {product.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
            Product Name
          </span>
          <input
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            className={inputClassName}
            placeholder="YungWear Heavyweight Hoodie"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
            Description
          </span>
          <textarea
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({ ...current, description: event.target.value }))
            }
            className={`${inputClassName} min-h-24 resize-y`}
            placeholder="Oversized hoodie for the first drop."
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
              Category
            </span>
            <select
              value={form.category}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  category: event.target.value as ProductCategory,
                }))
              }
              className={inputClassName}
            >
              {PRODUCT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
              Price EUR
            </span>
            <input
              value={form.price}
              onChange={(event) =>
                setForm((current) => ({ ...current, price: event.target.value }))
              }
              className={inputClassName}
              inputMode="decimal"
              placeholder="120"
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
            Brands
          </span>
          <input
            value={form.brandNames}
            onChange={(event) =>
              setForm((current) => ({ ...current, brandNames: event.target.value }))
            }
            className={inputClassName}
            placeholder="YungWear, Capsule Line"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
            Product Images
          </span>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => handlePendingFileSelection(event.target.files)}
            className={fileInputClassName}
          />
          <p className="mt-2 text-xs leading-5 text-[var(--shop-muted)]">
            Images are uploaded to Firebase Storage and their download URLs are saved into the product document automatically.
          </p>
          {galleryItems.length > 0 ? (
            <p className="mt-2 text-xs text-[var(--shop-muted)]">
              Gallery items ready: {galleryItems.length}. Move, remove, and save to lock in the final order.
            </p>
          ) : null}
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
                  total={galleryItems.length}
                  onMove={handleMoveGalleryItem}
                  onRemoveExisting={handleRemoveExistingImage}
                  onRemovePending={handleRemovePendingImage}
                />
              ))}
            </div>
          </div>
        ) : null}

        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
            Limited Label
          </span>
          <input
            value={form.isLimitedLabel}
            onChange={(event) =>
              setForm((current) => ({ ...current, isLimitedLabel: event.target.value }))
            }
            className={inputClassName}
            placeholder="Limited Drop"
          />
        </label>

        <label className="flex items-center gap-3 rounded-2xl bg-white/8 px-4 py-3 text-sm text-[var(--shop-cream)]">
          <input
            type="checkbox"
            checked={form.isAvailable}
            onChange={(event) =>
              setForm((current) => ({ ...current, isAvailable: event.target.checked }))
            }
            className="h-4 w-4 accent-zinc-900"
          />
          Product is available
        </label>

        {feedbackMessage ? (
          <p
            className={`rounded-2xl px-4 py-3 text-sm ${
              feedbackTone === 'success'
                ? 'bg-emerald-300/18 text-emerald-100'
                : 'bg-[var(--shop-red)]/18 text-[var(--shop-cream)]'
            }`}
          >
            {feedbackMessage}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-2xl bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] px-4 py-3 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting
            ? 'Saving Product...'
            : selectedProduct
              ? 'Save Product Changes'
              : 'Create Product'}
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

        <button
          type="button"
          onClick={handleDeleteSoldProducts}
          disabled={isSubmitting || soldProducts.length === 0}
          className="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm font-semibold text-[var(--shop-cream)] transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
        >
          Delete All Sold Items ({soldProducts.length})
        </button>
      </form>
    </article>
  )
}

const inputClassName =
  'w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-[var(--shop-cream)] outline-none transition placeholder:text-[var(--shop-muted)]/70 focus:border-[var(--shop-red)]'

const fileInputClassName =
  'w-full rounded-2xl border border-dashed border-white/14 bg-white/6 px-4 py-3 text-sm text-[var(--shop-muted)] file:mr-3 file:rounded-full file:border-0 file:bg-[var(--shop-purple)] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white'

type PendingImageCardProps = {
  item: GalleryItem
  index: number
  total: number
  onMove: (fromIndex: number, toIndex: number) => void
  onRemoveExisting: (imageUrl: string) => void
  onRemovePending: (itemId: string) => void
}

function GalleryImageCard({
  item,
  index,
  total,
  onMove,
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
    <article className="overflow-hidden rounded-[20px] border border-white/10 bg-black/10">
      <div className="aspect-[3/4] w-full bg-black/20">
        <img
          src={imageSrc}
          alt={imageLabel}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="p-3">
        <p className="truncate text-xs text-[var(--shop-muted)]">{imageName}</p>
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-cream)]/70">
          {item.kind === 'existing' ? 'Saved' : 'Pending'}
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onMove(index, index - 1)}
            disabled={index === 0}
            className="rounded-2xl border border-white/10 bg-white/8 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Move Left
          </button>
          <button
            type="button"
            onClick={() => onMove(index, index + 1)}
            disabled={index === total - 1}
            className="rounded-2xl border border-white/10 bg-white/8 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Move Right
          </button>
        </div>
        <button
          type="button"
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
