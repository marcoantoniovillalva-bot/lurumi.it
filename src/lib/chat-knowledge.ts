/**
 * chat-knowledge.ts — Contenuto statico iniettato nel system prompt del chatbot.
 * Queste costanti sono sempre incluse in ogni richiesta (totale ~600 token).
 */

// ── Tavola abbreviazioni dal libro Lurumi (IT/EN/ES) ─────────────────────────
export const LURUMI_ABBREVIATIONS = `
## Vocabolario Lurumi — Abbreviazioni
mb/pb=maglia bassa(sc) | AM=anello magico(MR) | aum=aumento(inc) | dim=diminuzione invisibile(dec) | cat=catenella(ch) | mpa=mezzo punto alto(hdc) | pa=punto alto(dc) | dpa=doppio punto alto(tr) | BLO=solo asole posteriori | FLO=solo asole anteriori | pbss=slip stitch
Nota: mb=pb=maglia bassa=punto basso — stessa tecnica, sinonimi. "Maglia liscia" NON esiste nel sistema Lurumi.`

// ── Logica sfera amigurumi (formule fondamentali) ─────────────────────────────
export const SPHERE_RULES = `
## Logica Sfera Amigurumi
Struttura: Crescita→Plateau→Chiusura (+6/-6 maglie/giro).
Aumenti: G1=AM,6mb | G2=(1aum)×6→12 | G3=(1mb,1aum)×6→18 | G4=(2mb,1aum)×6→24 | G5=(3mb,1aum)×6→30 | G6=(4mb,1aum)×6→36. Regola Gn: ((n-2)mb,1aum)×6.
Diminuzioni speculari: (K mb,1dim)×6.
Gauge: cotone 2.5mm ~5mb=1cm. Diametro≈plateau/30cm. BLO=bordo visibile. Ovale=N cat su entrambi i lati.`

// ── FAQ utilizzo app Lurumi ───────────────────────────────────────────────────
export const APP_FAQ = `
## App Lurumi — info rapide
Crediti: free=50/mese, premium=300/mese. Chat=gratis. Vision=5cr. Img fast=8cr. Img HD=20cr. BG removal=10cr. BG gen=15cr.
Progetti: tipo PDF/immagini/tutorial/blank, note HTML, sezioni (parti anatomiche), contatori secondari (giri/parti).
Altre funzioni: timer lavoro, export ZIP, tutorial YouTube trascritti automaticamente, generatore immagini AI, corsi/eventi.`

// ── Costruisce il blocco knowledge da iniettare nel system prompt ─────────────
export function buildKnowledgeBlock(options: {
    includeAbbreviations?: boolean
    includeSphereRules?: boolean
    includeFaq?: boolean
} = {}): string {
    const { includeAbbreviations = true, includeSphereRules = true, includeFaq = true } = options
    const parts: string[] = ['--- CONOSCENZA TECNICA ---']
    if (includeAbbreviations) parts.push(LURUMI_ABBREVIATIONS)
    if (includeSphereRules) parts.push(SPHERE_RULES)
    if (includeFaq) parts.push(APP_FAQ)
    parts.push('--- FINE CONOSCENZA ---')
    return parts.join('\n')
}

// ── Tipo profilo utente (salvato in profiles.ai_profile) ─────────────────────
export interface AiUserProfile {
    // Personale
    nome?: string | null
    eta_approssimativa?: string | null          // es. "20-30", "teenager", "adulto", "anziano"
    citta_paese?: string | null                 // es. "Milano", "Argentina", "Londra"
    lingua_madre?: string | null                // es. "italiano", "spagnolo", "inglese"
    professione?: string | null                 // es. "insegnante", "designer", "studente"

    // Craft
    livello?: 'principiante' | 'intermedio' | 'avanzato' | null
    tecniche?: string[]                         // es. ["uncinetto", "maglia", "ricamo", "macramé"]
    filato_preferito?: string | null
    marca_filato_preferita?: string | null      // es. "Drops", "Paintbox", "Hobbii"
    uncinetto_preferito?: string | null
    misura_uncinetto_preferita?: string | null  // es. "2.5mm", "3mm", "4mm"
    stile_estetico?: string | null              // es. "kawaii", "naturale", "colorato", "minimal", "realistico"
    colori_preferiti?: string[]                 // es. ["pastello", "colori vivaci", "neutri", "bianco/nero"]

