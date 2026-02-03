import { Outlet } from "react-router-dom";
import { EditorSidebar } from "./EditorSidebar";

/**
 * VS Code 风格的编辑器布局
 * 包含 Activity Bar + Sidebar + 主内容区域
 */
export function EditorLayout() {
  return (
    <div className="flex h-screen w-screen bg-[#1e1e1e] text-[#cccccc] overflow-hidden">
      {/* 侧边栏导航 (Activity Bar + Sidebar) */}
      <EditorSidebar />

      {/* 主内容区域 - Editor Area */}
      <main className="flex-1 overflow-hidden bg-[#1e1e1e]">
        <Outlet />
      </main>
    </div>
  );
}
