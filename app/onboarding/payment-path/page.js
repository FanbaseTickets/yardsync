'use client'
import dynamic from 'next/dynamic'
const PaymentPathContent = dynamic(() => import('./PaymentPathContent'), { ssr: false })
export default function PaymentPathPage() {
  return <PaymentPathContent />
}
