export interface Series {
  /** Field name in each datum */
  key: string;
  /** Legend / tooltip label */
  label: string;
  /** Defaults to the categorical palette by index */
  color?: string;
}

export type Datum = Record<string, string | number | null | undefined>;