    // Motivazione e contesto
    motivazione?: string | null                 // es. "hobby rilassante", "regalo per nipoti", "vendita su Etsy", "passione"
    per_chi_crea?: string[]                     // es. ["bambini", "nipoti", "amici", "regalo", "sé stesso", "cliente"]
    ha_bambini?: boolean | null
    animali_domestici?: string | null           // es. "cane", "gatto", "nessuno" — utile per progetti tematici

    // Progetti e ritmo
    progetti_in_corso?: string[]
    progetti_completati_recenti?: string[]      // ultimi completati
    tempo_disponibile?: string | null           // es. "poco (30min/giorno)", "tanto (weekend)", "sporadico"
    velocita_lavoro?: string | null             // es. "veloce", "lenta e precisa", "media"

    // Social e business
    condivide_sui_social?: boolean | null
    piattaforme_social?: string[]               // es. ["Instagram", "TikTok", "Pinterest"]
    vende_i_lavori?: boolean | null
    piattaforma_vendita?: string | null         // es. "Etsy", "mercatino", "su commissione"

    // Preferenze di interazione
    tono_preferito?: 'informale' | 'formale' | null
    preferisce_risposte_brevi?: boolean | null
    come_impara_meglio?: string | null          // es. "video", "schemi scritti", "foto passo-passo", "spiegazione verbale"

    // Difficoltà e obiettivi
    difficolta_segnalate?: string[]
    obiettivi?: string[]                        // es. ["imparare la maglia", "fare un amigurumi realistico", "schema proprio"]

    // Stile degli schemi (estratto dalle note dei progetti)
    linguaggio_schemi?: string | null           // "italiano", "inglese", "spagnolo", "misto"
    abbreviazioni_usate?: string[]              // es. ["mb", "aum", "dim", "AM"] o ["sc", "inc", "dec", "MR"]
    formato_giri?: string | null               // es. "G1:", "Giro 1:", "R1:", "Round 1:" oppure solo numero
    avviamento_preferito?: string | null       // "anello magico (AM)", "catenella di 2", "misto"
    stile_note_schemi?: string | null          // "molto dettagliato", "solo abbreviazioni", "con spiegazioni descrittive"
    struttura_tipica_personaggi?: string | null // "testa e corpo separati", "tutto in uno", "top-down"
    tecniche_speciali?: string[]               // es. ["BLO", "FLO", "surface slip stitch", "tapestry", "appliqué"]
    gauge_tipico?: string | null               // es. "cotone gasato 2.5mm, ~5 mb/cm"
    dimensioni_tipiche?: string | null         // es. "15-20cm con imbottitura media"

    // Meta
    ultimo_aggiornamento?: string
    stile_schemi_aggiornato?: string           // timestamp ultimo aggiornamento stile schemi
}

