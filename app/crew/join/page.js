'use client'
import dynamic from 'next/dynamic'
const CrewJoinContent = dynamic(() => import('./CrewJoinContent'), { ssr: false })
export default function CrewJoinPage() {
  return <CrewJoinContent />
}
