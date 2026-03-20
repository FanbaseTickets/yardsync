'use client'
import dynamic from 'next/dynamic'
const SmsContent = dynamic(() => import('./SmsContent'), { ssr: false })
export default function SmsPage() { return <SmsContent /> }