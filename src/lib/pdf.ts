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

async function blobAsCompressedDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(blob);

    image.onload = () => {
      try {
        const MAX_WIDTH = 640;
        const MAX_HEIGHT = 480;

        const ratio = Math.min(
          MAX_WIDTH / image.width,
          MAX_HEIGHT / image.height,
          1
        );

        const width = Math.round(image.width * ratio);
        const height = Math.round(image.height * ratio);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');

        if (!ctx) {
          throw new Error('Impossibile elaborare l’immagine.');
        }

        // Sfondo bianco per eventuali PNG trasparenti
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        ctx.drawImage(image, 0, 0, width, height);

        // JPEG compresso al 72%
        const dataUrl = canvas.toDataURL('image/jpeg', 0.72);

        URL.revokeObjectURL(url);
        resolve(dataUrl);
      } catch (error) {
        URL.revokeObjectURL(url);
        reject(error);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('L’immagine non può essere letta.'));
    };

    image.src = url;
  });
}

async function loadImage(exercise: Exercise): Promise<string | null> {
  // L'immagine NON è più obbligatoria
  if (!exercise.imageUrl && !exercise.imagePath) {
    return null;
  }

  try {
    let source: Blob;

    if (exercise.imagePath && storage) {
      source = await getBlob(ref(storage, exercise.imagePath));
    } else if (exercise.imageUrl?.startsWith('data:image/')) {
      const response = await fetch(exercise.imageUrl);
      source = await response.blob();
    } else if (exercise.imageUrl) {
      const response = await fetch(exercise.imageUrl);

      if (!response.ok) {
        return null;
      }

      source = await response.blob();
    } else {
      return null;
    }

    return await blobAsCompressedDataURL(source);
  } catch (error) {
    console.warn(
      `Impossibile caricare l’immagine di "${exercise.name}".`,
      error
    );

    // Il PDF continua anche senza immagine
    return null;
  }
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

  pdf.text(`PAGINA ${page}`, pageWidth - margin, 12, {
    align: 'right',
  });
}

function addFooter(pdf: Doc) {
  pdf.setDrawColor(220, 230, 221);
  pdf.line(margin, 280, pageWidth - margin, 280);

  pdf.setFontSize(8);
  pdf.setTextColor(...muted);

  pdf.text(
    'Scheda Pilates • preparata dall’insegnante',
    margin,
    287
  );
}

function ensurePage(
  pdf: Doc,
  cursor: number,
  needed: number,
  page: { current: number }
): number {
  if (cursor + needed <= 271) {
    return cursor;
  }

  addFooter(pdf);
  pdf.addPage();

  page.current += 1;

  addHeader(pdf, page.current);

  return 26;
}

function wrap(
  pdf: Doc,
  text: string,
  maxWidth: number,
  maxLines = 6
): string[] {
  return pdf
    .splitTextToSize(text || '—', maxWidth)
    .slice(0, maxLines) as string[];
}

