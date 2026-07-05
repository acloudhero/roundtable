// src/vite-env.d.ts
// Purpose: Type references for Vite's virtual modules and any
//          vite-plugin-* virtual imports RoundTable uses.
//
// v0.12.0 Checkpoint K — adds vite-plugin-pwa types for
//   `virtual:pwa-register/react` (consumed by
//   src/components/PwaUpdateBanner.tsx).
//
// Without this reference, TypeScript reports a "Cannot find module
// 'virtual:pwa-register/react'" error at the import site. The plugin
// ships the declaration; we just need to opt in.

/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />
