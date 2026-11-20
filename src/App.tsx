import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  Activity, Archive, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BookOpen,
  CalendarDays, Check, CheckCircle2, ChevronDown, CircleHelp, Clock,
  Download, Dumbbell, Edit3, FileText, Filter, Image as ImageIcon,
  Layers3, Leaf, LogOut, MapPin, Menu, MoreVertical, Plus, RotateCcw,
  Search, Sparkles, Trash2, Upload, X,
} from 'lucide-react';
import { onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { auth, firebaseEnabled } from './lib/firebase';
import { formatDate, localDateKey, monthLabel, newId } from './lib/date';
import { downloadPlanPdf } from './lib/pdf';
import { deleteRecord, importSampleExercises, loadWorkspace, resetDemo, saveRecord, uploadExerciseImage } from './services/repository';
import type { Exercise, Lesson, Tab, WorkoutItem, WorkoutPlan, Workspace } from './types';

const today = () => localDateKey(new Date());
const empty: Workspace = { exercises: [], plans: [], lessons: [] };
const tabs: Array<{ id: Tab; label: string; icon: typeof Activity }> = [
  { id: 'dashboard', label: 'Dashboard', icon: Activity },
  { id: 'calendar', label: 'Calendario', icon: CalendarDays },
  { id: 'exercises', label: 'Esercizi', icon: Dumbbell },
  { id: 'plans', label: 'Schede', icon: Layers3 },
  { id: 'history', label: 'Storico schede', icon: Archive },
];

const makeExercise = (): Exercise => ({
  id: newId(), name: '', category: 'Core', description: '', repetitions: '', equipment: 'Tappetino',
  variations: [], imageUrl: '', gallery: [], createdAt: today(),
});
const makePlan = (): WorkoutPlan => ({
  id: newId(), title: '', group: 'Pilates Arcore', startDate: today(),
  durationWeeks: 6, status: 'active', notes: '', items: [], createdAt: today(),
});
const makeLesson = (date = today()): Lesson => ({
  id: newId(), title: 'Pilates', date, time: '18:30', location: '',
  planId: '', completed: false, notes: '',
});

const Badge = ({ children, tone = 'mint' }: { children: ReactNode; tone?: 'mint' | 'purple' | 'gray' | 'rose' }) =>
  <span className={`pill pill-${tone}`}>{children}</span>;

function Modal({ title, children, onClose, wide = false }: {
  title: string; children: ReactNode; onClose: () => void; wide?: boolean;
}) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}
        onMouseDown={event => event.stopPropagation()}>
        <div className="modal-header"><h2>{title}</h2><button className="icon-btn" aria-label="Chiudi" onClick={onClose}><X size={20} /></button></div>
        {children}
      </section>
    </div>
  );
}

