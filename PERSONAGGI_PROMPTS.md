# Prompt Immagini Personaggi Lurumi

Questo file contiene i prompt completi usati (o da usare) per generare le immagini
tematiche dei personaggi. Ogni immagine va caricata su Supabase Storage nel bucket
**`character-themes`** con path **`{personaggio}/{slot}.png`**.

> Dopo aver sostituito tutte le immagini, puoi eliminare questo file
> oppure aggiornare le descrizioni con quelle che ti hanno funzionato meglio.

---

## Stile comune (da aggiungere SEMPRE in fondo ad ogni prompt)

```
Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

---

## Descrizioni base dei personaggi

| Personaggio | Descrizione |
|-------------|-------------|
| **luly** | una tenera ragazza chibi con i capelli rossi ricci in due codini, che indossa una camicia bianca a maniche corte a pois e una gonna rossa, con scarpe rosse decorate con cuori |
| **babol** | una tenera ragazza chibi con i capelli ricci rosa acconciati in due codini bassi e un berretto lavorato a maglia rosa, che indossa un top blu a quadretti senza maniche sopra una gonna plissé bianca, con una piccola borsa rotonda rossa all'uncinetto sulla spalla |
| **clara** | una tenera ragazza chibi con i capelli lunghi blu navy portati in una treccia sulla spalla, un fermaglio bianco a fiore tra i capelli, che indossa un abito giallo a maniche corte ricoperto di stampe a cuori rossi con colletto e orlo smerlato bianchi |
| **tommy** | un tenero ragazzo chibi con i capelli corti castano rossastro e le guance rosate, che indossa una camicia bianca a maniche corte con il colletto e dei pantaloncini rossi con calzini bianchi e scarpe marroni |
| **derek** | un tenero ragazzo chibi con i capelli appuntiti neri e bianchi, espressione seria/severa con sopracciglia aggrottate e occhi blu, che indossa una divisa scolastica da marinaio blu navy scuro con bordi bianchi e un fazzoletto bianco |
| **sara** | una tenera ragazza chibi con i capelli arancio-auburn che arrivano alle spalle, che indossa un berretto lavorato a maglia giallo con un fiocco nero, tute gialle sopra una camicia bianca, una borsa messenger scura con testo kanji, stivali bianchi |
| **susy** | una tenera ragazza chibi con i capelli corti ondulati biondo dorato e gli occhi azzurri luminosi, che indossa una camicetta bianca a maniche corte e un abito verde con un fiocco verde al colletto e scarpe verdi Mary Jane con fiocchi bianchi |

---

## Slot 1 — `welcome`
*Usato in: pagina Progetti (header), pagina di benvenuto*
*Path Supabase: `{personaggio}/welcome.png`*

**Azione:** saluta con la mano, tiene in mano un orsetto amigurumi

```
[DESC_PERSONAGGIO], che saluta allegramente con una mano alzata in gesto di saluto,
tenendo in mano un piccolo orsetto amigurumi all'uncinetto fatto a mano nell'altra.
Espressione: grande sorriso felice, accogliente e amichevole.
[+ STILE COMUNE]
```

### Prompt completi per welcome

**luly/welcome.png**
```
una tenera ragazza chibi con i capelli rossi ricci in due codini, che indossa una camicia bianca a maniche corte a pois e una gonna rossa, con scarpe rosse decorate con cuori, che saluta allegramente con una mano alzata in gesto di saluto, tenendo in mano un piccolo orsetto amigurumi all'uncinetto fatto a mano nell'altra. Espressione: grande sorriso felice, accogliente e amichevole. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**babol/welcome.png**
```
una tenera ragazza chibi con i capelli ricci rosa acconciati in due codini bassi e un berretto lavorato a maglia rosa, che indossa un top blu a quadretti senza maniche sopra una gonna plissé bianca, con una piccola borsa rotonda rossa all'uncinetto sulla spalla, che saluta allegramente con una mano alzata in gesto di saluto, tenendo in mano un piccolo orsetto amigurumi all'uncinetto fatto a mano nell'altra. Espressione: grande sorriso felice, accogliente e amichevole. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**clara/welcome.png**
```
una tenera ragazza chibi con i capelli lunghi blu navy portati in una treccia sulla spalla, un fermaglio bianco a fiore tra i capelli, che indossa un abito giallo a maniche corte ricoperto di stampe a cuori rossi con colletto e orlo smerlato bianchi, che saluta allegramente con una mano alzata in gesto di saluto, tenendo in mano un piccolo orsetto amigurumi all'uncinetto fatto a mano nell'altra. Espressione: grande sorriso felice, accogliente e amichevole. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**tommy/welcome.png**
```
un tenero ragazzo chibi con i capelli corti castano rossastro e le guance rosate, che indossa una camicia bianca a maniche corte con il colletto e dei pantaloncini rossi con calzini bianchi e scarpe marroni, che saluta allegramente con una mano alzata in gesto di saluto, tenendo in mano un piccolo orsetto amigurumi all'uncinetto fatto a mano nell'altra. Espressione: grande sorriso felice, accogliente e amichevole. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**derek/welcome.png**
```
un tenero ragazzo chibi con i capelli appuntiti neri e bianchi, espressione seria/severa con sopracciglia aggrottate e occhi blu, che indossa una divisa scolastica da marinaio blu navy scuro con bordi bianchi e un fazzoletto bianco, che saluta allegramente con una mano alzata in gesto di saluto, tenendo in mano un piccolo orsetto amigurumi all'uncinetto fatto a mano nell'altra. Espressione: grande sorriso felice, accogliente e amichevole. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**sara/welcome.png**
```
una tenera ragazza chibi con i capelli arancio-auburn che arrivano alle spalle, che indossa un berretto lavorato a maglia giallo con un fiocco nero, tute gialle sopra una camicia bianca, una borsa messenger scura con testo kanji, stivali bianchi, che saluta allegramente con una mano alzata in gesto di saluto, tenendo in mano un piccolo orsetto amigurumi all'uncinetto fatto a mano nell'altra. Espressione: grande sorriso felice, accogliente e amichevole. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**susy/welcome.png**
```
una tenera ragazza chibi con i capelli corti ondulati biondo dorato e gli occhi azzurri luminosi, che indossa una camicetta bianca a maniche corte e un abito verde con un fiocco verde al colletto e scarpe verdi Mary Jane con fiocchi bianchi, che saluta allegramente con una mano alzata in gesto di saluto, tenendo in mano un piccolo orsetto amigurumi all'uncinetto fatto a mano nell'altra. Espressione: grande sorriso felice, accogliente e amichevole. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

