import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Privacy Policy — Lurumi',
    description: 'Informativa sul trattamento dei dati personali ai sensi del GDPR (Reg. UE 2016/679)',
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="mb-8">
        <h2 className="text-lg font-black text-[#1C1C1E] mb-3 pb-2 border-b border-[#EEF0F4]">{title}</h2>
        <div className="space-y-3 text-sm text-[#4A4A55] leading-relaxed font-medium">{children}</div>
    </section>
)

const Item = ({ label, value }: { label: string; value: string }) => (
    <div className="lu-card p-4">
        <p className="text-xs font-black text-[#9AA2B1] uppercase tracking-wider mb-1">{label}</p>
        <p className="text-sm text-[#1C1C1E] font-medium">{value}</p>
    </div>
)

export default function PrivacyPage() {
    return (
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-24">
            <div className="mb-8">
                <p className="text-xs font-black text-[#7B5CF6] uppercase tracking-widest mb-2">Informativa</p>
                <h1 className="text-3xl font-black text-[#1C1C1E] mb-2">Privacy Policy</h1>
                <p className="text-[#9AA2B1] text-sm font-medium">
                    Ai sensi degli artt. 13 e 14 del Regolamento UE 2016/679 (GDPR) e del D.Lgs. 196/2003 come modificato dal D.Lgs. 101/2018.
                </p>
                <p className="text-xs text-[#9AA2B1] font-medium mt-2">Ultimo aggiornamento: marzo 2026</p>
            </div>

            <Section title="1. Titolare del trattamento">
                <div className="grid grid-cols-1 gap-2">
                    <Item label="Responsabile" value="Marco Villalva" />
                    <Item label="Denominazione attività" value="Marketizzati — P.IVA 03028360182" />
                    <Item label="ATECO" value="73.11.02 — Conduzione di campagne di marketing e altri servizi pubblicitari" />
                    <Item label="Indirizzo" value="Via Mentana 21, 27029 Vigevano (PV), Italia" />
                    <Item label="Email" value="lurumi@marketizzati.it" />
                </div>
                <p className="mt-3">
                    Lurumi è un progetto ideato e condotto da Erika Herrera. Per qualsiasi questione relativa al
                    trattamento dei tuoi dati personali puoi scrivere a{' '}
                    <strong>lurumi@marketizzati.it</strong>.
                </p>
            </Section>

            <Section title="2. Dati personali trattati">
                <p>Trattiamo le seguenti categorie di dati personali:</p>
                <ul className="space-y-2 mt-2">
                    {[
                        { cat: 'Dati di identità e contatto', desc: 'Nome, cognome, indirizzo email forniti al momento della registrazione o tramite autenticazione Google.' },
                        { cat: 'Dati di utilizzo', desc: 'Informazioni su come interagisci con l\'app: funzionalità usate, strumenti AI attivati, pattern caricati, timestamp delle azioni.' },
                        { cat: 'Dati tecnici', desc: 'Indirizzo IP, tipo di dispositivo e browser, sistema operativo, identificativi di sessione necessari al funzionamento del servizio.' },
                        { cat: 'Dati di pagamento', desc: 'Non conserviamo direttamente i dati delle carte di credito. Il pagamento è gestito da Stripe Inc., certificato PCI-DSS.' },
                        { cat: 'Contenuti caricati', desc: 'Pattern PDF e immagini caricati nell\'app. Vengono conservati localmente sul tuo dispositivo (IndexedDB). Se hai effettuato il login, vengono sincronizzati su Supabase Storage (bucket privato accessibile solo al tuo account) per garantire la disponibilità su più dispositivi.' },
                    ].map(({ cat, desc }) => (
                        <li key={cat} className="lu-card p-4">
                            <p className="font-black text-[#1C1C1E] text-sm mb-1">{cat}</p>
                            <p className="text-xs text-[#9AA2B1] font-medium leading-relaxed">{desc}</p>
                        </li>
                    ))}
                </ul>
                <p className="mt-3 text-xs text-[#9AA2B1]">
                    Non trattiamo categorie particolari di dati (art. 9 GDPR) né dati relativi a condanne penali.
                    Non raccogliamo dati di minori di 16 anni.
                </p>
            </Section>

            <Section title="3. Finalità e base giuridica del trattamento">
                <div className="space-y-2">
                    {[
                        { finalita: 'Registrazione e gestione dell\'account', base: 'Esecuzione del contratto (art. 6.1.b GDPR)', desc: 'Creazione e gestione del tuo profilo utente, autenticazione e accesso al servizio.' },
                        { finalita: 'Erogazione del servizio', base: 'Esecuzione del contratto (art. 6.1.b GDPR)', desc: 'Utilizzo degli strumenti AI, gestione dei progetti, accesso a tutorial e guide.' },
                        { finalita: 'Elaborazione dei pagamenti', base: 'Esecuzione del contratto (art. 6.1.b GDPR)', desc: 'Gestione degli abbonamenti tramite Stripe.' },
                        { finalita: 'Adempimenti legali', base: 'Obbligo legale (art. 6.1.c GDPR)', desc: 'Conservazione dei dati per obblighi fiscali, contabili e normativi.' },
                        { finalita: 'Analisi e miglioramento del servizio', base: 'Legittimo interesse (art. 6.1.f GDPR) o Consenso (art. 6.1.a GDPR)', desc: 'Analisi aggregata dell\'utilizzo per migliorare le funzionalità. Puoi opporti tramite le preferenze cookie.' },
                        { finalita: 'Comunicazioni di marketing', base: 'Consenso (art. 6.1.a GDPR)', desc: 'Invio di newsletter e offerte. Solo con consenso esplicito, revocabile in qualsiasi momento.' },
                    ].map(({ finalita, base, desc }) => (
                        <div key={finalita} className="lu-card p-4">
                            <p className="font-black text-[#1C1C1E] text-sm">{finalita}</p>
                            <p className="text-xs font-bold text-[#7B5CF6] mt-0.5">{base}</p>
                            <p className="text-xs text-[#9AA2B1] font-medium mt-1 leading-relaxed">{desc}</p>
                        </div>
                    ))}
                </div>
            </Section>

            <Section title="4. Destinatari e responsabili del trattamento">
                <p>I tuoi dati possono essere comunicati, nella misura strettamente necessaria, ai seguenti Responsabili del Trattamento (art. 28 GDPR):</p>
                <div className="space-y-2 mt-2">
                    {[
                        { nome: 'Supabase Inc.', ruolo: 'Autenticazione, database e file storage', sede: 'USA — Clausole Contrattuali Standard (SCC)', info: 'supabase.com/privacy' },
                        { nome: 'OpenAI Inc.', ruolo: 'Elaborazione AI: assistente chat, analisi immagini pattern (Vision), generazione immagini (DALL-E 3)', sede: 'USA — Clausole Contrattuali Standard (SCC)', info: 'openai.com/policies/privacy-policy' },
                        { nome: 'Replicate Inc.', ruolo: 'Generazione immagini AI (Flux Schnell, Flux Dev)', sede: 'USA — Clausole Contrattuali Standard (SCC)', info: 'replicate.com/privacy' },
                        { nome: 'Stripe Inc.', ruolo: 'Elaborazione pagamenti', sede: 'USA — PCI-DSS + Clausole Contrattuali Standard', info: 'stripe.com/privacy' },
                    ].map(({ nome, ruolo, sede, info }) => (
                        <div key={nome} className="lu-card p-4">
                            <p className="font-black text-[#1C1C1E] text-sm">{nome}</p>
                            <p className="text-xs text-[#9AA2B1] font-medium mt-0.5">{ruolo}</p>
                            <p className="text-xs text-[#9AA2B1] font-medium">Sede: {sede}</p>
                            <p className="text-xs text-[#7B5CF6] font-medium mt-0.5">{info}</p>
                        </div>
                    ))}
                </div>
                <p className="mt-3 text-xs">I dati non vengono venduti o ceduti a terzi per finalità proprie.</p>
            </Section>

            <Section title="5. Trasferimento dati verso Paesi terzi">
                <p>
                    I responsabili del trattamento indicati hanno sede negli Stati Uniti d'America. I trasferimenti
                    avvengono sulla base delle <strong>Clausole Contrattuali Standard</strong> adottate dalla
                    Commissione Europea (decisione 2021/914/UE), che garantiscono un livello di protezione adeguato.
                </p>
            </Section>

            <Section title="6. Periodo di conservazione">
                <div className="space-y-2">
                    {[
                        { tipo: 'Dati dell\'account', periodo: 'Per tutta la durata del rapporto + 10 anni (obblighi fiscali)' },
                        { tipo: 'Dati di utilizzo e log', periodo: '12 mesi dalla raccolta' },
                        { tipo: 'Dati di fatturazione', periodo: '10 anni (art. 2220 c.c.)' },
                        { tipo: 'Dati per finalità di marketing', periodo: 'Fino alla revoca del consenso' },
                        { tipo: 'Contenuti locali (IndexedDB)', periodo: 'Sul dispositivo fino a cancellazione manuale' },
                    ].map(({ tipo, periodo }) => (
                        <div key={tipo} className="lu-card p-4">
                            <p className="font-black text-[#1C1C1E] text-sm">{tipo}</p>
                            <p className="text-xs text-[#9AA2B1] font-medium mt-0.5">{periodo}</p>
                        </div>
                    ))}
                </div>
            </Section>

            <Section title="7. I tuoi diritti (artt. 15–22 GDPR)">
                <p>Hai il diritto di accesso, rettifica, cancellazione, limitazione, portabilità, opposizione e revoca del consenso. Per esercitarli:</p>
                <div className="mt-3 p-4 bg-[#F4EEFF] rounded-2xl text-sm font-medium text-[#1C1C1E]">
                    Scrivi a <strong>lurumi@marketizzati.it</strong>. Risponderemo entro 30 giorni (art. 12 GDPR).
                </div>
                <p className="mt-3 text-xs text-[#9AA2B1]">
                    Hai anche il diritto di proporre reclamo al Garante per la Protezione dei Dati Personali
                    (www.garanteprivacy.it).
                </p>
            </Section>

            <Section title="8. Cookie e tecnologie di tracciamento">
                <p>
                    Per informazioni dettagliate, consulta la nostra{' '}
                    <Link href="/cookie-policy" className="text-[#7B5CF6] font-bold underline">Cookie Policy</Link>.
                </p>
            </Section>

            <Section title="9. Modifiche alla presente informativa">
                <p>
                    La presente informativa può essere aggiornata periodicamente. Ogni modifica sostanziale sarà
                    comunicata tramite avviso nell'app o per email.
                </p>
            </Section>

            <div className="flex gap-4 pt-4 border-t border-[#EEF0F4]">
                <Link href="/cookie-policy" className="text-sm font-bold text-[#7B5CF6] hover:underline">Cookie Policy →</Link>
            </div>
        </div>
    )
}
