/**
 * 商店编辑页面
 */
import { useParams, useNavigate } from "react-router-dom";
import { ListEditorPage, DetailEditorPage } from "./ListEditorPage";

// 模拟数据
const mockShops = [
  { id: "shop001", name: "杂货铺", description: "出售各种杂货" },
  { id: "shop002", name: "武器店", description: "出售各种武器" },
  { id: "shop003", name: "药店", description: "出售各种药品" },
  { id: "shop004", name: "防具店", description: "出售各种防具" },
];

export function ShopsListPage() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const basePath = `/dashboard/${gameId}/shops`;

  return (
    <ListEditorPage
      title="商店编辑"
      itemName="商店"
      items={mockShops}
      basePath={basePath}
      onAdd={() => navigate(`${basePath}/new`)}
      onEdit={(id) => navigate(`${basePath}/${id}`)}
      onDelete={(id) => console.log("删除商店:", id)}
    />
  );
}

export function ShopDetailPage() {
  const { gameId, shopId } = useParams();
  const basePath = `/dashboard/${gameId}/shops`;
  const isNew = shopId === "new";
  const shop = mockShops.find((s) => s.id === shopId);

  return (
    <DetailEditorPage
      title={isNew ? "新建商店" : `编辑商店 - ${shop?.name || shopId}`}
      backPath={basePath}
      onSave={() => console.log("保存商店")}
      onDelete={isNew ? undefined : () => console.log("删除商店")}
    >
      <div className="space-y-6">
        {/* 基本信息 */}
        <section className="bg-[#252526] border border-[#454545] rounded-lg p-4">
          <h2 className="text-lg font-medium text-[#bbbbbb] mb-4">基本信息</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#858585] mb-1">商店ID</label>
              <input
                type="text"
                defaultValue={shop?.id || ""}
                disabled={!isNew}
                className="w-full px-3 py-2 bg-[#3c3c3c] border border-[#454545] rounded text-white disabled:opacity-50 focus:outline-none focus:border-[#0098ff]"
              />
            </div>
            <div>
              <label className="block text-sm text-[#858585] mb-1">商店名称</label>
              <input
                type="text"
                defaultValue={shop?.name || ""}
                className="w-full px-3 py-2 bg-[#3c3c3c] border border-[#454545] rounded text-white focus:outline-none focus:border-[#0098ff]"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-[#858585] mb-1">描述</label>
              <textarea
                rows={2}
                defaultValue={shop?.description || ""}
                className="w-full px-3 py-2 bg-[#3c3c3c] border border-[#454545] rounded text-white focus:outline-none focus:border-[#0098ff] resize-none"
              />
            </div>
          </div>
        </section>

        {/* 商品列表 */}
        <section className="bg-[#252526] border border-[#454545] rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-[#bbbbbb]">商品列表</h2>
            <button className="px-3 py-1 text-sm bg-[#3c3c3c] hover:bg-[#4a4a4a] rounded transition-colors">
              + 添加商品
            </button>
          </div>
          <div className="text-sm text-[#858585]">
            暂无商品，点击上方按钮添加
          </div>
        </section>
      </div>
    </DetailEditorPage>
  );
}