---

## Slot 2 — `projects_empty`
*Usato in: pagina Progetti (stato vuoto)*
*Path Supabase: `{personaggio}/projects_empty.png`*

**Azione:** seduta a un tavolo da lavoro con uncinetto e gomitolo

```
[DESC_PERSONAGGIO], seduta a un piccolo tavolo da lavoro, tiene un uncinetto in una
mano e un gomitolo colorato nell'altra, guardando eccitata e pronta a iniziare a
creare. Un progetto all'uncinetto a metà lavoro è sul tavolo.
Espressione: entusiasta e ansiosa di iniziare.
[+ STILE COMUNE]
```

### Prompt completi per projects_empty

**luly/projects_empty.png**
```
una tenera ragazza chibi con i capelli rossi ricci in due codini, che indossa una camicia bianca a maniche corte a pois e una gonna rossa, con scarpe rosse decorate con cuori, seduta a un piccolo tavolo da lavoro, che tiene un uncinetto in una mano e un gomitolo colorato nell'altra, guardando eccitata e pronta a iniziare a creare. Un progetto all'uncinetto a metà lavoro è sul tavolo. Espressione: entusiasta e ansiosa di iniziare. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**babol/projects_empty.png**
```
una tenera ragazza chibi con i capelli ricci rosa acconciati in due codini bassi e un berretto lavorato a maglia rosa, che indossa un top blu a quadretti senza maniche sopra una gonna plissé bianca, con una piccola borsa rotonda rossa all'uncinetto sulla spalla, seduta a un piccolo tavolo da lavoro, che tiene un uncinetto in una mano e un gomitolo colorato nell'altra, guardando eccitata e pronta a iniziare a creare. Un progetto all'uncinetto a metà lavoro è sul tavolo. Espressione: entusiasta e ansiosa di iniziare. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**clara/projects_empty.png**
```
una tenera ragazza chibi con i capelli lunghi blu navy portati in una treccia sulla spalla, un fermaglio bianco a fiore tra i capelli, che indossa un abito giallo a maniche corte ricoperto di stampe a cuori rossi con colletto e orlo smerlato bianchi, seduta a un piccolo tavolo da lavoro, che tiene un uncinetto in una mano e un gomitolo colorato nell'altra, guardando eccitata e pronta a iniziare a creare. Un progetto all'uncinetto a metà lavoro è sul tavolo. Espressione: entusiasta e ansiosa di iniziare. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**tommy/projects_empty.png**
```
un tenero ragazzo chibi con i capelli corti castano rossastro e le guance rosate, che indossa una camicia bianca a maniche corte con il colletto e dei pantaloncini rossi con calzini bianchi e scarpe marroni, seduto a un piccolo tavolo da lavoro, che tiene un uncinetto in una mano e un gomitolo colorato nell'altra, guardando eccitato e pronto a iniziare a creare. Un progetto all'uncinetto a metà lavoro è sul tavolo. Espressione: entusiasta e ansioso di iniziare. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**derek/projects_empty.png**
```
un tenero ragazzo chibi con i capelli appuntiti neri e bianchi, espressione seria/severa con sopracciglia aggrottate e occhi blu, che indossa una divisa scolastica da marinaio blu navy scuro con bordi bianchi e un fazzoletto bianco, seduto a un piccolo tavolo da lavoro, che tiene un uncinetto in una mano e un gomitolo colorato nell'altra, guardando eccitato e pronto a iniziare a creare. Un progetto all'uncinetto a metà lavoro è sul tavolo. Espressione: entusiasta e ansioso di iniziare. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**sara/projects_empty.png**
```
una tenera ragazza chibi con i capelli arancio-auburn che arrivano alle spalle, che indossa un berretto lavorato a maglia giallo con un fiocco nero, tute gialle sopra una camicia bianca, una borsa messenger scura con testo kanji, stivali bianchi, seduta a un piccolo tavolo da lavoro, che tiene un uncinetto in una mano e un gomitolo colorato nell'altra, guardando eccitata e pronta a iniziare a creare. Un progetto all'uncinetto a metà lavoro è sul tavolo. Espressione: entusiasta e ansiosa di iniziare. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**susy/projects_empty.png**
```
una tenera ragazza chibi con i capelli corti ondulati biondo dorato e gli occhi azzurri luminosi, che indossa una camicetta bianca a maniche corte e un abito verde con un fiocco verde al colletto e scarpe verdi Mary Jane con fiocchi bianchi, seduta a un piccolo tavolo da lavoro, che tiene un uncinetto in una mano e un gomitolo colorato nell'altra, guardando eccitata e pronta a iniziare a creare. Un progetto all'uncinetto a metà lavoro è sul tavolo. Espressione: entusiasta e ansiosa di iniziare. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

---

## Slot 3 — `tutorials_empty`
*Usato in: pagina Tutorial (stato vuoto)*
*Path Supabase: `{personaggio}/tutorials_empty.png`*

**Azione:** tiene in mano un tablet con un video player

```
[DESC_PERSONAGGIO], che tiene in mano un piccolo tablet che mostra un video player
con un pulsante di riproduzione, guardando curiosa e interessata allo schermo.
Espressione: studiosa, curiosa e attenta.
[+ STILE COMUNE]
```

### Prompt completi per tutorials_empty

**luly/tutorials_empty.png**
```
una tenera ragazza chibi con i capelli rossi ricci in due codini, che indossa una camicia bianca a maniche corte a pois e una gonna rossa, con scarpe rosse decorate con cuori, che tiene in mano un piccolo tablet che mostra un video player con un pulsante di riproduzione, guardando curiosa e interessata allo schermo. Espressione: studiosa, curiosa e attenta. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**babol/tutorials_empty.png**
```
una tenera ragazza chibi con i capelli ricci rosa acconciati in due codini bassi e un berretto lavorato a maglia rosa, che indossa un top blu a quadretti senza maniche sopra una gonna plissé bianca, con una piccola borsa rotonda rossa all'uncinetto sulla spalla, che tiene in mano un piccolo tablet che mostra un video player con un pulsante di riproduzione, guardando curiosa e interessata allo schermo. Espressione: studiosa, curiosa e attenta. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**clara/tutorials_empty.png**
```
una tenera ragazza chibi con i capelli lunghi blu navy portati in una treccia sulla spalla, un fermaglio bianco a fiore tra i capelli, che indossa un abito giallo a maniche corte ricoperto di stampe a cuori rossi con colletto e orlo smerlato bianchi, che tiene in mano un piccolo tablet che mostra un video player con un pulsante di riproduzione, guardando curiosa e interessata allo schermo. Espressione: studiosa, curiosa e attenta. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**tommy/tutorials_empty.png**
```
un tenero ragazzo chibi con i capelli corti castano rossastro e le guance rosate, che indossa una camicia bianca a maniche corte con il colletto e dei pantaloncini rossi con calzini bianchi e scarpe marroni, che tiene in mano un piccolo tablet che mostra un video player con un pulsante di riproduzione, guardando curioso e interessato allo schermo. Espressione: studioso, curioso e attento. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**derek/tutorials_empty.png**
```
un tenero ragazzo chibi con i capelli appuntiti neri e bianchi, espressione seria/severa con sopracciglia aggrottate e occhi blu, che indossa una divisa scolastica da marinaio blu navy scuro con bordi bianchi e un fazzoletto bianco, che tiene in mano un piccolo tablet che mostra un video player con un pulsante di riproduzione, guardando curioso e interessato allo schermo. Espressione: studioso, curioso e attento. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**sara/tutorials_empty.png**
```
una tenera ragazza chibi con i capelli arancio-auburn che arrivano alle spalle, che indossa un berretto lavorato a maglia giallo con un fiocco nero, tute gialle sopra una camicia bianca, una borsa messenger scura con testo kanji, stivali bianchi, che tiene in mano un piccolo tablet che mostra un video player con un pulsante di riproduzione, guardando curiosa e interessata allo schermo. Espressione: studiosa, curiosa e attenta. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**susy/tutorials_empty.png**
```
una tenera ragazza chibi con i capelli corti ondulati biondo dorato e gli occhi azzurri luminosi, che indossa una camicetta bianca a maniche corte e un abito verde con un fiocco verde al colletto e scarpe verdi Mary Jane con fiocchi bianchi, che tiene in mano un piccolo tablet che mostra un video player con un pulsante di riproduzione, guardando curiosa e interessata allo schermo. Espressione: studiosa, curiosa e attenta. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

