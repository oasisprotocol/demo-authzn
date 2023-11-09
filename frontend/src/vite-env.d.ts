/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SAPPHIRE_JSONRPC: string
  readonly VITE_SAPPHIRE_CHAIN_ID: string
  readonly VITE_WEBAUTH_ADDR: string
  readonly VITE_TOTP_CONTRACT: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
