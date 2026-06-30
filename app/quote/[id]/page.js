'use client'
import dynamic from 'next/dynamic'
const QuoteContent = dynamic(() => import('./QuoteContent'), { ssr: false })
export default function QuotePage() {
  return <QuoteContent />
}
