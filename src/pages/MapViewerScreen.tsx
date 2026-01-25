import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Select, Badge, Space, Card, Typography, Tag, theme } from "antd";
import {
  ArrowLeftOutlined,
  LeftOutlined,
  RightOutlined,
  EnvironmentOutlined,
} from "@ant-design/icons";
import { motion } from "framer-motion";
import { MapViewer } from "../components";
import { MAPS } from "../constants/maps";

const { Text } = Typography;
const { useToken } = theme;

export default function MapViewerScreen() {
  const navigate = useNavigate();
  const { token } = useToken();
  const [viewerMapIndex, setViewerMapIndex] = useState(1);
  const [currentMapName, setCurrentMapName] = useState("");

  const handleMapLoaded = useCallback((mapName: string) => {
    setCurrentMapName(mapName);
  }, []);

  const handleMapSelect = (index: number) => {
    setViewerMapIndex(index);
  };

  return (
    <div className="w-full h-full relative">
      <div className="w-full h-full">
        <MapViewer
          mapPath={MAPS[viewerMapIndex].path}
          onMapLoaded={handleMapLoaded}
        />
      </div>

      {/* Top Control Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="pointer-events-auto"
        >
          <Card
            className="backdrop-blur-md border-0 shadow-lg"
            styles={{
              body: { padding: `${token.paddingSM}px ${token.padding}px` },
            }}
          >
            <div className="flex items-center justify-between">
              <Space size="middle">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    type="primary"
                    icon={<ArrowLeftOutlined />}
                    onClick={() => navigate("/")}
                    style={{
                      background: token.colorSuccess,
                    }}
                  >
                    返回标题
                  </Button>
                </motion.div>

                <Button.Group>
                  <Button
                    icon={<LeftOutlined />}
                    onClick={() => setViewerMapIndex((i) => (i - 1 + MAPS.length) % MAPS.length)}
                  >
                    上一张
                  </Button>

                  <Select
                    value={viewerMapIndex}
                    onChange={handleMapSelect}
                    className="!min-w-[200px]"
                    options={MAPS.map((map, index) => ({
                      value: index,
                      label: (
                        <Space>
                          <EnvironmentOutlined />
                          <span>{map.name}</span>
                        </Space>
                      ),
                    }))}
                  />

                  <Button
                    icon={<RightOutlined />}
                    onClick={() => setViewerMapIndex((i) => (i + 1) % MAPS.length)}
                    iconPosition="end"
                  >
                    下一张
                  </Button>
                </Button.Group>
              </Space>

              <Card
                size="small"
                className="border-0"
                styles={{
                  body: { padding: `${token.paddingXS}px ${token.paddingSM}px` },
                }}
              >
                <Space size={4}>
                  <Text style={{ color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>控制:</Text>
                  {['W', 'A', 'S', 'D'].map(key => (
                    <Tag key={key} bordered={false}>
                      {key}
                    </Tag>
                  ))}
                  <Text style={{ color: token.colorTextTertiary, fontSize: token.fontSizeSM }}>或方向键</Text>
                </Space>
              </Card>
            </div>
          </Card>
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
          <Badge count={`${viewerMapIndex + 1}/${MAPS.length}`}>
            <Card
              size="small"
              className="backdrop-blur-md border-0 shadow-lg"
              styles={{
                body: { padding: `${token.paddingXS}px ${token.padding}px` },
              }}
            >
              <Space>
                <EnvironmentOutlined style={{ color: token.colorInfo }} />
                <Text style={{ fontSize: token.fontSizeSM }}>
                  {currentMapName || "加载中..."}
                </Text>
              </Space>
            </Card>
          </Badge>
        </motion.div>
      </div>
    </div>
  );
}
