declare global {
  interface Window {
    cv: any;
    Module: any;
    onOpenCvReady: () => void;
  }
}

export type Point = { x: number; y: number };
export type SheetCorners = [Point, Point, Point, Point];

// Versioned, immutable jsDelivr build — served with `Cache-Control: max-age=31536000, immutable`,
// so once a browser has fetched it once it will not re-download it on later visits.
const OPENCV_CDN_URL =
  "https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.10.0-release.1/dist/opencv.js";

let cvReadyPromise: Promise<any> | null = null;

/**
 * Kicks off (or reuses) the OpenCV.js load. Safe to call multiple times —
 * intended to be called early (e.g. as soon as a template is selected) so
 * the WASM module has time to finish loading in the background before the
 * user actually needs it.
 */
export function loadOpenCV(): Promise<any> {
  if (cvReadyPromise) return cvReadyPromise;

  cvReadyPromise = new Promise((resolve, reject) => {
    if (typeof window.cv !== "undefined" && window.cv.Mat) {
      resolve(window.cv);
      return;
    }

    // Generous absolute ceiling in case the network stalls entirely — the
    // user-facing timeout is enforced separately by waitForOpenCV().
    const timeout = setTimeout(() => {
      reject(new Error("OpenCV.js load timeout (60 s)"));
    }, 60_000);

    window.Module = {
      onRuntimeInitialized() {
        clearTimeout(timeout);
        resolve(window.cv);
      },
    };

    if (document.querySelector('script[data-opencv="true"]')) {
      return;
    }

    const script = document.createElement("script");
    script.setAttribute("data-opencv", "true");
    script.async = true;
    script.src = OPENCV_CDN_URL;
    script.onerror = () => {
      clearTimeout(timeout);
      cvReadyPromise = null;
      reject(new Error("Failed to load OpenCV.js from CDN"));
    };
    document.head.appendChild(script);
  });

  return cvReadyPromise;
}

/**
 * Waits for OpenCV to become ready, bounded by `timeoutMs`. Does NOT cancel
 * the underlying background load on timeout — if it finishes shortly after,
 * a later retry will resolve immediately.
 */
export function waitForOpenCV(timeoutMs = 10_000): Promise<any> {
  const cvPromise = loadOpenCV();

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`OpenCV not ready within ${timeoutMs}ms`));
    }, timeoutMs);

    cvPromise.then(
      (cv) => {
        clearTimeout(timer);
        resolve(cv);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function orderCorners(pts: Point[]): SheetCorners {
  const summed = pts.map((p) => ({ p, s: p.x + p.y, d: p.y - p.x }));
  summed.sort((a, b) => a.s - b.s);
  const tl = summed[0].p;
  const br = summed[summed.length - 1].p;
  summed.sort((a, b) => a.d - b.d);
  const tr = summed[0].p;
  const bl = summed[summed.length - 1].p;
  return [tl, tr, br, bl];
}

function imageToCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(img, 0, 0);
  return canvas;
}

export async function detectSheetCorners(
  imageElement: HTMLImageElement
): Promise<SheetCorners | null> {
  const cv = await loadOpenCV();

  const srcCanvas = imageToCanvas(imageElement);
  const imageArea = srcCanvas.width * srcCanvas.height;

  let src = cv.imread(srcCanvas);
  let gray = new cv.Mat();
  let blurred = new cv.Mat();
  let edges = new cv.Mat();
  let dilated = new cv.Mat();
  let contours = new cv.MatVector();
  let hierarchy = new cv.Mat();

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    cv.Canny(blurred, edges, 50, 150);

    const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
    cv.dilate(edges, dilated, kernel);
    kernel.delete();

    cv.findContours(
      dilated,
      contours,
      hierarchy,
      cv.RETR_EXTERNAL,
      cv.CHAIN_APPROX_SIMPLE
    );

    let bestCorners: Point[] | null = null;
    let bestArea = 0;

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const peri = cv.arcLength(contour, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(contour, approx, 0.02 * peri, true);

      if (approx.rows === 4) {
        const area = Math.abs(cv.contourArea(approx));
        if (area > bestArea) {
          bestArea = area;
          bestCorners = [];
          for (let j = 0; j < 4; j++) {
            bestCorners.push({
              x: approx.data32S[j * 2],
              y: approx.data32S[j * 2 + 1],
            });
          }
        }
      }
      approx.delete();
      contour.delete();
    }

    const MIN_AREA_FRACTION = 0.1;
    if (!bestCorners || bestArea < imageArea * MIN_AREA_FRACTION) {
      return null;
    }

    return orderCorners(bestCorners);
  } finally {
    src.delete();
    gray.delete();
    blurred.delete();
    edges.delete();
    dilated.delete();
    contours.delete();
    hierarchy.delete();
  }
}

export async function perspectiveCorrect(
  imageElement: HTMLImageElement,
  corners: SheetCorners,
  outputCanvas: HTMLCanvasElement
): Promise<void> {
  const cv = await loadOpenCV();

  const srcCanvas = imageToCanvas(imageElement);

  const [tl, tr, br, bl] = corners;
  const widthTop = Math.hypot(tr.x - tl.x, tr.y - tl.y);
  const widthBottom = Math.hypot(br.x - bl.x, br.y - bl.y);
  const heightLeft = Math.hypot(bl.x - tl.x, bl.y - tl.y);
  const heightRight = Math.hypot(br.x - tr.x, br.y - tr.y);

  const maxWidth = Math.round(Math.max(widthTop, widthBottom));
  const maxHeight = Math.round(Math.max(heightLeft, heightRight));

  let src = cv.imread(srcCanvas);
  let dst = new cv.Mat();

  const srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
    tl.x, tl.y,
    tr.x, tr.y,
    br.x, br.y,
    bl.x, bl.y,
  ]);
  const dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0, 0,
    maxWidth - 1, 0,
    maxWidth - 1, maxHeight - 1,
    0, maxHeight - 1,
  ]);

  try {
    const M = cv.getPerspectiveTransform(srcPts, dstPts);
    cv.warpPerspective(
      src,
      dst,
      M,
      new cv.Size(maxWidth, maxHeight),
      cv.INTER_LINEAR,
      cv.BORDER_CONSTANT,
      new cv.Scalar()
    );
    M.delete();

    outputCanvas.width = maxWidth;
    outputCanvas.height = maxHeight;
    cv.imshow(outputCanvas, dst);
  } finally {
    src.delete();
    dst.delete();
    srcPts.delete();
    dstPts.delete();
  }
}

export async function detectAndCorrectSheet(
  imageElement: HTMLImageElement,
  outputCanvas: HTMLCanvasElement
): Promise<SheetCorners | null> {
  const corners = await detectSheetCorners(imageElement);
  if (!corners) return null;
  await perspectiveCorrect(imageElement, corners, outputCanvas);
  return corners;
}
