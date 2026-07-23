import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Home, Search, ShoppingBag, ClipboardList, User, ChevronLeft, Bell } from 'lucide-react'
import { useCartStore } from '@/stores/cartStore'
import { useAuthStore } from '@/stores/authStore'
import { Avatar } from '@/components/ui'
import { PreferencesToggle } from '@/hooks/usePreferences'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@quickbite/shared'

// ─── Top Navbar ────────────────────────────────────────────────────────────────

export const Navbar = () => {
  const { user } = useAuthStore()
  const itemCount = useCartStore(s => s.itemCount())
  const openCart  = useCartStore(s => s.openCart)

  return (
    <nav className="sticky top-0 z-30 bg-white/95 dark:bg-background-dark/95 backdrop-blur-sm border-b border-border h-16 flex items-center px-4 gap-3">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2 flex-shrink-0">
        <div className="w-8 h-8 rounded-sm gradient-primary flex items-center justify-center">
          <span className="text-white font-display font-bold text-sm">Q</span>
        </div>
        <span className="font-display font-bold text-xl text-secondary hidden sm:block">QuickBite</span>
      </Link>

      <div className="flex-1" />

      {/* Language + Theme */}
      <PreferencesToggle />

      {/* Cart */}
      <button onClick={openCart} className="relative p-2 hover:bg-muted rounded-sm transition-colors tap-highlight">
        <ShoppingBag className="w-5 h-5 text-secondary" />
        <AnimatePresence>
          {itemCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-primary text-white text-2xs font-bold rounded-full flex items-center justify-center"
            >
              {itemCount > 9 ? '9+' : itemCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Notifications */}
      <Link to="/notifications" className="p-2 hover:bg-muted rounded-sm transition-colors">
        <Bell className="w-5 h-5 text-secondary" />
      </Link>

      {/* Avatar */}
      <Link to="/profile">
        <Avatar src={user?.profile?.avatar} name={user?.profile?.firstName} size="sm" />
      </Link>
    </nav>
  )
}

// ─── Bottom Navigation ─────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { path: '/',        icon: Home,          label: 'Home' },
  { path: '/search',  icon: Search,        label: 'Search' },
  { path: '/orders',  icon: ClipboardList, label: 'Orders' },
  { path: '/profile', icon: User,          label: 'Profile' },
]

export const BottomNav = () => {
  const { pathname } = useLocation()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-border safe-bottom">
      <div className="flex items-center justify-around h-[68px]">
        {NAV_ITEMS.map(({ path, icon: Icon, label }) => {
          const active = pathname === path || (path !== '/' && pathname.startsWith(path))
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                'flex flex-col items-center gap-1 px-4 py-2 rounded-sm transition-all tap-highlight',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <div className="relative">
                <Icon className={cn('w-5 h-5 transition-transform', active && 'scale-110')} />
                {active && (
                  <motion.div
                    layoutId="nav-dot"
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full"
                  />
                )}
              </div>
              <span className={cn('text-2xs font-medium', active && 'font-semibold')}>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

// ─── Page Header ───────────────────────────────────────────────────────────────

interface PageHeaderProps {
  title: string
  subtitle?: string
  showBack?: boolean
  rightAction?: React.ReactNode
}

export const PageHeader = ({ title, subtitle, showBack = false, rightAction }: PageHeaderProps) => {
  const navigate = useNavigate()
  return (
    <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-border px-4 h-14 flex items-center gap-3">
      {showBack && (
        <button onClick={() => navigate(-1)} className="p-1.5 -ml-1.5 hover:bg-muted rounded-sm transition-colors">
          <ChevronLeft className="w-5 h-5 text-secondary" />
        </button>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="font-bold text-lg text-secondary truncate">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {rightAction && <div className="flex-shrink-0">{rightAction}</div>}
    </div>
  )
}
