import { jsPDF } from 'jspdf';
import { getBlob, ref } from 'firebase/storage';
import { storage } from './firebase';
import { formatDate } from './date';
import type { Exercise, WorkoutPlan } from '../types';

type Doc = InstanceType<typeof jsPDF>;
const ink: [number, number, number] = [29, 60, 54];
const muted: [number, number, number] = [98, 115, 107];
const green: [number, number, number] = [37, 112, 95];
const pageWidth = 210;
const margin = 16;

async function blobAsDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('L’immagine non può essere letta.'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

async function loadImage(exercise: Exercise): Promise<string> {
  if (!exercise.imageUrl && !exercise.imagePath) throw new Error(`Manca l’immagine dell’esercizio “${exercise.name}”.`);
  if (exercise.imageUrl.startsWith('data:image/')) return exercise.imageUrl;
  let source: Blob;
  if (exercise.imagePath && storage) {
    source = await getBlob(ref(storage, exercise.imagePath));
  } else {
    const response = await fetch(exercise.imageUrl);
    if (!response.ok) throw new Error(`Non riesco a caricare l’immagine di “${exercise.name}”.`);
    source = await response.blob();
  }
  return blobAsDataURL(source);
}

function addHeader(pdf: Doc, page: number) {
  pdf.setFillColor(242, 248, 243);
  pdf.rect(0, 0, pageWidth, 18, 'F');
  pdf.setTextColor(...ink);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text('LALLA  /  PILATES STUDIO', margin, 12);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...muted);
  pdf.setFontSize(9);
  pdf.text(`PAGINA ${page}`, pageWidth - margin, 12, { align: 'right' });
}

function addFooter(pdf: Doc) {
  pdf.setDrawColor(220, 230, 221);
  pdf.line(margin, 280, pageWidth - margin, 280);
  pdf.setFontSize(8);
  pdf.setTextColor(...muted);
  pdf.text('Scheda Pilates • preparata dall’insegnante', margin, 287);
}

function ensurePage(pdf: Doc, cursor: number, needed: number, page: { current: number }): number {
  if (cursor + needed <= 271) return cursor;
  addFooter(pdf);
  pdf.addPage();
  page.current += 1;
  addHeader(pdf, page.current);
  return 26;
}

function wrap(pdf: Doc, text: string, maxWidth: number, maxLines = 6): string[] {
  return pdf.splitTextToSize(text || '—', maxWidth).slice(0, maxLines) as string[];
}

