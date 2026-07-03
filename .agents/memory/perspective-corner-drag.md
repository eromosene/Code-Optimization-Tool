---
name: Perspective corner-drag + live warp
description: Pattern for interactive 4-corner perspective correction (OpenCV.js) with real-time re-warp on drag, used in the OMR grader's sheet alignment step.
---

When a user needs to manually mark/adjust the 4 corners of a skewed document photo and see a live-updating straightened result (rather than just an overlay drawn on the raw skewed image), use this structure:

- Keep corner points in the **raw image's natural pixel space** (not percentages), and convert to percentages only for CSS positioning of the drag handles. This keeps the math correct regardless of how the raw `<img>` is scaled/displayed.
- Use **two separate canvases**: a hidden "computation" canvas that `cv.warpPerspective` writes into (passed to the OpenCV helper function), and a separate visible "preview" canvas that a 2D `drawImage` copies the computation canvas's pixels into. This avoids coupling the OpenCV helper's API to whether a live preview is currently mounted, and avoids losing draw state when the preview canvas unmounts/remounts as the UI switches stages (re-sync it via `drawImage` whenever the stage becomes active again, in a `useEffect`).
- Throttle re-warps during drag with `requestAnimationFrame` (cancel-and-reschedule pattern) so a fast mousemove stream collapses to one warp per frame instead of queuing up redundant OpenCV calls.
- Before finalizing/locking in the alignment (e.g., a "Use This Alignment" button), run one more **synchronous, awaited** warp with the current corner state before reading `canvas.toDataURL()`. This avoids a race where the last rAF-throttled warp from a drag hasn't resolved yet and the locked-in image would be one frame stale.
- Track drag state with global `window` `mousemove`/`mouseup` listeners (not just element-scoped handlers) so dragging a small handle stays responsive even if the cursor briefly leaves the handle/image bounds.

**Why:** the naive approach (draw an SVG polygon/overlay on top of the raw photo) never actually corrects the image data, so downstream processing (e.g. bubble-darkness sampling) still operates on the skewed source and grid math on percentage-based overlays doesn't track real column positions when there's camera-angle skew.