---

## Slot 4 — `tool_designer`
*Usato in: card strumento "Designer AI"*
*Path Supabase: `{personaggio}/tool_designer.png`*

**Azione:** tiene una tavolozza e un pennello, scintille colorate attorno

```
[DESC_PERSONAGGIO], che tiene una tavolozza per artisti in una mano e un grande
pennello nell'altra, circondata da scintille colorate fluttuanti e piccole stelle.
Espressione: creativa e concentrata, con la testa leggermente inclinata.
[+ STILE COMUNE]
```

### Prompt completi per tool_designer

**luly/tool_designer.png**
```
una tenera ragazza chibi con i capelli rossi ricci in due codini, che indossa una camicia bianca a maniche corte a pois e una gonna rossa, con scarpe rosse decorate con cuori, che tiene una tavolozza per artisti in una mano e un grande pennello nell'altra, circondata da scintille colorate fluttuanti e piccole stelle. Espressione: creativa e concentrata, con la testa leggermente inclinata. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**babol/tool_designer.png**
```
una tenera ragazza chibi con i capelli ricci rosa acconciati in due codini bassi e un berretto lavorato a maglia rosa, che indossa un top blu a quadretti senza maniche sopra una gonna plissé bianca, con una piccola borsa rotonda rossa all'uncinetto sulla spalla, che tiene una tavolozza per artisti in una mano e un grande pennello nell'altra, circondata da scintille colorate fluttuanti e piccole stelle. Espressione: creativa e concentrata, con la testa leggermente inclinata. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**clara/tool_designer.png**
```
una tenera ragazza chibi con i capelli lunghi blu navy portati in una treccia sulla spalla, un fermaglio bianco a fiore tra i capelli, che indossa un abito giallo a maniche corte ricoperto di stampe a cuori rossi con colletto e orlo smerlato bianchi, che tiene una tavolozza per artisti in una mano e un grande pennello nell'altra, circondata da scintille colorate fluttuanti e piccole stelle. Espressione: creativa e concentrata, con la testa leggermente inclinata. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**tommy/tool_designer.png**
```
un tenero ragazzo chibi con i capelli corti castano rossastro e le guance rosate, che indossa una camicia bianca a maniche corte con il colletto e dei pantaloncini rossi con calzini bianchi e scarpe marroni, che tiene una tavolozza per artisti in una mano e un grande pennello nell'altra, circondato da scintille colorate fluttuanti e piccole stelle. Espressione: creativo e concentrato, con la testa leggermente inclinata. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**derek/tool_designer.png**
```
un tenero ragazzo chibi con i capelli appuntiti neri e bianchi, espressione seria/severa con sopracciglia aggrottate e occhi blu, che indossa una divisa scolastica da marinaio blu navy scuro con bordi bianchi e un fazzoletto bianco, che tiene una tavolozza per artisti in una mano e un grande pennello nell'altra, circondato da scintille colorate fluttuanti e piccole stelle. Espressione: creativo e concentrato, con la testa leggermente inclinata. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**sara/tool_designer.png**
```
una tenera ragazza chibi con i capelli arancio-auburn che arrivano alle spalle, che indossa un berretto lavorato a maglia giallo con un fiocco nero, tute gialle sopra una camicia bianca, una borsa messenger scura con testo kanji, stivali bianchi, che tiene una tavolozza per artisti in una mano e un grande pennello nell'altra, circondata da scintille colorate fluttuanti e piccole stelle. Espressione: creativa e concentrata, con la testa leggermente inclinata. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**susy/tool_designer.png**
```
una tenera ragazza chibi con i capelli corti ondulati biondo dorato e gli occhi azzurri luminosi, che indossa una camicetta bianca a maniche corte e un abito verde con un fiocco verde al colletto e scarpe verdi Mary Jane con fiocchi bianchi, che tiene una tavolozza per artisti in una mano e un grande pennello nell'altra, circondata da scintille colorate fluttuanti e piccole stelle. Espressione: creativa e concentrata, con la testa leggermente inclinata. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

---

## Slot 5 — `tool_chat`
*Usato in: card strumento "Chat AI"*
*Path Supabase: `{personaggio}/tool_chat.png`*

**Azione:** parla con un piccolo robot rotondo, fumetto con "..."

```
[DESC_PERSONAGGIO], che parla allegramente con un piccolo simpatico robot rotondo
che le sta accanto, con un fumetto che contiene tre puntini (indicatore di digitazione).
Espressione: vivace, amichevole, nel mezzo di una conversazione.
[+ STILE COMUNE]
```

### Prompt completi per tool_chat

**luly/tool_chat.png**
```
una tenera ragazza chibi con i capelli rossi ricci in due codini, che indossa una camicia bianca a maniche corte a pois e una gonna rossa, con scarpe rosse decorate con cuori, che parla allegramente con un piccolo simpatico robot rotondo che le sta accanto, con un fumetto che contiene tre puntini (indicatore di digitazione). Espressione: vivace, amichevole, nel mezzo di una conversazione. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**babol/tool_chat.png**
```
una tenera ragazza chibi con i capelli ricci rosa acconciati in due codini bassi e un berretto lavorato a maglia rosa, che indossa un top blu a quadretti senza maniche sopra una gonna plissé bianca, con una piccola borsa rotonda rossa all'uncinetto sulla spalla, che parla allegramente con un piccolo simpatico robot rotondo che le sta accanto, con un fumetto che contiene tre puntini (indicatore di digitazione). Espressione: vivace, amichevole, nel mezzo di una conversazione. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**clara/tool_chat.png**
```
una tenera ragazza chibi con i capelli lunghi blu navy portati in una treccia sulla spalla, un fermaglio bianco a fiore tra i capelli, che indossa un abito giallo a maniche corte ricoperto di stampe a cuori rossi con colletto e orlo smerlato bianchi, che parla allegramente con un piccolo simpatico robot rotondo che le sta accanto, con un fumetto che contiene tre puntini (indicatore di digitazione). Espressione: vivace, amichevole, nel mezzo di una conversazione. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**tommy/tool_chat.png**
```
un tenero ragazzo chibi con i capelli corti castano rossastro e le guance rosate, che indossa una camicia bianca a maniche corte con il colletto e dei pantaloncini rossi con calzini bianchi e scarpe marroni, che parla allegramente con un piccolo simpatico robot rotondo che gli sta accanto, con un fumetto che contiene tre puntini (indicatore di digitazione). Espressione: vivace, amichevole, nel mezzo di una conversazione. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**derek/tool_chat.png**
```
un tenero ragazzo chibi con i capelli appuntiti neri e bianchi, espressione seria/severa con sopracciglia aggrottate e occhi blu, che indossa una divisa scolastica da marinaio blu navy scuro con bordi bianchi e un fazzoletto bianco, che parla allegramente con un piccolo simpatico robot rotondo che gli sta accanto, con un fumetto che contiene tre puntini (indicatore di digitazione). Espressione: vivace, amichevole, nel mezzo di una conversazione. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**sara/tool_chat.png**
```
una tenera ragazza chibi con i capelli arancio-auburn che arrivano alle spalle, che indossa un berretto lavorato a maglia giallo con un fiocco nero, tute gialle sopra una camicia bianca, una borsa messenger scura con testo kanji, stivali bianchi, che parla allegramente con un piccolo simpatico robot rotondo che le sta accanto, con un fumetto che contiene tre puntini (indicatore di digitazione). Espressione: vivace, amichevole, nel mezzo di una conversazione. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**susy/tool_chat.png**
```
una tenera ragazza chibi con i capelli corti ondulati biondo dorato e gli occhi azzurri luminosi, che indossa una camicetta bianca a maniche corte e un abito verde con un fiocco verde al colletto e scarpe verdi Mary Jane con fiocchi bianchi, che parla allegramente con un piccolo simpatico robot rotondo che le sta accanto, con un fumetto che contiene tre puntini (indicatore di digitazione). Espressione: vivace, amichevole, nel mezzo di una conversazione. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

