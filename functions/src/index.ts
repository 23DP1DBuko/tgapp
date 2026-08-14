// ── Firebase Functions Entry Point ──
// Domain-specific types and handlers split into separate modules.
// Each module's Cloud Functions must be re-exported from this entry point
// so Firebase Functions can discover them during deployment.
// Note: helpers.ts must be imported first (initializes Firebase + exports shared utils).

import "./helpers.js"

export {
  upsertProductAdmin,
  deleteProductsAdmin,
  setProductDiscountAdmin,
  updateProductSignal,
  uploadProductImageAdmin,
  deleteProductImagesAdmin,
} from "./products.js"

export {
  upsertPromoCodeAdmin,
  deletePromoCodesAdmin,
  validatePromoCode,
  listPromoCodesAdmin,
} from "./promoCodes.js"

export {
  updateOrderStatusAdmin,
  listOrdersAdmin,
  createCheckoutOrder,
  listBuyerOrders,
} from "./orders.js"

export {
  upsertGiveawayAdmin,
  deleteGiveawaysAdmin,
  joinGiveaway,
  completeGiveawayTask,
  getGiveawayEntries,
  getMyGiveawayEntry,
  drawGiveawayAdmin,
} from "./giveaways.js"

export {
  verifyTelegramAdmin,
  telegramBotWebhook,
  broadcastMessageAdmin,
  upsertCampaignAdmin,
  deleteCampaignsAdmin,
  reorderCampaignsAdmin,
  upsertTaskAdmin,
  deleteTasksAdmin,
  toggleBroadcastSubscription,
  getReferralLeaderboard,
  getReferralInfo,
} from "./content.js"

export {
  dailyCheckin,
  getCheckinStatus,
} from "./checkin.js"

export {
  updatePresence,
} from "./presence.js"

export {
  acceptTermsHandler,
  updateUserSettingsHandler,
} from "./consent.js"

export {
  uploadBannerImageAdmin,
  uploadGiveawayImageAdmin,
  getAdminAnalytics,
} from "./helpers.js"
