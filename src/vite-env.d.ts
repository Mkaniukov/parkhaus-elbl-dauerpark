/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional: override submit URL (e.g. local Netlify dev proxy). */
  readonly VITE_SUBMIT_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
