import { fetchWithTimeout } from '../retry'

const DEFAULT_ADMIN_UPLOAD_PRODUCT_IMAGE_URL = '/api/admin/uploadProductImage'
const DEFAULT_ADMIN_DELETE_PRODUCT_IMAGES_URL = '/api/admin/deleteProductImages'
const DEFAULT_ADMIN_UPLOAD_BANNER_IMAGE_URL = '/api/admin/uploadBannerImage'
const DEFAULT_ADMIN_UPLOAD_GIVEAWAY_IMAGE_URL = '/api/admin/uploadGiveawayImage'
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024

/** Timeout for image upload/delete operations (60 seconds to allow for larger images). */
const IMAGE_FETCH_TIMEOUT_MS = 60_000

type UploadProductImageAdminResponse = {
  ok?: boolean
  imageUrl?: string | null
  reason?: string
  detail?: string
}

type DeleteProductImagesAdminResponse = {
  ok?: boolean
  deletedCount?: number
  reason?: string
  detail?: string
}

async function readErrorReason(response: Response): Promise<string> {
  let reason = `http_${response.status}`
  let detail = ''

  try {
    const result = (await response.json()) as { reason?: string; detail?: string }
    if (typeof result.reason === 'string') {
      reason = result.reason
    }
    if (typeof result.detail === 'string' && result.detail) {
      detail = result.detail
    }
  } catch {
    // Keep HTTP fallback values.
  }

  return `${reason}${detail ? ` (${detail})` : ''}`
}

/** Read a Blob and return its base64-encoded data (without the data: prefix). */
async function blobToBase64(blob: Blob, label = 'image'): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      const [, base64Data = ''] = result.split(',', 2)

      if (!base64Data) {
        reject(new Error(`Failed to read image: ${label}.`))
        return
      }

      resolve(base64Data)
    }

    reader.onerror = () => {
      reject(new Error(`Failed to read image: ${label}.`))
    }

    reader.readAsDataURL(blob)
  })
}

function validateImageFile(file: File) {
  if (!file.type.startsWith('image/')) {
    throw new Error(`Only image uploads are allowed: ${file.name}.`)
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error(`Image exceeds 5 MB limit: ${file.name}.`)
  }
}

/**
 * Converts an image File to WebP format in the browser using Canvas API.
 * Falls back to the original file if conversion fails or WebP is unsupported.
 * Skips conversion for files that are already WebP.
 */
async function convertToWebP(file: File, quality = 0.82): Promise<{ blob: Blob; fileName: string; contentType: string }> {
  // Already WebP — skip conversion
  if (file.type === 'image/webp') {
    return { blob: file, fileName: file.name, contentType: file.type }
  }

  try {
    // Fast check: some very old browsers don't support canvas.toBlob at all
    if (typeof document.createElement('canvas').toBlob !== 'function') {
      return { blob: file, fileName: file.name, contentType: file.type }
    }
    const img = await loadImage(file)
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not get canvas context')

    ctx.drawImage(img, 0, 0)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', quality),
    )

    if (!blob) throw new Error('Canvas toBlob returned null')

    // Use the original filename but swap extension to .webp
    const webpName = file.name.replace(/\.[^.]+$/, '') + '.webp'

    return { blob, fileName: webpName, contentType: 'image/webp' }
  } catch {
    // Conversion failed — fall back to original
    return { blob: file, fileName: file.name, contentType: file.type }
  }
}

/** Helper: load a File into an HTMLImageElement */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`Failed to load image: ${file.name}`))
    }
    img.src = url
  })
}

/**
 * Upload multiple product images with client-side WebP conversion.
 */
export async function uploadProductImages(
  initData: string,
  files: File[],
): Promise<string[]> {
  const uploads = files.map(async (file) => {
    validateImageFile(file)

    // Convert to WebP before reading as base64
    const { blob, fileName, contentType } = await convertToWebP(file)

    const base64Data = await blobToBase64(blob, fileName)
    const response = await fetchWithTimeout(
      import.meta.env.VITE_ADMIN_UPLOAD_PRODUCT_IMAGE_URL ||
        DEFAULT_ADMIN_UPLOAD_PRODUCT_IMAGE_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          initData,
          fileName,
          contentType,
          base64Data,
        }),
      },
      IMAGE_FETCH_TIMEOUT_MS,
    )

    if (!response.ok) {
      throw new Error(`Failed to upload image: ${await readErrorReason(response)}.`)
    }

    const result = (await response.json()) as UploadProductImageAdminResponse

    if (!result.ok || typeof result.imageUrl !== 'string' || !result.imageUrl) {
      throw new Error('Failed to upload image: invalid backend response.')
    }

    return result.imageUrl
  })

  return Promise.all(uploads)
}

export async function deleteProductImages(
  initData: string,
  imageUrls: string[],
): Promise<void> {
  if (imageUrls.length === 0) {
    return
  }

  const response = await fetchWithTimeout(
    import.meta.env.VITE_ADMIN_DELETE_PRODUCT_IMAGES_URL ||
      DEFAULT_ADMIN_DELETE_PRODUCT_IMAGES_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        initData,
        imageUrls,
      }),
    },
    IMAGE_FETCH_TIMEOUT_MS,
  )

  if (!response.ok) {
    throw new Error(`${await readErrorReason(response)}`)
  }

  const result = (await response.json()) as DeleteProductImagesAdminResponse

  if (!result.ok) {
    throw new Error(
      `${result.reason ?? 'invalid_backend_response'}`,
    )
  }
}

type UploadBannerImageResponse = {
  ok?: boolean
  imageUrl?: string | null
  reason?: string
}

export async function uploadBannerImage(
  initData: string,
  file: File,
): Promise<string> {
  validateImageFile(file)

  const base64Data = await blobToBase64(file, file.name)

  const response = await fetch(
    import.meta.env.VITE_ADMIN_UPLOAD_BANNER_IMAGE_URL ||
      DEFAULT_ADMIN_UPLOAD_BANNER_IMAGE_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        initData,
        fileName: file.name,
        contentType: file.type,
        base64Data,
      }),
    },
  )

  if (!response.ok) {
    const reason = await readErrorReason(response)
    throw new Error(`Failed to upload banner image: ${reason}.`)
  }

  const result = (await response.json()) as UploadBannerImageResponse

  if (!result.ok || typeof result.imageUrl !== 'string' || !result.imageUrl) {
    throw new Error('Failed to upload banner image: invalid backend response.')
  }

  return result.imageUrl
}

type UploadGiveawayImageResponse = {
  ok?: boolean
  imageUrl?: string | null
  reason?: string
}

export async function uploadGiveawayImage(
  initData: string,
  file: File,
): Promise<string> {
  validateImageFile(file)

  const base64Data = await blobToBase64(file, file.name)

  const response = await fetch(
    import.meta.env.VITE_ADMIN_UPLOAD_GIVEAWAY_IMAGE_URL ||
      DEFAULT_ADMIN_UPLOAD_GIVEAWAY_IMAGE_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        initData,
        fileName: file.name,
        contentType: file.type,
        base64Data,
      }),
    },
  )

  if (!response.ok) {
    const reason = await readErrorReason(response)
    throw new Error(`Failed to upload giveaway image: ${reason}.`)
  }

  const result = (await response.json()) as UploadGiveawayImageResponse

  if (!result.ok || typeof result.imageUrl !== 'string' || !result.imageUrl) {
    throw new Error('Failed to upload giveaway image: invalid backend response.')
  }

  return result.imageUrl
}
