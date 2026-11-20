classificator:
 - da indagare se in ablation classifica chiavi allo "stesso livello" come fa in modalita main

[login fixed] Correzioni fatte (tutte typecheck pulito)
Pre-check auth ora ri-gioca gli header catturati (niente più falso "expired").
Protezione data-loss: DEBUG_NO_CRAWLING non wipa più il dominio (main.ts) — il login manuale non distrugge mai i dati.
Messaggio pre-check corretto: se il token catturato scade, serve ri-crawlare (ri-loggarsi nel browser non aggiorna gli header catturati).

Da chiedere: cosa server rifare il login se tanto gli header non sono aggiornati? devo rifare per forza l'esplorazione ogni volta che mi scade il token? spero di no!


Preindexing:

Indagando il perché dei 77 match ho trovato la causa a monte, in preindex.ts:45-50:


if (typeof value === 'string') return trimmed.length > 1 && …   // '5' SCARTATO
if (typeof value === 'number') return Number.isFinite(value);    // 5 ACCETTATO
Una stringa di 1 carattere è esclusa, un numero passa sempre. Quindi tutte le props numeriche a una cifra (padding, contatori, indici di array) finiscono in preindex e collidono con qualunque valore URL a una cifra. È questo che alimenta l'esplosione, non solo limit: valeva anche per ?page=5, /step/3, ecc.

Rendere la regola numerica simmetrica a quella delle stringhe (≥2 cifre) ucciderebbe l'intera classe alla radice. Non l'ho fatto perché: (a) è oltre i fix che hai approvato, (b) cambia la preindex, quindi richiede un re-preindex per avere effetto (i siti già catturati non ne beneficerebbero senza ri-crawl), (c) va misurato sui 4 siti prima — un id legittimo a una cifra esiste in teoria. L'ho annotato nel CHANGELOG come follow-up.








Controllare regressione Busuu:
 - [controllato] chiave `user` viene classificato come authZ? -> attualmente si, ma il rischio di FP e' basso. User avra' probabilmente lo stesso valore in componenti React diversi, quindi la diff non ritorna un segnale AuthZ
 - [controllato] che tipo di valore viene considerato nella `diff` tra le props considerate authZ? valutiamo se considerare solo booleani per ridurre FP (testare possibili regressioni) -> attualmente consideriamo sia booleani che stringhe, utile per scenari come 'tier': 'premium'

Da confermare:
 - [confermato] avendo una esplorazione salvata a DB, una nuova analisi interroga nuovamente il server reale? Non dobbiamo avere risultati cachati in analisi (probe client-routing e' sempre live, mai cachato. Le richieste http forgiate invece sono cachate)
 - [confermato] nuova esplorazione o analisi su nuovo sito NON deve cancellare dati di altri siti (esplorazione o analisi)
