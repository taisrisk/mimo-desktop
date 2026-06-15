interface ImportMetaEnv {
  readonly VITE_MIMO_SERVER_HOST: string
  readonly VITE_MIMO_SERVER_PORT: string
  readonly VITE_MIMO_CHANNEL?: "dev" | "beta" | "prod"
  // Legacy aliases kept for OpenCode compatibility
  readonly VITE_OPENCODE_SERVER_HOST: string
  readonly VITE_OPENCODE_SERVER_PORT: string
  readonly VITE_OPENCODE_CHANNEL?: "dev" | "beta" | "prod"
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

export declare module "solid-js" {
  namespace JSX {
    interface Directives {
      sortable: true
    }
  }
}
