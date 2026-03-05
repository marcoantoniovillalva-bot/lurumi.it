import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = process.env.EMAIL_FROM_NOREPLY ?? 'noreply@lurumi.it'
// Forza sempre l'URL di produzione nelle email (le immagini devono essere pubblicamente raggiungibili)
const BASE_URL = 'https://www.lurumi.it'

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
      <!-- Header con gradiente -->
      <tr>
        <td style="background:linear-gradient(135deg,#7B5CF6 0%,#9B7DFF 100%);padding:32px 40px 28px;text-align:center;">
          <!-- Avatar circolare con isotipo -->
          <div style="display:inline-block;width:72px;height:72px;border-radius:50%;background:#ffffff;padding:4px;box-shadow:0 4px 16px rgba(0,0,0,0.15);">
            <img src="${BASE_URL}/images/logo/isotipo.png" alt="Lurumi" width="64" height="64"
              style="display:block;width:64px;height:64px;border-radius:50%;object-fit:cover;">
          </div>
          <p style="margin:10px 0 0;font-size:20px;font-weight:900;color:#ffffff;letter-spacing:-0.3px;">Lurumi</p>
          <p style="margin:2px 0 0;font-size:11px;color:rgba(255,255,255,0.7);font-weight:500;letter-spacing:0.5px;">AI Powered Crafting</p>
        </td>
      </tr>
      <!-- Contenuto -->
      <tr>
        <td style="padding:36px 40px 28px;">
          ${content}
        </td>
      </tr>
      <!-- Footer -->
      <tr>
        <td style="background:#FAFAFC;border-top:1px solid #EEF0F4;padding:20px 40px;text-align:center;">
          <p style="margin:0;font-size:11px;color:#C0C7D4;font-weight:500;">
            © 2026 Lurumi · AI Powered Crafting<br>
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
      <td align="center" style="padding:8px 0;">
        <a href="${url}" style="display:inline-block;background:#7B5CF6;color:#ffffff;text-decoration:none;font-weight:900;font-size:15px;padding:14px 36px;border-radius:16px;letter-spacing:0.1px;">${label}</a>
      </td>
    </tr>
  </table>`
}

// ── Email di benvenuto (inviata dopo primo accesso) ───────────────────────────
export async function sendWelcomeEmail(to: string, firstName?: string) {
  const name = firstName ?? 'amica'
  const html = emailWrapper(`
    <p style="margin:0 0 6px;font-size:23px;font-weight:900;color:#1C1C1E;line-height:1.2;">Benvenuta su Lurumi, ${name}! 🎉</p>
    <p style="margin:0 0 24px;font-size:15px;color:#9AA2B1;font-weight:500;line-height:1.6;">
      Il tuo account è attivo. Inizia subito a creare i tuoi primi progetti amigurumi con l'aiuto dell'AI.
    </p>
    <div style="background:#F4EEFF;border-radius:16px;padding:20px 24px;margin-bottom:28px;">
      <p style="margin:0 0 10px;font-size:13px;font-weight:900;color:#7B5CF6;text-transform:uppercase;letter-spacing:0.5px;">Cosa puoi fare con Lurumi</p>
      <p style="margin:0;font-size:14px;color:#1C1C1E;line-height:1.9;">
        🧶 Crea e organizza i tuoi progetti amigurumi<br>
        🤖 Genera immagini AI dei tuoi personaggi<br>
        📖 Sfoglia la libreria di tutorial e schemi<br>
        🎨 Modifica le immagini con AI (rimozione sfondo, generazione)
      </p>
    </div>
    ${primaryButton('Inizia a creare →', BASE_URL)}
    <p style="margin:24px 0 0;font-size:12px;color:#C0C7D4;text-align:center;line-height:1.6;">
      Hai domande? Scrivici su <a href="${BASE_URL}/support" style="color:#7B5CF6;text-decoration:none;">supporto</a>.
    </p>
  `)

  return resend.emails.send({
    from: `Lurumi <${FROM}>`,
    to,
    subject: 'Benvenuta su Lurumi! 🎉',
    html,
  })
}

// ── Newsletter generica (admin) ───────────────────────────────────────────────
export async function sendNewsletterEmail(to: string, subject: string, bodyHtml: string) {
  const html = emailWrapper(`
    ${bodyHtml}
    <p style="margin:32px 0 0;font-size:11px;color:#C0C7D4;text-align:center;line-height:1.6;">
      Ricevi questa email perché sei iscritta alla newsletter di Lurumi.<br>
      <a href="${BASE_URL}/profilo" style="color:#9AA2B1;text-decoration:none;">Gestisci preferenze</a>
    </p>
  `)

  return resend.emails.send({
    from: `Lurumi <${FROM}>`,
    to,
    subject,
    html,
  })
}
