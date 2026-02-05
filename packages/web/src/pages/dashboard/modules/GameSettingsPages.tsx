/**
 * 游戏编辑模块页面
 */
import { useParams } from "react-router-dom";
import { NumberInput } from "@/components/common";

export function GameConfigPage() {
  const { gameId } = useParams();

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl">
        <h1 className="text-xl font-bold text-white mb-6">基础配置</h1>

        <div className="space-y-6">
          {/* 游戏基本信息 */}
          <section className="bg-[#252526] border border-[#454545] rounded-lg p-4">
            <h2 className="text-lg font-medium text-[#bbbbbb] mb-4">游戏信息</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[#858585] mb-1">游戏名称</label>
                <input
                  type="text"
                  defaultValue="月影传说"
                  className="w-full px-3 py-2 bg-[#3c3c3c] border border-[#454545] rounded text-white focus:outline-none focus:border-[#0098ff]"
                />
              </div>
              <div>
                <label className="block text-sm text-[#858585] mb-1">游戏版本</label>
                <input
                  type="text"
                  defaultValue="1.0.0"
                  className="w-full px-3 py-2 bg-[#3c3c3c] border border-[#454545] rounded text-white focus:outline-none focus:border-[#0098ff]"
                />
              </div>
              <div>
                <label className="block text-sm text-[#858585] mb-1">游戏描述</label>
                <textarea
                  rows={3}
                  defaultValue="基于《剑侠情缘外传：月影传说》复刻的 Web 游戏"
                  className="w-full px-3 py-2 bg-[#3c3c3c] border border-[#454545] rounded text-white focus:outline-none focus:border-[#0098ff] resize-none"
                />
              </div>
            </div>
          </section>

          {/* 初始设置 */}
          <section className="bg-[#252526] border border-[#454545] rounded-lg p-4">
            <h2 className="text-lg font-medium text-[#bbbbbb] mb-4">初始设置</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[#858585] mb-1">初始地图</label>
                <select className="w-full px-3 py-2 bg-[#3c3c3c] border border-[#454545] rounded text-white focus:outline-none focus:border-[#0098ff]">
                  <option value="m01">M01 - 开场村庄</option>
                  <option value="m02">M02 - 城镇</option>
                  <option value="m03">M03 - 山洞</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[#858585] mb-1">初始X坐标</label>
                  <NumberInput
                    value={100}
                    onChange={() => {}}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#858585] mb-1">初始Y坐标</label>
                  <NumberInput
                    value={200}
                    onChange={() => {}}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* 保存按钮 */}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="px-4 py-2 bg-[#3c3c3c] hover:bg-[#4a4a4a] rounded text-sm transition-colors"
            >
              重置
            </button>
            <button
              type="button"
              className="px-4 py-2 bg-[#0e639c] hover:bg-[#1177bb] rounded text-sm transition-colors"
            >
              保存配置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function NewGameScriptPage() {
  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl">
        <h1 className="text-xl font-bold text-white mb-6">新游戏触发脚本</h1>
        <p className="text-[#858585] mb-4">
          编辑 newgame.txt 脚本，该脚本在新游戏开始时执行。
        </p>

        <div className="bg-[#1e1e1e] border border-[#454545] rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-[#454545]">
            <span className="text-sm text-[#858585]">newgame.txt</span>
            <div className="flex gap-2">
              <button className="px-3 py-1 text-xs bg-[#3c3c3c] hover:bg-[#4a4a4a] rounded transition-colors">
                格式化
              </button>
              <button className="px-3 py-1 text-xs bg-[#0e639c] hover:bg-[#1177bb] rounded transition-colors">
                保存
              </button>
            </div>
          </div>
          <textarea
            className="w-full h-96 p-4 bg-transparent text-white font-mono text-sm focus:outline-none resize-none"
            defaultValue={`; 新游戏初始化脚本
; 设置初始变量
SetVar(GameStart, 1)

; 加载初始地图
LoadMap(M01)

; 设置玩家初始位置
SetPlayerPos(100, 200)

; 显示开场对话
Talk(INTRO_001)
`}
          />
        </div>
      </div>
    </div>
  );
}

export function PlayerConfigPage() {
  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl">
        <h1 className="text-xl font-bold text-white mb-6">游戏主角</h1>

        <div className="space-y-6">
          {/* 基本信息 */}
          <section className="bg-[#252526] border border-[#454545] rounded-lg p-4">
            <h2 className="text-lg font-medium text-[#bbbbbb] mb-4">基本信息</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[#858585] mb-1">角色名称</label>
                <input
                  type="text"
                  defaultValue="云天河"
                  className="w-full px-3 py-2 bg-[#3c3c3c] border border-[#454545] rounded text-white focus:outline-none focus:border-[#0098ff]"
                />
              </div>
              <div>
                <label className="block text-sm text-[#858585] mb-1">角色等级</label>
                <NumberInput
                  value={1}
                  onChange={() => {}}
                  className="w-full"
                />
              </div>
            </div>
          </section>

          {/* 初始属性 */}
          <section className="bg-[#252526] border border-[#454545] rounded-lg p-4">
            <h2 className="text-lg font-medium text-[#bbbbbb] mb-4">初始属性</h2>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "生命值", key: "hp", value: 100 },
                { label: "内力值", key: "mp", value: 50 },
                { label: "攻击力", key: "attack", value: 10 },
                { label: "防御力", key: "defense", value: 5 },
                { label: "敏捷度", key: "agility", value: 10 },
                { label: "幸运值", key: "luck", value: 5 },
              ].map((attr) => (
                <div key={attr.key}>
                  <label className="block text-sm text-[#858585] mb-1">{attr.label}</label>
                  <NumberInput
                    value={attr.value}
                    onChange={() => {}}
                    className="w-full"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* 初始武功 */}
          <section className="bg-[#252526] border border-[#454545] rounded-lg p-4">
            <h2 className="text-lg font-medium text-[#bbbbbb] mb-4">初始武功</h2>
            <div className="text-sm text-[#858585]">
              暂无初始武功，点击添加
            </div>
            <button className="mt-2 px-3 py-1 text-sm bg-[#3c3c3c] hover:bg-[#4a4a4a] rounded transition-colors">
              + 添加武功
            </button>
          </section>

          {/* 保存按钮 */}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="px-4 py-2 bg-[#0e639c] hover:bg-[#1177bb] rounded text-sm transition-colors"
            >
              保存配置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
