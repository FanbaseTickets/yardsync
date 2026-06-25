'use client'
import dynamic from 'next/dynamic'
const BillingSetupContent = dynamic(() => import('./BillingSetupContent'), { ssr: false })
export default function BillingSetupPage() { return <BillingSetupContent /> }
