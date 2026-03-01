import { AuthProvider, DeviceProvider, ThemeProvider, TRPCProvider } from "@miu2d/shared";
import { LoadingIcon } from "@miu2d/ui";
import { lazy, Suspense } from "react";
import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { PWAUpdatePrompt } from "./PWAUpdatePrompt";
import { LoginPage } from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";
import { RegisterPage } from "./pages/RegisterPage";
import { LandingPage } from "./pages/landing";

const GameScreen = lazy(() => import("@miu2d/game").then((m) => ({ default: m.GameScreen })));
const DashboardApp = lazy(() =>
  import("@miu2d/dashboard").then((m) => ({ default: m.DashboardApp })),
);

export default function App() {
  return (
    <TRPCProvider>
      <AuthProvider>
        <ThemeProvider>
          <DeviceProvider>
            <Router>
              <Suspense fallback={<div className="flex h-screen w-screen items-center justify-center"><LoadingIcon className="h-8 w-8 text-primary" /></div>}>
                <Routes>
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/game/:gameSlug" element={<GameScreen />} />
                  <Route path="/game/:gameSlug/share/:shareCode" element={<GameScreen />} />
                  <Route path="/dashboard/*" element={<DashboardApp />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Suspense>
            </Router>
            <PWAUpdatePrompt />
          </DeviceProvider>
        </ThemeProvider>
      </AuthProvider>
    </TRPCProvider>
  );
}
