import { Template } from "./store";

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedAnswer {
  question: number;
  answer: string;
  confidence: number;
}

const OPTION_LABELS = ["A", "B", "C", "D", "E"];

export async function processOMRImage(
  imageElement: HTMLImageElement,
  template: Template,
  gridBounds: BoundingBox
): Promise<DetectedAnswer[]> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  
  if (!ctx) throw new Error("Could not get canvas context");

  // Draw the image at its natural size
  canvas.width = imageElement.naturalWidth;
  canvas.height = imageElement.naturalHeight;
  ctx.drawImage(imageElement, 0, 0);

  const results: DetectedAnswer[] = [];

  // The grid bounds are defined relative to the displayed image size,
  // so we need to map them back to the natural image size.
  // Assuming gridBounds comes in as percentages or we map it before calling.
  // Actually, let's assume gridBounds is in the natural image space.
  
  // Calculate the spacing
  const cellWidth = gridBounds.width / template.optionsPerQuestion;
  const cellHeight = gridBounds.height / template.questionCount;
  
  // The radius of the circle to check (a bit smaller than the cell)
  const radius = Math.min(cellWidth, cellHeight) * 0.3;

  for (let q = 0; q < template.questionCount; q++) {
    let darkestOption = -1;
    let maxDarkness = -1;
    let allDarkness: number[] = [];

    const centerY = gridBounds.y + (q + 0.5) * cellHeight;

    for (let o = 0; o < template.optionsPerQuestion; o++) {
      const centerX = gridBounds.x + (o + 0.5) * cellWidth;
      
      // Calculate average darkness in this circle
      const darkness = calculateAverageDarkness(ctx, centerX, centerY, radius);
      allDarkness.push(darkness);

      if (darkness > maxDarkness) {
        maxDarkness = darkness;
        darkestOption = o;
      }
    }

    // Sort to find the difference between darkest and second darkest (confidence)
    const sorted = [...allDarkness].sort((a, b) => b - a);
    const primary = sorted[0];
    const secondary = sorted[1];
    
    // Confidence is relative diff between darkest and second darkest
    let confidence = 0;
    if (primary > 0) {
      confidence = Math.max(0, Math.min(100, ((primary - secondary) / primary) * 100));
    }
    
    // Threshold to ensure it's actually marked (if the darkest is very light, maybe empty)
    // 0 is white, 255 is black
    const isEmpty = primary < 30; // Threshold of darkness out of 255
    
    results.push({
      question: q,
      answer: isEmpty ? "" : OPTION_LABELS[darkestOption],
      confidence: isEmpty ? 100 : confidence,
    });
  }

  return results;
}

function calculateAverageDarkness(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number
): number {
  const x = Math.max(0, Math.floor(centerX - radius));
  const y = Math.max(0, Math.floor(centerY - radius));
  const size = Math.ceil(radius * 2);
  
  try {
    const imageData = ctx.getImageData(x, y, size, size);
    const data = imageData.data;
    
    let totalDarkness = 0;
    let count = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Convert to grayscale
      const brightness = (r * 0.299 + g * 0.587 + b * 0.114);
      
      // We want darkness, so invert it
      const darkness = 255 - brightness;
      
      totalDarkness += darkness;
      count++;
    }

    return count === 0 ? 0 : totalDarkness / count;
  } catch (e) {
    return 0; // Out of bounds
  }
}
