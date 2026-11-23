import React, { useEffect } from 'react';
import { X, Loader2, Inbox } from 'lucide-react';

export const cx = (...c) => c.filter(Boolean).join(' ');

/* ----------------------------------------------------------------- tones -- */
const TONES = {
  slate: 'bg-slate-50 text-slate-700 ring-slate-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200',
  rose: 'bg-rose-50 text-rose-700 ring-rose-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  sky: 'bg-sky-50 text-sky-700 ring-sky-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
  dark: 'bg-slate-900 text-white ring-slate-900',
};

export const Badge = ({ tone = 'slate', className, children, ...rest }) => (
  <span className={cx('badge', TONES[tone], className)} {...rest}>{children}</span>
);

const STATUS_TONE = { CRITICAL: 'rose', ADMITTED: 'sky', STABLE: 'emerald', DISCHARGED: 'slate' };
export const StatusBadge = ({ status }) => (
  <Badge tone={STATUS_TONE[status] || 'slate'}>
    <span className={cx('h-1.5 w-1.5 rounded-full',
      status === 'CRITICAL' ? 'bg-rose-500 blink' : status === 'STABLE' ? 'bg-emerald-500' :
      status === 'ADMITTED' ? 'bg-sky-500' : 'bg-slate-400')} />
    {status ? status.charAt(0) + status.slice(1).toLowerCase() : '-'}
  </Badge>
);

const PRIORITY_TONE = { STAT: 'rose', HIGH: 'amber', MEDIUM: 'sky', LOW: 'slate' };
export const PriorityBadge = ({ priority }) => (
  <Badge tone={PRIORITY_TONE[priority] || 'slate'}>{priority}</Badge>
);

const TASK_STATUS_TONE = { PENDING: 'slate', IN_PROGRESS: 'sky', COMPLETED: 'emerald', CANCELLED: 'slate' };
export const TaskStatusBadge = ({ status }) => (
  <Badge tone={TASK_STATUS_TONE[status] || 'slate'}>{(status || '').replace('_', ' ').toLowerCase()}</Badge>
);

/* ----------------------------------------------------------------- basics -- */
export const Spinner = ({ className }) => <Loader2 className={cx('h-4 w-4 animate-spin', className)} />;

export const Skeleton = ({ className }) => <div className={cx('skeleton', className)} />;

export const EmptyState = ({ icon: Icon = Inbox, title, hint, action }) => (
  <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
      <Icon className="h-5 w-5" />
    </div>
    <div className="text-sm font-semibold text-slate-700">{title}</div>
    {hint && <div className="max-w-sm text-xs text-slate-500">{hint}</div>}
    {action}
  </div>
);

