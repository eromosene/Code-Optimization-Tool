---
name: OpenCV detection perf on large phone photos
description: Why full-resolution phone photos (12MP+) can hang OpenCV.js contour/circle detection, and the downscale-then-scale-back fix.
---

Real phone photos are commonly 12MP+ (e.g. 4032x3024). Running `cv.Canny` +
`cv.dilate` + `cv.findContours` (or `cv.HoughCircles`) directly on a
full-resolution image in OpenCV.js (WASM, single-threaded, main thread) is
extremely slow — easily tens of seconds or more — since these ops scale
with pixel count. On a small template/mock image this is invisible, but it
becomes a serious real-world bug the moment a user uploads an actual phone
photo instead of a small test image.

**Why:** These detection ops only need a coarse read (a quadrilateral or a
cluster's bounding box) — full resolution buys no meaningful accuracy, only
cost. Confirmed via manual testing with a real 4032x3024 photo in the
`omr-grader` app.

**How to apply:** For any OpenCV.js corner/shape/circle detection step, draw
the source image onto a canvas capped at ~1200px on the long edge, run
detection there, then divide detected coordinates by the scale factor to map
back to full-resolution space before using them (e.g. for a perspective warp
that should still operate at full resolution for output quality). Keep
single-pass ops like `warpPerspective` at full resolution — those are cheap
even on large images; it's the iterative/search ops (contours, Hough) that
must be downscaled.

Separately: end-to-end testing of async image-processing pipelines via the
`screenshot` app-preview tool is not reliable — each call is a fresh page
navigation captured very soon after load (sub-second to ~1s), so it cannot
observe state that only settles after CDN fetches or multi-second processing
complete. For this kind of pipeline, prefer reasoning through the code path
plus a fix informed by real test assets, rather than relying on screenshot
timing to "see" the async result land.
