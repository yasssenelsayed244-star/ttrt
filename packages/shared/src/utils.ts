import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { OrderStatus } from './types'

// ─── Class merging (Tailwind) ──────────────────────────────────────────────────

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Money / numbers ────────────────────────────────────────────────────────────

export const formatPrice = (price: number, currency = 'EGP') =>
  `${price.toFixed(0)} ${currency}`

export const formatCompactNumber = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`

export const formatRating = (rating: number) => rating.toFixed(1)

export const formatDeliveryTime = (minutes: number) =>
  minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`

// ─── Dates ──────────────────────────────────────────────────────────────────────

export const formatDate = (d: string | Date) =>
  new Date(d).toLocaleDateString('en-EG', { day: 'numeric', month: 'short', year: 'numeric' })

export const formatTime = (d: string | Date) =>
  new Date(d).toLocaleTimeString('en-EG', { hour: '2-digit', minute: '2-digit' })

export const formatDateTime = (d: string | Date) => `${formatDate(d)} · ${formatTime(d)}`

export const formatTimeAgo = (date: string | Date) => {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export const truncate = (str: string, length = 40) =>
  str.length > length ? `${str.slice(0, length)}…` : str

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ─── Paginated response helper ──────────────────────────────────────────────────
// The backend's ApiResponse.paginated() puts the raw array directly on `data`
// (not `data.orders` / `data.restaurants` / etc) and pagination info on `meta`:
//
//   { success, message, data: Order[], meta: { pagination } }
//
// Use this instead of guessing the shape in every screen's `select`.
export const unwrapList = <T>(res: { data: { data: T[] } }): T[] => res.data.data ?? []

// ─── Order status — labels, colors ─────────────────────────────────────────────

export const STATUS_LABELS: Record<OrderStatus, string> = {
  PLACED:    'Order Placed',
  CONFIRMED: 'Confirmed',
  PREPARING: 'Preparing',
  READY:     'Ready for Pickup',
  PICKED_UP: 'On the Way',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  REFUNDED:  'Refunded',
}

/** Shorter labels — used in restaurant portal's compact table rows */
export const STATUS_LABELS_SHORT: Record<OrderStatus, string> = {
  PLACED:    'New Order',
  CONFIRMED: 'Confirmed',
  PREPARING: 'Preparing',
  READY:     'Ready',
  PICKED_UP: 'Picked Up',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  REFUNDED:  'Refunded',
}

export const STATUS_COLORS: Record<OrderStatus, string> = {
  PLACED:    'bg-blue-100 text-blue-700',
  CONFIRMED: 'bg-indigo-100 text-indigo-700',
  PREPARING: 'bg-yellow-100 text-yellow-700',
  READY:     'bg-orange-100 text-orange-700',
  PICKED_UP: 'bg-purple-100 text-purple-700',
  DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
  REFUNDED:  'bg-gray-100 text-gray-700',
}

/** Same palette with a matching border — used in restaurant portal badges */
export const STATUS_COLORS_BORDERED: Record<OrderStatus, string> = Object.fromEntries(
  Object.entries(STATUS_COLORS).map(([k, v]) => [k, `${v} border ${v.replace('bg-', 'border-').replace('100', '200').split(' ')[0]}`])
) as Record<OrderStatus, string>

export const getStatusColor = (status: string) =>
  STATUS_COLORS[status as OrderStatus] ?? 'bg-gray-100 text-gray-600'

export const getStatusLabel = (status: string) =>
  STATUS_LABELS[status as OrderStatus] ?? status

/** Alias — used in the admin dashboard where order status colors are unbordered */
export const ORDER_STATUS_COLOR = STATUS_COLORS

// ─── Short-name aliases ─────────────────────────────────────────────────────────
// The admin dashboard was written with terse names (fmt, fmtK…). Kept as aliases
// so the same underlying implementation is used everywhere — no duplicate logic.

export const fmt     = formatPrice
export const fmtK    = formatCompactNumber
export const fmtDate = formatDate
export const fmtTime = formatTime
export const timeAgo = formatTimeAgo
