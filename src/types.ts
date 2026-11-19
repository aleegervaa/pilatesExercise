export type ExerciseImage = { imageUrl: string; imagePath?: string };

export type Exercise = {
  id: string;
  name: string;
  category: string;
  description: string;
  repetitions: string;
  equipment: string;
  variations: string[];
  imageUrl: string;
  imagePath?: string;
  gallery?: ExerciseImage[];
  createdAt: string;
};

export type WorkoutItem = {
  id: string;
  exerciseId: string;
  snapshot: Exercise;
  sets: string;
  reps: string;
  notes: string;
};

export type WorkoutPlan = {
  id: string;
  title: string;
  group: string;
  startDate: string;
  durationWeeks: number;
  status: 'active' | 'archived';
  notes: string;
  items: WorkoutItem[];
  createdAt: string;
};

export type Lesson = {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  planId: string;
  completed: boolean;
  notes: string;
};

export type Workspace = {
  exercises: Exercise[];
  plans: WorkoutPlan[];
  lessons: Lesson[];
};

export type Tab = 'dashboard' | 'calendar' | 'exercises' | 'plans' | 'history';