---

## Slot 6 — `tool_books`
*Usato in: card strumento "Biblioteca / Guide"*
*Path Supabase: `{personaggio}/tool_books.png`*

**Azione:** tiene un libro aperto, libri e gomitoli fluttuanti attorno

```
[DESC_PERSONAGGIO], che tiene un grande libro colorato aperto e sorride felice
alla telecamera, circondata da piccoli libri fluttuanti e gomitoli di lana.
Espressione: gioiosa ed entusiasta della lettura.
[+ STILE COMUNE]
```

### Prompt completi per tool_books

**luly/tool_books.png**
```
una tenera ragazza chibi con i capelli rossi ricci in due codini, che indossa una camicia bianca a maniche corte a pois e una gonna rossa, con scarpe rosse decorate con cuori, che tiene un grande libro colorato aperto e sorride felice alla telecamera, circondata da piccoli libri fluttuanti e gomitoli di lana. Espressione: gioiosa ed entusiasta della lettura. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**babol/tool_books.png**
```
una tenera ragazza chibi con i capelli ricci rosa acconciati in due codini bassi e un berretto lavorato a maglia rosa, che indossa un top blu a quadretti senza maniche sopra una gonna plissé bianca, con una piccola borsa rotonda rossa all'uncinetto sulla spalla, che tiene un grande libro colorato aperto e sorride felice alla telecamera, circondata da piccoli libri fluttuanti e gomitoli di lana. Espressione: gioiosa ed entusiasta della lettura. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**clara/tool_books.png**
```
una tenera ragazza chibi con i capelli lunghi blu navy portati in una treccia sulla spalla, un fermaglio bianco a fiore tra i capelli, che indossa un abito giallo a maniche corte ricoperto di stampe a cuori rossi con colletto e orlo smerlato bianchi, che tiene un grande libro colorato aperto e sorride felice alla telecamera, circondata da piccoli libri fluttuanti e gomitoli di lana. Espressione: gioiosa ed entusiasta della lettura. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**tommy/tool_books.png**
```
un tenero ragazzo chibi con i capelli corti castano rossastro e le guance rosate, che indossa una camicia bianca a maniche corte con il colletto e dei pantaloncini rossi con calzini bianchi e scarpe marroni, che tiene un grande libro colorato aperto e sorride felice alla telecamera, circondato da piccoli libri fluttuanti e gomitoli di lana. Espressione: gioioso ed entusiasta della lettura. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**derek/tool_books.png**
```
un tenero ragazzo chibi con i capelli appuntiti neri e bianchi, espressione seria/severa con sopracciglia aggrottate e occhi blu, che indossa una divisa scolastica da marinaio blu navy scuro con bordi bianchi e un fazzoletto bianco, che tiene un grande libro colorato aperto e sorride felice alla telecamera, circondato da piccoli libri fluttuanti e gomitoli di lana. Espressione: gioioso ed entusiasta della lettura. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**sara/tool_books.png**
```
una tenera ragazza chibi con i capelli arancio-auburn che arrivano alle spalle, che indossa un berretto lavorato a maglia giallo con un fiocco nero, tute gialle sopra una camicia bianca, una borsa messenger scura con testo kanji, stivali bianchi, che tiene un grande libro colorato aperto e sorride felice alla telecamera, circondata da piccoli libri fluttuanti e gomitoli di lana. Espressione: gioiosa ed entusiasta della lettura. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**susy/tool_books.png**
```
una tenera ragazza chibi con i capelli corti ondulati biondo dorato e gli occhi azzurri luminosi, che indossa una camicetta bianca a maniche corte e un abito verde con un fiocco verde al colletto e scarpe verdi Mary Jane con fiocchi bianchi, che tiene un grande libro colorato aperto e sorride felice alla telecamera, circondata da piccoli libri fluttuanti e gomitoli di lana. Espressione: gioiosa ed entusiasta della lettura. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

---

## Slot 7 — `tool_timer`
*Usato in: card strumento "Timer / Contarighe"*
*Path Supabase: `{personaggio}/tool_timer.png`*

**Azione:** tiene un cronometro, conta con le dita, gomitolo ai piedi

```
[DESC_PERSONAGGIO], che tiene un cronometro rotondo in una mano alzata mentre conta
i punti con le dita dell'altra mano, un piccolo gomitolo colorato ai piedi.
Espressione: concentrata e focalizzata, con la lingua leggermente fuori.
[+ STILE COMUNE]
```

### Prompt completi per tool_timer

**luly/tool_timer.png**
```
una tenera ragazza chibi con i capelli rossi ricci in due codini, che indossa una camicia bianca a maniche corte a pois e una gonna rossa, con scarpe rosse decorate con cuori, che tiene un cronometro rotondo in una mano alzata mentre conta i punti con le dita dell'altra mano, un piccolo gomitolo colorato ai piedi. Espressione: concentrata e focalizzata, con la lingua leggermente fuori. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**babol/tool_timer.png**
```
una tenera ragazza chibi con i capelli ricci rosa acconciati in due codini bassi e un berretto lavorato a maglia rosa, che indossa un top blu a quadretti senza maniche sopra una gonna plissé bianca, con una piccola borsa rotonda rossa all'uncinetto sulla spalla, che tiene un cronometro rotondo in una mano alzata mentre conta i punti con le dita dell'altra mano, un piccolo gomitolo colorato ai piedi. Espressione: concentrata e focalizzata, con la lingua leggermente fuori. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**clara/tool_timer.png**
```
una tenera ragazza chibi con i capelli lunghi blu navy portati in una treccia sulla spalla, un fermaglio bianco a fiore tra i capelli, che indossa un abito giallo a maniche corte ricoperto di stampe a cuori rossi con colletto e orlo smerlato bianchi, che tiene un cronometro rotondo in una mano alzata mentre conta i punti con le dita dell'altra mano, un piccolo gomitolo colorato ai piedi. Espressione: concentrata e focalizzata, con la lingua leggermente fuori. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**tommy/tool_timer.png**
```
un tenero ragazzo chibi con i capelli corti castano rossastro e le guance rosate, che indossa una camicia bianca a maniche corte con il colletto e dei pantaloncini rossi con calzini bianchi e scarpe marroni, che tiene un cronometro rotondo in una mano alzata mentre conta i punti con le dita dell'altra mano, un piccolo gomitolo colorato ai piedi. Espressione: concentrato e focalizzato, con la lingua leggermente fuori. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**derek/tool_timer.png**
```
un tenero ragazzo chibi con i capelli appuntiti neri e bianchi, espressione seria/severa con sopracciglia aggrottate e occhi blu, che indossa una divisa scolastica da marinaio blu navy scuro con bordi bianchi e un fazzoletto bianco, che tiene un cronometro rotondo in una mano alzata mentre conta i punti con le dita dell'altra mano, un piccolo gomitolo colorato ai piedi. Espressione: concentrato e focalizzato, con la lingua leggermente fuori. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**sara/tool_timer.png**
```
una tenera ragazza chibi con i capelli arancio-auburn che arrivano alle spalle, che indossa un berretto lavorato a maglia giallo con un fiocco nero, tute gialle sopra una camicia bianca, una borsa messenger scura con testo kanji, stivali bianchi, che tiene un cronometro rotondo in una mano alzata mentre conta i punti con le dita dell'altra mano, un piccolo gomitolo colorato ai piedi. Espressione: concentrata e focalizzata, con la lingua leggermente fuori. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**susy/tool_timer.png**
```
una tenera ragazza chibi con i capelli corti ondulati biondo dorato e gli occhi azzurri luminosi, che indossa una camicetta bianca a maniche corte e un abito verde con un fiocco verde al colletto e scarpe verdi Mary Jane con fiocchi bianchi, che tiene un cronometro rotondo in una mano alzata mentre conta i punti con le dita dell'altra mano, un piccolo gomitolo colorato ai piedi. Espressione: concentrata e focalizzata, con la lingua leggermente fuori. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

