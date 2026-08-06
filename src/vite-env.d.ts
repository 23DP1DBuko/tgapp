/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string
  readonly VITE_FIREBASE_AUTH_DOMAIN: string
  readonly VITE_FIREBASE_PROJECT_ID: string
  readonly VITE_FIREBASE_STORAGE_BUCKET: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string
  readonly VITE_FIREBASE_APP_ID: string
  readonly VITE_TELEGRAM_ADMIN_IDS: string
  readonly VITE_TELEGRAM_BOT_USERNAME: string
  readonly VITE_TELEGRAM_BOT_START: string
  readonly VITE_TELEGRAM_BOT_STARTAPP: string
  readonly VITE_ENABLE_ADMIN_IN_BROWSER: string
  readonly VITE_DEV_TELEGRAM_USER_ID: string
  readonly VITE_DEV_TELEGRAM_USERNAME: string
  readonly VITE_DEV_TELEGRAM_FIRST_NAME: string
  readonly VITE_VERIFY_TELEGRAM_ADMIN_URL: string
  readonly VITE_ADMIN_UPDATE_ORDER_STATUS_URL: string
  readonly VITE_ADMIN_UPSERT_PROMO_URL: string
  readonly VITE_ADMIN_DELETE_PROMOS_URL: string
  readonly VITE_ADMIN_UPSERT_PRODUCT_URL: string
  readonly VITE_ADMIN_DELETE_PRODUCTS_URL: string
  readonly VITE_CREATE_CHECKOUT_ORDER_URL: string
  readonly VITE_UPDATE_PRODUCT_SIGNAL_URL: string
  readonly VITE_ADMIN_UPLOAD_PRODUCT_IMAGE_URL: string
  readonly VITE_ADMIN_DELETE_PRODUCT_IMAGES_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