export async function downloadPlanPdf(plan: WorkoutPlan, exercises: Exercise[]): Promise<void> {
  if (!plan.items.length) throw new Error('La scheda non contiene esercizi.');
  const content = plan.items.map(item => ({
    item,
    exercise: exercises.find(ex => ex.id === item.exerciseId) ?? item.snapshot,
  }));
  // Precarica TUTTE le immagini, e interrompi l’export se ne manca una:
  // una scheda dichiarata "con immagini" non viene scaricata incompleta.
  const pictures = await Promise.all(content.map(async ({ exercise }) => {
    try { return await loadImage(exercise); }
    catch (error) {
      const msg = error instanceof Error ? error.message : 'Errore di lettura.';
      throw new Error(`${msg} Se è su Firebase Storage, verifica le regole e la configurazione CORS.`);
    }
  }));

  const galleryPictures = await Promise.all(content.map(async ({ exercise }) => {
    const gallery = exercise.gallery ?? [];
    try { return await Promise.all(gallery.map(photo => loadImage({ ...exercise, ...photo }))); }
    catch { throw new Error(`Non riesco a incorporare una foto aggiuntiva di “${exercise.name}”. Controlla file e CORS.`); }
  }));

  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const page = { current: 1 };
  addHeader(pdf, 1);
  let y = 31;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(23);
  pdf.setTextColor(...ink);
  const titleLines = wrap(pdf, plan.title, pageWidth - margin * 2, 3);
  pdf.text(titleLines, margin, y);
  y += titleLines.length * 9 + 3;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.setTextColor(...muted);
  pdf.text(`${plan.group || 'Pilates'}  •  Dal ${formatDate(plan.startDate)}  •  ${plan.durationWeeks} settimane`, margin, y);
  y += 11;
  if (plan.notes) {
    pdf.setFontSize(10);
    const notes = wrap(pdf, plan.notes, 173, 4);
    pdf.text(notes, margin, y);
    y += notes.length * 5 + 5;
  }
  pdf.setDrawColor(205, 221, 211);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 10;

  content.forEach(({ item, exercise }, index) => {
    // Caratteri speciali sono mostrati se supportati dal font Helvetica.
    const start = ensurePage(pdf, y, 76, page);
    y = start;
    pdf.setFillColor(249, 251, 248);
    pdf.roundedRect(margin, y, 178, 69, 3, 3, 'F');
    const imageX = margin + 4;
    const imageY = y + 7;
    const imageW = 66;
    const imageH = 44;
    const imageData = pictures[index];
    try {
      const props = pdf.getImageProperties(imageData);
      const ratio = Math.min(imageW / props.width, imageH / props.height);
      const w = props.width * ratio;
      const h = props.height * ratio;
      pdf.addImage(imageData, props.fileType, imageX + (imageW - w) / 2, imageY + (imageH - h) / 2, w, h);
    } catch {
      throw new Error(`Il formato dell’immagine di “${exercise.name}” non è compatibile con il PDF. Usa PNG o JPEG.`);
    }
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12.5);
    pdf.setTextColor(...ink);
    const x = margin + 76;
    const lines = wrap(pdf, `${index + 1}. ${exercise.name}`, 95, 2);
    pdf.text(lines, x, y + 10);
    let bodyY = y + 10 + lines.length * 5.4;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9.5);
    pdf.setTextColor(...green);
    const detailLines = wrap(pdf, `Serie: ${item.sets || '—'}  |  Rip.: ${item.reps || exercise.repetitions || '—'}`, 95, 2);
    pdf.text(detailLines, x, bodyY + 2);
    bodyY += 2 + detailLines.length * 4.4;
    pdf.setTextColor(...muted);
    const toolLines = wrap(pdf, `Attrezzo: ${exercise.equipment || '—'}`, 95, 2);
    pdf.text(toolLines, x, bodyY + 2);
    bodyY += 2 + toolLines.length * 4.4;
    const descLines = wrap(pdf, exercise.description, 95, 5);
    pdf.text(descLines, x, bodyY + 2);
    pdf.setFontSize(8.5);
    pdf.setTextColor(...muted);
    const comment = item.notes || (exercise.variations.length ? `Varianti: ${exercise.variations.join(', ')}` : '');
    if (comment) pdf.text(wrap(pdf, comment, 64, 3), imageX, y + 56);
    y += 75;
    const extra = galleryPictures[index];
    if (extra.length > 0) {
      y = ensurePage(pdf, y, 58, page);
      pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...green); pdf.setFontSize(9);
      pdf.text(`SEQUENZA FOTOGRAFICA • ${exercise.name}`, margin, y + 2);
      y += 7;
      extra.forEach((data, imageIndex) => {
        if (imageIndex > 0 && imageIndex % 3 === 0) { y += 46; y = ensurePage(pdf, y, 50, page); }
        const col = imageIndex % 3;
        try {
          const props = pdf.getImageProperties(data);
          const ratio = Math.min(52 / props.width, 38 / props.height);
          const w = props.width * ratio, h = props.height * ratio;
          pdf.addImage(data, props.fileType, margin + col * 61 + (52 - w) / 2, y + (38 - h) / 2, w, h);
        } catch { throw new Error(`Foto aggiuntiva non valida per l'esercizio “${exercise.name}”.`); }
      });
      y += 48;
    }
  });
  addFooter(pdf);
  const safeName = plan.title.replace(/[^a-z0-9\s_-]/gi, '').trim().replace(/\s+/g, '_') || 'scheda';
  pdf.save(`Scheda_Pilates_${safeName}.pdf`);
}
