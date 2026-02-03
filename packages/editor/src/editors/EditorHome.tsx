/**
 * 编辑器首页
 * 显示编辑器列表和项目状态
 */
export function EditorHome() {
  const editors = [
    {
      id: "map",
      name: "地图编辑器",
      icon: "🗺️",
      description: "编辑地图瓦片、障碍物、陷阱和 NPC 布局",
      priority: "P0",
      status: "开发中",
    },
    {
      id: "script",
      name: "脚本编辑器",
      icon: "📜",
      description: "编写和调试游戏脚本，支持语法高亮和自动补全",
      priority: "P0",
      status: "开发中",
    },
    {
      id: "magic",
      name: "武功编辑器",
      icon: "🧙",
      description: "配置武功属性、动画和等级成长数据",
      priority: "P0",
      status: "开发中",
    },
    {
      id: "npc",
      name: "NPC/怪物编辑器",
      icon: "👤",
      description: "配置 NPC 属性、AI、掉落和脚本",
      priority: "P1",
      status: "计划中",
    },
    {
      id: "goods",
      name: "物品编辑器",
      icon: "🎒",
      description: "编辑物品属性和效果",
      priority: "P1",
      status: "计划中",
    },
    {
      id: "shop",
      name: "商店编辑器",
      icon: "🏪",
      description: "配置商店物品和价格",
      priority: "P1",
      status: "计划中",
    },
  ];

  return (
    <div className="p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-amber-400">
          🎮 Miu2D Engine 游戏编辑器
        </h1>
        <p className="mt-2 text-gray-400">
          基于 Web 技术的 2D RPG 游戏编辑器套件
        </p>
      </header>

      <section>
        <h2 className="mb-4 text-xl font-semibold text-gray-200">编辑器列表</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {editors.map((editor) => (
            <a
              key={editor.id}
              href={`/editor/${editor.id}`}
              className="group rounded-lg border border-gray-700 bg-gray-800 p-4 transition-all hover:border-amber-500 hover:bg-gray-750"
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">{editor.icon}</span>
                <div>
                  <h3 className="font-semibold text-gray-100 group-hover:text-amber-400">
                    {editor.name}
                  </h3>
                  <div className="flex gap-2 text-xs">
                    <span className="rounded bg-blue-900 px-1.5 py-0.5 text-blue-300">
                      {editor.priority}
                    </span>
                    <span className="rounded bg-gray-700 px-1.5 py-0.5 text-gray-400">
                      {editor.status}
                    </span>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-sm text-gray-400">{editor.description}</p>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
