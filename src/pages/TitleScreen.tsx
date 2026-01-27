/**
 * Title Screen Page - based on JxqyHD Engine/Gui/TitleGui.cs
 * Main menu with original game graphics from resources
 *
 * Uses TitleGui component for original game UI rendering
 */
import { useNavigate } from "react-router-dom";
import { TitleGui } from "../components/ui";

export default function TitleScreen() {
  const navigate = useNavigate();

  // 处理菜单点击事件
  const handleBegin = () => {
    navigate("/game");
  };

  const handleLoad = () => {
    // TODO: 实现读取存档功能
    navigate("/game");
  };

  const handleTeam = () => {
    // 跳转到地图查看器作为开发工具
    navigate("/viewer");
  };

  const handleExit = () => {
    // Web 版无法真正退出，显示提示或返回
    console.log("退出游戏 - Web 版无法退出");
    // 可以选择关闭窗口或显示确认对话框
    if (window.confirm("确定要退出游戏吗？")) {
      window.close();
    }
  };

  return (
    <div className="w-full h-full relative bg-black">
      <TitleGui
        onNewGame={handleBegin}
        onLoadGame={handleLoad}
        onTeam={handleTeam}
        onExit={handleExit}
      />
    </div>
  );
}
