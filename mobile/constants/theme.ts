export const Colors = {
  // Primary palette (reference: black + gold)
  background: '#060606',
  surface: '#171717',
  surfaceAlt: '#222222',
  border: '#8C6A1D',

  // Accent
  teal: '#F7B500',
  tealDim: '#C99307',
  amber: '#F7B500',
  amberDim: '#A97A05',

  // Risk levels
  riskLow: '#10B981',         // green
  riskModerate: '#F7B500',
  riskHigh: '#D61F1F',

  // Text
  textPrimary: '#F4F0E6',
  textSecondary: '#C6BA99',
  textMuted: '#8E7C4F',

  // Utility
  white: '#FFFFFF',
  black: '#000000',
  error: '#D61F1F',
  success: '#68B76A',
  warning: '#F7B500',

  // Dimension scores
  exhaustion: '#EF4444',
  cynicism: '#D48806',
  efficacy: '#68B76A',
}

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
}

export const Radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 28,
  full: 9999,
}

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 30,
}

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
}

export function riskColor(level: string | undefined): string {
  if (level === 'high') return Colors.riskHigh
  if (level === 'moderate') return Colors.riskModerate
  return Colors.riskLow
}
