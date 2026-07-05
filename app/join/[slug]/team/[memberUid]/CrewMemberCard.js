'use client'

import { useState } from 'react'

// A crew member's public card. Owner branding (logo + name + accent) up top,
// the member's own headshot + name below, and a "Request service" CTA + QR that
// funnel to the OWNER's intake form. No Firebase imports (public route).
export default function CrewMemberCard({ business, member, requestUrl, qrSvg, initialLang }) {
  const [lang, setLang] = useState(initialLang === 'es' ? 'es' : 'en')
  const es = lang === 'es'
  const accent = business.accentColor || '#0F6E56'

  const initials = (member.name || '?').split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center px-5 py-8">
      <div className="w-full" style={{ maxWidth: 420 }}>
        {/* Language toggle */}
        <div className="flex justify-end mb-3">
          <button
            onClick={() => setLang(es ? 'en' : 'es')}
            className="text-[12px] font-medium text-gray-500 hover:text-gray-700 border border-gray-200 rounded-full px-3 py-1 bg-white"
          >
            {es ? 'English' : 'Español'}
          </button>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Business header */}
          <div className="px-6 pt-7 pb-6 text-center text-white" style={{ backgroundColor: accent }}>
            {business.logoURL
              ? <img src={business.logoURL} alt={business.name} className="w-16 h-16 rounded-2xl object-cover mx-auto mb-3 bg-white/10" />
              : <div className="w-16 h-16 rounded-2xl bg-white/15 mx-auto mb-3 flex items-center justify-center text-2xl font-bold">{(business.name || 'Y')[0]}</div>}
            <h1 className="text-[19px] font-bold">{business.name}</h1>
            {business.serviceArea && <p className="text-[12.5px] text-white/80 mt-0.5">{business.serviceArea}</p>}
          </div>

          {/* Member */}
          <div className="px-6 py-6 text-center border-b border-gray-100">
            {member.headshotURL
              ? <img src={member.headshotURL} alt={member.name} className="w-20 h-20 rounded-full object-cover mx-auto mb-3 border-4 border-white shadow -mt-12 bg-gray-100" />
              : <div className="w-20 h-20 rounded-full mx-auto mb-3 border-4 border-white shadow -mt-12 flex items-center justify-center text-xl font-bold text-white" style={{ backgroundColor: accent }}>{initials}</div>}
            <h2 className="text-[17px] font-semibold text-gray-900">{member.name}</h2>
            <p className="text-[12.5px] text-gray-500 mt-0.5">
              {es ? `Parte del equipo de ${business.name}` : `Part of the ${business.name} crew`}
            </p>
            {business.offersFreeEstimate && (
              <span className="inline-block mt-2 text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: accent + '18', color: accent }}>
                {es ? 'Estimado gratis' : 'Free estimate'}
              </span>
            )}
          </div>

          {/* CTA → owner intake */}
          <div className="px-6 py-6">
            <a
              href={requestUrl}
              className="block w-full text-center text-white font-bold text-[15px] py-4 rounded-2xl transition-opacity hover:opacity-90"
              style={{ backgroundColor: accent }}
            >
              {es ? 'Solicitar servicio' : 'Request service'}
            </a>
            <p className="text-[11.5px] text-gray-400 text-center mt-2">
              {es ? `Tu solicitud va directo a ${business.name}.` : `Your request goes straight to ${business.name}.`}
            </p>

            {qrSvg && (
              <div className="mt-5 flex flex-col items-center">
                <div className="w-40 h-40 p-2 bg-white rounded-xl border border-gray-100" dangerouslySetInnerHTML={{ __html: qrSvg }} />
                <p className="text-[12px] text-gray-600 font-medium mt-3">{es ? 'Escanee para solicitar' : 'Scan to request'}</p>
              </div>
            )}
          </div>
        </div>

        <p className="text-[11px] text-gray-400 text-center mt-5">
          {es ? 'Con tecnología de' : 'Powered by'} <span className="font-semibold text-gray-500">YardSync</span>
        </p>
      </div>
    </main>
  )
}
