'use client'
import dynamic from 'next/dynamic'
const SettingsContent = dynamic(() => import('./SettingsContent'), { ssr: false })
export default function SettingsPage() { return <SettingsContent /> }