export function buildProfileBlock(profile: AiUserProfile | null): string {
    if (!profile) return ''
    // Escludi ultimo_aggiornamento e campi non informativi
    const hasContent = Object.entries(profile).some(([k, v]) =>
        k !== 'ultimo_aggiornamento' && v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0)
    )
    if (!hasContent) return ''

    const lines: string[] = ['--- PROFILO UTENTE ---']

    // Personale
    if (profile.nome) lines.push(`Nome: ${profile.nome}`)
    if (profile.eta_approssimativa) lines.push(`Età approssimativa: ${profile.eta_approssimativa}`)
    if (profile.citta_paese) lines.push(`Città/Paese: ${profile.citta_paese}`)
    if (profile.lingua_madre) lines.push(`Lingua madre: ${profile.lingua_madre}`)
    if (profile.professione) lines.push(`Professione: ${profile.professione}`)

    // Craft
    if (profile.livello) lines.push(`Livello uncinetto: ${profile.livello}`)
    if (profile.tecniche?.length) lines.push(`Tecniche: ${profile.tecniche.join(', ')}`)
    if (profile.filato_preferito) lines.push(`Filato preferito: ${profile.filato_preferito}`)
    if (profile.marca_filato_preferita) lines.push(`Marca filato preferita: ${profile.marca_filato_preferita}`)
    if (profile.uncinetto_preferito) lines.push(`Uncinetto preferito: ${profile.uncinetto_preferito}`)
    if (profile.misura_uncinetto_preferita) lines.push(`Misura uncinetto preferita: ${profile.misura_uncinetto_preferita}`)
    if (profile.stile_estetico) lines.push(`Stile estetico: ${profile.stile_estetico}`)
    if (profile.colori_preferiti?.length) lines.push(`Colori preferiti: ${profile.colori_preferiti.join(', ')}`)

    // Motivazione
    if (profile.motivazione) lines.push(`Motivazione: ${profile.motivazione}`)
    if (profile.per_chi_crea?.length) lines.push(`Crea per: ${profile.per_chi_crea.join(', ')}`)
    if (profile.ha_bambini != null) lines.push(`Ha bambini: ${profile.ha_bambini ? 'sì' : 'no'}`)
    if (profile.animali_domestici) lines.push(`Animali domestici: ${profile.animali_domestici}`)

    // Ritmo
    if (profile.progetti_in_corso?.length) lines.push(`Progetti in corso: ${profile.progetti_in_corso.join(', ')}`)
    if (profile.progetti_completati_recenti?.length) lines.push(`Completati di recente: ${profile.progetti_completati_recenti.join(', ')}`)
    if (profile.tempo_disponibile) lines.push(`Tempo disponibile: ${profile.tempo_disponibile}`)
    if (profile.velocita_lavoro) lines.push(`Velocità di lavoro: ${profile.velocita_lavoro}`)

    // Social
    if (profile.condivide_sui_social != null) lines.push(`Condivide sui social: ${profile.condivide_sui_social ? 'sì' : 'no'}`)
    if (profile.piattaforme_social?.length) lines.push(`Social: ${profile.piattaforme_social.join(', ')}`)
    if (profile.vende_i_lavori != null) lines.push(`Vende i lavori: ${profile.vende_i_lavori ? 'sì' : 'no'}`)
    if (profile.piattaforma_vendita) lines.push(`Vende su: ${profile.piattaforma_vendita}`)

    // Preferenze di interazione
    if (profile.tono_preferito) lines.push(`Tono preferito: ${profile.tono_preferito}`)
    if (profile.preferisce_risposte_brevi != null) lines.push(`Preferisce risposte brevi: ${profile.preferisce_risposte_brevi ? 'sì' : 'no'}`)
    if (profile.come_impara_meglio) lines.push(`Impara meglio con: ${profile.come_impara_meglio}`)

    // Difficoltà e obiettivi
    if (profile.difficolta_segnalate?.length) lines.push(`Difficoltà: ${profile.difficolta_segnalate.join(', ')}`)
    if (profile.obiettivi?.length) lines.push(`Obiettivi: ${profile.obiettivi.join(', ')}`)

    // Stile schemi
    const hasSchemaStyle = profile.linguaggio_schemi || profile.abbreviazioni_usate?.length
        || profile.formato_giri || profile.avviamento_preferito || profile.stile_note_schemi
        || profile.struttura_tipica_personaggi || profile.tecniche_speciali?.length
        || profile.gauge_tipico || profile.dimensioni_tipiche
    if (hasSchemaStyle) {
        lines.push('[Stile schemi — seguilo quando crei pattern:]')
        if (profile.linguaggio_schemi) lines.push(`Linguaggio schemi: ${profile.linguaggio_schemi}`)
        if (profile.abbreviazioni_usate?.length) lines.push(`Abbreviazioni usate: ${profile.abbreviazioni_usate.join(', ')}`)
        if (profile.formato_giri) lines.push(`Formato giri: ${profile.formato_giri}`)
        if (profile.avviamento_preferito) lines.push(`Avviamento preferito: ${profile.avviamento_preferito}`)
        if (profile.stile_note_schemi) lines.push(`Stile note: ${profile.stile_note_schemi}`)
        if (profile.struttura_tipica_personaggi) lines.push(`Struttura tipica: ${profile.struttura_tipica_personaggi}`)
        if (profile.tecniche_speciali?.length) lines.push(`Tecniche speciali usate: ${profile.tecniche_speciali.join(', ')}`)
        if (profile.gauge_tipico) lines.push(`Gauge tipico: ${profile.gauge_tipico}`)
        if (profile.dimensioni_tipiche) lines.push(`Dimensioni tipiche: ${profile.dimensioni_tipiche}`)
    }

    lines.push('---')
    return lines.join('\n')
}
