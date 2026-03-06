import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Cookie Policy — Lurumi',
    description: 'Informativa sull\'uso dei cookie ai sensi del Provvedimento Garante Privacy dell\'8 maggio 2014 e delle Linee Guida del 10 giugno 2021.',
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="mb-8">
        <h2 className="text-lg font-black text-[#1C1C1E] mb-3 pb-2 border-b border-[#EEF0F4]">{title}</h2>
        <div className="space-y-3 text-sm text-[#4A4A55] leading-relaxed font-medium">{children}</div>
    </section>
)

const cookies = [
    {
        category: 'Tecnici necessari',
        color: 'bg-green-50 text-green-700',
        badge: 'Nessun consenso richiesto',
        badgeColor: 'bg-green-100 text-green-700',
        items: [
            {
                nome: 'sb-djatdyhqliotgnsljdja-auth-token',
                fornitore: 'Supabase Inc.',
                scopo: 'Mantiene la sessione di autenticazione dell\'utente. Senza questo cookie non è possibile rimanere connessi.',
                durata: 'Sessione / 1 anno (se "ricordami" è attivo)',
                tipo: 'HTTP Cookie — HttpOnly, Secure',
            },
            {
                nome: 'sb-*-auth-token-code-verifier',
                fornitore: 'Supabase Inc.',
                scopo: 'Codice PKCE usato durante il flusso OAuth (es. login con Google) per prevenire attacchi CSRF.',
                durata: 'Sessione (eliminato dopo il login)',
                tipo: 'HTTP Cookie — HttpOnly, Secure',
            },
        ],
    },
    {
        category: 'Funzionali',
        color: 'bg-[#F4EEFF] text-[#7B5CF6]',
        badge: 'Consenso richiesto',
        badgeColor: 'bg-[#F4EEFF] text-[#7B5CF6]',
        items: [
            {
                nome: 'lurumi_consent_v1',
                fornitore: 'Lurumi (primo parti)',
                scopo: 'Memorizza le preferenze di consenso ai cookie dell\'utente. Consente di non riproporre il banner ad ogni visita. Se l\'utente è autenticato, le preferenze vengono sincronizzate anche su Supabase per garantire la coerenza su più dispositivi.',
                durata: '12 mesi (localStorage) / fino alla cancellazione account (Supabase)',
                tipo: 'localStorage + Supabase DB (se autenticato)',
            },
            {
                nome: 'lurumi-project-storage',
                fornitore: 'Lurumi (primo parti)',
                scopo: 'Conserva i dati dei progetti di uncinetto/maglia localmente sul dispositivo per garantire la disponibilità offline. I file binari (PDF, immagini) sono in IndexedDB; i metadati strutturati in localStorage.',
                durata: 'Fino a cancellazione manuale',
                tipo: 'localStorage + IndexedDB',
            },
        ],
    },
    {
        category: 'Analitici',
        color: 'bg-blue-50 text-blue-700',
        badge: 'Consenso richiesto',
        badgeColor: 'bg-blue-100 text-blue-700',
        items: [
            {
                nome: '— (non attivi al momento)',
                fornitore: '—',
                scopo: 'Sezione riservata a eventuali strumenti di analisi (es. Plausible, Umami) che potrebbero essere attivati in futuro previo aggiornamento di questa policy.',
                durata: '—',
                tipo: '—',
            },
        ],
    },
    {
        category: 'Marketing e profilazione',
        color: 'bg-orange-50 text-orange-700',
        badge: 'Consenso richiesto',
        badgeColor: 'bg-orange-100 text-orange-700',
        items: [
            {
                nome: '— (non attivi al momento)',
                fornitore: '—',
                scopo: 'Sezione riservata a eventuali cookie di marketing (es. pixel di advertising) che potrebbero essere attivati in futuro previo aggiornamento di questa policy e raccolta del consenso.',
                durata: '—',
                tipo: '—',
            },
        ],
    },
]

