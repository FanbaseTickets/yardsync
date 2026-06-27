'use client'

import './landing.css'
import { useState, useEffect } from 'react'

const STRINGS = {
  en: {
    nav: { who: "Who it's for", features: 'Features', pricing: 'Pricing', sms: 'SMS Policy', signin: 'Sign In →' },
    hero: {
      eyebrow: '🌱 Start free — pay nothing until your first client pays you',
      sub: "Start free — build your card, send invoices, get paid. You pay $0 until money lands in your account; then it's $39/mo. Drag-and-drop routes, one-tap Stripe invoices, bilingual SMS reminders. No upfront cost, no hidden fees.",
      getStarted: 'Get Started →', seeWho: 'See who uses it ↓',
      stat1: 'Flat rate per invoice', stat2v: '3 taps', stat2: 'From door to invoice', stat3v: '2 min', stat3: 'Average setup time',
    },
    who: {
      lbl: "Who it's for", h: 'Built for contractors who work outside',
      s: 'If you manage recurring clients and schedule on-site visits, YardSync was made for you.',
      trades: ['Lawn Care', 'Landscaping', 'Pressure Washing', 'Pool Service', 'Cleaning Services', 'Pest Control', 'Handyman', 'Tree Service', 'Irrigation / Sprinklers', 'Window Washing', 'HVAC Maintenance', 'Electrical (Recurring)', '...and many more'],
    },
    feat: {
      lbl: 'Features', h: "Everything you need. Nothing you don't.", s: 'One app replaces your notebook, spreadsheets, and five different tools.',
      dashTag: 'DASHBOARD', dashH: 'See your whole business at a glance', dashP: "Revenue, active clients, today's jobs, SMS stats — one screen, zero guesswork.",
      dashCks: ['Daily revenue tracker', 'Active client count', "Today's job queue", 'SMS delivery stats'],
      calTag: 'CALENDAR', calH: 'Drag, drop, done — scheduling that works', calP: 'Visual calendar with recurring jobs, one-time visits, and auto SMS reminders the day before.',
      calCks: ['Weekly / monthly views', 'Recurring job support', 'Auto reminder SMS', 'Walk-in job quick-add'],
      cliTag: 'CLIENT MANAGEMENT', cliH: 'Every client, organized and searchable', cliP: 'Name, address, phone, service package, billing frequency, notes — all in one place, sortable and filterable.',
      cliCks: ['Sort by name, date, frequency', 'Filter by service type', 'Invoice history per client', 'Quick SMS from profile'],
      detTag: 'CLIENT DETAILS', detH: 'Tap a name. See everything.', detP: 'Full profile with address, service package, invoice history, and a direct link to send an invoice or SMS in one tap.',
      detCks: ['Member since date', 'Package & pricing', 'Full invoice history', 'One-tap invoice or SMS'],
      matTag: 'MATERIALS & COSTS', matH: 'Track what you spend on every job', matP: 'Log materials per service visit — fertilizer, chemicals, parts — and see your true cost per client.',
      matCks: ['Per-visit material logging', 'Cost tracking by client', 'Running total dashboard', 'Attach to invoices'],
      invTag: 'INVOICING', invH: 'Send invoices in one tap. See exactly what you keep.', invP: 'Stripe-powered invoicing with a transparent 5.5% flat fee — no hidden processing charges, no monthly minimums. Every invoice shows the service breakdown, materials, total, and exactly what hits your bank.',
      invCks: ['One-tap send', 'Auto-calculated fee', 'Materials included', 'Real-time payment status'],
    },
    bili: {
      lbl: 'Bilingual', h: 'The only app that speaks both languages',
      p: 'Your clients get reminders in their language. You run your business in yours. Toggle instantly — in the app and in every text message.',
      smsEnMeta: '📱 Auto SMS — English client',
      smsEn: "Hi Sara! Your service is scheduled for Saturday, April 18 at 9:00AM. See you then! Reply STOP to opt out. 🗓 — Marco's Services",
      smsEsMeta: '📱 SMS Automático — Cliente español',
      smsEs: '¡Hola Carlos! Su servicio está programado para el sábado, 18 de abril a las 9:00AM. ¡Hasta pronto! Responda STOP para cancelar. – Marco’s Services',
    },
    card: { lbl: 'Your card', h: 'Your own digital business card — free forever' },
    vol: {
      lbl: 'Volume Reward Program',
      s: "If you're already running a client base, the math works in your favor. The more you invoice through YardSync, the less — or nothing — you pay.",
      realityLabel: 'Think about your current book of business',
      realityFine: 'Hit the threshold for 2 consecutive months to lock in your tier. No tricks, no fine print.',
      zeroSub: 'subscription · 5.5% per invoice continues',
      t1r: 'Under $1,500/mo invoiced', t1d: 'Full Subscription', t1p: '$39/month', t1n: '+ 5.5% per invoice. Standard rate to start.',
      t2r: '$1,500–$2,999/mo invoiced', t2d: '50% Off Subscription', t2p: '$19.50/month', t2n: '+ 5.5% per invoice. Hit 2 months to unlock.',
      t3r: '$3,000+/mo invoiced', t3d: '$0 Subscription', t3p: '$0/month', t3n: '+ 5.5% per invoice. Your app pays for itself.',
      fine: 'Drop below threshold for 2 consecutive months to return to the previous tier. No surprise charges — always 2 months notice. The 5.5% per-invoice fee applies at every tier.',
      cta: 'View Pricing Plans →',
    },
    early: {
      lbl: 'Early Adopter Pricing',
      h: 'Sign up before April 15, 2028 — lock in 5.5% for life.',
      s: 'Accounts created after that date may see higher rates. Get in now and your rate never changes.',
    },
    pricing: {
      lbl: 'Pricing', h: 'Simple pricing. Serious results.',
      mName: 'Monthly', mSub: 'Mensual', mPer: 'per month + 5.5% per invoice',
      mFeat: ['Free until your first client pays', 'Unlimited clients', 'Auto SMS reminders', 'Stripe invoicing (5.5% per invoice)', '$0 subscription at $3k+/mo', 'English & Spanish', 'Cancel anytime'],
      mCta: 'Start Monthly →',
      aBadge: 'SAVE $78 · BEST VALUE', aName: 'Annual', aSub: 'Anual', aPer: 'per year · $32.50/mo + 5.5% per invoice',
      aFeat: ['Everything in Monthly', '2 months free', 'Priority support', 'Early feature access', '$0 subscription at $3k+/mo'],
      aCta: 'Start Annual →',
      pBadge: "SWITCHING? WE'LL HANDLE IT", pName: 'Pro Setup', pSub: 'Migración & Configuración Pro', pPer: 'one-time · non-refundable',
      pFeat: ['We import all your existing clients', 'Works from Yardbook, Jobber, spreadsheets, or any list', 'Set up service packages & pricing', 'Schedule all recurring visits', 'Ready on day one — zero downtime'],
      pNote: "Switching from another platform? We move your whole client book over so you don't have to start from scratch.",
      pCta: 'Switch & Set Up →',
    },
    how: {
      lbl: 'How it works', h: 'Up and running in minutes',
      s1h: 'Sign Up', s1p: 'Create your account at yardsyncapp.com in under 3 minutes.',
      s2h: 'Add Clients', s2p: 'Enter clients, set service packages, and schedule recurring visits.',
      s3h: 'Auto Reminders', s3p: 'SMS reminders fire automatically in English or Spanish before each job.',
      s4h: 'Invoice & Grow', s4p: 'Send invoices, track materials, and watch your revenue grow.',
    },
    sms: {
      lbl: 'SMS Messaging Policy', h: 'How client SMS works',
      s: 'Transparency about how appointment reminder messages are sent on behalf of service providers.',
      cH: '📋 How clients consent to receive messages',
      cP: 'Clients provide their phone number directly to their service provider when scheduling. The provider enters it into YardSync. Clients are informed they will receive appointment reminder SMS and can opt out at any time by replying STOP.',
      exLabel: 'Reminder message example:',
      ex: 'Hi [Name]! Your service is scheduled for [date] at [time]. See you then! Reply STOP to opt out. – [Business Name]',
      optOut: 'Opt-out:', help: 'Help:',
      full: 'Full details:', privacy: 'Privacy Policy', terms: 'Terms of Service',
    },
    cta: {
      h1: 'Start growing your business ', hEm: 'today',
      p: 'Start free. Pay nothing until your first client pays you.',
      getStarted: 'Get Started →',
      note: 'Free to start · $39/mo once your first client pays + 5.5% per invoice · $0 subscription at $3k+/mo invoiced · Cancel anytime · English & Español',
    },
    footer: { privacy: 'Privacy Policy', terms: 'Terms of Service', sms: 'SMS Policy', signin: 'Sign In' },
  },
  es: {
    nav: { who: 'Para quién es', features: 'Funciones', pricing: 'Precios', sms: 'Política SMS', signin: 'Iniciar sesión →' },
    hero: {
      eyebrow: '🌱 Empieza gratis — no pagas nada hasta que tu primer cliente te pague',
      sub: 'Empieza gratis — crea tu tarjeta, envía facturas y cobra. Pagas $0 hasta que el dinero llegue a tu cuenta; después son $39/mes. Rutas con arrastrar y soltar, facturas con un toque, recordatorios bilingües por SMS. Sin costo inicial, sin cargos ocultos.',
      getStarted: 'Empieza ahora →', seeWho: 'Mira quién lo usa ↓',
      stat1: 'Tarifa fija por factura', stat2v: '3 toques', stat2: 'De la puerta a la factura', stat3v: '2 min', stat3: 'Tiempo de configuración',
    },
    who: {
      lbl: 'Para quién es', h: 'Hecho para contratistas que trabajan afuera',
      s: 'Si manejas clientes recurrentes y programas visitas a domicilio, YardSync se hizo para ti.',
      trades: ['Jardinería', 'Paisajismo', 'Lavado a presión', 'Servicio de piscinas', 'Servicios de limpieza', 'Control de plagas', 'Reparaciones (handyman)', 'Poda de árboles', 'Riego / Aspersores', 'Lavado de ventanas', 'Mantenimiento HVAC', 'Electricidad (recurrente)', '...y muchos más'],
    },
    feat: {
      lbl: 'Funciones', h: 'Todo lo que necesitas. Nada de más.', s: 'Una sola app reemplaza tu libreta, tus hojas de cálculo y cinco herramientas distintas.',
      dashTag: 'PANEL', dashH: 'Ve todo tu negocio de un vistazo', dashP: 'Ingresos, clientes activos, trabajos de hoy y estadísticas de SMS — una pantalla, sin adivinar.',
      dashCks: ['Ingresos diarios', 'Conteo de clientes activos', 'Trabajos de hoy', 'Estado de envío de SMS'],
      calTag: 'CALENDARIO', calH: 'Arrastra, suelta, listo — programación que funciona', calP: 'Calendario visual con trabajos recurrentes, visitas únicas y recordatorios automáticos por SMS el día anterior.',
      calCks: ['Vistas semanal / mensual', 'Soporte para trabajos recurrentes', 'Recordatorios automáticos por SMS', 'Agrega trabajos sin cita al instante'],
      cliTag: 'GESTIÓN DE CLIENTES', cliH: 'Cada cliente, organizado y fácil de buscar', cliP: 'Nombre, dirección, teléfono, paquete de servicio, frecuencia de cobro y notas — todo en un solo lugar, ordenable y filtrable.',
      cliCks: ['Ordena por nombre, fecha o frecuencia', 'Filtra por tipo de servicio', 'Historial de facturas por cliente', 'SMS rápido desde el perfil'],
      detTag: 'DETALLE DEL CLIENTE', detH: 'Toca un nombre. Ve todo.', detP: 'Perfil completo con dirección, paquete de servicio, historial de facturas y un enlace directo para enviar una factura o SMS con un toque.',
      detCks: ['Cliente desde', 'Paquete y precio', 'Historial completo de facturas', 'Factura o SMS con un toque'],
      matTag: 'MATERIALES Y COSTOS', matH: 'Controla lo que gastas en cada trabajo', matP: 'Registra materiales por visita — fertilizante, químicos, repuestos — y conoce tu costo real por cliente.',
      matCks: ['Registro de materiales por visita', 'Control de costos por cliente', 'Total acumulado en el panel', 'Adjunta a las facturas'],
      invTag: 'FACTURACIÓN', invH: 'Envía facturas con un toque. Ve exactamente lo que te queda.', invP: 'Facturación con Stripe y una tarifa fija y transparente del 5.5% — sin cargos de procesamiento ocultos ni mínimos mensuales. Cada factura muestra el desglose del servicio, los materiales, el total y exactamente lo que llega a tu banco.',
      invCks: ['Envío con un toque', 'Tarifa calculada automáticamente', 'Materiales incluidos', 'Estado de pago en tiempo real'],
    },
    bili: {
      lbl: 'Bilingüe', h: 'La única app que habla los dos idiomas',
      p: 'Tus clientes reciben recordatorios en su idioma. Tú manejas tu negocio en el tuyo. Cambia al instante — en la app y en cada mensaje de texto.',
      smsEnMeta: '📱 SMS automático — Cliente en inglés',
      smsEn: "Hi Sara! Your service is scheduled for Saturday, April 18 at 9:00AM. See you then! Reply STOP to opt out. 🗓 — Marco's Services",
      smsEsMeta: '📱 SMS automático — Cliente en español',
      smsEs: '¡Hola Carlos! Su servicio está programado para el sábado, 18 de abril a las 9:00AM. ¡Hasta pronto! Responda STOP para cancelar. – Marco’s Services',
    },
    card: { lbl: 'Tu tarjeta', h: 'Tu propia tarjeta de presentación digital — gratis para siempre' },
    vol: {
      lbl: 'Programa de Recompensas por Volumen',
      s: 'Si ya tienes una base de clientes, los números están a tu favor. Mientras más factures con YardSync, menos pagas — o no pagas nada.',
      realityLabel: 'Piensa en tu cartera de clientes actual',
      realityFine: 'Alcanza el umbral 2 meses seguidos para fijar tu nivel. Sin trucos, sin letra chica.',
      zeroSub: 'suscripción · el 5.5% por factura continúa',
      t1r: 'Menos de $1,500/mes facturado', t1d: 'Suscripción completa', t1p: '$39/mes', t1n: '+ 5.5% por factura. Tarifa estándar para empezar.',
      t2r: '$1,500–$2,999/mes facturado', t2d: '50% de descuento', t2p: '$19.50/mes', t2n: '+ 5.5% por factura. Mantén 2 meses para desbloquear.',
      t3r: '$3,000+/mes facturado', t3d: 'Suscripción $0', t3p: '$0/mes', t3n: '+ 5.5% por factura. Tu app se paga sola.',
      fine: 'Si bajas del umbral 2 meses seguidos, regresas al nivel anterior. Sin cargos sorpresa — siempre con 2 meses de aviso. La tarifa del 5.5% por factura aplica en todos los niveles.',
      cta: 'Ver planes de precios →',
    },
    early: {
      lbl: 'Precio para Primeros Usuarios',
      h: 'Regístrate antes del 15 de abril de 2028 — fija el 5.5% de por vida.',
      s: 'Las cuentas creadas después de esa fecha pueden ver tarifas más altas. Entra ahora y tu tarifa nunca cambia.',
    },
    pricing: {
      lbl: 'Precios', h: 'Precios simples. Resultados serios.',
      mName: 'Mensual', mSub: 'Monthly', mPer: 'por mes + 5.5% por factura',
      mFeat: ['Gratis hasta que tu primer cliente te pague', 'Clientes ilimitados', 'Recordatorios automáticos por SMS', 'Facturación con Stripe (5.5% por factura)', 'Suscripción $0 con $3k+/mes', 'Inglés y español', 'Cancela cuando quieras'],
      mCta: 'Empezar Mensual →',
      aBadge: 'AHORRA $78 · MEJOR VALOR', aName: 'Anual', aSub: 'Annual', aPer: 'por año · $32.50/mes + 5.5% por factura',
      aFeat: ['Todo lo del plan Mensual', '2 meses gratis', 'Soporte prioritario', 'Acceso anticipado a funciones', 'Suscripción $0 con $3k+/mes'],
      aCta: 'Empezar Anual →',
      pBadge: '¿TE CAMBIAS? NOSOTROS LO HACEMOS', pName: 'Configuración Pro', pSub: 'Pro Setup', pPer: 'pago único · no reembolsable',
      pFeat: ['Importamos todos tus clientes actuales', 'Funciona desde Yardbook, Jobber, hojas de cálculo o cualquier lista', 'Configuramos tus paquetes y precios', 'Programamos todas las visitas recurrentes', 'Listo desde el primer día — sin tiempo perdido'],
      pNote: '¿Te cambias de otra plataforma? Movemos toda tu cartera de clientes para que no empieces desde cero.',
      pCta: 'Cambiar y configurar →',
    },
    how: {
      lbl: 'Cómo funciona', h: 'Listo en minutos',
      s1h: 'Regístrate', s1p: 'Crea tu cuenta en yardsyncapp.com en menos de 3 minutos.',
      s2h: 'Agrega clientes', s2p: 'Ingresa clientes, define paquetes de servicio y programa visitas recurrentes.',
      s3h: 'Recordatorios automáticos', s3p: 'Los recordatorios por SMS se envían solos, en inglés o español, antes de cada trabajo.',
      s4h: 'Factura y crece', s4p: 'Envía facturas, controla materiales y mira crecer tus ingresos.',
    },
    sms: {
      lbl: 'Política de Mensajes SMS', h: 'Cómo funcionan los SMS a clientes',
      s: 'Transparencia sobre cómo se envían los recordatorios de cita en nombre de los proveedores de servicio.',
      cH: '📋 Cómo dan su consentimiento los clientes',
      cP: 'Los clientes dan su número de teléfono directamente a su proveedor de servicio al agendar. El proveedor lo ingresa en YardSync. Se informa a los clientes que recibirán recordatorios de cita por SMS y que pueden cancelar en cualquier momento respondiendo STOP.',
      exLabel: 'Ejemplo de recordatorio:',
      ex: '¡Hola [Nombre]! Su servicio está programado para el [fecha] a las [hora]. ¡Hasta pronto! Responda STOP para cancelar. – [Nombre del negocio]',
      optOut: 'Cancelar:', help: 'Ayuda:',
      full: 'Detalles completos:', privacy: 'Política de Privacidad', terms: 'Términos de Servicio',
    },
    cta: {
      h1: 'Haz crecer tu negocio ', hEm: 'hoy',
      p: 'Empieza gratis. No pagas nada hasta que tu primer cliente te pague.',
      getStarted: 'Empieza ahora →',
      note: 'Gratis para empezar · $39/mes cuando tu primer cliente te pague + 5.5% por factura · Suscripción $0 con $3k+/mes facturado · Cancela cuando quieras · Inglés y Español',
    },
    footer: { privacy: 'Política de Privacidad', terms: 'Términos de Servicio', sms: 'Política SMS', signin: 'Iniciar sesión' },
  },
}

