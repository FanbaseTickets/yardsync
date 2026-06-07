'use client'

import { Input } from '@/components/ui'

export default function PhoneInput({ value, onChange, label, error, placeholder, ...props }) {
  function handleChange(e) {
    const allDigits = e.target.value.replace(/\D/g, '')

    // Strip US country code (+1) from the front. Handles pasted formats like
    // "+19107230609", "1 (910) 723-0609", "1-910-723-0609", etc. Without this,
    // an 11-digit input would have its trailing digit dropped by slice(0, 10)
    // and the leading "1" treated as the first area-code digit — producing a
    // false-positive 10-digit string like "(191) 072-3060".
    const stripped = (allDigits.length >= 11 && allDigits.startsWith('1'))
      ? allDigits.slice(1)
      : allDigits
    const digits = stripped.slice(0, 10)

    let formatted = digits
    if (digits.length > 6) {
      formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
    } else if (digits.length > 3) {
      formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    } else if (digits.length > 0) {
      formatted = `(${digits}`
    }
    onChange(formatted)
  }

  return (
    <Input
      label={label || 'Phone'}
      type="tel"
      placeholder={placeholder || '(210) 555-0100'}
      value={value}
      onChange={handleChange}
      error={error}
      {...props}
    />
  )
}
