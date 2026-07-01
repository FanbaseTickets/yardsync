'use client'
import dynamic from 'next/dynamic'
const QuotesContent = dynamic(() => import('./QuotesContent'), { ssr: false })
export default function QuotesPage() {
  return <QuotesContent />
}
