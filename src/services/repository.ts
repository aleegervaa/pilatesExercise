import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, firebaseEnabled, storage } from '../lib/firebase';
import { demoWorkspace, sampleExercises } from '../lib/seed';
import type { Exercise, Lesson, WorkoutPlan, Workspace } from '../types';

const storageKey = 'lalla-pilates-demo-v1';

function readLocal(): Workspace {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) return JSON.parse(stored) as Workspace;
  } catch { /* browser could disable storage */ }
  const demo = structuredClone(demoWorkspace);
  localStorage.setItem(storageKey, JSON.stringify(demo));
  return demo;
}
function writeLocal(data: Workspace) { localStorage.setItem(storageKey, JSON.stringify(data)); }

type Kind = keyof Workspace;
type RecordOf<T extends Kind> = Workspace[T][number];
const names: Record<Kind, string> = { exercises: 'exercises', plans: 'plans', lessons: 'lessons' };


export async function loadWorkspace(userId: string): Promise<Workspace> {
  if (!firebaseEnabled) return readLocal();

  if (!db || !userId) {
    throw new Error('Firebase non disponibile: effettua l’accesso.');
  }

  const firestore = db;
  const totalStart = performance.now();

  const [ex, pl, le] = await Promise.all(
    (Object.keys(names) as Kind[]).map(async (kind) => {
      const start = performance.now();

      try {
        const snapshot = await getDocs(
          collection(firestore, 'users', userId, names[kind])
        );

        console.log(
          `[Firestore] ${kind}: ${Math.round(performance.now() - start)} ms (${snapshot.size} documenti)`
        );

        return snapshot;
      } catch (error) {
        console.error(`[Firestore] Errore ${kind}:`, error);
        throw error;
      }
    })
  );

  console.log(
    `[Firestore] TOTALE: ${Math.round(performance.now() - totalStart)} ms`
  );

  return {
    exercises: ex.docs.map(d => d.data() as Exercise),
    plans: pl.docs.map(d => d.data() as WorkoutPlan),
    lessons: le.docs.map(d => d.data() as Lesson),
  };
}


/*export async function loadWorkspace(userId: string): Promise<Workspace> {
  if (!firebaseEnabled) return readLocal();
  if (!db || !userId) throw new Error('Firebase non disponibile: effettua l’accesso.');
  const [ex, pl, le] = await Promise.all(
    (Object.keys(names) as Kind[]).map(k => getDocs(collection(db, 'users', userId, names[k]))),
  );
  return {
    exercises: ex.docs.map(d => d.data() as Exercise),
    plans: pl.docs.map(d => d.data() as WorkoutPlan),
    lessons: le.docs.map(d => d.data() as Lesson),
  };
}*/

export async function saveRecord<T extends Kind>(userId: string, kind: T, value: RecordOf<T>): Promise<void> {
  if (!firebaseEnabled) {
    const data = readLocal();
    // Each collection has the same id field; this cast is only needed for the generic union.
    const records = data[kind] as Array<{ id: string }>;
    const index = records.findIndex(x => x.id === value.id);
    if (index < 0) records.push(value);
    else records[index] = value;
    writeLocal(data);
    return;
  }
  if (!db) throw new Error('Firestore non configurato.');
  await setDoc(doc(db, 'users', userId, names[kind], value.id), value);
}

export async function deleteRecord(userId: string, kind: Kind, id: string): Promise<void> {
  if (!firebaseEnabled) {
    const data = readLocal();
    const records = data[kind] as Array<{ id: string }>;
    const index = records.findIndex(x => x.id === id);
    if (index >= 0) records.splice(index, 1);
    writeLocal(data);
    return;
  }
  if (!db) throw new Error('Firestore non configurato.');
  await deleteDoc(doc(db, 'users', userId, names[kind], id));
}

export async function importSampleExercises(userId: string, existing: Exercise[]): Promise<number> {
  const missing = sampleExercises.filter(e => !existing.some(record => record.id === e.id));
  for (const ex of missing) await saveRecord(userId, 'exercises', ex);
  return missing.length;
}

async function readFileDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Impossibile leggere l’immagine.'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

export async function uploadExerciseImage(userId: string, file: File): Promise<{ imageUrl: string; imagePath?: string }> {
  if (!['image/jpeg', 'image/png'].includes(file.type)) throw new Error('Per il PDF scegli un file JPEG o PNG.');
  if (file.size > 4 * 1024 * 1024) throw new Error('L’immagine deve pesare meno di 4 MB.');
  if (!firebaseEnabled) {
    if (file.size > 550 * 1024) throw new Error('In demo le immagini devono pesare meno di 550 KB (limite localStorage).');
    return { imageUrl: await readFileDataUrl(file) };
  }
  if (!storage) throw new Error('Firebase Storage non configurato.');
  const ext = file.type === 'image/png' ? 'png' : 'jpg';
  const imagePath = `exercise-images/${userId}/${crypto.randomUUID()}.${ext}`;
  const destination = ref(storage, imagePath);
  await uploadBytes(destination, file, { contentType: file.type });
  return { imageUrl: await getDownloadURL(destination), imagePath };
}

export function resetDemo() {
  if (firebaseEnabled) return;
  localStorage.removeItem(storageKey);
}
