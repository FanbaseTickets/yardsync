'use client'
import dynamic from 'next/dynamic'
const ConnectStripeContent = dynamic(() => import('./ConnectStripeContent'), { ssr: false })
export default function ConnectStripePage() {
  return <ConnectStripeContent />
}