export async function downloadPlanPdf(
  plan: WorkoutPlan,
  exercises: Exercise[]
): Promise<void> {
  if (!plan.items.length) {
    throw new Error('La scheda non contiene esercizi.');
  }

  const content = plan.items.map(item => ({
    item,
    exercise:
      exercises.find(ex => ex.id === item.exerciseId) ??
      item.snapshot,
  }));

  /*
   * L'immagine principale è facoltativa.
   * Un'immagine non disponibile non blocca più il PDF.
   */
  const pictures = await Promise.all(
    content.map(({ exercise }) => loadImage(exercise))
  );

  /*
   * Anche le immagini aggiuntive sono facoltative.
   * Se una foto non funziona viene semplicemente ignorata.
   */
  const galleryPictures = await Promise.all(
    content.map(async ({ exercise }) => {
      const gallery = exercise.gallery ?? [];

      const images = await Promise.all(
        gallery.map(photo =>
          loadImage({
            ...exercise,
            ...photo,
          })
        )
      );

      return images.filter(
        (image): image is string => image !== null
      );
    })
  );

  const pdf = new jsPDF({
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const page = {
    current: 1,
  };

  addHeader(pdf, 1);

  let y = 31;

  /*
   * TITOLO
   */

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(23);
  pdf.setTextColor(...ink);

  const titleLines = wrap(
    pdf,
    plan.title,
    pageWidth - margin * 2,
    3
  );

  pdf.text(titleLines, margin, y);

  y += titleLines.length * 9 + 3;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.setTextColor(...muted);

  pdf.text(
    `${plan.group || 'Pilates'}  •  Dal ${formatDate(
      plan.startDate
    )}  •  ${plan.durationWeeks} settimane`,
    margin,
    y
  );

  y += 11;

  /*
   * NOTE SCHEDA
   */

  if (plan.notes) {
    pdf.setFontSize(10);

    const notes = wrap(
      pdf,
      plan.notes,
      173,
      4
    );

    pdf.text(notes, margin, y);

    y += notes.length * 5 + 5;
  }

  pdf.setDrawColor(205, 221, 211);
  pdf.line(margin, y, pageWidth - margin, y);

  y += 8;

  /*
   * ESERCIZI
   */

  content.forEach(({ item, exercise }, index) => {
    y = ensurePage(
      pdf,
      y,
      64,
      page
    );

    const imageData = pictures[index];

    /*
     * Card più bassa rispetto alla versione precedente.
     */
    const cardHeight = 58;

    pdf.setFillColor(249, 251, 248);

    pdf.roundedRect(
      margin,
      y,
      178,
      cardHeight,
      3,
      3,
      'F'
    );

    /*
     * FOTO PRINCIPALE
     *
     * Prima:
     * 66 × 44 mm
     *
     * Ora:
     * 38 × 28 mm
     */

    const imageX = margin + 5;
    const imageY = y + 7;

    const imageW = 38;
    const imageH = 28;

    if (imageData) {
      try {
        const props =
          pdf.getImageProperties(imageData);

        const ratio = Math.min(
          imageW / props.width,
          imageH / props.height
        );

        const width =
          props.width * ratio;

        const height =
          props.height * ratio;

        pdf.addImage(
          imageData,
          'JPEG',
          imageX + (imageW - width) / 2,
          imageY + (imageH - height) / 2,
          width,
          height,
          undefined,
          'FAST'
        );
      } catch (error) {
        console.warn(
          `Immagine PDF ignorata per ${exercise.name}`,
          error
        );
      }
    }

    /*
     * Se non c'è una foto utilizziamo tutto lo spazio
     * disponibile per il testo.
     */

    const textX = imageData
      ? margin + 49
      : margin + 6;

    const textWidth = imageData
      ? 123
      : 166;

    /*
     * NOME ESERCIZIO
     */

    pdf.setFont(
      'helvetica',
      'bold'
    );

    pdf.setFontSize(12.5);
    pdf.setTextColor(...ink);

    const nameLines = wrap(
      pdf,
      `${index + 1}. ${exercise.name}`,
      textWidth,
      2
    );

    pdf.text(
      nameLines,
      textX,
      y + 10
    );

    let bodyY =
      y +
      10 +
      nameLines.length * 5.4;

    /*
     * SERIE / RIPETIZIONI
     */

    pdf.setFont(
      'helvetica',
      'normal'
    );

    pdf.setFontSize(9.5);
    pdf.setTextColor(...green);

    const detailLines = wrap(
      pdf,
      `Serie: ${item.sets || '—'}  |  Rip.: ${
        item.reps ||
        exercise.repetitions ||
        '—'
      }`,
      textWidth,
      2
    );

    pdf.text(
      detailLines,
      textX,
      bodyY + 2
    );

    bodyY +=
      2 +
      detailLines.length * 4.4;

    /*
     * ATTREZZO
     */

    pdf.setTextColor(...muted);

    const toolLines = wrap(
      pdf,
      `Attrezzo: ${
        exercise.equipment || '—'
      }`,
      textWidth,
      2
    );

    pdf.text(
      toolLines,
      textX,
      bodyY + 2
    );

    bodyY +=
      2 +
      toolLines.length * 4.4;

    /*
     * DESCRIZIONE
     */

    const descLines = wrap(
      pdf,
      exercise.description,
      textWidth,
      4
    );

    pdf.text(
      descLines,
      textX,
      bodyY + 2
    );

    /*
     * NOTE / VARIANTI
     */

    const comment =
      item.notes ||
      (
        exercise.variations?.length
          ? `Varianti: ${exercise.variations.join(', ')}`
          : ''
      );

    if (comment) {
      pdf.setFontSize(8.5);
      pdf.setTextColor(...muted);

      pdf.text(
        wrap(
          pdf,
          comment,
          166,
          2
        ),
        margin + 6,
        y + 49
      );
    }

    y += cardHeight + 5;

    /*
     * FOTO AGGIUNTIVE
     */

    const extra =
      galleryPictures[index];

    if (extra.length > 0) {
      y = ensurePage(
        pdf,
        y,
        46,
        page
      );

      pdf.setFont(
        'helvetica',
        'bold'
      );

      pdf.setTextColor(...green);
      pdf.setFontSize(8.5);

      pdf.text(
        `SEQUENZA • ${exercise.name}`,
        margin,
        y + 2
      );

      y += 6;

      /*
       * Foto aggiuntive più piccole:
       * 4 per riga invece di 3.
       */

      extra.forEach(
        (data, imageIndex) => {
          if (
            imageIndex > 0 &&
            imageIndex % 4 === 0
          ) {
            y += 32;

            y = ensurePage(
              pdf,
              y,
              35,
              page
            );
          }

          const col =
            imageIndex % 4;

          try {
            const props =
              pdf.getImageProperties(data);

            const maxW = 39;
            const maxH = 27;

            const ratio =
              Math.min(
                maxW / props.width,
                maxH / props.height
              );

            const width =
              props.width * ratio;

            const height =
              props.height * ratio;

            pdf.addImage(
              data,
              'JPEG',
              margin +
                col * 44 +
                (maxW - width) / 2,
              y +
                (maxH - height) / 2,
              width,
              height,
              undefined,
              'FAST'
            );
          } catch (error) {
            console.warn(
              `Foto aggiuntiva ignorata per ${exercise.name}`,
              error
            );
          }
        }
      );

      const rows =
        Math.ceil(extra.length / 4);

      y += rows * 32 + 3;
    }
  });

  addFooter(pdf);

  /*
   * NOME FILE
   */

  const safeName =
    plan.title
      .replace(
        /[^a-z0-9\s_-]/gi,
        ''
      )
      .trim()
      .replace(/\s+/g, '_') ||
    'scheda';

  pdf.save(
    `Scheda_Pilates_${safeName}.pdf`
  );
}