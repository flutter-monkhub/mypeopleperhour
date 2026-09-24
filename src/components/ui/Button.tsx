import type { ComponentProps, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { LoaderCircle, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'mentor' | 'link';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

interface StyleProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  /** Square button that only shows the icon (give it an aria-label) */
  iconOnly?: boolean;
}

interface ContentProps {
  /** Lucide icon component shown before the label */
  icon?: LucideIcon;
  /** Lucide icon component shown after the label */
  iconRight?: LucideIcon;
  loading?: boolean;
  children?: ReactNode;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white shadow-[0_1px_2px_rgba(47,86,232,.25)] hover:bg-primary-dark active:bg-primary-dark',
  secondary: 'bg-white text-ink border border-line-strong shadow-[0_1px_2px_rgba(15,23,42,.04)] hover:bg-canvas hover:border-[#c9d1e1]',
  outline: 'bg-white text-primary border border-primary/70 hover:bg-primary-soft hover:border-primary',
  ghost: 'text-ink-2 hover:bg-neutral-soft hover:text-ink',
  danger: 'bg-danger text-white shadow-[0_1px_2px_rgba(220,38,38,.25)] hover:bg-[#b91c1c]',
  mentor: 'bg-mentor text-white shadow-[0_1px_2px_rgba(126,55,148,.25)] hover:bg-mentor-dark',
  link: 'text-primary hover:text-primary-dark hover:underline underline-offset-4 h-auto! px-0!',
};

const SIZES: Record<ButtonSize, { base: string; square: string; icon: string }> = {
  xs: { base: 'h-7 px-2.5 text-xs gap-1.5 rounded-md', square: 'h-7 w-7 rounded-md', icon: 'size-3.5' },
  sm: { base: 'h-8.5 px-3 text-[13px] gap-1.5 rounded-btn', square: 'h-8.5 w-8.5 rounded-btn', icon: 'size-4' },
  md: { base: 'h-10 px-4 text-sm gap-2 rounded-btn', square: 'h-10 w-10 rounded-btn', icon: 'size-4' },
  lg: { base: 'h-11 px-5 text-[15px] gap-2 rounded-btn', square: 'h-11 w-11 rounded-btn', icon: 'size-[18px]' },
};

/** Class string for anything that should look like a button (e.g. an <a>). */
export function buttonClasses({ variant = 'primary', size = 'md', fullWidth, iconOnly }: StyleProps = {}): string {
  return cn(
    'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium transition-colors duration-150',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
    'disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50',
    iconOnly ? SIZES[size].square : SIZES[size].base,
    VARIANTS[variant],
    fullWidth && 'w-full',
  );
}

function Content({ icon: Icon, iconRight: IconRight, loading, children, size = 'md' }: ContentProps & { size?: ButtonSize }) {
  const ic = SIZES[size].icon;
  return (
    <>
      {loading ? <LoaderCircle className={cn(ic, 'animate-spin')} aria-hidden /> : Icon ? <Icon className={ic} aria-hidden strokeWidth={2} /> : null}
      {children}
      {IconRight && !loading ? <IconRight className={ic} aria-hidden strokeWidth={2} /> : null}
    </>
  );
}

export type ButtonProps = StyleProps & ContentProps & Omit<ComponentProps<'button'>, 'children'>;

/**
 * <Button variant="primary|secondary|outline|ghost|danger|mentor|link" size="xs|sm|md|lg" icon={Plus} loading>Save</Button>
 */
export function Button({ variant, size = 'md', fullWidth, iconOnly, icon, iconRight, loading, children, className, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={cn(buttonClasses({ variant, size, fullWidth, iconOnly }), className)} {...rest}>
      <Content icon={icon} iconRight={iconRight} loading={loading} size={size}>
        {children}
      </Content>
    </button>
  );
}

export type LinkButtonProps = StyleProps & ContentProps & Omit<LinkProps, 'children'>;

/** A react-router <Link> styled as a button. */
export function LinkButton({ variant, size = 'md', fullWidth, iconOnly, icon, iconRight, loading, children, className, ...rest }: LinkButtonProps) {
  return (
    <Link className={cn(buttonClasses({ variant, size, fullWidth, iconOnly }), className)} {...rest}>
      <Content icon={icon} iconRight={iconRight} loading={loading} size={size}>
        {children}
      </Content>
    </Link>
  );
}

/** Square icon button — `label` is required for accessibility (also used as tooltip). */
export function IconButton({ icon, label, variant = 'ghost', size = 'md', className, ...rest }: Omit<ButtonProps, 'iconOnly' | 'children'> & { icon: LucideIcon; label: string }) {
  return <Button icon={icon} iconOnly variant={variant} size={size} aria-label={label} title={label} className={className} {...rest} />;
}
