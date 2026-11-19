# Tracciamento dei requisiti del PDF originale (3 pagine)

## Pagina 1 — app per l'insegnante

| Nota nel PDF | Realizzazione nella prima versione |
| --- | --- |
| Scelta degli esercizi | Selettore esercizi quando si crea una scheda |
| Database esercizi | CRUD Firestore + immagini Firebase Storage |
| Visualizzazione schede | Elenco schede + vista di dettaglio con immagini |
| Modifica e rimozione schede | Pulsanti Modifica / Elimina / Archivia |
| Storico schede per nome e data | Sezione Storico con filtri testuali e date |
| Durata delle schede in settimane, attive | Campo durata settimane e stato attiva/archiviata |
| Calendario stile Google | Calendario mensile con lezioni cliccabili |
| Lezione, quando, organizzazione | Evento con giorno, orario, luogo e note |
| AI per suggerimento esercizi ("magari") | Non inclusa: proposta futura, non indispensabile alla prima versione |

## Pagina 2 — calendario e libreria

| Nota nel PDF | Realizzazione nella prima versione |
| --- | --- |
| Pilates Arcore / Pilates Concorezzo | Titoli lezioni e gruppi modificabili, esempi precaricati |
| Clic sul giorno per inserire un evento | Click sul giorno della griglia apre il form lezione |
| Nome scheda, ora, dove, completata sì/no | Campi nel form lezione con scheda collegata e checkbox completamento |
| Possibilità di vedere la scheda | Pulsante Visualizza dalla lezione e vista dettaglio |
| Riga con foto, nome esercizio, menu tre puntini | Libreria con anteprima e menu Modifica / Elimina |
| Aggiungi esercizio: nome, spiegazione, scelta attrezzo | Form esercizio con campi corrispondenti e immagine obbligatoria |

## Pagina 3 — esercizi con sotto-esercizi e foto

| Nota nel PDF | Realizzazione nella prima versione |
| --- | --- |
| Affondi → rotazione busto | Esercizio di esempio con variante "Rotazione busto senza affondo" |
| Descrizione, Rep, attrezzo | Campi esercizio salvati in Firestore e disponibili in PDF |
| Riquadri immagini collegati al movimento | Immagine principale + galleria di massimo sei foto per singolo esercizio, inclusa nel PDF |

## Richiesta aggiunta nel messaggio

**Esportazione in PDF CON IMMAGINI:** implementata da `src/lib/pdf.ts`, con caricamento reale dei blob prima dell'esportazione. La funzione si ferma in caso di immagine mancante/inaccessibile anziché consegnare un documento che omette le fotografie.

**Da verificare con l'insegnante:** se le sotto-immagini della pagina 3 rappresentano passaggi in sequenza, varianti differenti oppure inquadrature dello stesso movimento. Il modello attuale supporta foto aggiuntive ordinate, con varianti in testo, per coprire il caso generale.