function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const login = async (event: FormEvent) => {
    event.preventDefault();
    if (!auth) return;
    try {
      setLoading(true); setMessage('');
      await signInWithEmailAndPassword(auth, email.trim(), password);
} catch (error) {
  const code = (error as { code?: string }).code ?? 'unknown';

  console.error('Errore login Firebase:', code);

  if (code === 'auth/invalid-credential') {
    setMessage('Email o password non corretti.');
  } else if (code === 'auth/operation-not-allowed') {
    setMessage('Devi abilitare Email/Password su Firebase.');
  } else if (code === 'auth/user-disabled') {
    setMessage('Questo account è stato disabilitato.');
  } else if (code === 'auth/too-many-requests') {
    setMessage('Troppi tentativi. Riprova più tardi.');
  } else {
    setMessage(`Errore Firebase: ${code}`);
  }
} finally {
  setLoading(false);
}
  };
  const reset = async () => {
    if (!auth || !email.includes('@')) { setMessage('Inserisci prima la tua email.'); return; }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setMessage('Se l’indirizzo è registrato, riceverai una mail per reimpostare la password.');
    } catch { setMessage('Non riesco a inviare il link: riprova più tardi.'); }
  };
  return (
    <div className="auth-shell">
      <div className="auth-brand"><Leaf size={36} /><h1>Lalla <em>Pilates</em></h1><p>Le tue lezioni, il tuo metodo, il tuo spazio.</p></div>
      <form className="auth-card" onSubmit={login}>
        <span className="eyebrow">AREA RISERVATA</span><h2>Bentornata!</h2><p>Accedi per gestire schede, esercizi e lezioni.</p>
        <label>Email<input required type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="insegnante@email.it" /></label>
        <label>Password<input required type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="La tua password" /></label>
        {message && <p className="message-inline">{message}</p>}
        <button disabled={loading} className="primary-button" type="submit">{loading ? 'Accesso...' : 'Accedi'} <ArrowRight size={17} /></button>
        <button className="text-button" type="button" onClick={reset}>Password dimenticata?</button>
        <small>L’account viene creato dall’amministratore nella console Firebase.</small>
      </form>
    </div>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(firebaseEnabled);
  const [workspace, setWorkspace] = useState<Workspace>(empty);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [searchExercise, setSearchExercise] = useState('');
  const [filterCategory, setFilterCategory] = useState('Tutti');
  const [historySearch, setHistorySearch] = useState('');
  const [historyFrom, setHistoryFrom] = useState('');
  const [historyTo, setHistoryTo] = useState('');
  const [exerciseDraft, setExerciseDraft] = useState<Exercise | null>(null);
  const [exercisePhoto, setExercisePhoto] = useState<File | null>(null);
  const [extraPhotos, setExtraPhotos] = useState<File[]>([]);
  const [variationText, setVariationText] = useState('');
  const [planDraft, setPlanDraft] = useState<WorkoutPlan | null>(null);
  const [addExerciseId, setAddExerciseId] = useState('');
  const [lessonDraft, setLessonDraft] = useState<Lesson | null>(null);
  const [previewPlan, setPreviewPlan] = useState<WorkoutPlan | null>(null);

  const uid = user?.uid ?? 'demo';
  const notify = (message: string) => { setNotification(message); setTimeout(() => setNotification(''), 5000); };
  const refresh = useCallback(async (currentUid: string) => {
    setLoadingData(true);
    try { setWorkspace(await loadWorkspace(currentUid)); setError(''); }
    catch (err) { setError(err instanceof Error ? err.message : 'Errore nel caricamento.'); }
    finally { setLoadingData(false); }
  }, []);

  useEffect(() => {
    if (!auth) { void refresh('demo'); return; }
    const unsubscribe = onAuthStateChanged(auth, currentUser => {
      setUser(currentUser); setCheckingAuth(false);
      if (currentUser) void refresh(currentUser.uid);
      else { setWorkspace(empty); setLoadingData(false); }
    });
    return unsubscribe;
  }, [refresh]);

  const run = async (action: () => Promise<void>, success = 'Modifiche salvate') => {
    try {
      setBusy(true); setError('');
      await action();
      await refresh(uid);
      notify(success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operazione non riuscita.');
    } finally { setBusy(false); }
  };

  const openExercise = (record?: Exercise) => {
    const draft = record ? structuredClone(record) : makeExercise();
    setExerciseDraft(draft); setVariationText(draft.variations.join('\n')); setExercisePhoto(null); setExtraPhotos([]);
  };

  const saveExercise = async (event: FormEvent) => {
  event.preventDefault();

  if (!exerciseDraft || !exerciseDraft.name.trim()) {
    setError('Inserisci almeno il nome dell’esercizio.');
    return;
  }

  setBusy(true);
  setError('');

  const draft = {
    ...exerciseDraft,
    name: exerciseDraft.name.trim(),
    variations: variationText
      .split('\n')
      .map(v => v.trim())
      .filter(Boolean),
  };

  let imageWarning = '';

  try {
    // IMMAGINE PRINCIPALE FACOLTATIVA
    if (exercisePhoto) {
      try {
        const uploaded = await uploadExerciseImage(uid, exercisePhoto);
        Object.assign(draft, uploaded);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Errore caricamento immagine';

        console.warn('Immagine non caricata:', err);

        imageWarning = message;
      }
    }

    // FOTO AGGIUNTIVE
    if ((draft.gallery?.length ?? 0) + extraPhotos.length > 6) {
      throw new Error(
        'Sono consentite al massimo 6 foto aggiuntive per esercizio.'
      );
    }

    const uploadedGallery: Array<{
      imageUrl: string;
      imagePath?: string;
    }> = [];

    for (const file of extraPhotos) {
      try {
        const uploaded = await uploadExerciseImage(uid, file);
        uploadedGallery.push(uploaded);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Errore caricamento immagine';

        console.warn('Foto aggiuntiva non caricata:', err);

        imageWarning = imageWarning
          ? `${imageWarning} ${message}`
          : message;
      }
    }

    draft.gallery = [
      ...(draft.gallery ?? []),
      ...uploadedGallery,
    ];

    // IMPORTANTISSIMO:
    // l'esercizio viene salvato anche se le immagini non funzionano.
    await saveRecord(uid, 'exercises', draft);

    await refresh(uid);

    setExerciseDraft(null);
    setExercisePhoto(null);
    setExtraPhotos([]);

    if (imageWarning) {
      notify('Esercizio salvato senza alcune immagini');
      setError(
        `L’esercizio è stato salvato correttamente. L’immagine non è stata caricata: ${imageWarning}`
      );
    } else {
      notify('Esercizio salvato');
    }
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : 'Impossibile salvare l’esercizio.'
    );
  } finally {
    setBusy(false);
  }
};

  /*const saveExercise = async (event: FormEvent) => {
    event.preventDefault();
    if (!exerciseDraft || !exerciseDraft.name.trim()) return;
    const draft = { ...exerciseDraft, name: exerciseDraft.name.trim(), variations: variationText.split('\n').map(v => v.trim()).filter(Boolean) };
    await run(async () => {
      if (exercisePhoto) Object.assign(draft, await uploadExerciseImage(uid, exercisePhoto));
      if ((draft.gallery?.length ?? 0) + extraPhotos.length > 6) throw new Error('Sono consentite al massimo 6 foto aggiuntive per esercizio.');
      const uploadedGallery: Array<{ imageUrl: string; imagePath?: string }> = [];
      for (const file of extraPhotos) uploadedGallery.push(await uploadExerciseImage(uid, file));
      draft.gallery = [...(draft.gallery ?? []), ...uploadedGallery];
      if (!draft.imageUrl) throw new Error('Aggiungi un’immagine: serve anche per il PDF della scheda.');
      await saveRecord(uid, 'exercises', draft);
      setExerciseDraft(null); setExercisePhoto(null); setExtraPhotos([]);
    }, 'Esercizio salvato');
  };*/
  const removeExercise = (ex: Exercise) => {
    if (!window.confirm(`Eliminare l’esercizio “${ex.name}”? Le schede già salvate manterranno una copia dei suoi dati.`)) return;
    void run(() => deleteRecord(uid, 'exercises', ex.id), 'Esercizio eliminato');
  };
  const openPlan = (plan?: WorkoutPlan) => { setPlanDraft(plan ? structuredClone(plan) : makePlan()); setAddExerciseId(''); };
  const addToDraft = () => {
    const ex = workspace.exercises.find(record => record.id === addExerciseId);
    if (!ex || !planDraft) return;
    const item: WorkoutItem = { id: newId(), exerciseId: ex.id, snapshot: ex, sets: '2', reps: ex.repetitions, notes: '' };
    setPlanDraft({ ...planDraft, items: [...planDraft.items, item] }); setAddExerciseId('');
  };
  const updateDraftItem = (id: string, patch: Partial<WorkoutItem>) => {
    if (!planDraft) return;
    setPlanDraft({ ...planDraft, items: planDraft.items.map(record => record.id === id ? { ...record, ...patch } : record) });
  };
  const shiftDraftItem = (index: number, delta: number) => {
    if (!planDraft || index + delta < 0 || index + delta >= planDraft.items.length) return;
    const next = [...planDraft.items];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    setPlanDraft({ ...planDraft, items: next });
  };
  const savePlan = async (event: FormEvent) => {
    event.preventDefault();
    if (!planDraft) return;
    if (planDraft.items.length === 0) { setError('Aggiungi almeno un esercizio alla scheda.'); return; }
    await run(async () => {
      await saveRecord(uid, 'plans', { ...planDraft, title: planDraft.title.trim(), group: planDraft.group.trim() });
      setPlanDraft(null);
    }, 'Scheda salvata');
  };
  const deletePlan = (plan: WorkoutPlan) => {
    if (!window.confirm(`Eliminare definitivamente la scheda “${plan.title}”? Le lezioni collegate non saranno eliminate.`)) return;
    void run(async () => {
      // Non lasciare riferimenti a schede eliminate nelle lezioni.
      for (const lesson of workspace.lessons.filter(l => l.planId === plan.id)) {
        await saveRecord(uid, 'lessons', { ...lesson, planId: '' });
      }
      await deleteRecord(uid, 'plans', plan.id);
    }, 'Scheda eliminata');
  };
  const archivePlan = (plan: WorkoutPlan) => {
    void run(() => saveRecord(uid, 'plans', { ...plan, status: plan.status === 'active' ? 'archived' : 'active' }),
      plan.status === 'active' ? 'Scheda archiviata' : 'Scheda riattivata');
  };
  const pdfPlan = async (plan: WorkoutPlan) => {
    try { setBusy(true); setError(''); await downloadPlanPdf(plan, workspace.exercises); notify('PDF scaricato con immagini'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Errore PDF.'); }
    finally { setBusy(false); }
  };
  const saveLesson = async (event: FormEvent) => {
    event.preventDefault();
    if (!lessonDraft) return;
    await run(async () => { await saveRecord(uid, 'lessons', lessonDraft); setLessonDraft(null); }, 'Lezione salvata');
  };
  const deleteLesson = (lesson: Lesson) => {
    if (!window.confirm(`Eliminare la lezione del ${formatDate(lesson.date)}?`)) return;
    void run(async () => { await deleteRecord(uid, 'lessons', lesson.id); setLessonDraft(null); }, 'Lezione eliminata');
  };
  const changeTab = (next: Tab) => { setTab(next); setMobileOpen(false); };
  const selectedPlan = (id: string) => workspace.plans.find(plan => plan.id === id);
  const selectedExercise = (item: WorkoutItem) => workspace.exercises.find(ex => ex.id === item.exerciseId) ?? item.snapshot;

  const categories = useMemo(() => ['Tutti', ...new Set(workspace.exercises.map(ex => ex.category))].sort(), [workspace.exercises]);
  const matchingExercises = useMemo(() => workspace.exercises
    .filter(ex => (filterCategory === 'Tutti' || filterCategory === ex.category)
      && `${ex.name} ${ex.equipment} ${ex.description}`.toLowerCase().includes(searchExercise.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, 'it')), [workspace.exercises, filterCategory, searchExercise]);
  const matchingHistory = useMemo(() => workspace.plans
    .filter(p => `${p.title} ${p.group}`.toLowerCase().includes(historySearch.toLowerCase())
      && (!historyFrom || p.startDate >= historyFrom) && (!historyTo || p.startDate <= historyTo))
    .sort((a, b) => b.startDate.localeCompare(a.startDate)), [workspace.plans, historySearch, historyFrom, historyTo]);
  const upcoming = workspace.lessons.filter(lesson => lesson.date >= today() && !lesson.completed)
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).slice(0, 5);
  const completedCount = workspace.lessons.filter(lesson => lesson.completed).length;

  if (checkingAuth) return <div className="loading-screen"><Leaf /><p>Caricamento...</p></div>;
  if (firebaseEnabled && !user) return <AuthScreen />;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="brand"><div className="brand-mark"><Leaf size={26} /></div><div><strong>Lalla <em>Pilates</em></strong><small>STUDIO MANAGER</small></div></div>
        <div className="sidebar-section">IL TUO SPAZIO</div>
        <nav className="nav-menu" aria-label="Menu principale">
          {tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => changeTab(id)} className={`nav-item ${tab === id ? 'nav-active' : ''}`}>
            <Icon size={18} />{label}</button>)}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-note"><Sparkles size={17} /><span>Organizza ogni lezione con cura, dal primo esercizio all’ultimo respiro.</span></div>
          <div className="profile"><div className="avatar">LP</div><div className="profile-name"><strong>Lalla Pilates</strong><small>{firebaseEnabled ? 'Dati su Firebase' : 'Modalità demo locale'}</small></div></div>
          {firebaseEnabled && <button className="logout-btn" onClick={() => void signOut(auth!)}><LogOut size={16} /> Esci</button>}
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar"><button className="mobile-menu icon-btn" aria-label="Apri menu" onClick={() => setMobileOpen(!mobileOpen)}><Menu size={22} /></button>
          <div><div className="topbar-crumb">IL TUO STUDIO <span>/</span> {tabs.find(entry => entry.id === tab)?.label}</div>
            <div className="topbar-mobile-title">Lalla Pilates Studio</div></div>
          <div className="topbar-right"><Badge tone={firebaseEnabled ? 'mint' : 'purple'}>{firebaseEnabled ? '● Firebase attivo' : '◉ Demo locale'}</Badge>
            <span className="today-date">{formatDate(today())}</span></div></header>

        {error && <div className="error-banner" role="alert"><CircleHelp size={18} /><span>{error}</span><button onClick={() => setError('')} aria-label="Chiudi errore"><X size={16} /></button></div>}
        {notification && <div className="success-banner" role="status"><CheckCircle2 size={18} />{notification}</div>}
        {busy && <div className="busy-bar">Salvataggio o elaborazione in corso...</div>}
        {loadingData ? <div className="page-loading">Caricamento dati...</div> : <>

          {tab === 'dashboard' && <div className="page">
            <div className="welcome-banner"><div className="welcome-content"><span className="welcome-kicker">IL TUO SPAZIO PILATES</span>
              <h1>Il movimento<br /><em>inizia da qui.</em></h1><p>Un unico posto per prenderti cura delle tue lezioni, degli esercizi e delle schede.</p>
              <button className="white-button" onClick={() => { changeTab('calendar'); setLessonDraft(makeLesson()); }}>Nuova lezione <Plus size={17} /></button></div>
              <div className="welcome-art"><div className="art-circle art-circle-one" /><div className="art-circle art-circle-two" /><Leaf size={170} strokeWidth={0.75} /></div></div>
            <div className="stats-grid">
              {[{ icon: BookOpen, label: 'Esercizi in libreria', value: workspace.exercises.length, color: 'mint' },
                { icon: Layers3, label: 'Schede attive', value: workspace.plans.filter(p => p.status === 'active').length, color: 'purple' },
                { icon: CalendarDays, label: 'Lezioni programmate', value: workspace.lessons.length, color: 'peach' },
                { icon: CheckCircle2, label: 'Lezioni completate', value: completedCount, color: 'mint' }].map(item =>
                <div className="stat-card" key={item.label}><span className={`stat-icon stat-${item.color}`}><item.icon size={21} /></span>
                  <div><strong>{item.value}</strong><small>{item.label}</small></div></div>)}
            </div>
            <div className="dashboard-grid">
              <section className="content-card"><div className="section-heading"><div><span className="eyebrow">IN AGENDA</span><h2>Le prossime lezioni</h2></div>
                <button className="link-button" onClick={() => changeTab('calendar')}>Apri calendario <ArrowRight size={16} /></button></div>
                {upcoming.length === 0 ? <div className="empty-state">Non ci sono lezioni future. Aggiungine una dal calendario.</div> :
                  <div className="agenda-list">{upcoming.map(lesson => <button className="agenda-item" key={lesson.id} onClick={() => setLessonDraft(structuredClone(lesson))}>
                    <div className="agenda-date"><strong>{lesson.date.slice(8)}</strong><small>{new Date(`${lesson.date}T12:00:00`).toLocaleDateString('it-IT', { month: 'short' })}</small></div>
                    <div className="agenda-info"><strong>{lesson.title}</strong><span><Clock size={14} /> {lesson.time} &nbsp; <MapPin size={14} /> {lesson.location || 'Luogo da definire'}</span></div><ArrowRight size={18} /></button>)}</div>}
              </section>
              <section className="content-card"><div className="section-heading"><div><span className="eyebrow">AZIONI RAPIDE</span><h2>Cosa vuoi fare?</h2></div></div>
                <div className="quick-actions">
                  <button onClick={() => { changeTab('exercises'); openExercise(); }}><span className="quick-icon"><Dumbbell size={21} /></span><span><strong>Nuovo esercizio</strong><small>Aggiungi immagine, varianti e dettagli</small></span><Plus size={19} /></button>
                  <button onClick={() => { changeTab('plans'); openPlan(); }}><span className="quick-icon"><FileText size={21} /></span><span><strong>Crea una scheda</strong><small>Componi il tuo allenamento</small></span><Plus size={19} /></button>
                  <button onClick={() => { changeTab('calendar'); setLessonDraft(makeLesson()); }}><span className="quick-icon"><CalendarDays size={21} /></span><span><strong>Organizza una lezione</strong><small>Assegna giorno, orario e scheda</small></span><Plus size={19} /></button>
                </div>
              </section>
            </div>
            {!firebaseEnabled && <div className="demo-hint"><CircleHelp size={17} /> Stai provando una demo: i dati rimangono in questo browser. Per salvare tutto online, configura Firebase seguendo il README.</div>}
          </div>}

          {tab === 'exercises' && <div className="page">
            <div className="page-heading"><div><span className="eyebrow">BIBLIOTECA MOVIMENTI</span><h1>La libreria esercizi</h1><p>Immagini, spiegazioni, ripetizioni, attrezzi e varianti: tutto a portata di mano.</p></div>
              <button className="primary-button" onClick={() => openExercise()}><Plus size={17} /> Aggiungi esercizio</button></div>
            <div className="toolbar"><div className="search-field"><Search size={19} /><input value={searchExercise} onChange={event => setSearchExercise(event.target.value)} placeholder="Cerca esercizio o attrezzo..." /></div>
              <div className="select-wrap"><Filter size={17} /><select aria-label="Filtra categoria" value={filterCategory} onChange={event => setFilterCategory(event.target.value)}>{categories.map(cat => <option key={cat}>{cat}</option>)}</select></div>
              {firebaseEnabled && <button className="outline-button" disabled={busy} onClick={() => void run(async () => { const count = await importSampleExercises(uid, workspace.exercises); notify(`${count} esercizi importati`); }, 'Libreria aggiornata')}><Upload size={16} /> Esempi</button>}</div>
            <div className="section-meta">{matchingExercises.length} ESERCIZI TROVATI</div>
            {matchingExercises.length === 0 ? <div className="empty-state big-empty"><ImageIcon size={28} /><h3>Nessun esercizio</h3><p>Modifica i filtri oppure aggiungi il tuo primo esercizio.</p></div> :
            <div className="exercise-grid">{matchingExercises.map(ex => <article key={ex.id} className="exercise-card">
              <div className="exercise-cover"><img src={ex.imageUrl} alt={`Illustrazione di ${ex.name}`} loading="lazy" /><Badge tone="mint">{ex.category}</Badge></div>
              <div className="exercise-content"><div className="exercise-title-row"><h3>{ex.name}</h3><div className="more-menu"><button className="icon-btn" aria-label={`Opzioni ${ex.name}`}><MoreVertical size={19} /></button><div className="menu-pop"><button onClick={() => openExercise(ex)}><Edit3 size={15} /> Modifica</button><button onClick={() => removeExercise(ex)}><Trash2 size={15} /> Elimina</button></div></div></div>
                <p>{ex.description}</p><div className="exercise-details"><span><Activity size={14} /> {ex.repetitions || '—'}</span><span><Dumbbell size={14} /> {ex.equipment || 'Senza attrezzi'}</span></div>
                {(ex.gallery?.length ?? 0) > 0 && <div className="mini-gallery">{ex.gallery?.slice(0, 4).map((photo, i) => <img src={photo.imageUrl} key={i} alt={`Passaggio ${i + 1} di ${ex.name}`} />)}</div>}
                {ex.variations.length > 0 && <details className="variations"><summary><ChevronDown size={15} /> {ex.variations.length} varianti</summary><ul>{ex.variations.map((v, i) => <li key={`${v}-${i}`}>{v}</li>)}</ul></details>}
                <button className="card-edit" onClick={() => openExercise(ex)}>Modifica esercizio <Edit3 size={15} /></button>
              </div></article>)}</div>}
          </div>}

          {tab === 'plans' && <div className="page">
            <div className="page-heading"><div><span className="eyebrow">ALLENAMENTI SU MISURA</span><h1>Le tue schede</h1><p>Organizza gli esercizi, personalizza serie e ripetizioni, esporta il PDF con immagini.</p></div>
              <button className="primary-button" onClick={() => openPlan()}><Plus size={17} /> Nuova scheda</button></div>
            {workspace.plans.filter(p => p.status === 'active').length === 0 ? <div className="empty-state big-empty"><FileText size={30} /><h3>Nessuna scheda attiva</h3><p>Crea una scheda e scegli gli esercizi dalla libreria.</p></div> :
            <div className="plans-grid">{workspace.plans.filter(p => p.status === 'active').sort((a, b) => b.startDate.localeCompare(a.startDate)).map(plan =>
              <article className="plan-card" key={plan.id}><div className="plan-decor"><Leaf size={76} strokeWidth={1} /><Badge>Attiva</Badge></div>
                <div className="plan-body"><span className="eyebrow">{plan.group || 'PILATES'}</span><h3>{plan.title}</h3>
                  <p><CalendarDays size={15} /> {formatDate(plan.startDate)} <span>·</span> {plan.durationWeeks} settimane</p>
                  <p><Dumbbell size={15} /> {plan.items.length} esercizi</p>
                  <div className="plan-avatars">{plan.items.slice(0, 4).map(item => <img key={item.id} src={selectedExercise(item).imageUrl} alt="" />)}{plan.items.length > 4 && <span>+{plan.items.length - 4}</span>}</div>
                  <div className="plan-actions"><button className="outline-button" onClick={() => setPreviewPlan(plan)}><BookOpen size={16} /> Visualizza</button>
                    <button className="primary-button" disabled={busy} onClick={() => void pdfPlan(plan)}><Download size={16} /> PDF</button></div>
                  <div className="plan-secondary"><button onClick={() => openPlan(plan)}><Edit3 size={15} /> Modifica</button>
                    <button onClick={() => archivePlan(plan)}><Archive size={15} /> Archivia</button>
                    <button onClick={() => deletePlan(plan)} className="danger-link"><Trash2 size={15} /> Elimina</button></div>
                </div></article>)}</div>}
          </div>}

          {tab === 'history' && <div className="page">
            <div className="page-heading"><div><span className="eyebrow">IL TUO ARCHIVIO</span><h1>Storico delle schede</h1><p>Tutte le schede, anche quelle archiviate, ricercabili per nome e data.</p></div></div>
            <div className="toolbar"><div className="search-field"><Search size={19} /><input value={historySearch} onChange={event => setHistorySearch(event.target.value)} placeholder="Nome scheda o corso..." /></div>
              <label className="filter-date">Dal<input type="date" value={historyFrom} onChange={event => setHistoryFrom(event.target.value)} /></label>
              <label className="filter-date">Al<input type="date" value={historyTo} onChange={event => setHistoryTo(event.target.value)} /></label>
              {(historySearch || historyFrom || historyTo) && <button className="text-button" onClick={() => { setHistorySearch(''); setHistoryFrom(''); setHistoryTo(''); }}>Azzera filtri</button>}</div>
            <div className="history-list">{matchingHistory.length === 0 ? <div className="empty-state">Nessuna scheda corrisponde ai filtri.</div> : matchingHistory.map(plan =>
              <article className="history-row" key={plan.id}><div className="history-icon"><FileText size={22} /></div>
                <div className="history-info"><h3>{plan.title}</h3><p>{plan.group || 'Pilates'} · {formatDate(plan.startDate)} · {plan.items.length} esercizi</p></div>
                <Badge tone={plan.status === 'active' ? 'mint' : 'gray'}>{plan.status === 'active' ? 'Attiva' : 'Archiviata'}</Badge>
                <div className="history-actions"><button className="outline-button" onClick={() => setPreviewPlan(plan)}>Visualizza</button>
                  <button className="icon-btn" title="Modifica" onClick={() => openPlan(plan)}><Edit3 size={17} /></button>
                  <button className="icon-btn" title="Scarica PDF" disabled={busy} onClick={() => void pdfPlan(plan)}><Download size={17} /></button>
                  <button className="icon-btn" title={plan.status === 'active' ? 'Archivia' : 'Riattiva'} onClick={() => archivePlan(plan)}><RotateCcw size={17} /></button>
                  <button className="icon-btn danger-link" title="Elimina" onClick={() => deletePlan(plan)}><Trash2 size={17} /></button></div>
              </article>)}</div>
          </div>}

          {tab === 'calendar' && <div className="page">
            <div className="page-heading"><div><span className="eyebrow">ORGANIZZA IL TUO TEMPO</span><h1>Calendario lezioni</h1><p>Seleziona un giorno per aggiungere una lezione oppure clicca su una già programmata.</p></div>
              <button className="primary-button" onClick={() => setLessonDraft(makeLesson())}><Plus size={17} /> Nuova lezione</button></div>
            <div className="calendar-card"><div className="calendar-toolbar"><h2>{monthLabel(month)}</h2><div><button className="outline-button" onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Oggi</button>
              <button className="icon-btn" aria-label="Mese precedente" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ArrowLeft size={19} /></button>
              <button className="icon-btn" aria-label="Mese successivo" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ArrowRight size={19} /></button></div></div>
              <div className="calendar-grid">{['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'].map(day => <div className="calendar-weekday" key={day}>{day}</div>)}
                {Array.from({ length: 42 }, (_, i) => {
                  const first = new Date(month.getFullYear(), month.getMonth(), 1);
                  const offset = (first.getDay() + 6) % 7;
                  const date = new Date(month.getFullYear(), month.getMonth(), i - offset + 1);
                  const key = localDateKey(date);
                  const items = workspace.lessons.filter(lesson => lesson.date === key).sort((a, b) => a.time.localeCompare(b.time));
                  return <div key={key} className={`calendar-day ${date.getMonth() !== month.getMonth() ? 'other-month' : ''} ${key === today() ? 'is-today' : ''}`}
                    onClick={() => setLessonDraft(makeLesson(key))} role="button" tabIndex={0}
                    onKeyDown={ev => { if (ev.key === 'Enter') setLessonDraft(makeLesson(key)); }} aria-label={`Aggiungi lezione per ${formatDate(key)}`}>
                    <div className="calendar-day-number">{date.getDate()}</div>
                    <div className="calendar-events">{items.slice(0, 3).map(lesson => <button key={lesson.id} className={`calendar-event ${lesson.completed ? 'event-done' : ''}`}
                      title={`${lesson.time} · ${lesson.title}`} onClick={event => { event.stopPropagation(); setLessonDraft(structuredClone(lesson)); }}>
                      <span>{lesson.time}</span> {lesson.title}</button>)}{items.length > 3 && <span className="extra-events">+{items.length - 3} altre</span>}</div>
                    </div>;
                })}</div></div>
            <div className="calendar-legend"><Badge>Pianificata</Badge><Badge tone="gray">Completata</Badge><span>Seleziona un giorno per creare una lezione</span></div>
          </div>}
        </>}
      </main>

      {exerciseDraft && <Modal title={workspace.exercises.some(e => e.id === exerciseDraft.id) ? 'Modifica esercizio' : 'Nuovo esercizio'} onClose={() => setExerciseDraft(null)} wide>
        <form className="modal-form" onSubmit={event => void saveExercise(event)}>
          <div className="form-grid"><label>Nome esercizio *<input required value={exerciseDraft.name} onChange={e => setExerciseDraft({ ...exerciseDraft, name: e.target.value })} placeholder="Es. Affondi con rotazione busto" /></label>
            <label>Categoria<select value={exerciseDraft.category} onChange={e => setExerciseDraft({ ...exerciseDraft, category: e.target.value })}>
              {['Core', 'Mobilità', 'Glutei', 'Gambe', 'Schiena', 'Equilibrio', 'Stretching', 'Respirazione', 'Braccia', 'Altro'].map(c => <option key={c}>{c}</option>)}</select></label></div>
          <label>Descrizione dell’esercizio<textarea rows={3} value={exerciseDraft.description} onChange={e => setExerciseDraft({ ...exerciseDraft, description: e.target.value })} placeholder="Descrivi come eseguire il movimento..." /></label>
          <div className="form-grid"><label>Ripetizioni / durata<input value={exerciseDraft.repetitions} onChange={e => setExerciseDraft({ ...exerciseDraft, repetitions: e.target.value })} placeholder="Es. 10 per lato / 30 secondi" /></label>
            <label>Attrezzo<input value={exerciseDraft.equipment} onChange={e => setExerciseDraft({ ...exerciseDraft, equipment: e.target.value })} placeholder="Es. Tappetino, ring, softball" /></label></div>
          <label>Varianti e approfondimenti <small>(una variante per riga)</small><textarea rows={3} value={variationText} onChange={e => setVariationText(e.target.value)} placeholder={'Rotazione busto\nAffondo statico\nAffondo con attrezzo'} /></label>
          <div className="photo-editor"><div className="photo-preview">{exerciseDraft.imageUrl ? <img src={exerciseDraft.imageUrl} alt="Immagine esercizio" /> : <ImageIcon size={34} />}</div>
            <div><strong>Immagine dell’esercizio (facoltativa)*</strong>
            <p>
              Facoltativa. Se presente, la fotografia/illustrazione sarà inclusa nel PDF.
              Formati PNG o JPEG, massimo 4 MB.
            </p>
              <label className="file-button"><Upload size={17} /> {exercisePhoto ? exercisePhoto.name : 'Carica un’immagine'}<input type="file" accept="image/png,image/jpeg" onChange={event => setExercisePhoto(event.target.files?.[0] ?? null)} /></label></div></div>
          <div className="gallery-editor"><strong>Foto aggiuntive / passaggi dell'esercizio</strong><p>Per sequenze come “Affondi → Rotazione busto”. Puoi aggiungere fino a 6 immagini, che verranno inserite anche nel PDF.</p>
            <div className="gallery-thumbs">{(exerciseDraft.gallery ?? []).map((photo, index) => <div className="gallery-thumb" key={index}><img src={photo.imageUrl} alt={`Foto ${index + 1}`} />
              <button type="button" title="Rimuovi foto dalla scheda" onClick={() => setExerciseDraft({ ...exerciseDraft, gallery: (exerciseDraft.gallery ?? []).filter((_, i) => i !== index) })}><X size={14} /></button></div>)}</div>
            <label className="file-button"><Upload size={17} /> Aggiungi foto (PNG/JPEG)<input type="file" accept="image/png,image/jpeg" multiple onChange={event => setExtraPhotos(Array.from(event.target.files ?? []))} /></label>
            {extraPhotos.length > 0 && <small>{extraPhotos.length} nuove immagini selezionate</small>}
          </div>
          <div className="modal-actions"><button className="outline-button" type="button" onClick={() => setExerciseDraft(null)}>Annulla</button><button disabled={busy} className="primary-button" type="submit"><Check size={17} /> Salva esercizio</button></div>
        </form>
      </Modal>}

      {planDraft && <Modal title={workspace.plans.some(p => p.id === planDraft.id) ? 'Modifica scheda' : 'Crea nuova scheda'} onClose={() => setPlanDraft(null)} wide>
        <form className="modal-form" onSubmit={event => void savePlan(event)}>
          <div className="form-grid"><label>Nome scheda *<input required value={planDraft.title} onChange={e => setPlanDraft({ ...planDraft, title: e.target.value })} placeholder="Es. Pilates Flow - Principianti" /></label>
            <label>Corso / gruppo<input value={planDraft.group} onChange={e => setPlanDraft({ ...planDraft, group: e.target.value })} placeholder="Es. Pilates Concorezzo" /></label></div>
          <div className="form-grid"><label>Data di inizio<input required type="date" value={planDraft.startDate} onChange={e => setPlanDraft({ ...planDraft, startDate: e.target.value })} /></label>
            <label>Durata (settimane)<input type="number" min="1" max="104" required value={planDraft.durationWeeks} onChange={e => setPlanDraft({ ...planDraft, durationWeeks: Number(e.target.value) })} /></label></div>
          <label>Note per la lezione<textarea rows={2} value={planDraft.notes} onChange={e => setPlanDraft({ ...planDraft, notes: e.target.value })} placeholder="Obiettivi, indicazioni, adattamenti..." /></label>
          <div className="form-section-heading"><strong>Esercizi della scheda</strong><span>{planDraft.items.length} selezionati</span></div>
          <div className="add-exercise-row"><select aria-label="Seleziona esercizio da aggiungere" value={addExerciseId} onChange={e => setAddExerciseId(e.target.value)}>
            <option value="">Seleziona un esercizio...</option>{workspace.exercises.slice().sort((a, b) => a.name.localeCompare(b.name)).map(ex => <option value={ex.id} key={ex.id}>{ex.name}</option>)}</select>
            <button className="outline-button" disabled={!addExerciseId} type="button" onClick={addToDraft}><Plus size={17} /> Aggiungi</button></div>
          {planDraft.items.length === 0 && <div className="empty-state">La scheda è vuota. Seleziona almeno un esercizio dalla libreria.</div>}
          <div className="chosen-exercises">{planDraft.items.map((item, index) => {
            const ex = selectedExercise(item);
            return <div className="chosen-exercise" key={item.id}><img src={ex.imageUrl} alt="" />
              <div className="chosen-content"><strong>{index + 1}. {ex.name}</strong><div className="chosen-inputs"><label>Serie<input value={item.sets} onChange={e => updateDraftItem(item.id, { sets: e.target.value })} /></label>
                <label>Ripetizioni / durata<input value={item.reps} onChange={e => updateDraftItem(item.id, { reps: e.target.value })} /></label>
                <label>Note<input value={item.notes} onChange={e => updateDraftItem(item.id, { notes: e.target.value })} /></label></div></div>
              <div className="reorder-actions"><button type="button" className="icon-btn" disabled={index === 0} title="Sposta su" onClick={() => shiftDraftItem(index, -1)}><ArrowUp size={16} /></button>
                <button type="button" className="icon-btn" disabled={index === planDraft.items.length - 1} title="Sposta giù" onClick={() => shiftDraftItem(index, 1)}><ArrowDown size={16} /></button>
                <button type="button" className="icon-btn danger-link" title="Rimuovi esercizio" onClick={() => setPlanDraft({ ...planDraft, items: planDraft.items.filter(i => i.id !== item.id) })}><X size={18} /></button></div>
            </div>;
          })}</div>
          <div className="modal-actions"><button className="outline-button" type="button" onClick={() => setPlanDraft(null)}>Annulla</button><button disabled={busy} className="primary-button" type="submit"><Check size={17} /> Salva scheda</button></div>
        </form>
      </Modal>}

      {lessonDraft && <Modal title={workspace.lessons.some(l => l.id === lessonDraft.id) ? 'Modifica lezione' : 'Nuova lezione'} onClose={() => setLessonDraft(null)}>
        <form className="modal-form" onSubmit={event => void saveLesson(event)}>
          <label>Nome lezione *<input value={lessonDraft.title} required onChange={e => setLessonDraft({ ...lessonDraft, title: e.target.value })} placeholder="Pilates Arcore" /></label>
          <div className="form-grid"><label>Giorno *<input type="date" required value={lessonDraft.date} onChange={e => setLessonDraft({ ...lessonDraft, date: e.target.value })} /></label>
            <label>Ora *<input type="time" required value={lessonDraft.time} onChange={e => setLessonDraft({ ...lessonDraft, time: e.target.value })} /></label></div>
          <label>Dove / sede<input value={lessonDraft.location} onChange={e => setLessonDraft({ ...lessonDraft, location: e.target.value })} placeholder="Es. Palestra Arcore" /></label>
          <label>Scheda associata<select value={lessonDraft.planId} onChange={e => setLessonDraft({ ...lessonDraft, planId: e.target.value })}>
            <option value="">Nessuna scheda</option>{workspace.plans.map(plan => <option key={plan.id} value={plan.id}>{plan.title} {plan.status === 'archived' ? '(archiviata)' : ''}</option>)}</select></label>
          {lessonDraft.planId && selectedPlan(lessonDraft.planId) && <div className="linked-plan"><FileText size={17} /><span>{selectedPlan(lessonDraft.planId)?.items.length} esercizi nella scheda</span><button type="button" onClick={() => { setPreviewPlan(selectedPlan(lessonDraft.planId)!); }}>Visualizza <ArrowRight size={14} /></button></div>}
          <label>Organizzazione / note<textarea rows={2} value={lessonDraft.notes} onChange={e => setLessonDraft({ ...lessonDraft, notes: e.target.value })} placeholder="Materiale da portare, indicazioni per la lezione..." /></label>
          <label className="check-row"><input type="checkbox" checked={lessonDraft.completed} onChange={e => setLessonDraft({ ...lessonDraft, completed: e.target.checked })} /> Lezione completata</label>
          <div className="modal-actions">{workspace.lessons.some(l => l.id === lessonDraft.id) && <button className="text-button danger-link" type="button" onClick={() => deleteLesson(lessonDraft)}><Trash2 size={16} /> Elimina</button>}
            <button className="outline-button" type="button" onClick={() => setLessonDraft(null)}>Annulla</button><button disabled={busy} className="primary-button" type="submit"><Check size={17} /> Salva lezione</button></div>
        </form>
      </Modal>}

      {previewPlan && <Modal title={previewPlan.title} onClose={() => setPreviewPlan(null)} wide>
        <div className="preview-modal"><div className="preview-info"><Badge tone={previewPlan.status === 'active' ? 'mint' : 'gray'}>{previewPlan.status === 'active' ? 'Attiva' : 'Archiviata'}</Badge>
          <span>{previewPlan.group}</span><span>{formatDate(previewPlan.startDate)} · {previewPlan.durationWeeks} settimane</span></div>
          {previewPlan.notes && <p>{previewPlan.notes}</p>}
          {previewPlan.items.map((item, index) => {
            const ex = selectedExercise(item);
            return <div className="preview-item" key={item.id}><img src={ex.imageUrl} alt={`Immagine ${ex.name}`} /><div><strong>{index + 1}. {ex.name}</strong>
              <span>{item.sets} serie · {item.reps || ex.repetitions} · {ex.equipment}</span><p>{ex.description}</p>
              {item.notes && <small>Note: {item.notes}</small>}{(ex.gallery?.length ?? 0) > 0 && <div className="mini-gallery">{ex.gallery?.map((photo, i) => <img key={i} src={photo.imageUrl} alt={`Passaggio ${i + 1}`} />)}</div>}{ex.variations.length > 0 && <details><summary>Varianti disponibili</summary><ul>{ex.variations.map((v, i) => <li key={i}>{v}</li>)}</ul></details>}</div></div>;
          })}
          <div className="modal-actions"><button className="outline-button" onClick={() => { const plan = previewPlan; setPreviewPlan(null); openPlan(plan); }}><Edit3 size={16} /> Modifica</button>
            <button disabled={busy} className="primary-button" onClick={() => void pdfPlan(previewPlan)}><Download size={17} /> Scarica PDF con immagini</button></div>
        </div>
      </Modal>}

      {mobileOpen && <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />}
      {!firebaseEnabled && <button className="demo-reset" title="Reimposta i dati dimostrativi" onClick={() => {
        if (window.confirm('Ripristinare la demo? Le tue modifiche locali andranno perse.')) { resetDemo(); void refresh(uid); }
      }}><RotateCcw size={14} /> Reset demo</button>}
    </div>
  );
}

export default App;
