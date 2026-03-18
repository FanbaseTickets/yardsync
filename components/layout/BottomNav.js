'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, CalendarDays, Users, Wrench, MessageSquare } from 'lucide-react'
import { useLang } from '@/context/LangContext'
import clsx from 'clsx'

export default function BottomNav() {
  const pathname = usePathname()
  const { translate } = useLang()

  const NAV_ITEMS = [
    { href: '/dashboard', label: translate('nav', 'home'),     icon: LayoutDashboard },
    { href: '/calendar',  label: translate('nav', 'calendar'), icon: CalendarDays    },
    { href: '/clients',   label: translate('nav', 'clients'),  icon: Users           },
    { href: '/services',  label: translate('nav', 'services'), icon: Wrench          },
    { href: '/sms',       label: translate('nav', 'sms'),      icon: MessageSquare   },
  ]

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100"
      style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-stretch h-14 max-w-lg mx-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex flex-col items-center justify-center flex-1 gap-0.5 transition-colors',
                active ? 'text-brand-600' : 'text-gray-400 hover:text-gray-600'
              )}
            >
              <Icon
                size={20}
                strokeWidth={active ? 2.5 : 1.75}
                className={active ? 'text-brand-600' : 'text-gray-400'}
              />
              <span className={clsx(
                'text-[10px] font-medium tracking-wide',
                active ? 'text-brand-600' : 'text-gray-400'
              )}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}