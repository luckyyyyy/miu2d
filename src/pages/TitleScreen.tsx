import { useNavigate } from "react-router-dom";
import { Typography, theme } from "antd";
import { motion } from "framer-motion";

const { Title, Text } = Typography;
const { useToken } = theme;

export default function TitleScreen() {
  const navigate = useNavigate();
  const { token } = useToken();

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#0a1628] via-[#1a0f28] to-[#0f1a28] relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 opacity-10">
        <motion.div
          className="absolute top-20 left-20 w-96 h-96 bg-yellow-500 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 4,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute bottom-20 right-20 w-96 h-96 bg-blue-500 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 4,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
            delay: 1,
          }}
        />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <Title
            level={1}
            className="!text-8xl !font-bold !mb-4 !tracking-[0.8rem]"
            style={{
              color: "#ffd700",
              textShadow: "0 0 20px rgba(255, 215, 0, 0.8), 0 0 40px rgba(255, 215, 0, 0.5), 0 4px 30px rgba(255, 215, 0, 0.3), 0 8px 60px rgba(255, 100, 0, 0.2)",
              fontFamily: '"KaiTi", "STKaiti", serif',
              WebkitTextStroke: '1px rgba(139, 69, 19, 0.3)',
            }}
          >
            剑侠情缘
          </Title>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <Text
            className="!text-xl !mb-12 !tracking-widest"
            style={{
              color: "#c0a060",
              textShadow: "0 2px 10px rgba(192, 160, 96, 0.5)",
            }}
          >
            月影传说
          </Text>
        </motion.div>

        {/* Menu */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex flex-col gap-6 mt-8"
        >
          <motion.div
            whileHover={{ scale: 1.05, x: 10 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate("/game")}
            className="cursor-pointer"
          >
            <Text
              style={{
                fontSize: '28px',
                fontFamily: '"KaiTi", "STKaiti", serif',
                color: '#ffd700',
                textShadow: '0 2px 15px rgba(255, 215, 0, 0.6)',
                letterSpacing: '0.3em',
              }}
            >
              开始新游戏
            </Text>
          </motion.div>

          <motion.div
            className="cursor-not-allowed opacity-40"
          >
            <Text
              style={{
                fontSize: '28px',
                fontFamily: '"KaiTi", "STKaiti", serif',
                color: '#c0a060',
                letterSpacing: '0.3em',
              }}
            >
              读取存档
            </Text>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.05, x: 10 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate("/viewer")}
            className="cursor-pointer"
          >
            <Text
              style={{
                fontSize: '28px',
                fontFamily: '"KaiTi", "STKaiti", serif',
                color: '#ffd700',
                textShadow: '0 2px 15px rgba(255, 215, 0, 0.6)',
                letterSpacing: '0.3em',
              }}
            >
              地图查看器
            </Text>
          </motion.div>
        </motion.div>

        {/* Footer */}
        <motion.div
          className="mt-12 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.8 }}
        >
          <Text style={{ color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>
            Web 版复刻 · 基于 JxqyHD 引擎
          </Text>
          <br />
          <Text style={{ color: token.colorTextTertiary, fontSize: token.fontSizeSM, marginTop: token.marginXS }}>
            西山居 2001 经典 RPG 致敬之作
          </Text>
        </motion.div>
      </div>
    </div>
  );
}
