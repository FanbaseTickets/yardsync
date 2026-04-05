'use client'
import dynamic from 'next/dynamic'
const PayContent = dynamic(() => import('./PayContent'), { ssr: false })
export default function PayPage() {
  return <PayContent />
}
