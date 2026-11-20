/** Colour tokens. Both palettes define the same keys; components never use raw colours. */
export type Palette = {
  scheme: 'light' | 'dark';
  background: string;
  surface: string;
  surfaceMuted: string;
  surfaceHighlight: string;
  border: string;
  divider: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  textFaint: string;
  primary: string;
  primarySoft: string;
  onPrimary: string;
  danger: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  purple: string;
  header: string;
  onHeader: string;
  onHeaderMuted: string;
  segmentTrack: string;
  backdrop: string;
  shadow: string;
  /** Left-border accents cycled through the lessons of a day. */
  accents: readonly string[];
};

export const lightPalette: Palette = {
  scheme: 'light',
  background: '#f5f7fb',
  surface: '#ffffff',
  surfaceMuted: '#f7f9fc',
  surfaceHighlight: '#edf3ff',
  border: '#d9dfeb',
  divider: '#edf0f6',
  text: '#172b4d',
  textMuted: '#5f6b7e',
  textSubtle: '#7a8599',
  textFaint: '#97a0b0',
  primary: '#3867d6',
  primarySoft: '#e9eefb',
  onPrimary: '#ffffff',
  danger: '#d63151',
  dangerSoft: '#fde6ea',
  success: '#13894a',
  successSoft: '#e3f7ec',
  warning: '#a87400',
  warningSoft: '#fff4d6',
  purple: '#8854d0',
  header: '#172b4d',
  onHeader: '#ffffff',
  onHeaderMuted: '#c4d0e6',
  segmentTrack: '#e5e9f2',
  backdrop: 'rgba(23,43,77,0.55)',
  shadow: '#172b4d',
  accents: ['#3867d6', '#20bf6b', '#8854d0', '#eb3b5a', '#f7b731'],
};

export const darkPalette: Palette = {
  scheme: 'dark',
  background: '#0e1525',
  surface: '#172136',
  surfaceMuted: '#1d2940',
  surfaceHighlight: '#1f2f52',
  border: '#2c3a57',
  divider: '#24304a',
  text: '#e8edf7',
  textMuted: '#aab5c9',
  textSubtle: '#8b97ad',
  textFaint: '#6c7890',
  primary: '#6f97ff',
  primarySoft: '#22325a',
  onPrimary: '#0e1525',
  danger: '#ff6b85',
  dangerSoft: '#4a2030',
  success: '#4fd18b',
  successSoft: '#163a2a',
  warning: '#f5c451',
  warningSoft: '#3d3218',
  purple: '#b48cf2',
  header: '#111a2d',
  onHeader: '#ffffff',
  onHeaderMuted: '#9fb0cf',
  segmentTrack: '#1d2940',
  backdrop: 'rgba(0,0,0,0.6)',
  shadow: '#000000',
  accents: ['#6f97ff', '#4fd18b', '#b48cf2', '#ff6b85', '#f5c451'],
};
