/**
 * 场景编辑页面
 */
import { useState } from "react";
import { useParams, NavLink } from "react-router-dom";
import { DashboardIcons } from "../icons";

export function ScenesHomePage() {
  const { gameId } = useParams();
  const basePath = `/dashboard/${gameId}/scenes`;

  const sceneModules = [
    {
      id: "map-editor",
      icon: "map",
      label: "地图编辑器",
      description: "编辑地图，设置陷阱和触发脚本",
      path: `${basePath}/map-editor`,
    },
    {
      id: "dialogs",
      icon: "dialog",
      label: "对话管理",
      description: "管理游戏中的对话内容",
      path: `${basePath}/dialogs`,
    },
    {
      id: "map-npcs",
      icon: "npc",
      label: "地图NPC",
      description: "配置各地图的NPC",
      path: `${basePath}/map-npcs`,
    },
    {
      id: "map-objects",
      icon: "goods",
      label: "地图物品",
      description: "配置各地图的物品",
      path: `${basePath}/map-objects`,
    },
    {
      id: "scene-scripts",
      icon: "script",
      label: "场景脚本",
      description: "编辑场景相关脚本",
      path: `${basePath}/scene-scripts`,
    },
  ] as const;

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl">
        <h1 className="text-xl font-bold text-white mb-6">场景编辑</h1>

        <div className="grid grid-cols-2 gap-4">
          {sceneModules.map((module) => (
            <NavLink
              key={module.id}
              to={module.path}
              className="flex items-start gap-4 p-4 bg-[#252526] hover:bg-[#2a2d2e] border border-[#454545] rounded-lg transition-colors group"
            >
              <span className="text-[#0098ff] mt-1">
                {DashboardIcons[module.icon]}
              </span>
              <div>
                <h3 className="text-[#cccccc] group-hover:text-white font-medium transition-colors">
                  {module.label}
                </h3>
                <p className="text-sm text-[#858585] mt-1">
                  {module.description}
                </p>
              </div>
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MapEditorPage() {
  const { gameId } = useParams();
  const [selectedMap, setSelectedMap] = useState<string | null>("M01");

  // 模拟地图列表
  const maps = [
    { id: "M01", name: "开场村庄" },
    { id: "M02", name: "城镇中心" },
    { id: "M03", name: "山洞入口" },
    { id: "M04", name: "山洞深处" },
    { id: "M05", name: "森林" },
  ];

  return (
    <div className="flex h-full">
      {/* 地图列表 */}
      <div className="w-48 h-full bg-[#252526] border-r border-[#1e1e1e] flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-[#1e1e1e]">
          <span className="text-xs font-medium uppercase tracking-wide text-[#bbbbbb]">
            地图列表
          </span>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {maps.map((map) => (
            <button
              key={map.id}
              type="button"
              onClick={() => setSelectedMap(map.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                selectedMap === map.id
                  ? "bg-[#094771] text-white"
                  : "hover:bg-[#2a2d2e]"
              }`}
            >
              <span className="text-[#858585]">{DashboardIcons.map}</span>
              <span className="truncate">{map.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 地图编辑区域 */}
      <div className="flex-1 flex flex-col">
        {selectedMap ? (
          <>
            {/* 工具栏 */}
            <div className="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-[#1e1e1e]">
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#bbbbbb]">
                  {maps.find((m) => m.id === selectedMap)?.name}
                </span>
                <span className="text-xs text-[#858585]">({selectedMap})</span>
              </div>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1 text-xs bg-[#3c3c3c] hover:bg-[#4a4a4a] rounded transition-colors">
                  添加陷阱
                </button>
                <button className="px-3 py-1 text-xs bg-[#3c3c3c] hover:bg-[#4a4a4a] rounded transition-colors">
                  添加传送点
                </button>
                <button className="px-3 py-1 text-xs bg-[#0e639c] hover:bg-[#1177bb] rounded transition-colors">
                  保存
                </button>
              </div>
            </div>

            {/* 地图画布 */}
            <div className="flex-1 bg-[#1a1a1a] flex items-center justify-center">
              <div className="text-[#858585] text-center">
                <p className="mb-2">地图编辑器</p>
                <p className="text-xs">拖拽设置陷阱和触发区域</p>
                <div className="mt-8 w-96 h-64 bg-[#252526] border border-[#454545] rounded flex items-center justify-center">
                  <span className="text-[#444]">地图预览区域</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[#858585]">
            选择一个地图开始编辑
          </div>
        )}
      </div>
    </div>
  );
}

export function DialogsPage() {
  const { gameId } = useParams();
  const [selectedDialog, setSelectedDialog] = useState<string | null>("INTRO_001");

  // 模拟对话列表
  const dialogs = [
    { id: "INTRO_001", name: "开场对话" },
    { id: "NPC_001_GREET", name: "村长问候" },
    { id: "NPC_002_SHOP", name: "铁匠商店" },
    { id: "QUEST_001", name: "任务对话" },
  ];

  return (
    <div className="flex h-full">
      {/* 对话列表 */}
      <div className="w-48 h-full bg-[#252526] border-r border-[#1e1e1e] flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-[#1e1e1e]">
          <span className="text-xs font-medium uppercase tracking-wide text-[#bbbbbb]">
            对话列表
          </span>
          <button className="p-1 rounded hover:bg-[#3c3c3c] text-[#858585] hover:text-white transition-colors">
            {DashboardIcons.add}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {dialogs.map((dialog) => (
            <button
              key={dialog.id}
              type="button"
              onClick={() => setSelectedDialog(dialog.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                selectedDialog === dialog.id
                  ? "bg-[#094771] text-white"
                  : "hover:bg-[#2a2d2e]"
              }`}
            >
              <span className="text-[#858585]">{DashboardIcons.dialog}</span>
              <span className="truncate">{dialog.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 对话编辑区域 */}
      <div className="flex-1 overflow-auto p-6">
        {selectedDialog ? (
          <div className="max-w-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-medium text-white">
                {dialogs.find((d) => d.id === selectedDialog)?.name}
              </h2>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1 text-xs bg-[#3c3c3c] hover:bg-[#4a4a4a] rounded transition-colors">
                  添加对话
                </button>
                <button className="px-3 py-1 text-xs bg-[#0e639c] hover:bg-[#1177bb] rounded transition-colors">
                  保存
                </button>
              </div>
            </div>

            {/* 对话段落 */}
            <div className="space-y-4">
              {[
                { speaker: "村长", content: "年轻人，你来到我们这个小村庄有什么事吗？" },
                { speaker: "主角", content: "老人家，我想打听一下关于月影山庄的消息。" },
                { speaker: "村长", content: "月影山庄？那可是个危险的地方啊..." },
              ].map((line, index) => (
                <div
                  key={index}
                  className="bg-[#252526] border border-[#454545] rounded-lg p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-[#858585]">#{index + 1}</span>
                    <input
                      type="text"
                      defaultValue={line.speaker}
                      placeholder="说话人"
                      className="w-24 px-2 py-1 bg-[#3c3c3c] border border-[#454545] rounded text-sm text-white focus:outline-none focus:border-[#0098ff]"
                    />
                    <button className="ml-auto p-1 rounded hover:bg-[#3c3c3c] text-[#858585] hover:text-red-400 transition-colors">
                      {DashboardIcons.delete}
                    </button>
                  </div>
                  <textarea
                    defaultValue={line.content}
                    rows={2}
                    className="w-full px-3 py-2 bg-[#3c3c3c] border border-[#454545] rounded text-white text-sm focus:outline-none focus:border-[#0098ff] resize-none"
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-[#858585]">
            选择一个对话开始编辑
          </div>
        )}
      </div>
    </div>
  );
}

export function MapNpcsPage() {
  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl">
        <h1 className="text-xl font-bold text-white mb-6">地图NPC</h1>
        <p className="text-[#858585] mb-4">配置各地图的NPC分组</p>

        <div className="space-y-4">
          {[
            { id: "npc_m01", name: "M01_村庄NPC.npc", count: 5 },
            { id: "npc_m02", name: "M02_城镇NPC.npc", count: 12 },
            { id: "npc_m03", name: "M03_山洞NPC.npc", count: 3 },
          ].map((group) => (
            <div
              key={group.id}
              className="flex items-center justify-between p-4 bg-[#252526] border border-[#454545] rounded-lg"
            >
              <div className="flex items-center gap-3">
                <span className="text-[#858585]">{DashboardIcons.npc}</span>
                <div>
                  <div className="text-[#cccccc]">{group.name}</div>
                  <div className="text-xs text-[#858585]">{group.count} 个NPC</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 rounded hover:bg-[#3c3c3c] text-[#858585] hover:text-white transition-colors">
                  {DashboardIcons.edit}
                </button>
                <button className="p-2 rounded hover:bg-[#3c3c3c] text-[#858585] hover:text-red-400 transition-colors">
                  {DashboardIcons.delete}
                </button>
              </div>
            </div>
          ))}
        </div>

        <button className="mt-4 flex items-center gap-2 px-4 py-2 bg-[#3c3c3c] hover:bg-[#4a4a4a] rounded transition-colors">
          {DashboardIcons.add}
          <span>添加NPC组</span>
        </button>
      </div>
    </div>
  );
}

export function MapObjectsPage() {
  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl">
        <h1 className="text-xl font-bold text-white mb-6">地图物品</h1>
        <p className="text-[#858585] mb-4">配置各地图的物品分组</p>

        <div className="space-y-4">
          {[
            { id: "obj_m01", name: "M01_村庄物品.obj", count: 8 },
            { id: "obj_m02", name: "M02_城镇物品.obj", count: 15 },
            { id: "obj_m03", name: "M03_山洞物品.obj", count: 5 },
          ].map((group) => (
            <div
              key={group.id}
              className="flex items-center justify-between p-4 bg-[#252526] border border-[#454545] rounded-lg"
            >
              <div className="flex items-center gap-3">
                <span className="text-[#858585]">{DashboardIcons.goods}</span>
                <div>
                  <div className="text-[#cccccc]">{group.name}</div>
                  <div className="text-xs text-[#858585]">{group.count} 个物品</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 rounded hover:bg-[#3c3c3c] text-[#858585] hover:text-white transition-colors">
                  {DashboardIcons.edit}
                </button>
                <button className="p-2 rounded hover:bg-[#3c3c3c] text-[#858585] hover:text-red-400 transition-colors">
                  {DashboardIcons.delete}
                </button>
              </div>
            </div>
          ))}
        </div>

        <button className="mt-4 flex items-center gap-2 px-4 py-2 bg-[#3c3c3c] hover:bg-[#4a4a4a] rounded transition-colors">
          {DashboardIcons.add}
          <span>添加物品组</span>
        </button>
      </div>
    </div>
  );
}

export function SceneScriptsPage() {
  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl">
        <h1 className="text-xl font-bold text-white mb-6">场景脚本</h1>
        <p className="text-[#858585] mb-4">陷阱、事件和对话脚本</p>

        <div className="space-y-4">
          {[
            { id: "trap_001", name: "陷阱_M03入口.txt", type: "trap" },
            { id: "event_001", name: "事件_村长剧情.txt", type: "event" },
            { id: "dialog_001", name: "对话_铁匠.txt", type: "dialog" },
          ].map((script) => (
            <div
              key={script.id}
              className="flex items-center justify-between p-4 bg-[#252526] border border-[#454545] rounded-lg"
            >
              <div className="flex items-center gap-3">
                <span className="text-[#858585]">
                  {script.type === "trap"
                    ? DashboardIcons.trap
                    : script.type === "dialog"
                      ? DashboardIcons.dialog
                      : DashboardIcons.script}
                </span>
                <div>
                  <div className="text-[#cccccc]">{script.name}</div>
                  <div className="text-xs text-[#858585]">
                    {script.type === "trap"
                      ? "陷阱脚本"
                      : script.type === "dialog"
                        ? "对话脚本"
                        : "事件脚本"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 rounded hover:bg-[#3c3c3c] text-[#858585] hover:text-white transition-colors">
                  {DashboardIcons.edit}
                </button>
                <button className="p-2 rounded hover:bg-[#3c3c3c] text-[#858585] hover:text-red-400 transition-colors">
                  {DashboardIcons.delete}
                </button>
              </div>
            </div>
          ))}
        </div>

        <button className="mt-4 flex items-center gap-2 px-4 py-2 bg-[#3c3c3c] hover:bg-[#4a4a4a] rounded transition-colors">
          {DashboardIcons.add}
          <span>添加脚本</span>
        </button>
      </div>
    </div>
  );
}
