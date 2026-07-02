---
name: OpenCV.js loading strategy
description: CDN choice for long-term caching, when to trigger background load, and how to layer timeouts for large WASM libraries.
---

For client-side OpenCV.js (or similar large WASM bundles) loaded via CDN script injection in a browser app:

- Prefer a versioned, immutable CDN URL (e.g. jsDelivr serving an npm package by exact version) over an unversioned/mutable one. jsDelivr sends `Cache-Control: public, max-age=31536000, immutable` for pinned versions, so the browser HTTP cache alone handles repeat-visit caching — no need for a custom IndexedDB/localForage layer.
  - **Why:** docs.opencv.org's hosted build only sends `max-age=86400` (1 day), causing frequent re-downloads of a multi-MB file.
  - **How to apply:** when picking a CDN URL for any large static asset users will fetch repeatedly, check response headers (`curl -sI`) for `cache-control`/`immutable` before deciding; don't assume the "official" host has good caching.

- Start loading heavy optional libraries as early as there's a clear user-intent signal (e.g. selecting a template/step), not on page mount and not only at the point of actual use. Fire-and-forget (`.catch(() => {})`) so it doesn't block UI.

- Layer two timeouts: a short, user-facing wait (e.g. 10s) at the point where the feature is actually needed, separate from a much longer absolute ceiling (e.g. 60s) inside the loader itself. The short wait should NOT cancel the underlying load promise on timeout — if the library finishes loading shortly after, a retry should resolve instantly instead of restarting the load.

- Never show a blocking/technical loading panel for background infra loading. Use a small inline spinner only while a user-triggered action is actually waiting, and a plain-language fallback message (not the raw error) if the timeout is hit.
