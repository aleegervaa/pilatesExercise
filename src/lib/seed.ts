import type { Exercise, Lesson, WorkoutPlan, Workspace } from '../types';
import { addDays, localDateKey } from './date';

const now = localDateKey(new Date());
const make = (slug: string, name: string, category: string, description: string, repetitions: string, equipment: string, variations: string[]): Exercise => ({
  id: `demo-${slug}`, name, category, description, repetitions, equipment, variations,
  imageUrl: `/exercises/${slug}.png`, createdAt: now,
});

export const sampleExercises: Exercise[] = [
  make('roll-up', 'Roll Up', 'Mobilità', 'Da supina, articolare lentamente la colonna per raggiungere la posizione seduta; tornare con controllo.', '6–8 ripetizioni', 'Tappetino', ['Roll Up con ginocchia piegate', 'Half Roll Back']),
  make('hundred', 'The Hundred', 'Core', 'Da supina, gambe in posizione controllata, sollevare capo e spalle e mantenere una respirazione regolare con piccoli movimenti delle braccia.', '5 cicli respiratori', 'Tappetino', ['Gambe piegate a tavolino', 'Piedi appoggiati al pavimento']),
  make('single-leg-stretch', 'Single Leg Stretch', 'Core', 'Alternare la flessione delle gambe mantenendo stabile il bacino e il controllo addominale.', '10 per lato', 'Tappetino', ['Testa appoggiata per semplificare']),
  make('double-leg-stretch', 'Double Leg Stretch', 'Core', 'Allungare contemporaneamente braccia e gambe in controllo e tornare alla posizione iniziale.', '8 ripetizioni', 'Tappetino', ['Escursione ridotta delle gambe']),
  make('bridge', 'Shoulder Bridge', 'Glutei', 'Da supina con ginocchia piegate, sollevare gradualmente il bacino e ridiscendere vertebra per vertebra.', '10 ripetizioni', 'Tappetino', ['Ponte con una gamba solo se appropriato']),
  make('spine-twist', 'Spine Twist', 'Mobilità', 'Da seduta, allungare la colonna e ruotare il busto senza perdere l’allineamento.', '6 per lato', 'Tappetino', ['Seduta su un supporto']),
  make('side-kick', 'Side Kick', 'Gambe', 'Sul fianco, muovere la gamba superiore avanti e indietro mantenendo il tronco stabile.', '10 per lato', 'Tappetino', ['Piccola ampiezza del movimento']),
  make('swimming', 'Swimming', 'Schiena', 'Da prona, alternare il sollevamento di braccio e gamba opposti mantenendo un movimento controllato.', '20–30 secondi', 'Tappetino', ['Alternare un arto alla volta']),
  make('plank', 'Plank', 'Core', 'Mantenere un allineamento stabile di testa, tronco e bacino senza trattenere il respiro.', '20–40 secondi', 'Tappetino', ['Plank sulle ginocchia']),
  make('cat-stretch', 'Cat Stretch', 'Mobilità', 'In quadrupedia, alternare flessione ed estensione controllata della colonna.', '8 ripetizioni', 'Tappetino', ['Ampiezza ridotta']),
  make('squat', 'Pilates Squat', 'Gambe', 'Piegare anche e ginocchia con busto allungato, quindi tornare in posizione eretta.', '12 ripetizioni', 'Senza attrezzi', ['Squat con palla morbida']),
  make('affondi-rotazione', 'Affondi con rotazione busto', 'Equilibrio', 'Eseguire un affondo controllato e aggiungere una rotazione dolce del busto.', '8 per lato', 'Senza attrezzi', ['Affondo statico', 'Rotazione busto senza affondo']),
];

const demoPlan = (id: string, title: string, group: string, indices: number[], startDate: string, status: WorkoutPlan['status']): WorkoutPlan => ({
  id, title, group, startDate, durationWeeks: 6, status, createdAt: startDate,
  notes: 'Lezione dimostrativa: personalizzare progressioni e tempi in base al gruppo.',
  items: indices.map((index, position) => ({
    id: `item-${id}-${index}`, exerciseId: sampleExercises[index].id,
    snapshot: sampleExercises[index], sets: position === 0 ? '1' : '2',
    reps: sampleExercises[index].repetitions, notes: '',
  })),
});

export const demoWorkspace: Workspace = {
  exercises: sampleExercises,
  plans: [
    demoPlan('plan-arcore', 'Pilates Flow • Base', 'Pilates Arcore', [9, 4, 0, 1, 5], now, 'active'),
    demoPlan('plan-concorezzo', 'Total Body • Intermedio', 'Pilates Concorezzo', [10, 11, 6, 8, 7], now, 'active'),
    demoPlan('plan-history', 'Mobilità & Core • Ottobre', 'Pilates Arcore', [9, 5, 2], localDateKey(addDays(new Date(), -35)), 'archived'),
  ],
  lessons: [
    { id: 'lesson-1', title: 'Pilates Arcore', date: now, time: '18:30', location: 'Arcore', planId: 'plan-arcore', completed: false, notes: '' },
    { id: 'lesson-2', title: 'Pilates Concorezzo', date: localDateKey(addDays(new Date(), 2)), time: '19:00', location: 'Concorezzo', planId: 'plan-concorezzo', completed: false, notes: '' },
    { id: 'lesson-3', title: 'Pilates Arcore', date: localDateKey(addDays(new Date(), 7)), time: '18:30', location: 'Arcore', planId: 'plan-arcore', completed: false, notes: '' },
  ] satisfies Lesson[],
};
