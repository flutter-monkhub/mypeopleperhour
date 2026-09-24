import { clsx, type ClassValue } from 'clsx';

/**
 * className helper (clsx). NOTE: there is no tailwind-merge — when two utilities conflict
 * (e.g. `p-5` + `p-0`) the stylesheet order wins, not the class order. Components expose
 * props (padding, size, tone…) instead of relying on className overrides for those.
 */
export const cn = (...inputs: ClassValue[]) => clsx(inputs);
