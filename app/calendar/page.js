'use client'

import dynamic from 'next/dynamic'

const CalendarContent = dynamic(() => import('./CalendarContent'), { ssr: false })

export default function CalendarPage() {
  return <CalendarContent />
}