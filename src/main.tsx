import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConfigProvider, theme } from "antd";
import zhCN from "antd/locale/zh_CN";
import "antd/dist/reset.css"; // Ant Design V6 reset styles
import "./index.css";
import App from "./App";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

// Removed StrictMode to prevent double useEffect calls in development
// which causes game initialization to run twice
createRoot(rootElement).render(
  <ConfigProvider
    locale={zhCN}
    theme={{
      algorithm: theme.darkAlgorithm,
      token: {
        // Brand Colors
        colorPrimary: "#667eea",
        colorSuccess: "#10b981",
        colorWarning: "#f59e0b",
        colorError: "#ef4444",
        colorInfo: "#3b82f6",

        // Border & Radius
        borderRadius: 8,
        borderRadiusLG: 12,

        // Font
        fontSize: 14,
        fontSizeSM: 13,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',

        // Spacing
        padding: 16,
        paddingSM: 12,
        paddingXS: 8,
        paddingLG: 24,
        margin: 16,
        marginSM: 12,
        marginXS: 8,
      },
      components: {
        Button: {
          controlHeight: 56,
          controlHeightLG: 56,
          fontSize: 16,
          fontSizeLG: 18,
          paddingContentHorizontal: 24,
        },
        Card: {
          paddingLG: 32,
        },
      },
    }}
  >
    <App />
  </ConfigProvider>
);
