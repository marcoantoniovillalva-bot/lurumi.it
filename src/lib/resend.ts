import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = process.env.EMAIL_FROM_NOREPLY ?? 'noreply@lurumi.it'
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.lurumi.it'

// ── Template base ────────────────────────────────────────────────────────────
function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#FAFAFC;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAFC;padding:40px 16px;">
  <tr><td align="center">
    <table width="100%" style="max-width:520px;background:#ffffff;border-radius:28px;border:1px solid #EEF0F4;overflow:hidden;">
      <tr>
        <td style="background:linear-gradient(135deg,#7B5CF6 0%,#9B7DFF 100%);padding:36px 40px;text-align:center;">
          <img src="${BASE_URL}/images/logo/isologo-horizontal.png" alt="Lurumi" height="44" style="display:block;margin:0 auto;">
        </td>
      </tr>
      <tr>
        <td style="padding:40px 40px 32px;">
          ${content}
        </td>
      </tr>
      <tr>
        <td style="background:#FAFAFC;border-top:1px solid #EEF0F4;padding:20px 40px;text-align:center;">
          <p style="margin:0;font-size:11px;color:#C0C7D4;font-weight:500;">
            © 2025 Lurumi · AI Powered Crafting<br>
            <a href="${BASE_URL}/privacy" style="color:#7B5CF6;text-decoration:none;">Privacy Policy</a>
            &nbsp;·&nbsp;
            <a href="${BASE_URL}/support" style="color:#7B5CF6;text-decoration:none;">Supporto</a>
            &nbsp;·&nbsp;
            <a href="${BASE_URL}/profilo" style="color:#9AA2B1;text-decoration:none;">Gestisci preferenze email</a>
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
}

function primaryButton(label: string, url: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center">
        <a href="${url}" style="display:inline-block;background:#7B5CF6;color:#ffffff;text-decoration:none;font-weight:900;font-size:15px;padding:14px 32px;border-radius:16px;letter-spacing:0.1px;">${label}</a>
      </td>
    </tr>
  </table>`
}

// ── Email di benvenuto (inviata dopo conferma email) ─────────────────────────
export async function sendWelcomeEmail(to: string, firstName?: string) {
  const name = firstName ?? 'amica'
  const html = emailWrapper(`
    <p style="margin:0 0 8px;font-size:22px;font-weight:900;color:#1C1C1E;">Benvenuta su Lurumi, ${name}! 🎉</p>
    <p style="margin:0 0 20px;font-size:15px;color:#9AA2B1;font-weight:500;line-height:1.6;">
      Il tuo account è attivo. Inizia subito a creare i tuoi primi progetti amigurumi con l'aiuto dell'AI.
    </p>
    <div style="background:#F4EEFF;border-radius:16px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 10px;font-size:13px;font-weight:900;color:#7B5CF6;">Cosa puoi fare con Lurumi:</p>
      <p style="margin:0;font-size:13px;color:#1C1C1E;line-height:1.8;">
        🧶 Crea e organizza i tuoi progetti amigurumi<br>
        🤖 Genera immagini AI dei tuoi personaggi<br>
        📖 Sfoglia la libreria di tutorial e schemi<br>
        🎨 Modifica le immagini con AI (rimozione sfondo, generazione)
      </p>
    </div>
    ${primaryButton('Inizia a creare →', BASE_URL)}
    <p style="margin:24px 0 0;font-size:12px;color:#9AA2B1;text-align:center;line-height:1.6;">
      Hai domande? Siamo su <a href="${BASE_URL}/support" style="color:#7B5CF6;">supporto</a>.
    </p>
  `)

  return resend.emails.send({
    from: `Lurumi <${FROM}>`,
    to,
    subject: 'Benvenuta su Lurumi! 🎉',
    html,
  })
}

// ── Newsletter generica ──────────────────────────────────────────────────────
export async function sendNewsletterEmail(to: string, subject: string, bodyHtml: string) {
  const html = emailWrapper(`
    ${bodyHtml}
    <p style="margin:32px 0 0;font-size:11px;color:#C0C7D4;text-align:center;line-height:1.6;">
      Ricevi questa email perché sei iscritta alla newsletter di Lurumi.<br>
      <a href="${BASE_URL}/profilo" style="color:#9AA2B1;">Gestisci preferenze</a>
    </p>
  `)

  return resend.emails.send({
    from: `Lurumi <${FROM}>`,
    to,
    subject,
    html,
  })
}
