'use client'

import clsx from 'clsx'
import { X } from 'lucide-react'

export function Button({
  children, onClick, type = 'button', variant = 'primary',
  size = 'md', disabled, loading, className, icon: Icon, fullWidth
}) {
  const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed'
  const variants = {
    primary:   'bg-brand-600 text-white hover:bg-brand-700 active:scale-[0.98] shadow-sm',
    secondary: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 active:scale-[0.98] shadow-sm',
    danger:    'bg-red-600 text-white hover:bg-red-700 active:scale-[0.98] shadow-sm',
    ghost:     'text-gray-600 hover:bg-gray-100 active:scale-[0.98]',
    brand:     'bg-brand-50 text-brand-700 hover:bg-brand-100 active:scale-[0.98]',
  }
  const sizes = {
    sm: 'text-[13px] px-3 py-1.5',
    md: 'text-[14px] px-4 py-2.5',
    lg: 'text-[15px] px-5 py-3',
    xl: 'text-[16px] px-6 py-3.5',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={clsx(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : Icon ? <Icon size={16} /> : null}
      {children}
    </button>
  )
}

export function Input({ label, id, error, hint, prefix, suffix, className, containerClassName, ...props }) {
  return (
    <div className={clsx('flex flex-col gap-1', containerClassName)}>
      {label && <label htmlFor={id} className="text-[13px] font-medium text-gray-700">{label}</label>}
      <div className="relative flex items-center">
        {prefix && <span className="absolute left-3 text-gray-400 text-sm pointer-events-none">{prefix}</span>}
        <input
          id={id}
          className={clsx(
            'w-full rounded-xl border bg-white text-gray-900 text-[14px] transition-colors',
            'placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent',
            error ? 'border-red-300' : 'border-gray-200 hover:border-gray-300',
            prefix ? 'pl-7' : 'pl-3',
            suffix ? 'pr-10' : 'pr-3',
            'py-2.5', className
          )}
          {...props}
        />
        {suffix && <span className="absolute right-3 text-gray-400 text-sm pointer-events-none">{suffix}</span>}
      </div>
      {error && <p className="text-[12px] text-red-500">{error}</p>}
      {hint && !error && <p className="text-[12px] text-gray-400">{hint}</p>}
    </div>
  )
}

export function Select({ label, id, error, hint, className, containerClassName, children, ...props }) {
  return (
    <div className={clsx('flex flex-col gap-1', containerClassName)}>
      {label && <label htmlFor={id} className="text-[13px] font-medium text-gray-700">{label}</label>}
      <select
        id={id}
        className={clsx(
          'w-full rounded-xl border bg-white text-gray-900 text-[14px] px-3 py-2.5 transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent',
          error ? 'border-red-300' : 'border-gray-200 hover:border-gray-300', className
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-[12px] text-red-500">{error}</p>}
      {hint && !error && <p className="text-[12px] text-gray-400">{hint}</p>}
    </div>
  )
}

const BADGE_STYLES = {
  monthly:   'bg-emerald-50 text-emerald-800',
  quarterly: 'bg-blue-50 text-blue-800',
  annual:    'bg-amber-50 text-amber-800',
  weekly:    'bg-purple-50 text-purple-800',
  onetime:   'bg-orange-50 text-orange-700',
  active:    'bg-green-50 text-green-700',
  paused:    'bg-yellow-50 text-yellow-700',
  cancelled: 'bg-red-50 text-red-700',
  scheduled: 'bg-blue-50 text-blue-700',
  completed: 'bg-green-50 text-green-700',
  skipped:   'bg-gray-100 text-gray-500',
  fixed:     'bg-purple-50 text-purple-700',
  variable:  'bg-orange-50 text-orange-700',
  default:   'bg-gray-100 text-gray-600',
}

function formatBadgeLabel(label) {
  if (!label) return ''
  if (label === 'onetime') return 'One-time'
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function Badge({ label, variant = 'default', className }) {
  return (
    <span className={clsx(
      'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium',
      BADGE_STYLES[variant] || BADGE_STYLES.default,
      className
    )}>
      {formatBadgeLabel(label)}
    </span>
  )
}

export function Card({ children, className, onClick, padding = true }) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'bg-white rounded-2xl border border-gray-100 shadow-card',
        padding && 'p-4',
        onClick && 'cursor-pointer hover:border-gray-200 hover:shadow-card-hover transition-all',
        className
      )}
    >
      {children}
    </div>
  )
}

export function StatCard({ label, value, sub, icon: Icon, accent }) {
  return (
    <div className={clsx(
      'bg-white rounded-2xl border border-gray-100 shadow-card p-3.5 flex flex-col gap-1',
      accent && 'border-l-[3px] border-l-brand-500'
    )}>
      {Icon && <Icon size={16} className="text-brand-500 mb-0.5" />}
      <p className="text-[11px] text-gray-400 uppercase tracking-wide font-medium">{label}</p>
      <p className="text-[22px] font-semibold text-gray-900 leading-none">{value}</p>
      {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
    </div>
  )
}

export function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl animate-fade-up">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-[17px] font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <X size={16} className="text-gray-500" />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto max-h-[70vh]">{children}</div>
        {footer && (
          <div className="px-5 pb-6 pt-2 border-t border-gray-100 flex gap-2">{footer}</div>
        )}
      </div>
    </div>
  )
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center mb-4">
          <Icon size={26} className="text-brand-500" />
        </div>
      )}
      <h3 className="text-[15px] font-semibold text-gray-800 mb-1">{title}</h3>
      {description && (
        <p className="text-[13px] text-gray-400 mb-5 max-w-[240px]">{description}</p>
      )}
      {action}
    </div>
  )
}

export function Skeleton({ className }) {
  return <div className={clsx('animate-pulse bg-gray-100 rounded-xl', className)} />
}