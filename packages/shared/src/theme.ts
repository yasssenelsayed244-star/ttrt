import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

interface ThemeState {
  mode: ThemeMode
  resolvedTheme: ResolvedTheme
  setMode: (mode: ThemeMode) => void
}

/**
 * Platform adapter — each app supplies how to:
 *  - detect the OS color scheme
 *  - apply the resolved theme (web: toggle a class on <html>; native: no-op,
 *    components read `resolvedTheme` directly)
 *  - persist the choice (web: localStorage; native: AsyncStorage/SecureStore)
 *
 * This keeps the store itself importable from React Native, where `window`
 * and `document` don't exist.
 */
export interface ThemePlatformAdapter {
  getSystemScheme: () => ResolvedTheme
  onSystemSchemeChange?: (cb: (scheme: ResolvedTheme) => void) => () => void
  applyTheme?: (resolved: ResolvedTheme) => void
  storage: StateStorage
}

let adapter: ThemePlatformAdapter | null = null

/** Call once at app startup (web main.tsx / native root layout) before rendering. */
export const configureThemeAdapter = (a: ThemePlatformAdapter) => {
  adapter = a
}

const resolve = (mode: ThemeMode): ResolvedTheme => {
  if (mode !== 'system') return mode
  return adapter?.getSystemScheme() ?? 'light'
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'system',
      resolvedTheme: 'light',

      setMode: (mode) => {
        const resolvedTheme = resolve(mode)
        adapter?.applyTheme?.(resolvedTheme)
        set({ mode, resolvedTheme })
      },
    }),
    {
      name: 'qb-theme',
      storage: createJSONStorage(() => adapter?.storage ?? memoryStorage),
      onRehydrateStorage: () => (state) => {
        // Re-resolve against the current system scheme after hydration
        if (state) {
          const resolvedTheme = resolve(state.mode)
          adapter?.applyTheme?.(resolvedTheme)
          state.resolvedTheme = resolvedTheme
        }
      },
    }
  )
)

// Fallback no-op storage so the store never crashes before an adapter is configured
const memoryStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

/** Cycles light -> dark -> system -> light */
export const cycleThemeMode = (current: ThemeMode): ThemeMode =>
  current === 'light' ? 'dark' : current === 'dark' ? 'system' : 'light'

export const THEME_ICONS: Record<ThemeMode, string> = { light: '☀️', dark: '🌙', system: '💻' }
export const THEME_LABELS_EN: Record<ThemeMode, string> = { light: 'Light', dark: 'Dark', system: 'System' }
export const THEME_LABELS_AR: Record<ThemeMode, string> = { light: 'فاتح', dark: 'داكن', system: 'تلقائي' }
