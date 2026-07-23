import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'

export type Lang = 'en' | 'ar'

// ─── Common translations — shared across every app ─────────────────────────────
// App-specific screens extend this with their own dictionary via `extendDictionary`.

export const commonDictionary = {
  en: {
    // Actions
    save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit', apply: 'Apply',
    confirm: 'Confirm', back: 'Back', next: 'Next', retry: 'Retry', close: 'Close',
    search: 'Search', filter: 'Filter', clear: 'Clear', loading: 'Loading…',
    // State
    error: 'Something went wrong', success: 'Success', empty: 'Nothing here yet',
    // Auth (shared shape across customer/restaurant/admin login forms)
    sign_in: 'Sign In', sign_up: 'Sign Up', log_out: 'Log Out',
    email: 'Email address', password: 'Password',
    forgot_password: 'Forgot password?',
    no_account: "Don't have an account?", have_account: 'Already have an account?',
    first_name: 'First name', last_name: 'Last name', phone: 'Phone',
    // Order status (used in customer, restaurant, admin, mobile)
    status_placed: 'Order Placed', status_confirmed: 'Confirmed', status_preparing: 'Preparing',
    status_ready: 'Ready for Pickup', status_picked_up: 'On the Way', status_delivered: 'Delivered',
    status_cancelled: 'Cancelled', status_refunded: 'Refunded',
    // Common nouns
    orders: 'Orders', order: 'Order', restaurant: 'Restaurant', restaurants: 'Restaurants',
    customer: 'Customer', driver: 'Driver', total: 'Total', subtotal: 'Subtotal',
    delivery_fee: 'Delivery', tax: 'Tax', discount: 'Discount',
  },
  ar: {
    save: 'حفظ', cancel: 'إلغاء', delete: 'حذف', edit: 'تعديل', apply: 'تطبيق',
    confirm: 'تأكيد', back: 'رجوع', next: 'التالي', retry: 'إعادة المحاولة', close: 'إغلاق',
    search: 'بحث', filter: 'فلترة', clear: 'مسح', loading: 'جاري التحميل…',
    error: 'حدث خطأ ما', success: 'تم بنجاح', empty: 'لا يوجد شيء هنا بعد',
    sign_in: 'تسجيل الدخول', sign_up: 'إنشاء حساب', log_out: 'تسجيل الخروج',
    email: 'البريد الإلكتروني', password: 'كلمة المرور',
    forgot_password: 'نسيت كلمة المرور؟',
    no_account: 'ليس لديك حساب؟', have_account: 'لديك حساب بالفعل؟',
    first_name: 'الاسم الأول', last_name: 'اسم العائلة', phone: 'رقم الهاتف',
    status_placed: 'تم الطلب', status_confirmed: 'مؤكد', status_preparing: 'يُحضَّر',
    status_ready: 'جاهز للاستلام', status_picked_up: 'في الطريق', status_delivered: 'تم التوصيل',
    status_cancelled: 'ملغي', status_refunded: 'مُسترجع',
    orders: 'الطلبات', order: 'طلب', restaurant: 'مطعم', restaurants: 'المطاعم',
    customer: 'العميل', driver: 'السائق', total: 'الإجمالي', subtotal: 'المجموع الفرعي',
    delivery_fee: 'التوصيل', tax: 'الضريبة', discount: 'الخصم',
  },
} as const

export type CommonKey = keyof typeof commonDictionary.en
type Dictionary = Record<Lang, Record<string, string>>

// ─── Platform adapter — same pattern as theme.ts ────────────────────────────────
export interface I18nPlatformAdapter {
  applyDirection?: (lang: Lang, isRTL: boolean) => void
  storage: StateStorage
}

let adapter: I18nPlatformAdapter | null = null
export const configureI18nAdapter = (a: I18nPlatformAdapter) => { adapter = a }

// ─── Store ─────────────────────────────────────────────────────────────────────

interface I18nState {
  lang: Lang
  isRTL: boolean
  /** Per-app dictionaries registered via `extendDictionary`, merged with common */
  extraDictionaries: Dictionary[]
  setLang: (lang: Lang) => void
  t: (key: string, vars?: Record<string, string>) => string
  registerDictionary: (dict: Dictionary) => void
}

const memoryStorage: StateStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }

export const useI18n = create<I18nState>()(
  persist(
    (set, get) => ({
      lang: 'en',
      isRTL: false,
      extraDictionaries: [],

      setLang: (lang) => {
        const isRTL = lang === 'ar'
        adapter?.applyDirection?.(lang, isRTL)
        set({ lang, isRTL })
      },

      registerDictionary: (dict) =>
        set((s) => ({ extraDictionaries: [...s.extraDictionaries, dict] })),

      t: (key, vars) => {
        const { lang, extraDictionaries } = get()
        let str: string | undefined =
          (commonDictionary[lang] as Record<string, string>)[key]

        if (!str) {
          for (const dict of extraDictionaries) {
            if (dict[lang]?.[key]) { str = dict[lang][key]; break }
          }
        }
        str = str ?? (commonDictionary.en as Record<string, string>)[key] ?? key

        if (vars) {
          for (const [k, v] of Object.entries(vars)) str = str.replace(`{${k}}`, v)
        }
        return str
      },
    }),
    {
      name: 'qb-i18n',
      storage: createJSONStorage(() => adapter?.storage ?? memoryStorage),
      partialize: (s) => ({ lang: s.lang, isRTL: s.isRTL }),
      onRehydrateStorage: () => (state) => {
        if (state) adapter?.applyDirection?.(state.lang, state.isRTL)
      },
    }
  )
)

/** Convenience hook for app-local dictionaries: call once at module load. */
export const extendDictionary = (dict: Dictionary) => {
  useI18n.getState().registerDictionary(dict)
}
