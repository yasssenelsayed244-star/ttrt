// ═══════════════════════════════════════════════════════════════════════════
// Shared types — single source of truth for customer, restaurant, admin, mobile
// ═══════════════════════════════════════════════════════════════════════════

// ─── API Response ──────────────────────────────────────────────────────────────

export interface Pagination {
  total: number
  page: number
  limit: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface ApiResponse<T = unknown> {
  success: boolean
  message: string
  data: T
  meta?: { pagination?: Pagination }
}

// ─── User ──────────────────────────────────────────────────────────────────────

export type UserRole = 'customer' | 'restaurant_owner' | 'driver' | 'admin'

export interface User {
  _id: string
  email: string
  phone?: string
  role: UserRole
  profile: {
    firstName: string
    lastName: string
    avatar?: string
    address?: Address
  }
  isEmailVerified: boolean
  isPhoneVerified: boolean
  status: 'active' | 'suspended' | 'deleted'
  favourites?: string[]
  createdAt: string
}

// ─── Address ───────────────────────────────────────────────────────────────────

export interface Coordinates { lat: number; lng: number }

export interface Address {
  street: string
  building?: string
  floor?: string
  apartment?: string
  city: string
  instructions?: string
  coordinates: Coordinates
}

export interface SavedAddress extends Address {
  _id: string
  label: 'home' | 'work' | 'other'
  customLabel?: string
  isDefault: boolean
}

// ─── Restaurant ────────────────────────────────────────────────────────────────

export interface DaySchedule {
  open: string
  close: string
  isOpen: boolean
}

export interface Restaurant {
  _id: string
  ownerId: string
  name: string
  slug: string
  description?: string
  logo?: string
  coverImage?: string
  cuisine: string[]
  address: {
    street: string
    city: string
    coordinates: Coordinates
  }
  contact: { phone: string; email?: string }
  operatingHours?: Record<string, DaySchedule>
  rating: { average: number; count: number }
  deliveryFee: number
  minimumOrder: number
  estimatedDeliveryTime: number
  status: 'pending' | 'active' | 'inactive' | 'rejected'
  isOpen: boolean
  createdAt: string
}

// ─── Menu ──────────────────────────────────────────────────────────────────────

export interface MenuCategory {
  _id: string
  restaurantId: string
  name: string
  description?: string
  sortOrder: number
  isActive?: boolean
  items: MenuItem[]
}

export interface MenuItemChoice { name: string; price: number }

export interface MenuItemOption {
  _id: string
  name: string
  required: boolean
  multiple: boolean
  choices: MenuItemChoice[]
}

export interface MenuItem {
  _id: string
  restaurantId: string
  categoryId: string
  name: string
  description?: string
  price: number
  image?: string
  options: MenuItemOption[]
  isAvailable: boolean
  isPopular: boolean
  preparationTime: number
  calories?: number
  tags: string[]
  sortOrder?: number
}

// ─── Cart ──────────────────────────────────────────────────────────────────────

export interface CartItemOption {
  optionId: string
  name: string
  choice: string
  extraPrice: number
}

export interface CartItem {
  cartItemId: string
  menuItem: Pick<MenuItem, '_id' | 'name' | 'price' | 'image' | 'isAvailable'>
  quantity: number
  options: CartItemOption[]
  totalPrice: number
}

export interface Cart {
  cartId?: string
  restaurant: Pick<
    Restaurant,
    '_id' | 'name' | 'logo' | 'deliveryFee' | 'minimumOrder' | 'estimatedDeliveryTime' | 'isOpen'
  > | null
  items: CartItem[]
  pricing: {
    subtotal: number
    deliveryFee: number
    tax: number
    total: number
  }
  expiresAt?: string
}

// ─── Order ─────────────────────────────────────────────────────────────────────

export type OrderStatus =
  | 'PLACED' | 'CONFIRMED' | 'PREPARING'
  | 'READY'  | 'PICKED_UP' | 'DELIVERED'
  | 'CANCELLED' | 'REFUNDED'

export interface OrderItem {
  menuItemId: string
  name: string
  quantity: number
  unitPrice: number
  options: { name: string; choice: string; extraPrice: number }[]
  totalPrice: number
}

export interface Order {
  _id: string
  orderNumber: string
  customerId: string | Pick<User, '_id' | 'profile'> & { phone?: string }
  restaurantId: string | Pick<Restaurant, '_id' | 'name' | 'logo'>
  driverId?: string
  items: OrderItem[]
  pricing: {
    subtotal: number
    deliveryFee: number
    tax: number
    discount: number
    total: number
  }
  deliveryAddress: Address
  status: OrderStatus
  statusHistory: { status: OrderStatus; timestamp: string; note?: string }[]
  payment: { method: 'cash' | 'card' | 'wallet'; status: string }
  timeline: {
    placedAt: string
    confirmedAt?: string
    preparedAt?: string
    pickedUpAt?: string
    deliveredAt?: string
    cancelledAt?: string
  }
  notes?: string
  cancellationReason?: string
  rating?: {
    customerToRestaurant?: { rating: number; comment?: string }
    customerToDriver?: { rating: number }
  }
  createdAt: string
}

// ─── Notification ──────────────────────────────────────────────────────────────

export interface Notification {
  _id: string
  type: 'order_update' | 'driver_assigned' | 'payment' | 'promotion' | 'system'
  title: string
  body: string
  data?: Record<string, unknown>
  isRead: boolean
  createdAt: string
}

// ─── Review ────────────────────────────────────────────────────────────────────

export interface Review {
  _id: string
  restaurantId: string
  customerId: User
  orderId: string
  rating: number
  comment?: string
  tags: string[]
  images: string[]
  ownerReply?: { text: string; repliedAt: string }
  createdAt: string
}

// ─── Wallet ────────────────────────────────────────────────────────────────────

export interface Wallet {
  balance: number
  currency: string
}

export interface WalletTransaction {
  _id: string
  type: 'credit' | 'debit'
  amount: number
  balance: number
  description: string
  refType: string
  createdAt: string
}

// ─── Driver ────────────────────────────────────────────────────────────────────

export type DriverStatus = 'available' | 'busy' | 'offline' | 'on_break'

export interface Driver {
  _id: string
  userId: string | Pick<User, '_id' | 'profile' | 'phone'>
  vehicle: { type: string; color: string; plateNumber?: string }
  status: DriverStatus
  zone?: string
  rating: { average: number; count: number }
  totalDeliveries: number
  activeOrderId?: string
  earnings: {
    balance: number
    totalEarned: number
  }
  location?: Coordinates
}

// ─── Restaurant Analytics (restaurant portal) ─────────────────────────────────

export interface DailyRevenue {
  _id: string // date string YYYY-MM-DD
  orders: number
  revenue: number
  avgOrderValue: number
}

export interface RestaurantStats {
  ordersToday: number
  revenueToday: number
  activeOrders: number
  avgRating: number
  ordersWeek: number
  revenueWeek: number
  totalOrders: number
}

// ─── Promo Code ────────────────────────────────────────────────────────────────

export interface PromoCode {
  _id: string
  code: string
  type: 'percentage' | 'fixed'
  value: number
  minOrderAmount: number
  maxDiscount?: number
  maxUses?: number
  maxUsesPerUser: number
  usedCount: number
  expiresAt: string
  isActive: boolean
  description?: string
}
