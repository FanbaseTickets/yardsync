/**
 * POST /api/admin/send-template
 * Sends the Client Import Template link to a contractor's email.
 *
 * Body: { email, name }
 */

import sgMail from '@sendgrid/mail'

export async function POST(request) {
  try {
    const key = process.env.SENDGRID_API_KEY
    const from = process.env.SENDGRID_FROM_EMAIL
    if (!key || !from) {
      return Response.json({ error: 'Email not configured' }, { status: 500 })
    }
    sgMail.setApiKey(key)

    const { email, name } = await request.json()
    if (!email) {
      return Response.json({ error: 'Missing email' }, { status: 400 })
    }

    const displayName = name || 'there'

    console.log(`Sending template to: ${email} from: ${from}`)
    await sgMail.send({
      to: email,
      from,
      subject: 'YardSync — Client Import Template',
      text: `Hi ${displayName},\n\nWelcome to YardSync Pro Setup! To get started, please download the Client Import Template and fill in your current client list:\n\nhttps://yardsyncapp.com/YardSync_Client_Import_Template.xlsx\n\nOnce complete, reply to this email with the filled-in spreadsheet and we'll import everything for you.\n\nThanks,\nYardSync Team`,
      html: `
        <div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f8faf9;">
          <div style="background:#0F6E56;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0;">
            <h1 style="margin:0;font-size:20px;font-weight:700;">Welcome to Pro Setup</h1>
            <p style="margin:6px 0 0;opacity:.9;font-size:13px;">Let's get your client list imported</p>
          </div>
          <div style="background:#fff;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e4e9e5;border-top:none;">
            <p style="margin:0 0 16px;font-size:15px;color:#1a2420;">Hi <strong>${displayName}</strong>,</p>
            <p style="margin:0 0 16px;font-size:14px;color:#5a6b60;">Thanks for purchasing Pro Setup! To kick things off, download the template below and fill in your current client list — one row per client.</p>
            <a href="https://yardsyncapp.com/YardSync_Client_Import_Template.xlsx" style="display:inline-block;margin:0 0 16px;background:#0F6E56;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">📋 Download import template</a>
            <p style="margin:0 0 8px;font-size:14px;color:#5a6b60;">Once you've filled it in, just reply to this email with the completed spreadsheet attached and we'll handle the rest.</p>
            <p style="margin:16px 0 0;font-size:13px;color:#8aaa96;">— The YardSync Team</p>
          </div>
          <p style="margin:16px 0 0;text-align:center;font-size:11px;color:#8aaa96;">YardSync · JNew Technologies, LLC</p>
        </div>
      `,
    })

    return Response.json({ ok: true })
  } catch (err) {
    console.error('send-template error:', err.message)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
