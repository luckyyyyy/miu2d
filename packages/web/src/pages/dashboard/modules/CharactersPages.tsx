/**
 * 角色编辑页面
 */
import { useParams, useNavigate } from "react-router-dom";
import { ListEditorPage, DetailEditorPage } from "./ListEditorPage";

// 模拟数据
const mockCharacters = [
  { id: "player", name: "主角", description: "游戏主角" },
  { id: "partner1", name: "仙儿", description: "女主角，精通剑法" },
  { id: "partner2", name: "月儿", description: "女二号，精通医术" },
];

export function CharactersListPage() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const basePath = `/dashboard/${gameId}/characters`;

  return (
    <ListEditorPage
      title="角色编辑"
      itemName="角色"
      items={mockCharacters}
      basePath={basePath}
      onAdd={() => navigate(`${basePath}/new`)}
      onEdit={(id) => navigate(`${basePath}/${id}`)}
      onDelete={(id) => console.log("删除角色:", id)}
    />
  );
}

export function CharacterDetailPage() {
  const { gameId, characterId } = useParams();
  const basePath = `/dashboard/${gameId}/characters`;
  const isNew = characterId === "new";
  const character = mockCharacters.find((c) => c.id === characterId);

  return (
    <DetailEditorPage
      title={isNew ? "新建角色" : `编辑角色 - ${character?.name || characterId}`}
      backPath={basePath}
      onSave={() => console.log("保存角色")}
      onDelete={isNew ? undefined : () => console.log("删除角色")}
    >
      <div className="space-y-6">
        {/* 基本信息 */}
        <section className="bg-[#252526] border border-[#454545] rounded-lg p-4">
          <h2 className="text-lg font-medium text-[#bbbbbb] mb-4">基本信息</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#858585] mb-1">角色ID</label>
              <input
                type="text"
                defaultValue={character?.id || ""}
                disabled={!isNew}
                className="w-full px-3 py-2 bg-[#3c3c3c] border border-[#454545] rounded text-white disabled:opacity-50 focus:outline-none focus:border-[#0098ff]"
              />
            </div>
            <div>
              <label className="block text-sm text-[#858585] mb-1">角色名称</label>
              <input
                type="text"
                defaultValue={character?.name || ""}
                className="w-full px-3 py-2 bg-[#3c3c3c] border border-[#454545] rounded text-white focus:outline-none focus:border-[#0098ff]"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-[#858585] mb-1">描述</label>
              <textarea
                rows={2}
                defaultValue={character?.description || ""}
                className="w-full px-3 py-2 bg-[#3c3c3c] border border-[#454545] rounded text-white focus:outline-none focus:border-[#0098ff] resize-none"
              />
            </div>
          </div>
        </section>

        {/* 属性配置 */}
        <section className="bg-[#252526] border border-[#454545] rounded-lg p-4">
          <h2 className="text-lg font-medium text-[#bbbbbb] mb-4">属性配置</h2>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "初始生命", key: "hp", value: 100 },
              { label: "初始内力", key: "mp", value: 50 },
              { label: "初始攻击", key: "attack", value: 10 },
              { label: "初始防御", key: "defense", value: 5 },
              { label: "初始敏捷", key: "agility", value: 10 },
              { label: "初始幸运", key: "luck", value: 5 },
            ].map((attr) => (
              <div key={attr.key}>
                <label className="block text-sm text-[#858585] mb-1">{attr.label}</label>
                <input
                  type="number"
                  defaultValue={attr.value}
                  className="w-full px-3 py-2 bg-[#3c3c3c] border border-[#454545] rounded text-white focus:outline-none focus:border-[#0098ff]"
                />
              </div>
            ))}
          </div>
        </section>

        {/* ASF 动画 */}
        <section className="bg-[#252526] border border-[#454545] rounded-lg p-4">
          <h2 className="text-lg font-medium text-[#bbbbbb] mb-4">动画资源</h2>
          <div>
            <label className="block text-sm text-[#858585] mb-1">ASF 文件</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="选择 ASF 动画文件"
                className="flex-1 px-3 py-2 bg-[#3c3c3c] border border-[#454545] rounded text-white focus:outline-none focus:border-[#0098ff]"
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
