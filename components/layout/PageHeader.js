'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import clsx from 'clsx'

export default function PageHeader({ title, subtitle, back, actions, className }) {
  const router = useRouter()

  return (
    <header className={clsx('bg-white border-b border-gray-100 sticky top-0 z-40', className)}>
      <div className="flex items-center gap-3 px-4 py-3 max-w-lg mx-auto">
        {back && (
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-50 transition-colors -ml-1"
          >
            <ArrowLeft size={18} className="text-gray-600" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-[17px] font-semibold text-gray-900 truncate leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[12px] text-gray-400 leading-tight mt-0.5 truncate">
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </header>
  )
}