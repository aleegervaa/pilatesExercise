# Lalla Pilates Studio

Web app **React + TypeScript + Vite + Firebase** per un'insegnante di Pilates, costruita partendo dalle tre pagine dell'idea originale.

## Cosa fa questa prima versione

- **Dashboard** con panoramica e lezioni imminenti.
- **Esercizi:** aggiunta, modifica, eliminazione, ricerca, filtro categoria, immagine principale PNG/JPEG, fino a 6 foto aggiuntive per le sequenze, descrizione, ripetizioni, attrezzo e *varianti/approfondimenti*.
- **Schede:** creazione, visualizzazione, modifica, eliminazione, riordino esercizi, serie, ripetizioni e note, corso/località, inizio e durata in settimane, archiviazione e riattivazione.
- **Storico:** tutte le schede, comprese le archiviate, con ricerca per nome/gruppo e filtro per intervallo date.
- **Calendario mensile:** clicca un giorno per aggiungere la lezione; crea, modifica, elimina, contrassegna completata, assegna luogo/ora, note e una scheda visualizzabile.
- **PDF con immagini reali incorporate:** scarica dalla scheda o dallo storico un PDF A4 con la foto principale e le eventuali sequenze fotografiche aggiuntive di ogni esercizio, titolo, serie, ripetizioni, attrezzo, descrizione e varianti/note. **Se un'immagine è mancante o inaccessibile il download si interrompe e mostra l'errore, anziché generare un PDF incompleto.**
- **12 esercizi e illustrazioni originali dimostrative** già disponibili in modalità demo; in Firebase importabili dal pulsante `Esempi` della libreria.
- **Login email/password** tramite Firebase Authentication. Account utente creato manualmente in Firebase (niente registrazione pubblica).
- **Demo offline** (senza Firebase): salvataggio nel browser via localStorage. Non sincronizzata tra dispositivi.

Le illustrazioni incluse servono a provare il flusso: prima dell'uso didattico, sostituiscile con foto/illustrazioni corrette e approvate dall'insegnante. Le descrizioni iniziali sono esempi e non sostituiscono l'istruzione professionale.

## 1 — Avvio immediato, SENZA Firebase

Requisito: Node.js LTS (22 o successivo) e un terminale (per esempio in VS Code).

```bash
npm install
npm run dev
```

Apri **http://localhost:5173**. L'app parte in **demo locale**, con 12 esercizi, schede e lezioni di prova. Puoi creare/modificare schede e scaricare subito il PDF con immagini. I dati sono memorizzati solo nel browser in cui stai provando l'app.

**Attenzione:** cancellare i dati del browser, usare la navigazione in incognito o premere `Reset demo` può perdere le modifiche locali. Non usare la demo come archivio definitivo.

## 2 — Configurazione Firebase, passo per passo

1. Vai su **https://console.firebase.google.com/** e crea un progetto (es. `lalla-pilates-studio`).
2. In **Impostazioni progetto → Le tue app** registra un'**app Web** (`</>`). Copia i valori del `firebaseConfig`.
3. Nella radice del progetto duplica `.env.example` e chiamalo **`.env.local`**, compilando:

```dotenv
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=TUOPROGETTO.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=TUOPROGETTO
VITE_FIREBASE_STORAGE_BUCKET=TUOPROGETTO.firebasestorage.app
VITE_FIREBASE_APP_ID=1:...:web:...
```

Usa **esattamente i valori presenti nel tuo SDK Firebase**: non inventare il bucket. Le variabili `VITE_` sono configurazioni client, non segreti. Non inserirci service-account o chiavi amministratore.

4. In **Build → Authentication → Sign-in method** abilita **Email/Password**.
5. In **Authentication → Users** crea manualmente l'account della sorella (email e password). Non c'è registrazione pubblica, per evitare utenti non autorizzati.
6. In **Build → Firestore Database** crea il database. Per una nuova app scegli una regione europea adeguata e pubblica le regole del file `firestore.rules` nella sezione **Regole**. Queste limitano lettura e scrittura alle sole raccolte dell'utente autenticato.
7. In **Build → Storage** crea il bucket e pubblica le regole del file `storage.rules`. Le immagini caricate sono separate per UID, massimo 4 MB da interfaccia.
8. **Cloud Storage for Firebase richiede attualmente il piano Blaze (a consumo), anche per i nuovi bucket predefiniti.** Prima di abilitarlo verifica i prezzi e imposta alert di budget: un alert **non** blocca automaticamente tutte le spese. Puoi provare senza Blaze la modalità demo, inclusi i PDF.
9. Riavvia Vite, perché cambiando `.env.local` serve ricaricare le variabili:

```bash
npm run dev
```

Adesso comparirà il **login Firebase**. Accedi con l'utente creato al punto 5. La libreria sarà inizialmente vuota: in **Esercizi → Esempi** puoi importare i 12 esempi, poi creare le prime schede.

## 3 — IMPORTANTISSIMO: immagini nel PDF e CORS

