// ═══════════════════════════════════════════════════════════════════════════
// QuickBite design tokens — single source of truth for color, type, and the
// signature visual language used across customer, restaurant, admin, mobile.
//
// Direction: warm, appetite-driven, confident — not a generic "delivery app"
// palette. Char (deep chili-orange) replaces the flatter default orange;
// Smoke (warm near-black) and Steam (warm cream) replace cold gray/white;
// Basil and Ember are deeper, less saturated than typical success/danger reds
// and greens so they sit comfortably next to Char instead of competing.
// ═══════════════════════════════════════════════════════════════════════════

export const palette = {
  // Brand — deep chili/turmeric orange, not the flat default
  char:      '#FF5A1F',
  charDeep:  '#D6430D',
  charLight: '#FF8A5C',

  // Neutrals — warm, not cold gray
  smoke:     '#1A1523', // near-black, primary text
  smokeSoft: '#4A4358', // secondary text
  ash:       '#8B8494', // muted/placeholder text
  steam:     '#FFF8F0', // app background
  linen:     '#FFFFFF', // card/surface background
  ember_line:'#EFE6DC', // borders — warm, not #E5E7EB gray

  // Semantic — deeper and warmer than stock success/danger greens/reds
  basil:     '#0E8F6F',
  basilSoft: '#0E8F6F1A',
  ember:     '#C0392B',
  emberSoft: '#C0392B1A',
  saffron:   '#D97B0A',
  saffronSoft:'#D97B0A1A',
  sky:       '#2874A6',

  // Dark mode neutrals
  darkSmoke:   '#120E17',
  darkLinen:   '#211B29',
  darkAsh:     '#6B6478',
  darkEmberLine:'#332B3D',
} as const

export const typography = {
  display: "'Fraunces', ui-serif, Georgia, serif",
  body:    "'Plus Jakarta Sans', ui-sans-serif, sans-serif",
  mono:    "'JetBrains Mono', ui-monospace, monospace",
  arabicDisplay: "'Lateef', 'Cairo', serif",
  arabicBody:    "'Cairo', ui-sans-serif, sans-serif",
} as const

/**
 * Signature shape language: one corner stays sharp, the rest round — evokes
 * a cut/torn edge (a slice, a wrapped parcel) rather than a generic
 * uniformly-rounded card. Used on primary cards, sheets, and primary
 * buttons; secondary UI stays uniformly rounded so it isn't diluted.
 */
export const signatureRadius = {
  card:    '6px 22px 22px 22px',
  cardRTL: '22px 6px 22px 22px',
  sheet:   '22px 22px 6px 22px',
  button:  '6px 16px 16px 16px',
  pill:    '6px 18px 18px 6px',
  pillRTL: '18px 6px 6px 18px',
} as const

/** Heat-scale used by the order tracking timeline — cool gray at the start,
 *  warming through amber, landing on full Char at delivery. */
export const heatScale = [
  '#C7C2CC', '#F2B366', '#F2914D', '#FF7A3D', '#FF5A1F',
] as const

export const shadow = {
  sm: '0 1px 2px rgba(26,21,35,0.06)',
  md: '0 4px 16px rgba(26,21,35,0.08)',
  lg: '0 12px 32px rgba(26,21,35,0.12)',
  charGlow: '0 8px 24px rgba(255,90,31,0.28)',
} as const
