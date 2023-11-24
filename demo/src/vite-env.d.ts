/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SAPPHIRE_JSONRPC: string
  readonly VITE_SAPPHIRE_CHAIN_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
