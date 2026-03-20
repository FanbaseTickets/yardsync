'use client'
import dynamic from 'next/dynamic'
const ServicesContent = dynamic(() => import('./ServicesContent'), { ssr: false })
export default function ServicesPage() { return <ServicesContent /> }