/**
 * 数据统计页面
 */
import { useParams } from "react-router-dom";
import { DashboardIcons } from "../icons";

export function StatisticsHomePage() {
  const { gameId } = useParams();

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl">
        <h1 className="text-xl font-bold text-white mb-6">数据统计</h1>

        {/* 概览卡片 */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: "总玩家数", value: "1,234", change: "+12%" },
            { label: "今日活跃", value: "567", change: "+5%" },
            { label: "平均游戏时长", value: "45分钟", change: "+8%" },
            { label: "完成度", value: "23%", change: "-" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="p-4 bg-[#252526] border border-[#454545] rounded-lg"
            >
              <p className="text-sm text-[#858585] mb-1">{stat.label}</p>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-[#4ec9b0] mt-1">{stat.change}</p>
            </div>
          ))}
        </div>

        {/* 图表区域 */}
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-[#252526] border border-[#454545] rounded-lg p-4">
            <h3 className="text-[#bbbbbb] font-medium mb-4">玩家活跃趋势</h3>
            <div className="h-48 flex items-center justify-center text-[#444]">
              图表区域
            </div>
          </div>
          <div className="bg-[#252526] border border-[#454545] rounded-lg p-4">
            <h3 className="text-[#bbbbbb] font-medium mb-4">关卡完成分布</h3>
            <div className="h-48 flex items-center justify-center text-[#444]">
              图表区域
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PlayerDataPage() {
  // 模拟玩家数据
  const players = [
    { id: "p001", name: "玩家A", level: 25, playtime: "12小时", lastLogin: "2小时前" },
    { id: "p002", name: "玩家B", level: 18, playtime: "8小时", lastLogin: "1天前" },
    { id: "p003", name: "玩家C", level: 42, playtime: "36小时", lastLogin: "30分钟前" },
    { id: "p004", name: "玩家D", level: 12, playtime: "4小时", lastLogin: "3天前" },
  ];

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl">
        <h1 className="text-xl font-bold text-white mb-6">玩家数据</h1>

        {/* 搜索和筛选 */}
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#858585]">
              {DashboardIcons.search}
            </span>
            <input
              type="text"
              placeholder="搜索玩家..."
              className="w-full pl-10 pr-4 py-2 bg-[#3c3c3c] border border-[#454545] rounded text-white placeholder-[#858585] focus:outline-none focus:border-[#0098ff]"
            />
          </div>
          <select className="px-4 py-2 bg-[#3c3c3c] border border-[#454545] rounded text-white focus:outline-none focus:border-[#0098ff]">
            <option value="">全部等级</option>
            <option value="1-10">1-10级</option>
            <option value="11-20">11-20级</option>
            <option value="21-30">21-30级</option>
            <option value="30+">30级以上</option>
          </select>
        </div>

        {/* 玩家列表 */}
        <div className="bg-[#252526] border border-[#454545] rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-[#858585] border-b border-[#454545]">
                <th className="px-4 py-3">玩家名</th>
                <th className="px-4 py-3">等级</th>
                <th className="px-4 py-3">游戏时长</th>
                <th className="px-4 py-3">最后登录</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => (
                <tr
                  key={player.id}
                  className="border-b border-[#454545] last:border-0 hover:bg-[#2a2d2e] transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[#858585]">{DashboardIcons.user}</span>
                      <span className="text-[#cccccc]">{player.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#4ec9b0]">Lv.{player.level}</td>
                  <td className="px-4 py-3 text-[#858585]">{player.playtime}</td>
                  <td className="px-4 py-3 text-[#858585]">{player.lastLogin}</td>
                  <td className="px-4 py-3">
                    <button className="text-[#0098ff] hover:underline text-sm">
                      查看详情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function PlayerSavesPage() {
  // 模拟存档数据
  const saves = [
    { id: "save_001", player: "玩家A", slot: 1, saveTime: "2025-02-04 10:30", progress: "第三章" },
    { id: "save_002", player: "玩家A", slot: 2, saveTime: "2025-02-03 18:45", progress: "第二章" },
    { id: "save_003", player: "玩家B", slot: 1, saveTime: "2025-02-02 14:20", progress: "第一章" },
    { id: "save_004", player: "玩家C", slot: 1, saveTime: "2025-02-04 09:15", progress: "第五章" },
  ];

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl">
        <h1 className="text-xl font-bold text-white mb-6">玩家存档</h1>

        {/* 存档列表 */}
        <div className="bg-[#252526] border border-[#454545] rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-[#858585] border-b border-[#454545]">
                <th className="px-4 py-3">玩家</th>
                <th className="px-4 py-3">存档槽</th>
                <th className="px-4 py-3">保存时间</th>
                <th className="px-4 py-3">进度</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {saves.map((save) => (
                <tr
                  key={save.id}
                  className="border-b border-[#454545] last:border-0 hover:bg-[#2a2d2e] transition-colors"
                >
                  <td className="px-4 py-3 text-[#cccccc]">{save.player}</td>
                  <td className="px-4 py-3 text-[#858585]">槽位 {save.slot}</td>
                  <td className="px-4 py-3 text-[#858585]">{save.saveTime}</td>
                  <td className="px-4 py-3 text-[#4ec9b0]">{save.progress}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button className="text-[#0098ff] hover:underline text-sm">
                        查看
                      </button>
                      <button className="text-[#0098ff] hover:underline text-sm">
                        下载
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