---

## Slot 8 — `tool_notes`
*Usato in: card strumento "Note"*
*Path Supabase: `{personaggio}/tool_notes.png`*

**Azione:** scrive su un quaderno a spirale, post-it colorati attorno

```
[DESC_PERSONAGGIO], che scrive su un quaderno a spirale colorato aperto con una matita,
circondata da piccoli post-it color pastello con scarabocchi di gomitoli e uncinetti.
Espressione: pensierosa e creativa.
[+ STILE COMUNE]
```

### Prompt completi per tool_notes

**luly/tool_notes.png**
```
una tenera ragazza chibi con i capelli rossi ricci in due codini, che indossa una camicia bianca a maniche corte a pois e una gonna rossa, con scarpe rosse decorate con cuori, che scrive su un quaderno a spirale colorato aperto con una matita, circondata da piccoli post-it color pastello con scarabocchi di gomitoli e uncinetti. Espressione: pensierosa e creativa. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**babol/tool_notes.png**
```
una tenera ragazza chibi con i capelli ricci rosa acconciati in due codini bassi e un berretto lavorato a maglia rosa, che indossa un top blu a quadretti senza maniche sopra una gonna plissé bianca, con una piccola borsa rotonda rossa all'uncinetto sulla spalla, che scrive su un quaderno a spirale colorato aperto con una matita, circondata da piccoli post-it color pastello con scarabocchi di gomitoli e uncinetti. Espressione: pensierosa e creativa. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**clara/tool_notes.png**
```
una tenera ragazza chibi con i capelli lunghi blu navy portati in una treccia sulla spalla, un fermaglio bianco a fiore tra i capelli, che indossa un abito giallo a maniche corte ricoperto di stampe a cuori rossi con colletto e orlo smerlato bianchi, che scrive su un quaderno a spirale colorato aperto con una matita, circondata da piccoli post-it color pastello con scarabocchi di gomitoli e uncinetti. Espressione: pensierosa e creativa. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**tommy/tool_notes.png**
```
un tenero ragazzo chibi con i capelli corti castano rossastro e le guance rosate, che indossa una camicia bianca a maniche corte con il colletto e dei pantaloncini rossi con calzini bianchi e scarpe marroni, che scrive su un quaderno a spirale colorato aperto con una matita, circondato da piccoli post-it color pastello con scarabocchi di gomitoli e uncinetti. Espressione: pensieroso e creativo. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**derek/tool_notes.png**
```
un tenero ragazzo chibi con i capelli appuntiti neri e bianchi, espressione seria/severa con sopracciglia aggrottate e occhi blu, che indossa una divisa scolastica da marinaio blu navy scuro con bordi bianchi e un fazzoletto bianco, che scrive su un quaderno a spirale colorato aperto con una matita, circondato da piccoli post-it color pastello con scarabocchi di gomitoli e uncinetti. Espressione: pensieroso e creativo. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**sara/tool_notes.png**
```
una tenera ragazza chibi con i capelli arancio-auburn che arrivano alle spalle, che indossa un berretto lavorato a maglia giallo con un fiocco nero, tute gialle sopra una camicia bianca, una borsa messenger scura con testo kanji, stivali bianchi, che scrive su un quaderno a spirale colorato aperto con una matita, circondata da piccoli post-it color pastello con scarabocchi di gomitoli e uncinetti. Espressione: pensierosa e creativa. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**susy/tool_notes.png** ⚠️ *sfondo bianco — da sostituire*
```
una tenera ragazza chibi con i capelli corti ondulati biondo dorato e gli occhi azzurri luminosi, che indossa una camicetta bianca a maniche corte e un abito verde con un fiocco verde al colletto e scarpe verdi Mary Jane con fiocchi bianchi, che scrive su un quaderno a spirale colorato aperto con una matita, circondata da piccoli post-it color pastello con scarabocchi di gomitoli e uncinetti. Espressione: pensierosa e creativa. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

---

## Slot 9 — `tool_courses`
*Usato in: card strumento "Corsi"*
*Path Supabase: `{personaggio}/tool_courses.png`*

**Azione:** cappello da laureata, tiene un diploma arrotolato

```
[DESC_PERSONAGGIO], che indossa un cappello da laurea nero sulla testa, e tiene
orgogliosamente un diploma arrotolato legato con un nastro.
Espressione: orgogliosa e soddisfatta, grande sorriso.
[+ STILE COMUNE]
```

### Prompt completi per tool_courses

**luly/tool_courses.png**
```
una tenera ragazza chibi con i capelli rossi ricci in due codini, che indossa una camicia bianca a maniche corte a pois e una gonna rossa, con scarpe rosse decorate con cuori, che indossa un cappello da laurea nero sulla testa e tiene orgogliosamente un diploma arrotolato legato con un nastro. Espressione: orgogliosa e soddisfatta, grande sorriso. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**babol/tool_courses.png**
```
una tenera ragazza chibi con i capelli ricci rosa acconciati in due codini bassi e un berretto lavorato a maglia rosa, che indossa un top blu a quadretti senza maniche sopra una gonna plissé bianca, con una piccola borsa rotonda rossa all'uncinetto sulla spalla, che indossa un cappello da laurea nero sulla testa e tiene orgogliosamente un diploma arrotolato legato con un nastro. Espressione: orgogliosa e soddisfatta, grande sorriso. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**clara/tool_courses.png**
```
una tenera ragazza chibi con i capelli lunghi blu navy portati in una treccia sulla spalla, un fermaglio bianco a fiore tra i capelli, che indossa un abito giallo a maniche corte ricoperto di stampe a cuori rossi con colletto e orlo smerlato bianchi, che indossa un cappello da laurea nero sulla testa e tiene orgogliosamente un diploma arrotolato legato con un nastro. Espressione: orgogliosa e soddisfatta, grande sorriso. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**tommy/tool_courses.png**
```
un tenero ragazzo chibi con i capelli corti castano rossastro e le guance rosate, che indossa una camicia bianca a maniche corte con il colletto e dei pantaloncini rossi con calzini bianchi e scarpe marroni, che indossa un cappello da laurea nero sulla testa e tiene orgogliosamente un diploma arrotolato legato con un nastro. Espressione: orgoglioso e soddisfatto, grande sorriso. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**derek/tool_courses.png**
```
un tenero ragazzo chibi con i capelli appuntiti neri e bianchi, espressione seria/severa con sopracciglia aggrottate e occhi blu, che indossa una divisa scolastica da marinaio blu navy scuro con bordi bianchi e un fazzoletto bianco, che indossa un cappello da laurea nero sulla testa e tiene orgogliosamente un diploma arrotolato legato con un nastro. Espressione: orgoglioso e soddisfatto, grande sorriso. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**sara/tool_courses.png**
```
una tenera ragazza chibi con i capelli arancio-auburn che arrivano alle spalle, che indossa un berretto lavorato a maglia giallo con un fiocco nero, tute gialle sopra una camicia bianca, una borsa messenger scura con testo kanji, stivali bianchi, che indossa un cappello da laurea nero sulla testa e tiene orgogliosamente un diploma arrotolato legato con un nastro. Espressione: orgogliosa e soddisfatta, grande sorriso. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**susy/tool_courses.png** ⚠️ *immagine mancante — da caricare*
```
una tenera ragazza chibi con i capelli corti ondulati biondo dorato e gli occhi azzurri luminosi, che indossa una camicetta bianca a maniche corte e un abito verde con un fiocco verde al colletto e scarpe verdi Mary Jane con fiocchi bianchi, che indossa un cappello da laurea nero sulla testa e tiene orgogliosamente un diploma arrotolato legato con un nastro. Espressione: orgogliosa e soddisfatta, grande sorriso. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