export const PageHeader = ({ eyebrow, title, subtitle, actions }) => (
  <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div>
      {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
      {subtitle && <p className="mt-1 max-w-2xl text-sm text-slate-500">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export const StatCard = ({ label, value, hint, icon: Icon, tone = 'brand', loading }) => {
  const ring = {
    brand: 'bg-brand-50 text-brand-600', rose: 'bg-rose-50 text-rose-600', amber: 'bg-amber-50 text-amber-600',
    sky: 'bg-sky-50 text-sky-600', violet: 'bg-violet-50 text-violet-600', emerald: 'bg-emerald-50 text-emerald-600',
  }[tone];
  return (
    <div className="card card-pad flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-xs font-medium text-slate-500">{label}</div>
        {loading ? <Skeleton className="mt-2 h-7 w-16" /> :
          <div className="mt-1 text-[28px] font-bold leading-none tracking-tight text-slate-900">{value}</div>}
        {hint && <div className="mt-2 truncate text-xs text-slate-400">{hint}</div>}
      </div>
      {Icon && <div className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', ring)}><Icon className="h-5 w-5" /></div>}
    </div>
  );
};

export const Tabs = ({ tabs, value, onChange, className }) => (
  <div className={cx('inline-flex rounded-xl bg-slate-100 p-1', className)}>
    {tabs.map((t) => (
      <button
        key={t.value}
        onClick={() => onChange(t.value)}
        className={cx('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition',
          value === t.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800')}
      >
        {t.icon && <t.icon className="h-3.5 w-3.5" />}
        {t.label}
        {t.count != null && (
          <span className={cx('rounded-md px-1.5 text-[10px]', value === t.value ? 'bg-slate-100' : 'bg-slate-200/70')}>{t.count}</span>
        )}
      </button>
    ))}
  </div>
);

export const Avatar = ({ name = '', size = 'md', className }) => {
  const initials = name.replace(/^(Dr\.?\s+)/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
  const palette = ['bg-brand-100 text-brand-800', 'bg-violet-100 text-violet-800', 'bg-sky-100 text-sky-800',
    'bg-amber-100 text-amber-800', 'bg-rose-100 text-rose-800', 'bg-emerald-100 text-emerald-800'];
  const idx = [...name].reduce((s, c) => s + c.charCodeAt(0), 0) % palette.length;
  const sz = { sm: 'h-7 w-7 text-[10px]', md: 'h-9 w-9 text-xs', lg: 'h-12 w-12 text-sm' }[size];
  return <div className={cx('flex shrink-0 items-center justify-center rounded-full font-bold', palette[idx], sz, className)}>{initials || '?'}</div>;
};

/* ---------------------------------------------------------------- modal -- */
export const Modal = ({ open, onClose, title, subtitle, icon: Icon, children, footer, size = 'md' }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  const width = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-[2px] anim-in sm:items-center"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={cx('card my-8 w-full overflow-hidden anim-pop', width)}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            {Icon && <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Icon className="h-4.5 w-4.5" /></div>}
            <div>
              <h3 className="text-base font-bold text-slate-900">{title}</h3>
              {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
};

export const Field = ({ label, children, hint, className }) => (
  <label className={cx('block', className)}>
    {label && <span className="label">{label}</span>}
    {children}
    {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
  </label>
);

export const ErrorNote = ({ children }) => children ? (
  <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{children}</div>
) : null;

/* ------------------------------------------------------------ sparkline -- */
export const Sparkline = ({ values, color = '#15897f', height = 36, width = 120, fill = true }) => {
  const vals = (values || []).filter((v) => v != null && !Number.isNaN(v));
  if (vals.length < 2) return <div style={{ height, width }} />;
  const min = Math.min(...vals); const max = Math.max(...vals);
  const span = max - min || 1;
  const pts = vals.map((v, i) => [(i / (vals.length - 1)) * width, height - 3 - ((v - min) / span) * (height - 6)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      {fill && <path d={`${d} L${width},${height} L0,${height} Z`} fill={color} opacity="0.08" />}
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.6" fill={color} />
    </svg>
  );
};

/** Minimal markdown: **bold**, _italic_, line breaks. Answers are extractive text. */
export const RichText = ({ text, className }) => {
  const lines = (text || '').split('\n');
  const renderInline = (s, key) => {
    const parts = s.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).filter(Boolean);
    return parts.map((p, i) => {
      if (p.startsWith('**') && p.endsWith('**')) return <strong key={`${key}-${i}`}>{p.slice(2, -2)}</strong>;
      if (p.startsWith('_') && p.endsWith('_') && p.length > 2) return <em key={`${key}-${i}`}>{p.slice(1, -1)}</em>;
      return <React.Fragment key={`${key}-${i}`}>{p}</React.Fragment>;
    });
  };
  return (
    <div className={cx('prose-answer space-y-1', className)}>
      {lines.map((ln, i) => (ln.trim() === '' ? <div key={i} className="h-2" /> : <div key={i}>{renderInline(ln, i)}</div>))}
    </div>
  );
};

export const fmtDateTime = (d) => {
  if (!d) return '-';
  const dt = new Date(d);
  return dt.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export const fmtRelative = (d) => {
  if (!d) return '-';
  const diff = (new Date(d).getTime() - Date.now()) / 36e5;
  const abs = Math.abs(diff);
  const txt = abs < 1 ? `${Math.round(abs * 60)}m` : abs < 48 ? `${Math.round(abs)}h` : `${Math.round(abs / 24)}d`;
  return diff < 0 ? `${txt} ago` : `in ${txt}`;
};

export const ageFrom = (dob) => {
  if (!dob) return null;
  const b = new Date(dob); const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a -= 1;
  return a;
};
