'use client'

import dynamic from 'next/dynamic'

const ClientsContent = dynamic(() => import('./ClientsContent'), { ssr: false })

export default function ClientsPage() {
  return <ClientsContent />
}