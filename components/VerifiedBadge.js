import { BadgeCheck } from 'lucide-react'

// Tasteful verified trust badge. Caller passes the localized label
// ("Verified" / "Verificado" on the dashboard; "Verified business" /
// "Negocio verificado" on the public card) and the color classes for its
// context (dark dashboard header vs white card). Gated by isVerifiedBusiness()
// in lib/verifiedBadge.js — render only when that returns true.
export default function VerifiedBadge({
  label,
  title,
  className = 'text-brand-700',
  iconClassName = 'text-brand-600',
  size = 14,
}) {
  return (
    <span
      title={title || label}
      className={`inline-flex items-center gap-1 font-semibold ${className}`}
    >
      <BadgeCheck size={size} className={iconClassName} />
      {label}
    </span>
  )
}