---

## Slot 10 — `profile`
*Usato in: pagina Profilo (greeting) + selettore personaggio*
*Path Supabase: `{personaggio}/profile.png`*

**Azione:** posa da supereroe con le mani sui fianchi, badge/stella sul petto

```
[DESC_PERSONAGGIO], in posa da supereroe fiero/a con le mani sui fianchi,
con un piccolo badge/medaglia a stella brillante appuntato sul petto.
Espressione: sicura di sé, orgogliosa e felice.
[+ STILE COMUNE]
```

### Prompt completi per profile

**luly/profile.png**
```
una tenera ragazza chibi con i capelli rossi ricci in due codini, che indossa una camicia bianca a maniche corte a pois e una gonna rossa, con scarpe rosse decorate con cuori, in posa da supereroe fiera con le mani sui fianchi, con un piccolo badge/medaglia a stella brillante appuntato sul petto. Espressione: sicura di sé, orgogliosa e felice. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**babol/profile.png**
```
una tenera ragazza chibi con i capelli ricci rosa acconciati in due codini bassi e un berretto lavorato a maglia rosa, che indossa un top blu a quadretti senza maniche sopra una gonna plissé bianca, con una piccola borsa rotonda rossa all'uncinetto sulla spalla, in posa da supereroe fiera con le mani sui fianchi, con un piccolo badge/medaglia a stella brillante appuntato sul petto. Espressione: sicura di sé, orgogliosa e felice. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**clara/profile.png**
```
una tenera ragazza chibi con i capelli lunghi blu navy portati in una treccia sulla spalla, un fermaglio bianco a fiore tra i capelli, che indossa un abito giallo a maniche corte ricoperto di stampe a cuori rossi con colletto e orlo smerlato bianchi, in posa da supereroe fiera con le mani sui fianchi, con un piccolo badge/medaglia a stella brillante appuntato sul petto. Espressione: sicura di sé, orgogliosa e felice. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**tommy/profile.png**
```
un tenero ragazzo chibi con i capelli corti castano rossastro e le guance rosate, che indossa una camicia bianca a maniche corte con il colletto e dei pantaloncini rossi con calzini bianchi e scarpe marroni, in posa da supereroe fiero con le mani sui fianchi, con un piccolo badge/medaglia a stella brillante appuntato sul petto. Espressione: sicuro di sé, orgoglioso e felice. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**derek/profile.png**
```
un tenero ragazzo chibi con i capelli appuntiti neri e bianchi, espressione seria/severa con sopracciglia aggrottate e occhi blu, che indossa una divisa scolastica da marinaio blu navy scuro con bordi bianchi e un fazzoletto bianco, in posa da supereroe fiero con le mani sui fianchi, con un piccolo badge/medaglia a stella brillante appuntato sul petto. Espressione: sicuro di sé, orgoglioso e felice. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**sara/profile.png**
```
una tenera ragazza chibi con i capelli arancio-auburn che arrivano alle spalle, che indossa un berretto lavorato a maglia giallo con un fiocco nero, tute gialle sopra una camicia bianca, una borsa messenger scura con testo kanji, stivali bianchi, in posa da supereroe fiera con le mani sui fianchi, con un piccolo badge/medaglia a stella brillante appuntato sul petto. Espressione: sicura di sé, orgogliosa e felice. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

