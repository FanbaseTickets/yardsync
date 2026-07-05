'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/context/LangContext'
import { getTeamMemberships, getMyCrews } from '@/lib/db'
import { formatCents } from '@/lib/fee'
import { Button, Input } from '@/components/ui'

const SEAT_PRICE_CENTS = 1500   // $15/seat/mo (display; billed via STRIPE_PRICE_CREW_SEAT)
// Mirror CREW_PALETTE in app/calendar/CalendarContent.js + the member-color route.
const CREW_PALETTE = ['#6366f1', '#ec4899', '#f59e0b', '#0ea5e9', '#8b5cf6', '#ef4444', '#10b981', '#f97316']
import { Users, UserPlus, Trash2, Clock, CheckCircle2, Briefcase, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

// Settings → Team. Owner invites crew (Workers), sees pending + active members
// and can remove them; everyone also sees the crews THEY belong to ("My crews").
// Reads go via the client SDK (owner-scoped by the Firestore rules); writes
// (invite/remove) go through the server-mediated /api/crew routes.
export default function TeamPanel() {
  const { user, profile } = useAuth()
  const { lang } = useLang()
  const es = lang === 'es'
  // A pure crew member sees only "Crews you're on" — not the owner invite/team.
  const crewScoped = profile?.crewMode === true && !profile?.stripeAccountId

  const [team, setTeam]       = useState([])
  const [myCrews, setMyCrews] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm]       = useState({ name: '', phone: '', email: '' })
  const [inviting, setInviting] = useState(false)
  const [removingUid, setRemovingUid] = useState(null)
  const [leavingBiz, setLeavingBiz] = useState(null)
  const [expandedMember, setExpandedMember] = useState(null)
  const [savingColor, setSavingColor] = useState(false)

  async function setColor(memberUid, color) {
    setSavingColor(true)
    try {
      const idToken = await user.getIdToken()
      const res = await fetch('/api/crew/member-color', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ memberUid, color }),
      })
      if (!res.ok) { toast.error(es ? 'No se pudo guardar' : 'Could not save'); return }
      setTeam(t => t.map(m => m.memberUid === memberUid ? { ...m, memberColor: color } : m))
    } catch { toast.error(es ? 'Algo salió mal' : 'Something went wrong') }
    finally { setSavingColor(false) }
  }

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    setLoading(true)
    try {
      const [t, c] = await Promise.all([getTeamMemberships(user.uid), getMyCrews(user.uid)])
      // Team = workers who are pending (invited) or active. Hides the retired
      // invite doc left behind on accept (status 'accepted') so a member never
      // appears twice, and hides 'removed'.
      setTeam(t.filter(m => m.role !== 'owner' && (m.status === 'invited' || m.status === 'active')))
      setMyCrews(c.filter(m => m.businessUid !== user.uid))
    } catch { /* rules may not be deployed yet — show empty rather than crash */ }
    finally { setLoading(false) }
  }

  async function invite() {
    const name = form.name.trim()
    if (!name) { toast.error(es ? 'El nombre es requerido' : 'Name is required'); return }
    if (!form.phone.trim() && !form.email.trim()) { toast.error(es ? 'Agrega un teléfono o email' : 'Add a phone or email'); return }
    setInviting(true)
    try {
      const idToken = await user.getIdToken()
      const res = await fetch('/api/crew/invite', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ name, phone: form.phone.trim(), email: form.email.trim(), lang }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || (es ? 'No se pudo invitar' : 'Could not invite')); setInviting(false); return }
      toast.success(es ? 'Invitación enviada ✓' : 'Invite sent ✓')
      setForm({ name: '', phone: '', email: '' })
      load()
    } catch { toast.error(es ? 'Algo salió mal' : 'Something went wrong') }
    finally { setInviting(false) }
  }

  async function leaveCrew(businessUid, label) {
    if (!businessUid) return
    if (!window.confirm(es ? `¿Salir del equipo de ${label}?` : `Leave ${label}'s crew?`)) return
    setLeavingBiz(businessUid)
    try {
      const idToken = await user.getIdToken()
      const res = await fetch('/api/crew/leave', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ businessUid }),
      })
      if (!res.ok) { const d = await res.json(); toast.error(d.error || (es ? 'No se pudo salir' : 'Could not leave')); setLeavingBiz(null); return }
      toast.success(es ? 'Saliste del equipo' : 'You left the crew')
      load()
    } catch { toast.error(es ? 'Algo salió mal' : 'Something went wrong') }
    finally { setLeavingBiz(null) }
  }

  async function remove(memberUid, label) {
    if (!memberUid) return
    if (!window.confirm(es ? `¿Quitar a ${label} de tu equipo?` : `Remove ${label} from your crew?`)) return
    setRemovingUid(memberUid)
    try {
      const idToken = await user.getIdToken()
      const res = await fetch('/api/crew/remove', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ memberUid }),
      })
      if (!res.ok) { const d = await res.json(); toast.error(d.error || (es ? 'No se pudo quitar' : 'Could not remove')); setRemovingUid(null); return }
      toast.success(es ? 'Miembro quitado' : 'Member removed')
      load()
    } catch { toast.error(es ? 'Algo salió mal' : 'Something went wrong') }
    finally { setRemovingUid(null) }
  }

  return (
    <div className="space-y-6">
      {!crewScoped && (<>
      {/* Invite */}
      <div>
        <h3 className="text-[15px] font-semibold text-gray-900 mb-1 flex items-center gap-2"><UserPlus size={16} className="text-brand-600" /> {es ? 'Invitar a un miembro' : 'Invite a crew member'}</h3>
        <p className="text-[12.5px] text-gray-500 mb-3">{es ? 'Los miembros ven solo los trabajos que les asignas — nunca precios, clientes ni facturas.' : 'Crew members see only the jobs you assign them — never prices, clients, or invoices.'}</p>
        <div className="space-y-2">
          <Input label={es ? 'Nombre' : 'Name'} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={es ? 'Nombre del miembro' : "Crew member's name"} />
          <div className="grid grid-cols-2 gap-2">
            <Input label={es ? 'Teléfono' : 'Phone'} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(210) 555-0100" />
            <Input label="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="name@email.com" />
          </div>
          <Button icon={UserPlus} loading={inviting} onClick={invite} fullWidth>{es ? 'Enviar invitación' : 'Send invite'}</Button>
        </div>
      </div>

      {/* Team list */}
      <div>
        <h3 className="text-[15px] font-semibold text-gray-900 mb-2 flex items-center gap-2"><Users size={16} className="text-brand-600" /> {es ? 'Tu equipo' : 'Your crew'}</h3>
        {loading ? (
          <p className="text-[13px] text-gray-400">{es ? 'Cargando…' : 'Loading…'}</p>
        ) : team.length === 0 ? (
          <p className="text-[13px] text-gray-400">{es ? 'Aún no hay miembros. Invita a alguien arriba.' : 'No crew members yet. Invite someone above.'}</p>
        ) : (
          <div className="space-y-2">
            {team.map(m => {
              const pending  = m.status === 'invited'
              const expanded = expandedMember === m.memberUid
              const dotColor = m.memberColor || CREW_PALETTE[0]
              return (
                <div key={m.id} className="bg-white border border-gray-100 rounded-xl">
                  <div className="flex items-center justify-between px-3 py-2.5">
                    {/* Active member name toggles the color panel (Jay: click name → expands). */}
                    {!pending && m.memberUid ? (
                      <button onClick={() => setExpandedMember(expanded ? null : m.memberUid)} className="min-w-0 flex items-center gap-2 text-left flex-1">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
                        <span className="min-w-0">
                          <span className="block text-[14px] font-medium text-gray-900 truncate">{m.inviteName || m.memberEmail || (es ? 'Miembro' : 'Member')}</span>
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-600"><CheckCircle2 size={11} /> {es ? 'Activo' : 'Active'}</span>
                        </span>
                      </button>
                    ) : (
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium text-gray-900 truncate">{m.inviteName || m.memberEmail || (es ? 'Miembro' : 'Member')}</p>
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600"><Clock size={11} /> {es ? 'Invitación pendiente' : 'Invite pending'}</span>
                      </div>
                    )}
                    {pending && m.inviteToken && (
                      <button
                        onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/crew/join?token=${m.inviteToken}`).then(() => toast.success(es ? 'Enlace copiado' : 'Link copied'), () => {}) }}
                        className="text-[12px] text-brand-700 hover:text-brand-800 font-medium px-2 py-1 rounded-lg hover:bg-brand-50 flex-shrink-0">
                        {es ? 'Copiar enlace' : 'Copy link'}
                      </button>
                    )}
                    {!pending && m.memberUid && (
                      <button onClick={() => remove(m.memberUid, m.inviteName || 'this member')} disabled={removingUid === m.memberUid}
                        className="text-gray-300 hover:text-red-500 p-1.5 disabled:opacity-50 flex-shrink-0" aria-label="remove">
                        {removingUid === m.memberUid ? <span className="w-4 h-4 border-2 border-gray-300 border-t-red-500 rounded-full animate-spin inline-block" /> : <Trash2 size={16} />}
                      </button>
                    )}
                  </div>
                  {/* Color picker (active members) */}
                  {expanded && !pending && (
                    <div className="px-3 pb-3 pt-1 border-t border-gray-100">
                      <p className="text-[11px] text-gray-400 mb-2">{es ? 'Color en el calendario' : 'Calendar color'}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {CREW_PALETTE.map(color => (
                          <button
                            key={color}
                            onClick={() => setColor(m.memberUid, color)}
                            disabled={savingColor}
                            aria-label={`color ${color}`}
                            className={`w-6 h-6 rounded-full transition-transform hover:scale-110 disabled:opacity-50 ${m.memberColor === color ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Running seat cost */}
      {team.filter(m => m.status === 'active').length > 0 && (
        <p className="text-[12px] text-gray-500">
          {(() => { const n = team.filter(m => m.status === 'active').length; return es
            ? `${n} miembro(s) activo(s) × $15/mes = +${formatCents(n * SEAT_PRICE_CENTS)}/mes en tu suscripción.`
            : `${n} active member(s) × $15/mo = +${formatCents(n * SEAT_PRICE_CENTS)}/mo on your subscription.` })()}
        </p>
      )}
      </>)}

      {/* Hustler on-ramp — a scoped worker can start their OWN business anytime.
          Onboarding Stripe Connect sets stripeAccountId, which auto-releases the
          crewMode scope and returns the full owner app (they keep their crews). */}
      {crewScoped && (
        <Link href="/onboarding/connect-stripe" className="block">
          <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-3.5 py-3 hover:border-brand-300 hover:bg-brand-50/40 transition-colors">
            <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0"><Briefcase size={17} className="text-brand-700" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-gray-900">{es ? 'Empieza tu propio negocio' : 'Start your own business'}</p>
              <p className="text-[12px] text-gray-500">{es ? 'Cobra a tus propios clientes — sigues en tus equipos.' : 'Invoice your own clients — you stay on your crews too.'}</p>
            </div>
            <ArrowRight size={16} className="text-gray-300 flex-shrink-0" />
          </div>
        </Link>
      )}

      {/* My crews (businesses I work in) */}
      {myCrews.length > 0 && (
        <div>
          <h3 className="text-[15px] font-semibold text-gray-900 mb-2">{es ? 'Equipos a los que perteneces' : "Crews you're on"}</h3>
          <div className="space-y-2">
            {myCrews.map(m => (
              <div key={m.id} className="flex items-center gap-2 bg-brand-50 border border-brand-100 rounded-xl px-3 py-2.5">
                <Users size={15} className="text-brand-700 flex-shrink-0" />
                <span className="text-[14px] text-brand-800 font-medium truncate flex-1">{m.businessName || (es ? 'Negocio' : 'Business')}</span>
                <button
                  onClick={() => leaveCrew(m.businessUid, m.businessName || (es ? 'este negocio' : 'this business'))}
                  disabled={leavingBiz === m.businessUid}
                  className="text-[12px] text-gray-400 hover:text-red-500 font-medium px-2 py-1 rounded-lg hover:bg-white flex-shrink-0 disabled:opacity-50">
                  {leavingBiz === m.businessUid ? (es ? 'Saliendo…' : 'Leaving…') : (es ? 'Salir' : 'Leave')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
