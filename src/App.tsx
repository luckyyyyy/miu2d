import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { TitleScreen, GameScreen, MapViewerScreen } from "./pages";

export default function App() {
  return (
    <div className="w-screen h-screen bg-[#0a0a14] overflow-hidden">
      <Router>
        <Routes>
          <Route path="/" element={<TitleScreen />} />
          <Route path="/game" element={<GameScreen />} />
          <Route path="/viewer" element={<MapViewerScreen />} />
        </Routes>
      </Router>
    </div>
  );
}
