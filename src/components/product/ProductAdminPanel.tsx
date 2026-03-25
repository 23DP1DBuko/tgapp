import { useState } from 'react'

import {
  PRODUCT_CATEGORIES,
  type Product,
  type ProductCategory,
} from '../../types/product'
import {
  createProduct,
  deleteProduct,
  updateProduct,
} from '../../lib/firebase/products'
import { uploadProductImages } from '../../lib/firebase/storage'

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
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [selectedProductId, setSelectedProductId] = useState<string>('new')

  const selectedProduct =
    selectedProductId === 'new'
      ? null
      : products.find((product) => product.id === selectedProductId) ?? null

  function resetToCreateMode() {
    setSelectedProductId('new')
    setForm(initialFormState)
    setImageFiles([])
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
    setImageFiles([])
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
      const uploadedImageUrls =
        imageFiles.length > 0 ? await uploadProductImages(imageFiles) : []
      const nextImages = selectedProduct
        ? [...selectedProduct.images, ...uploadedImageUrls]
        : uploadedImageUrls

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

      setImageFiles([])
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
      await deleteProduct(selectedProduct.id)
      resetToCreateMode()
      setFeedbackTone('success')
      setFeedbackMessage('Product deleted from Firestore.')
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

  return (
    <article className="rounded-[28px] border border-black/10 bg-white p-5 shadow-[0_18px_40px_rgba(24,24,27,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-stone-500">
            Admin Panel
          </p>
          <p className="mt-3 text-sm leading-6 text-zinc-700">
            Create, edit, and delete products directly from the app. This is intentionally simple and does not include admin auth yet.
          </p>
        </div>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
          MVP
        </span>
      </div>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
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
            {products.map((product) => (
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
            onChange={(event) =>
              setImageFiles(Array.from(event.target.files ?? []))
            }
            className={fileInputClassName}
          />
          <p className="mt-2 text-xs leading-5 text-stone-500">
            Images are uploaded to Firebase Storage and their download URLs are saved into the product document automatically.
          </p>
          {selectedProduct ? (
            <p className="mt-2 text-xs text-stone-500">
              Existing images kept: {selectedProduct.images.length}. New uploads will be added to them.
            </p>
          ) : null}
          {imageFiles.length > 0 ? (
            <p className="mt-2 text-xs text-zinc-700">
              Selected: {imageFiles.map((file) => file.name).join(', ')}
            </p>
          ) : null}
        </label>

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

        <label className="flex items-center gap-3 rounded-2xl bg-stone-100 px-4 py-3 text-sm text-zinc-700">
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
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-amber-50 text-amber-700'
            }`}
          >
            {feedbackMessage}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
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
            className="w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
          >
            Delete Product
          </button>
        ) : null}
      </form>
    </article>
  )
}

const inputClassName =
  'w-full rounded-2xl border border-black/10 bg-stone-50 px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-900'

const fileInputClassName =
  'w-full rounded-2xl border border-dashed border-black/15 bg-stone-50 px-4 py-3 text-sm text-zinc-700 file:mr-3 file:rounded-full file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white'
