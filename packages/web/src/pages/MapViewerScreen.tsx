import { ResourcePath } from "@miu2d/engine/config/resourcePaths";
import { motion } from "framer-motion";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapViewer } from "../components";

/** 地图列表（仅地图查看器使用） */
const MAPS = [
  { name: "凌绝峰连接地图", file: "map_001_凌绝峰连接地图.map" },
  { name: "凌绝峰峰顶", file: "map_002_凌绝峰峰顶.map" },
  { name: "武当山下", file: "map_003_武当山下.map" },
  { name: "武当山连接地图", file: "map_004_武当山连接地图.map" },
  { name: "洗剑池", file: "map_005_洗剑池.map" },
  { name: "武当山山顶", file: "map_006_武当山山顶.map" },
  { name: "连接地图 007", file: "map_007_连接地图.map" },
  { name: "野树林", file: "map_008_野树林.map" },
  { name: "山洞内部 009", file: "map_009_山洞内部.map" },
  { name: "山洞内部 010", file: "map_010_山洞内部.map" },
  { name: "连接地图 011", file: "map_011_连接地图.map" },
  { name: "惠安镇", file: "map_012_惠安镇.map" },
  { name: "连接地图 014", file: "map_014_连接地图.map" },
  { name: "藏剑山庄", file: "map_015_藏剑山庄.map" },
  { name: "剑气峰", file: "map_016_剑气峰.map" },
  { name: "连接地图 017", file: "map_017_连接地图.map" },
  { name: "连接地图 018", file: "map_018_连接地图.map" },
  { name: "寒波谷", file: "map_019_寒波谷.map" },
  { name: "寒波谷 (A)", file: "map_019_寒波谷(A).map" },
  { name: "寒波谷 (B)", file: "map_019_寒波谷(B).map" },
  { name: "樱花谷", file: "map_020_樱花谷.map" },
  { name: "油菜花地", file: "map_021_油菜花地.map" },
  { name: "清平乡", file: "map_022_清平乡.map" },
  { name: "连接地图 023", file: "map_023_连接地图.map" },
  { name: "倚天山", file: "map_024_倚天山.map" },
  { name: "摘星楼", file: "map_025_摘星楼.map" },
  { name: "摘星楼地下", file: "map_026_摘星楼地下.map" },
  { name: "连接地图 027", file: "map_027_连接地图.map" },
  { name: "连接地图 028", file: "map_028_连接地图.map" },
  { name: "码头", file: "map_029_码头.map" },
  { name: "悲魔山庄", file: "map_030_悲魔山庄.map" },
  { name: "连接地图 031", file: "map_031_连接地图.map" },
  { name: "天山", file: "map_032_天山.map" },
  { name: "落叶谷", file: "map_033_落叶谷.map" },
  { name: "落叶谷 (破坏后)", file: "map_033_落叶谷(破坏后).map" },
  { name: "天池", file: "map_034_天池.map" },
  { name: "天池内部", file: "map_035_天池内部.map" },
  { name: "连接地图 036", file: "map_036_连接地图.map" },
  { name: "敦煌十洞", file: "map_037_敦煌十洞.map" },
  { name: "连接地图 038", file: "map_038_连接地图.map" },
  { name: "飞龙堡", file: "map_039_飞龙堡.map" },
  { name: "沙漠", file: "map_040_沙漠.map" },
  { name: "通天塔一层", file: "MAP_041_通天塔一层.map" },
  { name: "通天塔二层", file: "MAP_042_通天塔二层.map" },
  { name: "通天塔第三层", file: "map_043_通天塔第三层.map" },
  { name: "通天塔四层", file: "MAP_044_通天塔四层.map" },
  { name: "通天塔第五层", file: "map_045_通天塔第五层.map" },
  { name: "通天塔第六层", file: "map_046_通天塔第六层.map" },
  { name: "通天塔第七层", file: "map_047_通天塔第七层.map" },
  { name: "通天塔第八层", file: "map_049_通天塔第八层.map" },
  { name: "忘忧岛", file: "map_050_忘忧岛.map" },
  { name: "海边", file: "map_051_海边.map" },
  { name: "码头 052", file: "map_052_码头.map" },
  { name: "连接地图 053", file: "map_053_连接地图.map" },
  { name: "北山", file: "map_054_北山.map" },
  { name: "山洞", file: "map_055_山洞.map" },
  { name: "盆地", file: "map_056_盆地.map" },
  { name: "盆地加坟墓", file: "map_056_盆地加坟墓.map" },
  { name: "连接地图 057", file: "map_057_连接地图.map" },
  { name: "禁地", file: "map_058_禁地.map" },
  { name: "禁地一层", file: "map_059_禁地一层.map" },
  { name: "禁地二层", file: "map_060_禁地二层.map" },
  { name: "禁地三层", file: "map_061_禁地三层.map" },
  { name: "禁地密室", file: "map_062_禁地密室.map" },
  { name: "药王谷", file: "map_063_药王谷.map" },
  { name: "霹雳堂", file: "map_064_霹雳堂.map" },
  { name: "霹雳堂被炸后", file: "map_064_霹雳堂被炸后.map" },
  { name: "天山古道", file: "map_065_天山古道.map" },
].map(({ name, file }) => ({ name, path: ResourcePath.map(file) }));

