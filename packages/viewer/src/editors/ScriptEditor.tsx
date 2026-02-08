/**
 * 脚本编辑器
 * P0 优先级 - 核心编辑器
 */
export function ScriptEditor() {
  return (
    <div className="flex h-full flex-col">
      {/* 工具栏 */}
      <header className="flex h-12 items-center gap-4 border-b border-gray-700 bg-gray-800 px-4">
        <h1 className="text-lg font-semibold text-amber-400">📜 脚本编辑器</h1>
      </header>

      {/* 主内容区 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧文件树 */}
        <aside className="w-48 border-r border-gray-700 bg-gray-800 p-4">
          <h2 className="mb-4 font-semibold text-gray-200">📁 脚本目录</h2>
          <ul className="space-y-1 text-sm">
            <li className="text-gray-300">📁 common/</li>
            <li className="text-gray-300">📁 map/</li>
            <li className="text-gray-300">📁 goods/</li>
          </ul>
        </aside>

        {/* 代码编辑区域 */}
        <div className="flex flex-1 items-center justify-center bg-gray-950">
          <div className="text-center text-gray-500">
            <p className="text-6xl">📜</p>
            <p className="mt-4 text-xl">脚本编辑器</p>
            <p className="mt-2 text-sm">Hello World - 功能开发中...</p>
            <p className="mt-1 text-xs text-gray-600">将集成 Monaco Editor 实现语法高亮</p>
          </div>
        </div>

        {/* 右侧命令列表 */}
        <aside className="w-48 border-l border-gray-700 bg-gray-800 p-4">
          <h2 className="mb-4 font-semibold text-gray-200">📋 命令列表</h2>
          <ul className="space-y-1 text-sm">
            <li className="text-gray-300">NPC 命令</li>
            <li className="text-gray-300">玩家命令</li>
            <li className="text-gray-300">对话命令</li>
            <li className="text-gray-300">游戏状态</li>
          </ul>
        </aside>
      </div>

      {/* 底部面板 */}
      <footer className="h-32 border-t border-gray-700 bg-gray-800 p-4">
        <h3 className="mb-2 text-sm font-semibold text-gray-300">📝 输出/问题</h3>
        <p className="text-xs text-gray-500">[信息] 脚本编辑器就绪</p>
      </footer>
    </div>
  );
}
