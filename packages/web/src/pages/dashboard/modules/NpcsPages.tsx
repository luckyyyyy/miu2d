/**
 * NPC 编辑页面
 */
import { useParams, useNavigate } from "react-router-dom";
import { ListEditorPage, DetailEditorPage } from "./ListEditorPage";

// 模拟数据
const mockNpcs = [
  { id: "npc001", name: "老村长", description: "村庄的领导者" },
  { id: "npc002", name: "铁匠", description: "武器店老板" },
  { id: "npc003", name: "药店老板", description: "出售各种药品" },
  { id: "npc004", name: "客栈老板", description: "提供休息服务" },
  { id: "npc005", name: "神秘老人", description: "隐藏剧情NPC" },
];

export function NpcsListPage() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const basePath = `/dashboard/${gameId}/npcs`;

  return (
    <ListEditorPage
      title="NPC编辑"
      itemName="NPC"
      items={mockNpcs}
      basePath={basePath}
      onAdd={() => navigate(`${basePath}/new`)}
      onEdit={(id) => navigate(`${basePath}/${id}`)}
      onDelete={(id) => console.log("删除NPC:", id)}
    />
  );
}

export function NpcDetailPage() {
  const { gameId, npcId } = useParams();
  const basePath = `/dashboard/${gameId}/npcs`;
  const isNew = npcId === "new";
  const npc = mockNpcs.find((n) => n.id === npcId);

  return (
    <DetailEditorPage
      title={isNew ? "新建NPC" : `编辑NPC - ${npc?.name || npcId}`}
      backPath={basePath}
      onSave={() => console.log("保存NPC")}
      onDelete={isNew ? undefined : () => console.log("删除NPC")}
    >
      <div className="space-y-6">
        {/* 基本信息 */}
        <section className="bg-[#252526] border border-widget-border rounded-lg p-4">
          <h2 className="text-lg font-medium text-[#bbbbbb] mb-4">基本信息</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#858585] mb-1">NPC ID</label>
              <input
                type="text"
                defaultValue={npc?.id || ""}
                disabled={!isNew}
                className="w-full px-3 py-2 bg-[#3c3c3c] border border-widget-border rounded text-white disabled:opacity-50 focus:outline-none focus:border-focus-border"
              />
            </div>
            <div>
              <label className="block text-sm text-[#858585] mb-1">NPC名称</label>
              <input
                type="text"
                defaultValue={npc?.name || ""}
                className="w-full px-3 py-2 bg-[#3c3c3c] border border-widget-border rounded text-white focus:outline-none focus:border-focus-border"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-[#858585] mb-1">描述</label>
              <textarea
                rows={2}
                defaultValue={npc?.description || ""}
                className="w-full px-3 py-2 bg-[#3c3c3c] border border-widget-border rounded text-white focus:outline-none focus:border-focus-border resize-none"
              />
            </div>
          </div>
        </section>

        {/* 行为配置 */}
        <section className="bg-[#252526] border border-widget-border rounded-lg p-4">
          <h2 className="text-lg font-medium text-[#bbbbbb] mb-4">行为配置</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-[#858585] mb-1">NPC类型</label>
              <select className="w-full px-3 py-2 bg-[#3c3c3c] border border-widget-border rounded text-white focus:outline-none focus:border-focus-border">
                <option value="normal">普通NPC</option>
                <option value="merchant">商人</option>
                <option value="quest">任务NPC</option>
                <option value="enemy">敌人</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-[#858585] mb-1">对话脚本</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="选择对话脚本"
                  className="flex-1 px-3 py-2 bg-[#3c3c3c] border border-widget-border rounded text-white focus:outline-none focus:border-focus-border"
                />
                <button className="px-4 py-2 bg-[#3c3c3c] hover:bg-[#4a4a4a] rounded text-sm transition-colors">
                  浏览
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="canInteract" defaultChecked className="rounded" />
              <label htmlFor="canInteract" className="text-sm text-[#cccccc]">
                可交互
              </label>
            </div>
          </div>
        </section>

        {/* 外观配置 */}
        <section className="bg-[#252526] border border-widget-border rounded-lg p-4">
          <h2 className="text-lg font-medium text-[#bbbbbb] mb-4">外观配置</h2>
          <div>
            <label className="block text-sm text-[#858585] mb-1">ASF 文件</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="选择 ASF 动画文件"
                className="flex-1 px-3 py-2 bg-[#3c3c3c] border border-widget-border rounded text-white focus:outline-none focus:border-focus-border"
              />
              <button className="px-4 py-2 bg-[#3c3c3c] hover:bg-[#4a4a4a] rounded text-sm transition-colors">
                浏览
              </button>
            </div>
          </div>
        </section>
      </div>
    </DetailEditorPage>
  );
}