export default function LandingPage() {
  const [lang, setLang] = useState('en')

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('yardsync_lang')
      if (saved === 'es' || saved === 'en') { setLang(saved); return }
    } catch {}
    if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('es')) setLang('es')
  }, [])

  function switchLang(l) {
    setLang(l)
    try { window.localStorage.setItem('yardsync_lang', l) } catch {}
  }

  const t = STRINGS[lang]
  const es = lang === 'es'

  return (
    <div className="lp-page">
      {/* NAV */}
      <nav className="lp-nav">
        <a href="/" className="lp-logo">
          <div className="lp-logo-b"><img src="/app-icon-master.png" alt="YardSync" /></div>
          <span>YardSync</span>
        </a>
        <div className="lp-nav-r">
          <a href="#who">{t.nav.who}</a>
          <a href="#features">{t.nav.features}</a>
          <a href="#pricing">{t.nav.pricing}</a>
          <a href="#sms-consent">{t.nav.sms}</a>
          <button
            type="button"
            onClick={() => switchLang(es ? 'en' : 'es')}
            className="lp-lang-toggle"
            aria-label={es ? 'Switch to English' : 'Cambiar a Español'}
          >
            {es ? '🇺🇸 English' : '🇲🇽 Español'}
          </button>
          <a href="/login" className="lp-nav-cta">{t.nav.signin}</a>
        </div>
      </nav>

      {/* HERO */}
      <section className="lp-hero">
        <div className="lp-hero-text">
          <div className="lp-eyebrow">{t.hero.eyebrow}</div>
          <h1>{es ? <>Software que trabaja como <em>tú</em>.</> : <>Software that works like <em>you</em> do.</>}</h1>
          <p className="lp-sub-en">{t.hero.sub}</p>
          <div className="lp-btns">
            <a href="/signup" className="lp-btn-y">{t.hero.getStarted}</a>
            <a href="#who" className="lp-btn-gh">{t.hero.seeWho}</a>
          </div>
          <div className="lp-stats">
            <div><div className="lp-sv">5.5%</div><div className="lp-sl">{t.hero.stat1}</div></div>
            <div><div className="lp-sv">{t.hero.stat2v}</div><div className="lp-sl">{t.hero.stat2}</div></div>
            <div><div className="lp-sv">{t.hero.stat3v}</div><div className="lp-sl">{t.hero.stat3}</div></div>
          </div>
        </div>
        <div className="lp-hero-phones-wrap">
          <div className="lp-phone"><img className="lp-phone-screen" src="/landing/app-screen-dashboard-v4.png" alt="Dashboard" /></div>
          <div className="lp-phone"><img className="lp-phone-screen" src="/landing/app-screen-calendar-v4.png" alt="Calendar" /></div>
          <div className="lp-phone"><img className="lp-phone-screen" src="/landing/app-screen-client-detail-v4.png" alt="Client profile" /></div>
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <section className="lp-who" id="who">
        <div className="lp-who-in">
          <div className="sec-lbl">{t.who.lbl}</div>
          <h2 className="sec-h">{t.who.h}</h2>
          <p className="sec-s">{t.who.s}</p>
          <div className="lp-trades">
            {['🌿', '🏡', '💧', '🏊', '🧹', '🐛', '🔧', '🌳', '🚿', '🪟', '❄️', '⚡', '✨'].map((ico, i) => (
              <div className="lp-trade" key={i}><span className="ico">{ico}</span>{t.who.trades[i]}</div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="lp-feat" id="features">
        <div className="lp-feat-in">
          <div className="lp-feat-head">
            <div className="sec-lbl">{t.feat.lbl}</div>
            <h2 className="sec-h">{t.feat.h}</h2>
            <p className="sec-s">{t.feat.s}</p>
          </div>

          <div className="lp-fr">
            <div className="lp-ftext">
              <div className="lp-ftag">{t.feat.dashTag}</div>
              <h3 className="lp-fh">{t.feat.dashH}</h3>
              <p className="lp-fp">{t.feat.dashP}</p>
              <div className="lp-cks">{t.feat.dashCks.map((c, i) => <span key={i}>{c}</span>)}</div>
            </div>
            <div className="lp-fph"><div className="lp-phone lp-phone-lg"><img className="lp-phone-screen" src="/landing/app-screen-dashboard-v4.png" alt="Dashboard" /></div></div>
          </div>

          <div className="lp-fr rev">
            <div className="lp-ftext">
              <div className="lp-ftag">{t.feat.calTag}</div>
              <h3 className="lp-fh">{t.feat.calH}</h3>
              <p className="lp-fp">{t.feat.calP}</p>
              <div className="lp-cks">{t.feat.calCks.map((c, i) => <span key={i}>{c}</span>)}</div>
            </div>
            <div className="lp-fph"><div className="lp-phone lp-phone-lg"><img className="lp-phone-screen" src="/landing/app-screen-calendar-v4.png" alt="Calendar" /></div></div>
          </div>

          <div className="lp-fr">
            <div className="lp-ftext">
              <div className="lp-ftag">{t.feat.cliTag}</div>
              <h3 className="lp-fh">{t.feat.cliH}</h3>
              <p className="lp-fp">{t.feat.cliP}</p>
              <div className="lp-cks">{t.feat.cliCks.map((c, i) => <span key={i}>{c}</span>)}</div>
            </div>
            <div className="lp-fph"><div className="lp-phone lp-phone-lg"><img className="lp-phone-screen" src="/landing/app-screen-clients-v4.png" alt="Clients" /></div></div>
          </div>

          <div className="lp-fr rev">
            <div className="lp-ftext">
              <div className="lp-ftag">{t.feat.detTag}</div>
              <h3 className="lp-fh">{t.feat.detH}</h3>
              <p className="lp-fp">{t.feat.detP}</p>
              <div className="lp-cks">{t.feat.detCks.map((c, i) => <span key={i}>{c}</span>)}</div>
            </div>
            <div className="lp-fph"><div className="lp-phone lp-phone-lg"><img className="lp-phone-screen" src="/landing/app-screen-client-detail-v4.png" alt="Client detail" /></div></div>
          </div>

          <div className="lp-fr">
            <div className="lp-ftext">
              <div className="lp-ftag">{t.feat.matTag}</div>
              <h3 className="lp-fh">{t.feat.matH}</h3>
              <p className="lp-fp">{t.feat.matP}</p>
              <div className="lp-cks">{t.feat.matCks.map((c, i) => <span key={i}>{c}</span>)}</div>
            </div>
            <div className="lp-fph"><div className="lp-phone lp-phone-lg"><img className="lp-phone-screen" src="/landing/app-screen-materials-v4.png" alt="Materials tracking" /></div></div>
          </div>

          <div className="lp-fr rev">
            <div className="lp-ftext">
              <div className="lp-ftag">{t.feat.invTag}</div>
              <h3 className="lp-fh">{t.feat.invH}</h3>
              <p className="lp-fp">{t.feat.invP}</p>
              <div className="lp-cks">{t.feat.invCks.map((c, i) => <span key={i}>{c}</span>)}</div>
            </div>
            <div className="lp-fph"><div className="lp-phone lp-phone-lg"><img className="lp-phone-screen" src="/landing/app-invoice-summary-v4.png" alt="Invoice summary with fee breakdown" /></div></div>
          </div>
        </div>
      </section>

      {/* BILINGUAL */}
      <section className="lp-bili">
        <div className="lp-bili-in">
          <div>
            <div className="sec-lbl">{t.bili.lbl}</div>
            <h2 className="sec-h">{t.bili.h}</h2>
            <p style={{ fontSize: '15px', color: 'var(--g6)', marginBottom: '8px' }}>{t.bili.p}</p>
            <div className="lp-lpills">
              <div className="lp-lp en">🇺🇸 English</div>
              <div className="lp-lp es">🇲🇽 Español</div>
            </div>
          </div>
          <div>
            <div className="lp-sms-card">
              <div className="lp-smeta">{t.bili.smsEnMeta}</div>
              <div className="lp-bub">{t.bili.smsEn}</div>
              <div className="lp-smeta" style={{ textAlign: 'right' }}>{t.bili.smsEsMeta}</div>
              <div className="lp-bub es">{t.bili.smsEs}</div>
            </div>
          </div>
        </div>
      </section>

      {/* DIGITAL BUSINESS CARD */}
      <section className="lp-bili">
        <div className="lp-bili-in">
          <div>
            <div className="sec-lbl">{t.card.lbl}</div>
            <h2 className="sec-h">{t.card.h}</h2>
            <p style={{ fontSize: '15px', color: 'var(--g6)', marginBottom: '8px' }}>
              {es
                ? <>Cada contratista de YardSync recibe una tarjeta de presentación digital con código QR para compartir. Tus prospectos tocan tu enlace o escanean tu código para solicitar servicio — y se agregan a tus prospectos automáticamente. <strong>Nunca más gastes en tarjetas de papel.</strong></>
                : <>Every YardSync contractor gets a shareable digital business card with a built-in QR code. Prospects tap your link or scan your code to request service — and they&apos;re added to your leads automatically. <strong>Never spend money on paper business cards again.</strong></>}
            </p>
          </div>
          <div>
            <img src="/landing/business-card.png" alt="Example YardSync digital business card for a lawn care contractor" style={{ width: '100%', maxWidth: '300px', margin: '0 auto', display: 'block', borderRadius: '18px', boxShadow: '0 12px 44px rgba(0,0,0,0.14)' }} />
          </div>
        </div>
      </section>

      {/* VOLUME REWARD */}
      <section className="lp-vol" id="volume-reward">
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <div className="sec-lbl">{t.vol.lbl}</div>
            <h2 className="sec-h" style={{ fontSize: 'clamp(32px,4vw,50px)' }}>
              {es
                ? <>¿Ya tienes clientes?<br />Tu suscripción podría ser <em style={{ fontStyle: 'italic', color: 'var(--gp)' }}>gratis</em>.*</>
                : <>Already have clients?<br />Your subscription could be <em style={{ fontStyle: 'italic', color: 'var(--gp)' }}>free</em>.*</>}
            </h2>
            <p style={{ fontSize: '17px', color: 'var(--g6)', maxWidth: '640px', margin: '12px auto 0' }}>{t.vol.s}</p>
          </div>
          <div className="lp-reality-box">
            <div>
              <div className="lp-reality-label">{t.vol.realityLabel}</div>
              <p className="lp-reality-text">
                {es
                  ? <><strong style={{ color: '#fff' }}>10 clientes a $300/mes cada uno = $3,000/mes.</strong><br />Ese es el nivel de suscripción $0. La mayoría de los contratistas con clientes ya están ahí — o llegan en sus primeros meses.</>
                  : <><strong style={{ color: '#fff' }}>10 clients at $300/month each = $3,000/month.</strong><br />That&apos;s the $0 subscription tier. Most contractors with an existing client base are already there — or get there within their first few months.</>}
              </p>
              <p className="lp-reality-fine">{t.vol.realityFine}</p>
            </div>
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div className="lp-zero-price">$0</div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,.55)', marginTop: '4px' }}>{t.vol.zeroSub}</div>
            </div>
          </div>
          <div className="lp-vg">
            <div className="lp-vt"><div style={{ fontSize: '18px', marginBottom: '8px' }}>🌱</div><div className="lp-vr">{t.vol.t1r}</div><div className="lp-vd">{t.vol.t1d}</div><div className="lp-vp">{t.vol.t1p}</div><div className="lp-vn">{t.vol.t1n}</div></div>
            <div className="lp-vt"><div style={{ fontSize: '18px', marginBottom: '8px' }}>📈</div><div className="lp-vr">{t.vol.t2r}</div><div className="lp-vd">{t.vol.t2d}</div><div className="lp-vp">{t.vol.t2p}</div><div className="lp-vn">{t.vol.t2n}</div></div>
            <div className="lp-vt top"><div style={{ fontSize: '18px', marginBottom: '8px' }}>🏆</div><div className="lp-vr">{t.vol.t3r}</div><div className="lp-vd">{t.vol.t3d}</div><div className="lp-vp">{t.vol.t3p}</div><div className="lp-vn">{t.vol.t3n}</div></div>
          </div>
          <p className="lp-vfine">{t.vol.fine}</p>
          <div style={{ textAlign: 'center', marginTop: '40px' }}>
            <a href="#pricing" className="lp-btn-y" style={{ fontSize: '15px', padding: '13px 30px' }}>{t.vol.cta}</a>
          </div>
        </div>
      </section>

      {/* EARLY ADOPTER */}
      <div style={{ background: 'linear-gradient(135deg, #1B4332 0%, #2D6A4F 100%)', padding: '28px 24px', textAlign: 'center', margin: '0' }}>
        <p style={{ color: '#FFD60A', fontSize: '13px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', margin: '0 0 6px' }}>{t.early.lbl}</p>
        <p style={{ color: '#fff', fontSize: 'clamp(18px,2.5vw,24px)', fontWeight: 700, margin: '0 0 6px' }}>{t.early.h}</p>
        <p style={{ color: 'rgba(255,255,255,.7)', fontSize: '14px', margin: 0 }}>{t.early.s}</p>
      </div>

      {/* PRICING */}
      <section className="lp-pricing" id="pricing">
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div className="sec-lbl">{t.pricing.lbl}</div>
          <h2 className="sec-h">{t.pricing.h}</h2>
          <p style={{ fontSize: '15px', color: 'var(--g6)' }}>
            {es
              ? <>Empieza gratis — no pagas <strong>nada</strong> hasta que tu primer cliente te pague. Después son $39/mes + 5.5% por factura. Sin contratos, sin costo inicial, cancela cuando quieras. Las recompensas por volumen bajan tu suscripción a <strong>$0</strong> con $3k+/mes facturado. La tarifa del 5.5% por factura siempre aplica.</>
              : <>Start free — you pay <strong>nothing</strong> until your first client pays you. Then it&apos;s $39/mo + 5.5% per invoice. No contracts, no upfront cost, cancel anytime. Volume rewards drop your subscription to <strong>$0</strong> at $3k+/mo invoiced. The 5.5% per-invoice fee always applies.</>}
          </p>
          <div className="lp-pg">
            <div className="lp-pc">
              <div className="lp-pn">{t.pricing.mName}</div><div className="lp-pne">{t.pricing.mSub}</div>
              <div className="lp-pa">$39</div><div className="lp-pp">{t.pricing.mPer}</div>
              <ul className="lp-pf">{t.pricing.mFeat.map((f, i) => <li key={i}>{i === 0 ? <strong>{f}</strong> : f}</li>)}</ul>
              <a href="/signup" className="lp-pcta">{t.pricing.mCta}</a>
            </div>
            <div className="lp-pc featured">
              <div className="lp-pbg">{t.pricing.aBadge}</div>
              <div className="lp-pn">{t.pricing.aName}</div><div className="lp-pne">{t.pricing.aSub}</div>
              <div className="lp-pa">$390</div><div className="lp-pp">{t.pricing.aPer}</div>
              <ul className="lp-pf">{t.pricing.aFeat.map((f, i) => <li key={i}>{f}</li>)}</ul>
              <a href="/signup" className="lp-pcta">{t.pricing.aCta}</a>
            </div>
            <div className="lp-pc pro-setup">
              <div className="lp-pro-badge">{t.pricing.pBadge}</div>
              <div className="lp-pn" style={{ marginTop: '8px' }}>{t.pricing.pName}</div><div className="lp-pne">{t.pricing.pSub}</div>
              <div className="lp-pa">$99</div><div className="lp-pp">{t.pricing.pPer}</div>
              <ul className="lp-pf">{t.pricing.pFeat.map((f, i) => <li key={i}>{f}</li>)}</ul>
              <p style={{ fontSize: '12px', color: 'var(--g6)', marginBottom: '16px', fontStyle: 'italic' }}>{t.pricing.pNote}</p>
              <a href="/signup" className="lp-pcta" style={{ background: 'var(--gp)', color: '#fff' }}>{t.pricing.pCta}</a>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="lp-how" id="how">
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div className="sec-lbl">{t.how.lbl}</div>
          <h2 className="sec-h">{t.how.h}</h2>
          <div className="lp-steps">
            <div className="lp-step"><div className="lp-sn">1</div><h3>{t.how.s1h}</h3><p>{t.how.s1p}</p></div>
            <div className="lp-step"><div className="lp-sn">2</div><h3>{t.how.s2h}</h3><p>{t.how.s2p}</p></div>
            <div className="lp-step"><div className="lp-sn">3</div><h3>{t.how.s3h}</h3><p>{t.how.s3p}</p></div>
            <div className="lp-step"><div className="lp-sn">4</div><h3>{t.how.s4h}</h3><p>{t.how.s4p}</p></div>
          </div>
        </div>
      </section>

      {/* SMS CONSENT */}
      <section className="lp-con" id="sms-consent">
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div className="sec-lbl">{t.sms.lbl}</div>
          <h2 className="sec-h">{t.sms.h}</h2>
          <p style={{ fontSize: '15px', color: 'var(--g6)', maxWidth: '500px' }}>{t.sms.s}</p>
          <div className="lp-cbox">
            <h3>{t.sms.cH}</h3>
            <p>{t.sms.cP}</p>
            <p><strong>{t.sms.exLabel}</strong> &quot;{t.sms.ex}&quot;</p>
            <div className="lp-krow"><div className="lp-klbl">{t.sms.optOut}</div><span className="lp-kw">STOP</span><span className="lp-kw">CANCEL</span><span className="lp-kw">QUIT</span><span className="lp-kw">UNSUBSCRIBE</span></div>
            <div className="lp-krow" style={{ marginTop: '8px' }}><div className="lp-klbl">{t.sms.help}</div><span className="lp-kw">HELP</span></div>
            <p style={{ marginTop: '14px', fontSize: '13px' }}>{t.sms.full} <a href="/privacy" style={{ color: 'var(--gp)' }}>{t.sms.privacy}</a> &amp; <a href="/terms" style={{ color: 'var(--gp)' }}>{t.sms.terms}</a>.</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="lp-cta-section">
        <div className="lp-cin">
          <h2>{t.cta.h1}<em>{t.cta.hEm}</em></h2>
          <p>{t.cta.p}</p>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <a href="/signup" className="lp-btn-y" style={{ fontSize: '17px', padding: '14px 36px' }}>{t.cta.getStarted}</a>
          </div>
          <p className="lp-cta-note">{t.cta.note}</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="lp-footer">
        <div className="lp-flogo"><div className="lp-fb"><img src="/app-icon-master.png" alt="YardSync" /></div><span>YardSync</span></div>
        <div className="lp-flinks">
          <a href="/privacy">{t.footer.privacy}</a>
          <a href="/terms">{t.footer.terms}</a>
          <a href="#sms-consent">{t.footer.sms}</a>
          <a href="/login">{t.footer.signin}</a>
        </div>
        <p className="lp-fcopy">YardSync by JNew Technologies, LLC · San Antonio, TX · <a href="mailto:support@yardsyncapp.com">support@yardsyncapp.com</a><br />© 2026 JNew Technologies, LLC. All rights reserved.</p>
      </footer>
    </div>
  )
}
