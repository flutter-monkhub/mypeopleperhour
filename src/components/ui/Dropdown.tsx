import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface PopoverProps {
  /** Render prop for the trigger; spread `props` onto a button */
  trigger: (props: { onClick: () => void; 'aria-expanded': boolean; 'aria-haspopup': true }) => ReactNode;
  align?: 'start' | 'end';
  /** Panel width class, e.g. "w-80" */
  width?: string;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode | ((close: () => void) => ReactNode);
}

/** Anchored panel that closes on outside click / Esc. Controlled or uncontrolled. */
export function Popover({ trigger, align = 'end', width = 'w-56', className, open: controlled, onOpenChange, children }: PopoverProps) {
  const [inner, setInner] = useState(false);
  const open = controlled ?? inner;
  const setOpen = (v: boolean) => {
    setInner(v);
    onOpenChange?.(v);
  };
  const ref = useRef<HTMLDivElement>(null);
  const setOpenRef = useRef(setOpen);
  useEffect(() => {
    setOpenRef.current = setOpen;
  });

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpenRef.current(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenRef.current(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const close = () => setOpen(false);
  return (
    <div ref={ref} className="relative inline-flex">
      {trigger({ onClick: () => setOpen(!open), 'aria-expanded': open, 'aria-haspopup': true })}
      {open && (
        <div className={cn('absolute top-full z-[60] mt-2 animate-pop-in rounded-xl border border-line bg-white shadow-pop', align === 'end' ? 'right-0' : 'left-0', width, className)}>
          {typeof children === 'function' ? children(close) : children}
        </div>
      )}
    </div>
  );
}

export interface MenuItem {
  label: ReactNode;
  icon?: LucideIcon;
  onClick?: () => void;
  /** Navigate to a route */
  to?: string;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  /** Draw a divider above this item */
  divider?: boolean;
  hint?: ReactNode;
}

export interface DropdownMenuProps extends Omit<PopoverProps, 'children'> {
  items: MenuItem[];
  /** Optional header block (e.g. signed-in user) */
  header?: ReactNode;
}

/** Action menu (row "⋮" menus, user menu). */
export function DropdownMenu({ items, header, ...popover }: DropdownMenuProps) {
  const navigate = useNavigate();
  return (
    <Popover {...popover}>
      {(close) => (
        <div role="menu" className="py-1.5">
          {header && <div className="border-b border-line px-3.5 pt-1.5 pb-3">{header}</div>}
          {items.map((it, i) => (
            <div key={i}>
              {it.divider && <div className="my-1.5 border-t border-line" />}
              <button
                type="button"
                role="menuitem"
                disabled={it.disabled}
                onClick={() => {
                  close();
                  it.onClick?.();
                  if (it.to) navigate(it.to);
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                  it.tone === 'danger' ? 'text-danger hover:bg-danger-soft' : 'text-ink hover:bg-canvas',
                )}
              >
                {it.icon && <it.icon className={cn('size-4 shrink-0', it.tone === 'danger' ? 'text-danger' : 'text-ink-2')} />}
                <span className="flex-1">{it.label}</span>
                {it.hint && <span className="text-xs text-muted">{it.hint}</span>}
              </button>
            </div>
          ))}
        </div>
      )}
    </Popover>
  );
}
