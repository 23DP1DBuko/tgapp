const DEFAULT_ADMIN_UPLOAD_PRODUCT_IMAGE_URL = '/api/admin/uploadProductImage'
const DEFAULT_ADMIN_DELETE_PRODUCT_IMAGES_URL = '/api/admin/deleteProductImages'
const DEFAULT_ADMIN_UPLOAD_BANNER_IMAGE_URL = '/api/admin/uploadBannerImage'
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024

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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      const [, base64Data = ''] = result.split(',', 2)

      if (!base64Data) {
        reject(new Error(`Failed to read image file: ${file.name}.`))
        return
      }

      resolve(base64Data)
    }

    reader.onerror = () => {
      reject(new Error(`Failed to read image file: ${file.name}.`))
    }

    reader.readAsDataURL(file)
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

export async function uploadProductImages(
  initData: string,
  files: File[],
): Promise<string[]> {
  const uploads = files.map(async (file) => {
    validateImageFile(file)

    const base64Data = await fileToBase64(file)
    const response = await fetch(
      import.meta.env.VITE_ADMIN_UPLOAD_PRODUCT_IMAGE_URL ||
        DEFAULT_ADMIN_UPLOAD_PRODUCT_IMAGE_URL,
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

  const response = await fetch(
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
  )

  if (!response.ok) {
    throw new Error(`Failed to delete product images: ${await readErrorReason(response)}.`)
  }

  const result = (await response.json()) as DeleteProductImagesAdminResponse

  if (!result.ok) {
    throw new Error(
      `Failed to delete product images: ${result.reason ?? 'invalid backend response'}.`,
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

  const base64Data = await fileToBase64(file)

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
