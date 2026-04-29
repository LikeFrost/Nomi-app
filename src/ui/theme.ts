// Soft Bento palette: white cards on a soft pink page, a single pink accent,
// and a green CTA. Surfaces lean on rounded corners + soft drop shadows
// instead of hard borders.

export const theme = {
  // Canvas
  bg: '#FDF2F8',
  surface: '#FFFFFF',
  surfaceMuted: '#FAF5FB',
  ink: '#1F2937',
  inkMuted: '#6B7280',
  inkSubtle: '#9CA3AF',

  // Pop palette
  accent: '#F472B6',
  accentSoft: '#FBCFE8',
  cta: '#22C55E',
  ctaSoft: '#DCFCE7',
  muted: '#A78BFA',
  mutedSoft: '#EDE9FE',
  white: '#FFFFFF',

  // Status fills
  moodFill: '#F472B6',
  energyFill: '#A78BFA',
  trackBg: '#F3F4F6',

  // Shape
  radius: 20,
  radiusSm: 12,
  radiusPill: 999,

  // Shadow tokens (consumed by Card)
  shadowColor: '#000000',
  shadowOpacity: 0.06,
} as const;

export const RADIUS_PILL = theme.radiusPill;