Per esportare in sicurezza le immagini **caricate in Firebase Storage**, il browser deve poter scaricare i blob. Il client usa `getBlob()` e necessita della configurazione CORS del bucket (documentazione Firebase: https://firebase.google.com/docs/storage/web/download-files).

Il file `cors.json` include `http://localhost:5173` e i domini Firebase Hosting. **Sostituisci `YOUR_PROJECT_ID` con l'ID effettivo.** Per un dominio personalizzato, aggiungi anche l'origine `https://tuodominio.it`.

Con **Google Cloud CLI** installata e dopo aver eseguito `gcloud auth login` e selezionato il progetto:

```bash
gcloud storage buckets update gs://TUO_BUCKET.firebasestorage.app --cors-file=cors.json
```

`TUO_BUCKET.firebasestorage.app` deve essere il nome reale del bucket indicato nel `firebaseConfig`. Controlla le autorizzazioni dell'account Google Cloud. Se l'esportazione dice **CORS / immagine non accessibile**, controlla configurazione, permessi e formato immagine. **Sono supportati PNG e JPEG** (non usare WebP/SVG per le foto caricate).

Le 12 illustrazioni demo in `public/exercises/` sono immagini PNG locali: vengono incorporate nel PDF anche senza Storage.

## 4 — Pubblicare su Firebase Hosting

Nel terminale del progetto:

```bash
npm run build
npm install -g firebase-tools
firebase login
firebase use --add
firebase deploy --only hosting,firestore:rules,storage
```

Il comando `firebase use --add` ti farà scegliere il progetto. Dopo il deploy Firebase mostrerà l'URL, solitamente `https://TUOPROGETTO.web.app`.

Se usi un **dominio personalizzato**, aggiungilo anche tra i domini autorizzati in **Authentication → Settings → Authorized domains** e nella configurazione CORS se esporti immagini di Storage.

> Nota: la build e il deploy online vanno eseguiti sul tuo computer dopo `npm install`. L'archivio allegato contiene il **codice sorgente** ma non `node_modules`, `.env.local` o credenziali Firebase.

## 5 — Struttura del progetto

```text
lalla-pilates-studio/
├─ public/exercises/          12 immagini PNG dimostrative
├─ src/
│  ├─ App.tsx                  schermate, menu e modali CRUD
│  ├─ styles.css               design responsive
│  ├─ types.ts                 modelli TypeScript
│  ├─ lib/
│  │  ├─ firebase.ts           inizializzazione Auth / Firestore / Storage
│  │  ├─ date.ts               utilità calendario
│  │  ├─ seed.ts               esercizi, schede e lezioni di esempio
│  │  └─ pdf.ts                generazione PDF con immagini incorporate
│  └─ services/repository.ts   CRUD Firebase + demo locale
├─ firestore.rules            dati accessibili solo al proprietario
├─ storage.rules              immagini del proprietario
├─ cors.json                  CORS per incorporare le immagini nel PDF
├─ firebase.json              hosting e deploy
├─ .env.example               esempio variabili di configurazione
└─ package.json
```

**Firestore** contiene, per ciascun utente autenticato:

```text
users/{uid}/exercises/{exerciseId}
users/{uid}/plans/{planId}
users/{uid}/lessons/{lessonId}
```

Le immagini caricate sono in `exercise-images/{uid}/{uuid}.png|jpg` su Firebase Storage. Una scheda registra sia l'ID dell'esercizio sia una copia dei dati, in modo che la scheda storica resti consultabile anche dopo l'eliminazione di un esercizio dalla libreria.

## 6 — Cosa resta per una versione definitiva

Questa è una **prima release funzionale**, non un software già pronto per essere distribuito senza test sul tuo ambiente:

- Creare il progetto Firebase, pubblicare le regole e testare da due browser/dispositivi reali.
- Verificare che il PDF includa correttamente anche le immagini caricate da Firebase Storage dopo CORS.
- Sostituire/verificare le illustrazioni e le istruzioni didattiche iniziali.
- Definire con tua sorella eventuali **clienti**, pagamenti, iscrizioni, notifiche, disponibilità o ricorrenze delle lezioni: non sono specificati nelle 3 pagine.
- Opzionale: suggerimenti esercizi tramite AI. Non inclusi in questa prima versione (servirebbe un backend dedicato con chiave API protetta e controllo dell'insegnante).
- Preparare backup/esportazione dei dati e test di sicurezza e usabilità prima dell'uso continuativo.

## Riferimenti ufficiali

- Firebase JS: https://firebase.google.com/docs/web/setup
- Firestore rules: https://firebase.google.com/docs/firestore/security/get-started
- Storage: https://firebase.google.com/docs/storage/web/start
- Download blob e CORS: https://firebase.google.com/docs/storage/web/download-files

## Verifiche svolte su questo starter

- Controllata la sintassi TS/TSX con il transpiler TypeScript e la risoluzione degli import locali.
- Generato il documento `Esempio_scheda_Lalla_Pilates.pdf` separato dall'archivio e verificato che includa **5 immagini incorporate nel file PDF** (non link).
- **Non è stata possibile una build/installazione npm in questo ambiente per assenza di accesso al registro npm**. Esegui `npm install`, `npm run build` e test funzionali sul tuo computer prima di metterla online.
- Non è stata ancora collegata a un progetto Firebase reale: il login, Storage, le regole e CORS devono essere verificati dopo la configurazione.