// Icons as simple SVG components
const ArrowLeftIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 19l-7-7m0 0l7-7m-7 7h18"
    />
  </svg>
);

const ChevronLeftIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const MapPinIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
);

export default function MapViewerScreen() {
  const navigate = useNavigate();
  const [viewerMapIndex, setViewerMapIndex] = useState(1);
  const [currentMapName, setCurrentMapName] = useState("");

  const handleMapLoaded = useCallback((mapName: string) => {
    setCurrentMapName(mapName);
  }, []);

  const handleMapSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setViewerMapIndex(Number(e.target.value));
  };

  return (
    <div className="w-full h-full relative">
      <div className="w-full h-full">
        <MapViewer mapPath={MAPS[viewerMapIndex].path} onMapLoaded={handleMapLoaded} />
      </div>

      {/* Top Control Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="pointer-events-auto"
        >
          <div className="bg-gray-900/80 backdrop-blur-md rounded-xl shadow-lg border border-gray-700/50 px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate("/")}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors"
                >
                  <ArrowLeftIcon />
                  返回标题
                </motion.button>

                <div className="flex items-center">
                  <button
                    onClick={() => setViewerMapIndex((i) => (i - 1 + MAPS.length) % MAPS.length)}
                    className="flex items-center gap-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-l-lg border-r border-gray-600 transition-colors"
                  >
                    <ChevronLeftIcon />
                    上一张
                  </button>

                  <select
                    value={viewerMapIndex}
                    onChange={handleMapSelect}
                    className="min-w-[200px] px-3 py-2 bg-gray-700 text-white border-x border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    {MAPS.map((map, index) => (
                      <option key={map.path} value={index}>
                        📍 {map.name}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => setViewerMapIndex((i) => (i + 1) % MAPS.length)}
                    className="flex items-center gap-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-r-lg border-l border-gray-600 transition-colors"
                  >
                    下一张
                    <ChevronRightIcon />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/60 rounded-lg">
                <span className="text-gray-400 text-sm">控制:</span>
                {["W", "A", "S", "D"].map((key) => (
                  <kbd
                    key={key}
                    className="px-2 py-0.5 bg-gray-700 text-gray-200 rounded text-xs font-mono border border-gray-600"
                  >
                    {key}
                  </kbd>
                ))}
                <span className="text-gray-500 text-sm">或方向键</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Bottom Info Bar */}
      <div className="absolute bottom-4 left-4 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="pointer-events-auto"
        >
          <div className="relative">
            <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-indigo-600 text-white text-xs rounded-full z-10">
              {viewerMapIndex + 1}/{MAPS.length}
            </span>
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-900/80 backdrop-blur-md rounded-lg shadow-lg border border-gray-700/50">
              <MapPinIcon />
              <span className="text-sm text-gray-200">{currentMapName || "加载中..."}</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
