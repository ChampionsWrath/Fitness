import type { ReactNode } from 'react';
import { useEffect } from 'react';

export function Icon({ name, size = 22 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'home':
      return (
        <svg {...common}>
          <path d="M3 11 12 3l9 8v10h-6v-6H9v6H3z" />
        </svg>
      );
    case 'workout':
      return (
        <svg {...common}>
          <path d="M6 5v14M18 5v14M3 8v8M21 8v8M6 12h12" />
        </svg>
      );
    case 'progress':
      return (
        <svg {...common}>
          <path d="M3 20h18M5 16l4-5 4 3 6-8" />
        </svg>
      );
    case 'library':
      return (
        <svg {...common}>
          <circle cx="12" cy="5" r="2.2" />
          <path d="M12 8v6M8 22l4-8 4 8M7 11l5-2 5 2" />
        </svg>
      );
    case 'food':
      return (
        <svg {...common}>
          <path d="M5 3v18M9 3v6a2 2 0 0 1-2 2 2 2 0 0 1-2-2V3M17 3c-2 0-3 3-3 6s1 4 3 4v8M17 13c2 0 3-1 3-4s-1-6-3-6" />
        </svg>
      );
    case 'steps':
      return (
        <svg {...common}>
          <path d="M8 3c2 0 3 2 3 4.5S10 12 8 12s-3-1.5-3-4.5S6 3 8 3zM16 8c2 0 3 2 3 4.5S18 17 16 17s-3-1.5-3-4.5S14 8 16 8zM6 14c1.5 0 2.5 1 2.5 2.5S7.5 20 6 20s-2.5-1-2.5-3.5S4.5 14 6 14zM14 19c1.5 0 2.5 1 2.5 2.5" />
        </svg>
      );
    case 'minus':
      return (
        <svg {...common}>
          <path d="M5 12h14" />
        </svg>
      );
    case 'back':
      return (
        <svg {...common}>
          <path d="m15 5-7 7 7 7" />
        </svg>
      );
    case 'chev':
      return (
        <svg {...common} width={18} height={18}>
          <path d="m9 5 7 7-7 7" />
        </svg>
      );
    case 'check':
      return (
        <svg {...common} width={size} height={size} strokeWidth={3}>
          <path d="m5 12 5 5 9-10" />
        </svg>
      );
    case 'plus':
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
      );
    case 'x':
      return (
        <svg {...common}>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      );
    case 'trash':
      return (
        <svg {...common} width={18} height={18}>
          <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
        </svg>
      );
    case 'info':
      return (
        <svg {...common} width={18} height={18}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" />
        </svg>
      );
    case 'play':
      return (
        <svg {...common} fill="currentColor" stroke="none">
          <path d="M7 5v14l12-7z" />
        </svg>
      );
    case 'pause':
      return (
        <svg {...common} fill="currentColor" stroke="none">
          <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
        </svg>
      );
    case 'camera':
      return (
        <svg {...common}>
          <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
          <circle cx="12" cy="13" r="3.5" />
        </svg>
      );
    default:
      return null;
  }
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  full,
  className = '',
  ...rest
}: {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'good';
  size?: 'lg' | 'md' | 'sm';
  full?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`btn ${variant} ${size} ${full ? 'full' : ''} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function Screen({
  title,
  onBack,
  right,
  children,
  noNav,
  eyebrow,
}: {
  title?: string;
  onBack?: () => void;
  right?: ReactNode;
  children: ReactNode;
  noNav?: boolean;
  eyebrow?: string;
}) {
  return (
    <div className={`screen fade-in ${noNav ? 'no-nav' : ''}`}>
      {(title || onBack) && (
        <div className="screen-head">
          {onBack && (
            <button className="back" onClick={onBack} aria-label="Back">
              <Icon name="back" />
            </button>
          )}
          <div className="grow">
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            {title && <h1>{title}</h1>}
          </div>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  full,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  full?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
  if (!open) return null;
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className={`sheet ${full ? 'full' : ''}`} role="dialog" aria-modal="true">
        <div className="grab" />
        {title && <h2>{title}</h2>}
        {children}
      </div>
    </>
  );
}

export function Stat({ label, value, unit, sub, tone }: { label: string; value: ReactNode; unit?: string; sub?: string; tone?: 'good' }) {
  return (
    <div className={`stat ${tone ?? ''}`}>
      <div className="label">{label}</div>
      <div className="value">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

export function ProgressBar({ value, tone }: { value: number; tone?: 'good' }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className={`progress ${tone ?? ''}`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <div className="tiny muted">{hint}</div>}
    </div>
  );
}

export function NumberInput({
  value,
  onChange,
  suffix,
  step = 1,
  min,
  placeholder,
  id,
}: {
  value: number | '';
  onChange: (v: number | '') => void;
  suffix?: string;
  step?: number;
  min?: number;
  placeholder?: string;
  id?: string;
}) {
  return (
    <div className="input-suffix">
      <input
        id={id}
        className="input num"
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      />
      {suffix && <span>{suffix}</span>}
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ title, body, children }: { title: string; body?: string; children?: ReactNode }) {
  return (
    <div className="card flat" style={{ textAlign: 'center', padding: 28 }}>
      <div style={{ fontWeight: 700, fontSize: 17 }}>{title}</div>
      {body && (
        <p className="muted small" style={{ marginTop: 6 }}>
          {body}
        </p>
      )}
      {children && <div style={{ marginTop: 14 }}>{children}</div>}
    </div>
  );
}
