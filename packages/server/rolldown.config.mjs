import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

/** @type {import('rolldown').RolldownOptions} */
export default {
  input: ["src/main.ts", "src/db/migrate.ts", "src/db/rehash-passwords.ts", "src/db/patch-null-scene-data.ts"],
  output: {
    format: "es",
    dir: "dist",
    entryFileNames: "[name].js",
    chunkFileNames: "[name].js",
    preserveModules: true,
    preserveModulesRoot: "src",
    sourcemap: true,
  },
  // npm 包和 node: 内置标记为外部；@miu2d/* 工作区包由 rolldown 直接打包
  external: (id) =>
    id.startsWith("node:") ||
    (!id.startsWith(".") &&
      !id.startsWith("/") &&
      !id.startsWith("@/") &&
      !id.startsWith("@miu2d/")),
  // JSON is handled natively by rolldown — @rollup/plugin-json no longer needed
  plugins: [
    // 解析 @miu2d/* 工作区包，从其 src 直接打包
    resolve({ resolveOnly: [/@miu2d\//] }),
    // Keep @rollup/plugin-typescript for emitDecoratorMetadata support (not yet in Oxc)
    typescript({
      tsconfig: "./tsconfig.build.json",
      compilerOptions: {
        module: "ESNext",
      },
    }),
  ],
};
