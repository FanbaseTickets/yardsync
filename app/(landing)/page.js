'use client'

import './landing.css'

export default function LandingPage() {
  return (
    <div className="lp-page">
      {/* NAV */}
      <nav className="lp-nav">
        <a href="/" className="lp-logo">
          <div className="lp-logo-b">YS</div>
          <span>YardSync</span>
        </a>
        <div className="lp-nav-r">
          <a href="#who">Who it&apos;s for</a>
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#sms-consent">SMS Policy</a>
          <a href="/login" className="lp-nav-cta">Sign In →</a>
        </div>
      </nav>

      {/* HERO */}
      <section className="lp-hero">
        <div className="lp-hero-text">
          <div className="lp-eyebrow">📱 Field Service Business Platform</div>
          <h1>Pro-grade service business software.<br/>One flat <em>5.5%</em> per invoice.</h1>
          <p className="lp-sub-en">$39/mo subscription with volume discounts — drops to free once you cross $3k/mo invoiced. Bilingual scheduling, SMS reminders, materials, and Stripe invoicing in one app.</p>
          <p className="lp-sub-es">Software pro para tu negocio de servicios. 5.5% por factura. Suscripción gratis al pasar $3k/mes facturados.</p>
          <div className="lp-btns">
            <a href="/signup" className="lp-btn-y">Get Started →</a>
            <a href="#who" className="lp-btn-gh">See who uses it ↓</a>
          </div>
          <div className="lp-stats">
            <div><div className="lp-sv">5.5%</div><div className="lp-sl">Flat rate per invoice</div></div>
            <div><div className="lp-sv">$0</div><div className="lp-sl">Subscription at $3k+/mo</div></div>
            <div><div className="lp-sv">2 min</div><div className="lp-sl">Average setup time</div></div>
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
          <div className="sec-lbl">Who it&apos;s for | Para quién es</div>
          <h2 className="sec-h">Built for contractors who work outside</h2>
          <p className="sec-s">If you manage recurring clients and schedule on-site visits, YardSync was made for you.</p>
          <div className="lp-trades">
            <div className="lp-trade"><span className="ico">🌿</span>Lawn Care</div>
            <div className="lp-trade"><span className="ico">🏡</span>Landscaping</div>
            <div className="lp-trade"><span className="ico">💧</span>Pressure Washing</div>
            <div className="lp-trade"><span className="ico">🏊</span>Pool Service</div>
            <div className="lp-trade"><span className="ico">🧹</span>Cleaning Services</div>
            <div className="lp-trade"><span className="ico">🐛</span>Pest Control</div>
            <div className="lp-trade"><span className="ico">🔧</span>Handyman</div>
            <div className="lp-trade"><span className="ico">🌳</span>Tree Service</div>
            <div className="lp-trade"><span className="ico">🚿</span>Irrigation / Sprinklers</div>
            <div className="lp-trade"><span className="ico">🪟</span>Window Washing</div>
            <div className="lp-trade"><span className="ico">❄️</span>HVAC Maintenance</div>
            <div className="lp-trade"><span className="ico">⚡</span>Electrical (Recurring)</div>
            <div className="lp-trade"><span className="ico">✨</span>...and many more</div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="lp-feat" id="features">
        <div className="lp-feat-in">
          <div className="lp-feat-head">
            <div className="sec-lbl">Features | Funciones</div>
            <h2 className="sec-h">Everything you need. Nothing you don&apos;t.</h2>
            <p className="sec-s">One app replaces your notebook, spreadsheets, and five different tools.</p>
          </div>

          <div className="lp-fr">
            <div className="lp-ftext">
              <div className="lp-ftag">DASHBOARD</div>
              <h3 className="lp-fh">See your whole business at a glance</h3>
              <p className="lp-fp">Revenue, active clients, today&apos;s jobs, SMS stats — one screen, zero guesswork.</p>
              <p className="lp-fes">Ve todo tu negocio en una sola pantalla.</p>
              <div className="lp-cks">
                <span>Daily revenue tracker</span>
                <span>Active client count</span>
                <span>Today&apos;s job queue</span>
                <span>SMS delivery stats</span>
              </div>
            </div>
            <div className="lp-fph"><div className="lp-phone lp-phone-lg"><img className="lp-phone-screen" src="/landing/app-screen-dashboard-v4.png" alt="Dashboard" /></div></div>
          </div>

          <div className="lp-fr rev">
            <div className="lp-ftext">
              <div className="lp-ftag">CALENDAR</div>
              <h3 className="lp-fh">Drag, drop, done — scheduling that works</h3>
              <p className="lp-fp">Visual calendar with recurring jobs, one-time visits, and auto SMS reminders the day before.</p>
              <p className="lp-fes">Calendario visual con recordatorios automáticos.</p>
              <div className="lp-cks">
                <span>Weekly / monthly views</span>
                <span>Recurring job support</span>
                <span>Auto reminder SMS</span>
                <span>Walk-in job quick-add</span>
              </div>
            </div>
            <div className="lp-fph"><div className="lp-phone lp-phone-lg"><img className="lp-phone-screen" src="/landing/app-screen-calendar-v4.png" alt="Calendar" /></div></div>
          </div>

          <div className="lp-fr">
            <div className="lp-ftext">
              <div className="lp-ftag">CLIENT MANAGEMENT</div>
              <h3 className="lp-fh">Every client, organized and searchable</h3>
              <p className="lp-fp">Name, address, phone, service package, billing frequency, notes — all in one place, sortable and filterable.</p>
              <p className="lp-fes">Todos tus clientes organizados en un solo lugar.</p>
              <div className="lp-cks">
                <span>Sort by name, date, frequency</span>
                <span>Filter by service type</span>
                <span>Invoice history per client</span>
                <span>Quick SMS from profile</span>
              </div>
            </div>
            <div className="lp-fph"><div className="lp-phone lp-phone-lg"><img className="lp-phone-screen" src="/landing/app-screen-clients-v4.png" alt="Clients" /></div></div>
          </div>

          <div className="lp-fr rev">
            <div className="lp-ftext">
              <div className="lp-ftag">CLIENT DETAILS</div>
              <h3 className="lp-fh">Tap a name. See everything.</h3>
              <p className="lp-fp">Full profile with address, service package, invoice history, and a direct link to send an invoice or SMS in one tap.</p>
              <p className="lp-fes">Perfil completo con historial de facturas y SMS directo.</p>
              <div className="lp-cks">
                <span>Member since date</span>
                <span>Package &amp; pricing</span>
                <span>Full invoice history</span>
                <span>One-tap invoice or SMS</span>
              </div>
            </div>
            <div className="lp-fph"><div className="lp-phone lp-phone-lg"><img className="lp-phone-screen" src="/landing/app-screen-client-detail-v4.png" alt="Client detail" /></div></div>
          </div>

          <div className="lp-fr">
            <div className="lp-ftext">
              <div className="lp-ftag">MATERIALS &amp; COSTS</div>
              <h3 className="lp-fh">Track what you spend on every job</h3>
              <p className="lp-fp">Log materials per service visit — fertilizer, chemicals, parts — and see your true cost per client.</p>
              <p className="lp-fes">Registra materiales por visita y conoce tu costo real.</p>
              <div className="lp-cks">
                <span>Per-visit material logging</span>
                <span>Cost tracking by client</span>
                <span>Running total dashboard</span>
                <span>Attach to invoices</span>
              </div>
            </div>
            <div className="lp-fph"><div className="lp-phone lp-phone-lg"><img className="lp-phone-screen" src="/landing/app-screen-materials-v4.png" alt="Materials tracking" /></div></div>
          </div>

          <div className="lp-fr rev">
            <div className="lp-ftext">
              <div className="lp-ftag">INVOICING</div>
              <h3 className="lp-fh">Send invoices in one tap. See exactly what you keep.</h3>
              <p className="lp-fp">Stripe-powered invoicing with a transparent 5.5% flat fee — no hidden processing charges, no monthly minimums. Every invoice shows the service breakdown, materials, total, and exactly what hits your bank.</p>
              <p className="lp-fes">Facturación con Stripe — tarifa fija del 5.5%, sin sorpresas.</p>
              <div className="lp-cks">
                <span>One-tap send</span>
                <span>Auto-calculated fee</span>
                <span>Materials included</span>
                <span>Real-time payment status</span>
              </div>
            </div>
            <div className="lp-fph"><div className="lp-phone lp-phone-lg"><img className="lp-phone-screen" src="/landing/app-invoice-summary-v4.png" alt="Invoice summary with fee breakdown" /></div></div>
          </div>
        </div>
      </section>

      {/* BILINGUAL */}
      <section className="lp-bili">
        <div className="lp-bili-in">
          <div>
            <div className="sec-lbl">Bilingual | Bilingüe</div>
            <h2 className="sec-h">The only app that speaks both languages</h2>
            <p style={{fontSize:'15px',color:'var(--g6)',marginBottom:'8px'}}>Your clients get reminders in their language. You run your business in yours. Toggle instantly — in the app and in every text message.</p>
            <p style={{fontSize:'13px',color:'#8aaa96',fontStyle:'italic'}}>El único app de servicios completamente bilingüe — app Y mensajes en español.</p>
            <div className="lp-lpills">
              <div className="lp-lp en">🇺🇸 English</div>
              <div className="lp-lp es">🇲🇽 Español</div>
            </div>
          </div>
          <div>
            <div className="lp-sms-card">
              <div className="lp-smeta">📱 Auto SMS — English client</div>
              <div className="lp-bub">Hi Sara! Your service is scheduled for Saturday, April 18 at 9:00AM. See you then! 🗓 — Marco&apos;s Services</div>
              <div className="lp-smeta" style={{textAlign:'right'}}>📱 SMS Automático — Cliente español</div>
              <div className="lp-bub es">¡Hola Carlos! Su servicio está programado para el sábado, 18 de abril a las 9:00AM. ¡Hasta pronto! – Marco&apos;s Services</div>
            </div>
          </div>
        </div>
      </section>

      {/* VOLUME REWARD */}
      <section className="lp-vol" id="volume-reward">
        <div style={{maxWidth:'1100px',margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:'48px'}}>
            <div className="sec-lbl">Volume Reward Program | Programa de Recompensas</div>
            <h2 className="sec-h" style={{fontSize:'clamp(32px,4vw,50px)'}}>Already have clients?<br/>Your subscription could be <em style={{fontStyle:'italic',color:'var(--gp)'}}>free</em>.</h2>
            <p style={{fontSize:'17px',color:'var(--g6)',maxWidth:'640px',margin:'12px auto 0'}}>If you&apos;re already running a client base, the math works in your favor. The more you invoice through YardSync, the less — or nothing — you pay.</p>
          </div>
          <div className="lp-reality-box">
            <div>
              <div className="lp-reality-label">Think about your current book of business</div>
              <p className="lp-reality-text"><strong style={{color:'#fff'}}>10 clients at $300/month each = $3,000/month.</strong><br/>That&apos;s the FREE tier. Most contractors with an existing client base are already there — or get there within their first few months.</p>
              <p className="lp-reality-fine">Hit the threshold for 2 consecutive months to lock in your tier. No tricks, no fine print.</p>
            </div>
            <div style={{textAlign:'center',flexShrink:0}}>
              <div className="lp-zero-price">$0</div>
              <div style={{fontSize:'13px',color:'rgba(255,255,255,.55)',marginTop:'4px'}}>subscription · 5.5% per invoice continues</div>
            </div>
          </div>
          <div className="lp-vg">
            <div className="lp-vt"><div style={{fontSize:'18px',marginBottom:'8px'}}>🌱</div><div className="lp-vr">Under $1,500/mo invoiced</div><div className="lp-vd">Full Subscription</div><div className="lp-vp">$39/month</div><div className="lp-vn">+ 5.5% per invoice. Standard rate to start.</div></div>
            <div className="lp-vt"><div style={{fontSize:'18px',marginBottom:'8px'}}>📈</div><div className="lp-vr">$1,500–$2,999/mo invoiced</div><div className="lp-vd">50% Off Subscription</div><div className="lp-vp">$19/month</div><div className="lp-vn">+ 5.5% per invoice. Hit 2 months to unlock.</div></div>
            <div className="lp-vt top"><div style={{fontSize:'18px',marginBottom:'8px'}}>🏆</div><div className="lp-vr">$3,000+/mo invoiced</div><div className="lp-vd">FREE Subscription</div><div className="lp-vp">$0/month</div><div className="lp-vn">+ 5.5% per invoice. Your app pays for itself.</div></div>
          </div>
          <p className="lp-vfine">Drop below threshold for 2 consecutive months to return to the previous tier. No surprise charges — always 2 months notice. The 5.5% per-invoice fee applies at every tier.</p>
          <div style={{textAlign:'center',marginTop:'40px'}}>
            <a href="#pricing" className="lp-btn-y" style={{fontSize:'15px',padding:'13px 30px'}}>View Pricing Plans →</a>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="lp-pricing" id="pricing">
        <div style={{maxWidth:'1100px',margin:'0 auto'}}>
          <div className="sec-lbl">Pricing | Precios</div>
          <h2 className="sec-h">Simple pricing. Serious results.</h2>
          <p style={{fontSize:'15px',color:'var(--g6)'}}>$39/mo subscription + 5.5% per invoice. No contracts. Cancel anytime. Volume rewards bring the subscription to <strong>free</strong> at $3k+/mo invoiced.</p>
          <div className="lp-pg">
            <div className="lp-pc">
              <div className="lp-pn">Monthly</div><div className="lp-pne">Mensual</div>
              <div className="lp-pa">$39</div><div className="lp-pp">per month + 5.5% per invoice</div>
              <ul className="lp-pf"><li>Unlimited clients</li><li>Auto SMS reminders</li><li>Stripe invoicing (5.5% per invoice)</li><li>Volume rewards: free at $3k+/mo</li><li>English &amp; Spanish</li><li>Cancel anytime</li></ul>
              <a href="/signup" className="lp-pcta">Start Monthly →</a>
            </div>
            <div className="lp-pc featured">
              <div className="lp-pbg">SAVE $78 · BEST VALUE</div>
              <div className="lp-pn">Annual</div><div className="lp-pne">Anual</div>
              <div className="lp-pa">$390</div><div className="lp-pp">per year · $32.50/mo + 5.5% per invoice</div>
              <ul className="lp-pf"><li>Everything in Monthly</li><li>2 months free</li><li>Priority support</li><li>Early feature access</li><li>Volume rewards: free at $3k+/mo</li></ul>
              <a href="/signup" className="lp-pcta">Start Annual →</a>
            </div>
            <div className="lp-pc pro-setup">
              <div className="lp-pro-badge">SWITCHING? WE&apos;LL HANDLE IT</div>
              <div className="lp-pn" style={{marginTop:'8px'}}>Pro Setup</div><div className="lp-pne">Migración &amp; Configuración Pro</div>
              <div className="lp-pa">$99</div><div className="lp-pp">one-time · non-refundable</div>
              <ul className="lp-pf">
                <li>We import all your existing clients</li>
                <li>Works from Yardbook, Jobber, spreadsheets, or any list</li>
                <li>Set up service packages &amp; pricing</li>
                <li>Schedule all recurring visits</li>
                <li>Ready on day one — zero downtime</li>
              </ul>
              <p style={{fontSize:'12px',color:'var(--g6)',marginBottom:'16px',fontStyle:'italic'}}>Switching from another platform? We move your whole client book over so you don&apos;t have to start from scratch.</p>
              <a href="/signup" className="lp-pcta" style={{background:'var(--gp)',color:'#fff'}}>Switch &amp; Set Up →</a>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="lp-how" id="how">
        <div style={{maxWidth:'1100px',margin:'0 auto'}}>
          <div className="sec-lbl">How it works | Cómo funciona</div>
          <h2 className="sec-h">Up and running in minutes</h2>
          <div className="lp-steps">
            <div className="lp-step"><div className="lp-sn">1</div><h3>Sign Up</h3><p>Create your account at yardsyncapp.com in under 3 minutes.</p></div>
            <div className="lp-step"><div className="lp-sn">2</div><h3>Add Clients</h3><p>Enter clients, set service packages, and schedule recurring visits.</p></div>
            <div className="lp-step"><div className="lp-sn">3</div><h3>Auto Reminders</h3><p>SMS reminders fire automatically in English or Spanish before each job.</p></div>
            <div className="lp-step"><div className="lp-sn">4</div><h3>Invoice &amp; Grow</h3><p>Send invoices, track materials, and watch your revenue grow.</p></div>
          </div>
        </div>
      </section>

      {/* SMS CONSENT */}
      <section className="lp-con" id="sms-consent">
        <div style={{maxWidth:'1100px',margin:'0 auto'}}>
          <div className="sec-lbl">SMS Messaging Policy</div>
          <h2 className="sec-h">How client SMS works</h2>
          <p style={{fontSize:'15px',color:'var(--g6)',maxWidth:'500px'}}>Transparency about how appointment reminder messages are sent on behalf of service providers.</p>
          <div className="lp-cbox">
            <h3>📋 How clients consent to receive messages</h3>
            <p>Clients provide their phone number directly to their service provider when scheduling. The provider enters it into YardSync. Clients are informed they will receive appointment reminder SMS and can opt out at any time by replying STOP.</p>
            <p><strong>Opt-in message:</strong> &quot;You have been added to receive appointment reminder SMS messages from [Business Name] via YardSync. Reply STOP to opt out. Msg &amp; data rates may apply.&quot;</p>
            <div className="lp-krow"><div className="lp-klbl">Opt-out:</div><span className="lp-kw">STOP</span><span className="lp-kw">CANCEL</span><span className="lp-kw">QUIT</span><span className="lp-kw">UNSUBSCRIBE</span></div>
            <div className="lp-krow" style={{marginTop:'8px'}}><div className="lp-klbl">Help:</div><span className="lp-kw">HELP</span></div>
            <p style={{marginTop:'14px',fontSize:'13px'}}>Full details: <a href="/privacy" style={{color:'var(--gp)'}}>Privacy Policy</a> &amp; <a href="/terms" style={{color:'var(--gp)'}}>Terms of Service</a>.</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="lp-cta-section">
        <div className="lp-cin">
          <h2>Start growing your business <em>today</em></h2>
          <p>Sign up in minutes. Cancel anytime.</p>
          <p className="lp-es-cta">Regístrate en minutos. Cancela cuando quieras.</p>
          <div style={{display:'flex',justifyContent:'center'}}>
            <a href="/signup" className="lp-btn-y" style={{fontSize:'17px',padding:'14px 36px'}}>Get Started →</a>
          </div>
          <p className="lp-cta-note">$39/mo + 5.5% per invoice · Free subscription at $3k+/mo invoiced · Cancel anytime · English &amp; Español</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="lp-footer">
        <div className="lp-flogo"><div className="lp-fb">YS</div><span>YardSync</span></div>
        <div className="lp-flinks">
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms of Service</a>
          <a href="#sms-consent">SMS Policy</a>
          <a href="/login">Sign In</a>
        </div>
        <p className="lp-fcopy">YardSync by JNew Technologies, LLC · San Antonio, TX · <a href="mailto:support@yardsyncapp.com">support@yardsyncapp.com</a><br/>© 2025 JNew Technologies, LLC. All rights reserved.</p>
      </footer>
    </div>
  )
}
