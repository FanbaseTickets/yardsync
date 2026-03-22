'use client'

import { Input } from '@/components/ui'

export default function PhoneInput({ value, onChange, label, error, placeholder, ...props }) {
  function handleChange(e) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
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
