export const localDateKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const addDays = (date: Date, days: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

export const formatDate = (date: string) => {
  if (!date) return '—';
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('it-IT', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
};

export const monthLabel = (date: Date) => date.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
export const newId = () => crypto.randomUUID();
