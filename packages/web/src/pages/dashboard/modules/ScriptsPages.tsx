/**
 * 脚本编辑页面
 */
import { useState } from "react";
import { useParams } from "react-router-dom";
import { DashboardIcons } from "../icons";

export function ScriptsPage() {
  const { gameId } = useParams();
  const [selectedFile, setSelectedFile] = useState<string | null>("newgame");
  const [scriptContent, setScriptContent] = useState(`; 新游戏初始化脚本
; 设置初始变量
SetVar(GameStart, 1)

; 加载初始地图
LoadMap(M01)

; 设置玩家初始位置
SetPlayerPos(100, 200)

; 显示开场对话
Talk(INTRO_001)
`);

  // 模拟文件树
  const fileTree = [
    {
      id: "common",
      name: "common",
      type: "folder" as const,
      children: [
        { id: "init", name: "init.txt", type: "file" as const },
        { id: "utils", name: "utils.txt", type: "file" as const },
      ],
    },
    { id: "newgame", name: "newgame.txt", type: "file" as const },
    { id: "event001", name: "event001.txt", type: "file" as const },
  ];

  return (
    <div className="flex h-full">
      {/* 文件树 */}
      <div className="w-64 h-full bg-[#252526] border-r border-[#1e1e1e] flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-[#1e1e1e]">
          <span className="text-xs font-medium uppercase tracking-wide text-[#bbbbbb]">
            脚本文件
          </span>
          <button className="p-1 rounded hover:bg-[#3c3c3c] text-[#858585] hover:text-white transition-colors">
            {DashboardIcons.add}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          <FileTreeView
            items={fileTree}
            selectedFile={selectedFile}
            onSelect={setSelectedFile}
          />
        </div>
      </div>

      {/* 编辑器区域 */}
      <div className="flex-1 flex flex-col">
        {selectedFile ? (
          <>
            {/* 标签栏 */}
            <div className="flex items-center h-9 bg-[#252526] border-b border-[#1e1e1e]">
              <div className="flex items-center px-3 py-1 bg-[#1e1e1e] text-sm">
                <span>{selectedFile}.txt</span>
                <button className="ml-2 p-0.5 rounded hover:bg-[#3c3c3c] text-[#858585] hover:text-white transition-colors">
                  {DashboardIcons.close}
                </button>
              </div>
            </div>

            {/* 工具栏 */}
            <div className="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-[#1e1e1e]">
              <div className="flex items-center gap-2">
                <button className="px-3 py-1 text-xs bg-[#3c3c3c] hover:bg-[#4a4a4a] rounded transition-colors">
                  格式化
                </button>
                <button className="px-3 py-1 text-xs bg-[#3c3c3c] hover:bg-[#4a4a4a] rounded transition-colors">
                  验证语法
                </button>
              </div>
              <button className="px-3 py-1 text-xs bg-[#0e639c] hover:bg-[#1177bb] rounded transition-colors">
                保存
              </button>
            </div>

            {/* 编辑器 */}
            <div className="flex-1 overflow-hidden">
              <textarea
                value={scriptContent}
                onChange={(e) => setScriptContent(e.target.value)}
                className="w-full h-full p-4 bg-[#1e1e1e] text-white font-mono text-sm focus:outline-none resize-none"
                spellCheck={false}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[#858585]">
            选择一个脚本文件开始编辑
          </div>
        )}
      </div>
    </div>
  );
}

interface FileTreeItem {
  id: string;
  name: string;
  type: "file" | "folder";
  children?: FileTreeItem[];
}

interface FileTreeViewProps {
  items: FileTreeItem[];
  selectedFile: string | null;
  onSelect: (id: string) => void;
  level?: number;
}

function FileTreeView({ items, selectedFile, onSelect, level = 0 }: FileTreeViewProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["common"]));

  const toggleFolder = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div>
      {items.map((item) => {
        const paddingLeft = 12 + level * 16;

        if (item.type === "folder") {
          const isExpanded = expanded.has(item.id);
          return (
            <div key={item.id}>
              <button
                type="button"
                onClick={() => toggleFolder(item.id)}
                className="flex w-full items-center gap-1 py-1 pr-2 text-left text-sm hover:bg-[#2a2d2e] transition-colors"
                style={{ paddingLeft }}
              >
                <span
                  className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
                >
                  {DashboardIcons.chevronRight}
                </span>
                <span className="text-[#dcb67a]">{DashboardIcons.folder}</span>
                <span className="truncate">{item.name}</span>
              </button>
              {isExpanded && item.children && (
                <FileTreeView
                  items={item.children}
                  selectedFile={selectedFile}
                  onSelect={onSelect}
                  level={level + 1}
                />
              )}
            </div>
          );
        }

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={`flex w-full items-center gap-2 py-1 pr-2 text-left text-sm transition-colors ${
              selectedFile === item.id
                ? "bg-[#094771] text-white"
                : "hover:bg-[#2a2d2e]"
            }`}
            style={{ paddingLeft: paddingLeft + 16 }}
          >
            <span className="text-[#858585]">{DashboardIcons.file}</span>
            <span className="truncate">{item.name}</span>
          </button>
        );
      })}
    </div>
  );
}
