interface ImportMetaEnv {
  readonly VITE_DEMO_RESOURCES_DOMAIN?: string;
  readonly [key: string]: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Build-time constants injected by Vite define.
 * See packages/web/vite.config.ts
 */
declare const __COMMIT_HASH__: string;
declare const __APP_VERSION__: string;
