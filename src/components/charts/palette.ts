// Chart palette. Categorical order validated with the dataviz palette checker (adjacent CVD ΔE ≥ 8,
// normal-vision ΔE ≥ 15 on white). Assign series in this order and never cycle — fold a 7th+
// series into "Other". Status colours are reserved for MonthlyStatus/SessionStatus semantics.

export const SERIES_COLORS = ['#2F56E8', '#EB6834', '#1BAF7A', '#EDA100', '#D55181', '#7E3794'] as const;

/** Programme accents (single-series charts) */
export const ACCENT = {
  primary: '#2F56E8',
  mentor: '#7E3794',
  success: '#16A34A',
  warning: '#E07B00',
  danger: '#DC2626',
  neutral: '#94A3B8',
} as const;

export const STATUS_COLORS = {
  completed: '#16A34A',
  scheduled: '#2F56E8',
  to_be_scheduled: '#E9A23B',
  missed: '#DC2626',
  cancelled: '#94A3B8',
  awaiting_update: '#E07B00',
} as const;

export const SENTIMENT_COLORS = { positive: '#16A34A', neutral: '#94A3B8', negative: '#DC2626' } as const;

/** Axis / grid styling (recessive) */
export const AXIS = {
  tick: { fill: '#64748B', fontSize: 12 },
  line: '#E5E9F2',
  grid: '#EEF1F6',
} as const;

export const seriesColor = (i: number) => SERIES_COLORS[Math.min(i, SERIES_COLORS.length - 1)];