export default function CookiePolicyPage() {
    return (
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-24">
            {/* Header */}
            <div className="mb-8">
                <p className="text-xs font-black text-[#7B5CF6] uppercase tracking-widest mb-2">Informativa</p>
                <h1 className="text-3xl font-black text-[#1C1C1E] mb-2">Cookie Policy</h1>
                <p className="text-[#9AA2B1] text-sm font-medium">
                    Ai sensi del Provvedimento del Garante per la Protezione dei Dati Personali dell'8 maggio 2014
                    e delle Linee Guida Cookie del 10 giugno 2021 (doc. web n. 9677876).
                </p>
                <p className="text-xs text-[#9AA2B1] font-medium mt-2">Ultimo aggiornamento: marzo 2026</p>
            </div>

            {/* 1. Cosa sono */}
            <Section title="1. Cosa sono i cookie">
                <p>
                    I cookie sono piccoli file di testo che i siti web visitati memorizzano sul tuo dispositivo
                    (computer, smartphone, tablet). Permettono al sito di ricordare le tue azioni e preferenze
                    (come la lingua o le impostazioni di accesso) per un certo lasso di tempo, così da non
                    doverle reinserire ad ogni visita.
                </p>
                <p>
                    Oltre ai cookie propriamente detti, questa policy copre anche tecnologie simili come
                    <strong> localStorage</strong> e <strong>IndexedDB</strong>, utilizzate per archiviare dati
                    direttamente sul tuo browser senza scadenza automatica.
                </p>
            </Section>

            {/* 2. Tabella cookie */}
            <Section title="2. Cookie utilizzati da questo sito">
                <p>Di seguito l'elenco completo e aggiornato dei cookie e delle tecnologie di archiviazione utilizzate:</p>

                <div className="space-y-6 mt-4">
                    {cookies.map(({ category, color, badge, badgeColor, items }) => (
                        <div key={category}>
                            <div className="flex items-center gap-2 mb-3">
                                <span className={`px-3 py-1 rounded-full text-xs font-black ${color}`}>
                                    {category}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badgeColor}`}>
                                    {badge}
                                </span>
                            </div>

                            <div className="space-y-3">
                                {items.map(({ nome, fornitore, scopo, durata, tipo }) => (
                                    <div key={nome} className="lu-card p-4 space-y-2">
                                        <p className="font-black text-[#1C1C1E] text-sm font-mono break-all">{nome}</p>
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                            <div>
                                                <p className="font-black text-[#9AA2B1] uppercase tracking-wider text-[10px]">Fornitore</p>
                                                <p className="text-[#1C1C1E] font-medium">{fornitore}</p>
                                            </div>
                                            <div>
                                                <p className="font-black text-[#9AA2B1] uppercase tracking-wider text-[10px]">Durata</p>
                                                <p className="text-[#1C1C1E] font-medium">{durata}</p>
                                            </div>
                                            <div>
                                                <p className="font-black text-[#9AA2B1] uppercase tracking-wider text-[10px]">Tipo</p>
                                                <p className="text-[#1C1C1E] font-medium">{tipo}</p>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="font-black text-[#9AA2B1] uppercase tracking-wider text-[10px] mb-0.5">Scopo</p>
                                            <p className="text-xs text-[#9AA2B1] font-medium leading-relaxed">{scopo}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </Section>

            {/* 3. Consenso */}
            <Section title="3. Come gestiamo il consenso">
                <p>
                    Al primo accesso al sito, viene mostrato un banner che ti consente di:
                </p>
                <ul className="space-y-2 mt-2">
                    {[
                        '✅ Accettare tutti i cookie (tecnici, funzionali, analitici, marketing)',
                        '❌ Rifiutare tutti i cookie non essenziali (verranno installati solo i cookie tecnici necessari)',
                        '⚙️ Personalizzare le preferenze per categoria',
                    ].map(item => (
                        <li key={item} className="lu-card p-3 text-sm font-medium text-[#1C1C1E]">{item}</li>
                    ))}
                </ul>
                <p className="mt-3">
                    Il consenso viene memorizzato nel tuo browser tramite <code className="bg-[#F4F4F8] px-1.5 py-0.5 rounded text-[#7B5CF6] font-mono text-xs">localStorage</code> con
                    la chiave <code className="bg-[#F4F4F8] px-1.5 py-0.5 rounded text-[#7B5CF6] font-mono text-xs">lurumi_consent_v1</code> e ha
                    validità di 12 mesi, dopodiché ti verrà riproposto il banner. Se sei autenticato, le preferenze vengono sincronizzate anche sul tuo profilo Supabase, in modo da mantenere le stesse scelte su tutti i tuoi dispositivi.
                </p>
                <p className="mt-3 p-4 bg-[#F4EEFF] rounded-2xl font-medium">
                    Puoi modificare o revocare il tuo consenso in qualsiasi momento accedendo a{' '}
                    <strong>Profilo → Gestisci cookie</strong> nell'app, oppure cancellando i dati del browser.
                </p>
            </Section>

            {/* 4. Cookie di terze parti */}
            <Section title="4. Cookie di terze parti">
                <p>
                    I cookie di terze parti sono installati da soggetti diversi dal titolare di questo sito.
                    Di seguito le terze parti coinvolte:
                </p>
                <div className="space-y-2 mt-2">
                    {[
                        {
                            nome: 'Supabase Inc.',
                            cookie: 'Cookie di autenticazione (tecnici)',
                            policy: 'supabase.com/privacy',
                        },
                    ].map(({ nome, cookie, policy }) => (
                        <div key={nome} className="lu-card p-4">
                            <p className="font-black text-[#1C1C1E] text-sm">{nome}</p>
                            <p className="text-xs text-[#9AA2B1] font-medium mt-0.5">{cookie}</p>
                            <p className="text-xs text-[#7B5CF6] font-medium mt-0.5">{policy}</p>
                        </div>
                    ))}
                </div>
                <p className="text-xs text-[#9AA2B1] mt-3">
                    Per i cookie di Stripe (attivi solo durante il checkout), si rinvia alla privacy policy di
                    Stripe Inc. disponibile su stripe.com/privacy.
                </p>
            </Section>

            {/* 5. Come disabilitare */}
            <Section title="5. Come disabilitare i cookie tramite il browser">
                <p>
                    Puoi disabilitare i cookie direttamente dalle impostazioni del tuo browser. Di seguito i
                    collegamenti alle istruzioni dei browser più diffusi:
                </p>
                <div className="grid grid-cols-2 gap-2 mt-2">
                    {[
                        { browser: 'Google Chrome', url: 'support.google.com/chrome/answer/95647' },
                        { browser: 'Mozilla Firefox', url: 'support.mozilla.org/it/kb/protezione-antitracciamento' },
                        { browser: 'Apple Safari', url: 'support.apple.com/it-it/guide/safari/sfri11471' },
                        { browser: 'Microsoft Edge', url: 'support.microsoft.com/it-it/microsoft-edge' },
                    ].map(({ browser, url }) => (
                        <div key={browser} className="lu-card p-3">
                            <p className="font-black text-[#1C1C1E] text-xs">{browser}</p>
                            <p className="text-[10px] text-[#9AA2B1] font-medium mt-0.5 break-all">{url}</p>
                        </div>
                    ))}
                </div>
                <p className="mt-3 p-3 bg-amber-50 rounded-2xl text-xs font-medium text-amber-700">
                    ⚠️ Attenzione: la disabilitazione dei cookie tecnici potrebbe compromettere il corretto
                    funzionamento del sito, in particolare l'accesso all'area riservata.
                </p>
            </Section>

            {/* 6. Aggiornamenti */}
            <Section title="6. Aggiornamenti di questa policy">
                <p>
                    La presente Cookie Policy può essere aggiornata per riflettere modifiche normative o
                    all'utilizzo dei cookie. La data dell'ultimo aggiornamento è indicata in cima alla pagina.
                    Modifiche sostanziali saranno comunicate tramite il banner dei cookie o per email.
                </p>
            </Section>

            {/* Footer link */}
            <div className="flex gap-4 pt-4 border-t border-[#EEF0F4]">
                <Link href="/privacy" className="text-sm font-bold text-[#7B5CF6] hover:underline">
                    Privacy Policy →
                </Link>
            </div>
        </div>
    )
}
