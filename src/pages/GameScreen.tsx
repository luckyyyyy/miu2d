import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Game } from "../components";

export default function GameScreen() {
  const navigate = useNavigate();
  const [windowSize, setWindowSize] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const updateSize = () => {
      setWindowSize({
        width: Math.min(window.innerWidth, 1280),
        height: Math.min(window.innerHeight - 20, 720),
      });
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  return (
    <div className="w-full h-full flex items-center justify-center">
      <Game width={windowSize.width} height={windowSize.height} />
      
      {/* Return to title button */}
      <button
        onClick={() => navigate("/")}
        className="absolute top-4 left-4 z-[100] px-4 py-2 bg-gray-500 text-white border-none rounded-lg cursor-pointer text-sm transition-colors pointer-events-auto hover:bg-gray-600"
      >
        ← 返回标题
      </button>
    </div>
  );
}
