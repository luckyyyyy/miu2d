/**
 * CurrentMissionHint Component
 * Displays the first/current mission on the screen as a hint
 * Shows the most recent memo entry (current task)
 */
import React, { useMemo, useEffect, useState } from "react";

interface CurrentMissionHintProps {
  memos: string[];
  screenWidth: number;
  screenHeight: number;
  onMemoClick?: () => void;
}

export const CurrentMissionHint: React.FC<CurrentMissionHintProps> = ({
  memos,
  screenWidth,
  screenHeight,
  onMemoClick,
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [prevMemoCount, setPrevMemoCount] = useState(memos.length);

  // Detect new memo added - trigger animation
  useEffect(() => {
    if (memos.length > prevMemoCount) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 1000);
      return () => clearTimeout(timer);
    }
    setPrevMemoCount(memos.length);
  }, [memos.length, prevMemoCount]);

  // Get the current task text (first few lines, combined)
  const currentTask = useMemo(() => {
    if (memos.length === 0) return null;

    // Find the first bullet point entry (●)
    // Combine all lines until we hit another bullet or end
    const lines: string[] = [];
    let foundBullet = false;

    for (let i = 0; i < memos.length && i < 5; i++) {
      const line = memos[i];
      if (line.startsWith("●")) {
        if (foundBullet) break; // Found second task
        foundBullet = true;
        lines.push(line);
      } else if (foundBullet) {
        lines.push(line);
      }
    }

    if (lines.length === 0) {
      // No bullet point found, just use first line
      return memos[0];
    }

    // Join lines, removing bullet for display
    const fullText = lines.join("");
    return fullText.replace(/^●/, "");
  }, [memos]);

  if (!currentTask) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 60,
        right: 16,
        maxWidth: 200,
        background: isAnimating
          ? "rgba(80, 60, 20, 0.9)"
          : "rgba(0, 0, 0, 0.7)",
        border: isAnimating
          ? "1px solid #ffd700"
          : "1px solid rgba(255, 215, 0, 0.3)",
        borderRadius: 4,
        padding: "8px 12px",
        cursor: "pointer",
        transition: "all 0.3s ease",
        boxShadow: isAnimating
          ? "0 0 10px rgba(255, 215, 0, 0.5)"
          : "0 2px 8px rgba(0, 0, 0, 0.3)",
        transform: isAnimating ? "scale(1.05)" : "scale(1)",
      }}
      onClick={(e) => {
        e.stopPropagation();
        onMemoClick?.();
      }}
      title="点击查看任务列表"
    >
      {/* Header */}
      <div
        style={{
          fontSize: 10,
          color: "#ffd700",
          marginBottom: 4,
          fontWeight: "bold",
          letterSpacing: 1,
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <span style={{ fontSize: 12 }}>📜</span>
        <span>当前任务</span>
      </div>

      {/* Task content */}
      <div
        style={{
          fontSize: 12,
          fontFamily: "SimSun, serif",
          color: "#fff",
          lineHeight: 1.5,
          wordBreak: "break-all",
        }}
      >
        {currentTask}
      </div>

      {/* Hint text */}
      <div
        style={{
          fontSize: 9,
          color: "#888",
          marginTop: 6,
          textAlign: "right",
        }}
      >
        点击查看详情
      </div>
    </div>
  );
};
