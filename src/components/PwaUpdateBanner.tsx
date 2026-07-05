// src/components/PwaUpdateBanner.tsx
// Purpose: v0.12.0 Checkpoint K — operator-prompted PWA update flow.
//
//   When vite-plugin-pwa's generated service worker detects a new
//   bundle, it waits in the 'installed' state rather than activating
//   automatically. This component bridges that state into the
//   RoundTable UI: a small banner above the main content tells the
//   operator a new version is ready and lets them choose when to
//   reload.
//
// Why prompted and not auto-update:
//   - Mid-import, the useMarkdownUpload hook holds transient state
//     (parsed preview, captured warnings) that is destroyed by a
//     reload. An auto-update would discard the operator's work
//     silently. Prompted updates preserve operator agency.
//   - The PWA readiness assessment (docs/PWA_READINESS.md § 8) calls
//     this out explicitly as the recommended strategy.
//
// Behavior:
//   - Renders nothing when no update is waiting (the common case).
//   - On `needRefresh: true`, renders an amber banner with two
//     buttons: "Reload to update" (calls updateServiceWorker) and
//     "Later" (dismisses the banner; the SW keeps waiting; the
//     banner reappears on the next page load).
//   - Also surfaces a one-time `offlineReady` toast equivalent so
//     the first-install operator knows the app is now cached for
//     offline use.
//
// Why a separate component (not inline in App.tsx):
//   - `useRegisterSW` is a hook from `virtual:pwa-register/react`.
//     Importing it through a dedicated component keeps the virtual-
//     module dependency localized and easier to mock for tests.
//   - The banner's lifecycle (visible/dismissed) is local concern;
//     keeping it self-contained avoids polluting App.tsx state.
//
// Owned by: this file
// Used by:  src/App.tsx (rendered above main content, next to
//           StoragePressureBanner).

import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export default function PwaUpdateBanner() {
  // useRegisterSW manages the SW lifecycle. We pass `onRegisteredSW`
  // so we can opportunistically request durable storage when the SW
  // is first installed (browsers expose this via navigator.storage).
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      // Opportunistically request durable storage. Best-effort: the
      // browser may deny it, may not implement it at all (older
      // browsers, some private modes), and may grant it silently. We
      // never block, never retry, never report failure to the user.
      requestPersistentStorage();
      // Log the SW URL so an operator inspecting devtools can see
      // which SW URL was registered (helps when a build path issue
      // makes the SW resolve to the wrong location).
      if (swUrl && registration) {
        // eslint-disable-next-line no-console
        console.info('[RoundTable] Service worker registered:', swUrl);
      }
    },
    onRegisterError(err) {
      // Registration failures should not break the app — without the
      // SW the operator simply loses offline capability and the
      // update prompt. We log and move on.
      // eslint-disable-next-line no-console
      console.warn('[RoundTable] Service worker registration failed:', err);
    },
  });

  // Banner-dismissed-by-user state. We let the operator hide the
  // banner without applying the update; the SW stays waiting and the
  // banner re-appears on the next page load (when useRegisterSW
  // re-detects the waiting worker).
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissal when a fresh update is detected (covers the rare
  // case where the operator dismisses one waiting SW, then a newer
  // build appears later in the same session).
  useEffect(() => {
    if (needRefresh) setDismissed(false);
  }, [needRefresh]);

  // First-install one-shot "offline ready" indicator. We collapse it
  // automatically after a few seconds — it's informational only.
  useEffect(() => {
    if (!offlineReady) return;
    const t = window.setTimeout(() => setOfflineReady(false), 8000);
    return () => window.clearTimeout(t);
  }, [offlineReady, setOfflineReady]);

  // Update available — the more important of the two banners.
  if (needRefresh && !dismissed) {
    return (
      <div
        className="pwa-update-banner pwa-update-banner-refresh"
        role="status"
        aria-live="polite"
      >
        <div className="pwa-update-banner-body">
          <div className="pwa-update-banner-headline">Update Available</div>
          <div className="pwa-update-banner-message">
            A new version of RoundTable has been downloaded. Reload to
            apply it. If you are mid-import or editing a round, finish
            first — your work will not be saved by the reload.
          </div>
        </div>
        <div className="pwa-update-banner-actions">
          <button
            className="btn btn-primary text-xs"
            onClick={() => updateServiceWorker(true)}
            style={{ minHeight: 32, padding: '4px 14px' }}
          >
            Reload to update
          </button>
          <button
            className="btn btn-ghost text-xs"
            onClick={() => {
              setDismissed(true);
              setNeedRefresh(false);
            }}
            style={{ minHeight: 32, padding: '4px 14px' }}
          >
            Later
          </button>
        </div>
      </div>
    );
  }

  // Offline-ready one-shot. Quieter visual treatment than the update
  // banner — green / informational, auto-dismisses after a few
  // seconds (effect above). We also allow manual dismissal.
  if (offlineReady) {
    return (
      <div
        className="pwa-update-banner pwa-update-banner-offline"
        role="status"
        aria-live="polite"
      >
        <div className="pwa-update-banner-body">
          <div className="pwa-update-banner-headline">Offline Ready</div>
          <div className="pwa-update-banner-message">
            RoundTable has been cached for offline use. The app shell
            will load even without a network connection.
          </div>
        </div>
        <div className="pwa-update-banner-actions">
          <button
            className="btn btn-ghost text-xs"
            onClick={() => setOfflineReady(false)}
            style={{ minHeight: 32, padding: '4px 14px' }}
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  return null;
}

/**
 * Opportunistically request durable storage from the browser.
 *
 * navigator.storage.persist() is available in Chromium and Firefox;
 * Safari does not yet implement it as of WebKit 18. Calling it on an
 * unsupported browser is safe — the optional chain guards against
 * missing API surface and the Promise just resolves false / never.
 *
 * Behavior:
 *   - We never block on the result; the call is fire-and-forget.
 *   - We never retry. A single attempt per page load is enough.
 *   - We never surface failures to the operator. If denial happens,
 *     the eviction policy follows the browser's default (LRU-ish);
 *     RoundTable's storage-pressure banner already covers the
 *     near-quota case.
 */
function requestPersistentStorage(): void {
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.storage &&
      typeof navigator.storage.persist === 'function'
    ) {
      void navigator.storage.persist().then(
        (granted) => {
          // eslint-disable-next-line no-console
          console.info(
            '[RoundTable] navigator.storage.persist() → ' +
              (granted ? 'granted (storage is durable)' : 'not granted (default eviction policy applies)')
          );
        },
        () => {
          // Promise rejected — extremely unusual; just swallow.
        }
      );
    }
  } catch {
    // Defensive: never throw from a fire-and-forget call.
  }
}
