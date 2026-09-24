import { cn } from '@/lib/cn';
import { initials } from '@/lib/format';

const SIZES = {
  xs: 'size-6 text-[10px]',
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-14 text-lg',
  xl: 'size-20 text-2xl',
} as const;

// Soft background + strong foreground pairs (deterministic by name)
const PALETTE = [
  ['#EEF2FF', '#2F56E8'],
  ['#F5ECF8', '#7E3794'],
  ['#E8F7EE', '#15803D'],
  ['#FFF4E5', '#B45309'],
  ['#FDECF3', '#BE185D'],
  ['#E6F6F8', '#0E7490'],
  ['#FDEEE7', '#C2410C'],
  ['#EEF0F4', '#334155'],
] as const;

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export const avatarColors = (name: string) => PALETTE[hash(name) % PALETTE.length];

export interface AvatarProps {
  name: string;
  size?: keyof typeof SIZES;
  src?: string;
  /** White ring (for stacks / dark backgrounds) */
  ring?: boolean;
  className?: string;
}

/** Round initials avatar with a deterministic colour. */
export function Avatar({ name, size = 'md', src, ring, className }: AvatarProps) {
  const [bg, fg] = avatarColors(name);
  return (
    <span
      className={cn('inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold select-none', SIZES[size], ring && 'ring-2 ring-white', className)}
      style={{ backgroundColor: bg, color: fg }}
      aria-hidden={!src}
      title={name}
    >
      {src ? <img src={src} alt={name} className="size-full object-cover" /> : initials(name)}
    </span>
  );
}

/** Avatar + name + secondary line (tables, lists). */
export function PersonCell({ name, secondary, size = 'sm', className }: { name: string; secondary?: string; size?: AvatarProps['size']; className?: string }) {
  return (
    <span className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <Avatar name={name} size={size} />
      <span className="min-w-0">
        <span className="block truncate font-medium text-ink">{name}</span>
        {secondary && <span className="block truncate text-xs text-ink-2">{secondary}</span>}
      </span>
    </span>
  );
}