**susy/profile.png** ⚠️ *immagine mancante — da caricare*
```
una tenera ragazza chibi con i capelli corti ondulati biondo dorato e gli occhi azzurri luminosi, che indossa una camicetta bianca a maniche corte e un abito verde con un fiocco verde al colletto e scarpe verdi Mary Jane con fiocchi bianchi, in posa da supereroe fiera con le mani sui fianchi, con un piccolo badge/medaglia a stella brillante appuntato sul petto. Espressione: sicura di sé, orgogliosa e felice. Il personaggio deve sembrare ESATTAMENTE come nell'immagine di riferimento: stessa faccia, stesso stile e colore dei capelli, stesso outfit e accessori, stesse proporzioni chibi. Stile artistico: simpatica illustrazione cartone animato chibi, contorni scuri spessi, colori pastello piatti con ombreggiature morbide, guance rosate in stile anime su entrambe le guance, occhi grandi rotondi espressivi. Sfondo bianco. Corpo intero visibile, centrato nel frame, senza ritagli.
```

---

## Riepilogo immagini da sostituire / caricare

| Path Supabase | Stato |
|---------------|-------|
| `susy/tool_notes.png` | ⚠️ Sfondo bianco — rigenerare e caricare |
| `susy/tool_courses.png` | ❌ Mancante — caricare |
| `susy/profile.png` | ❌ Mancante — caricare |

---

## Note per la generazione manuale

- **Proporzioni consigliate:** 3:4 (verticale) — il personaggio occupa tutto il frame
- **Sfondo:** bianco nel prompt, poi rimuovilo con un tool (es. remove.bg, Adobe Express, Photoshop)
- **Formato file:** PNG con canale alpha (trasparente)
- **Strumenti testati:** google/nano-banana-2 su Replicate (richiede immagine di riferimento del personaggio)
- **Immagine di riferimento:** usa le immagini originali nella cartella `personaggi/` (es. `Luly.png`)
- **Upload:** Supabase Dashboard → Storage → `character-themes` → cartella `{personaggio}/` → carica il file con nome `{slot}.png` (sovrascrive quello esistente)
