import { initWasm } from "@miu2d/engine/wasm";
import { createRoot } from "react-dom/client";
import "@miu2d/shared/i18n"; // 初始化 i18n
import "./styles/index.css";
import App from "./App";

// ── PWA install prompt ────────────────────────────────────────────────────────
// main.tsx 是同步入口，不是懒加载 chunk，能在 beforeinstallprompt 触发前注册。
// 捕获后存入 window.__pwaPrompt，并派发 CustomEvent 通知已挂载的组件。
declare global {
  interface Window {
    __pwaPrompt: Event | null;
    __pwaInstalled?: boolean;
  }
}
window.__pwaPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  window.__pwaPrompt = e;
  window.dispatchEvent(new CustomEvent("pwa-prompt-ready"));
});
window.addEventListener("appinstalled", () => {
  window.__pwaPrompt = null;
  window.__pwaInstalled = true;
  window.dispatchEvent(new CustomEvent("pwa-prompt-ready"));
});
// ─────────────────────────────────────────────────────────────────────────────

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

// 初始化 WASM 后再渲染应用
initWasm().then(() => {
  createRoot(rootElement).render(<App />);
});
