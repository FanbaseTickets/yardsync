'use client'
import dynamic from 'next/dynamic'
const ReactivateContent = dynamic(() => import('./ReactivateContent'), { ssr: false })
export default function ReactivatePage() {
  return <ReactivateContent />
}
