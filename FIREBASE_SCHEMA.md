# Firebase Schema

This document describes the first Firestore shape for the Telegram Mini App MVP.

## Goal

Keep the data model small, explicit, and easy to edit manually while the storefront is still being built.

## Collections To Start With

### `products`

Use this collection first. It is enough to support:
- product list
- product detail page
- category filtering
- manual availability control

Document shape:

```ts
type ProductDocument = {
  name: string
  description: string
  category: 'hoodies' | 'tshirts' | 'outerwear' | 'accessories' | 'other'
  brandNames: string[]
  price: number
  currency: 'EUR'
  isAvailable: boolean
  images: string[]
  createdAt: Timestamp
  isLimitedLabel?: string
}
```

Notes:
- Firestore document ID will act as the product `id` in the app.
- `brandNames` stays as a string array for now to avoid adding a separate brands collection too early.
- `createdAt` is stored as a Firestore timestamp.
- `images` stores Firebase Storage download URLs and supports multiple product images from the start.
- `isLimitedLabel` is optional and meant for manual labels like `1 of 1` or `Limited Drop`.

## Later Collections

Do not implement these yet, but keep them in mind:
- `categories`
- `promoCodes`
- `orders`
- `dropSubscriptions`

## Example Product Document

```json
{
  "name": "YungWear Heavyweight Hoodie",
  "description": "Oversized streetwear hoodie with a heavyweight cotton feel.",
  "category": "hoodies",
  "brandNames": ["YungWear"],
  "price": 120,
  "currency": "EUR",
  "isAvailable": true,
  "images": [
    "https://firebasestorage.googleapis.com/..."
  ],
  "createdAt": "Firestore Timestamp",
  "isLimitedLabel": "Limited Drop"
}
```
