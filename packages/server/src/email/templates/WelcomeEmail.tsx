import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

interface WelcomeEmailProps {
  userName: string;
  loginUrl?: string;
  appName?: string;
}

export function WelcomeEmail({
  userName = "用户",
  loginUrl = "https://miu2d.com",
  appName = "Miu2D Engine",
}: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>欢迎加入 {appName}！</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>🎮 欢迎加入 {appName}！</Heading>
          <Text style={greeting}>你好，{userName}：</Text>
          <Text style={paragraph}>
            感谢你注册 {appName}！我们很高兴你成为我们社区的一员。
          </Text>
          <Text style={paragraph}>你现在可以：</Text>
          <Section style={featureList}>
            <Text style={featureItem}>🗺️ 创建和编辑游戏地图</Text>
            <Text style={featureItem}>⚔️ 配置武功和角色系统</Text>
            <Text style={featureItem}>🎭 管理 NPC 和剧情脚本</Text>
            <Text style={featureItem}>🎵 导入音乐和音效资源</Text>
          </Section>
          <Section style={buttonSection}>
            <Button style={button} href={loginUrl}>
              开始使用
            </Button>
          </Section>
          <Hr style={hr} />
          <Text style={footer}>
            此邮件由 {appName} 自动发送，请勿直接回复。
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default WelcomeEmail;

const body: React.CSSProperties = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const container: React.CSSProperties = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "40px 32px",
  borderRadius: "8px",
  maxWidth: "480px",
};

const heading: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: "bold",
  textAlign: "center" as const,
  color: "#1a1a1a",
  margin: "0 0 24px",
};

const greeting: React.CSSProperties = {
  fontSize: "16px",
  color: "#333",
  margin: "0 0 12px",
};

const paragraph: React.CSSProperties = {
  fontSize: "14px",
  lineHeight: "24px",
  color: "#555",
  margin: "0 0 16px",
};

const featureList: React.CSSProperties = {
  backgroundColor: "#f0f4f8",
  borderRadius: "6px",
  padding: "16px 20px",
  margin: "16px 0",
};

const featureItem: React.CSSProperties = {
  fontSize: "14px",
  color: "#333",
  margin: "6px 0",
  lineHeight: "22px",
};

const buttonSection: React.CSSProperties = {
  textAlign: "center" as const,
  margin: "24px 0",
};

const button: React.CSSProperties = {
  backgroundColor: "#4f46e5",
  borderRadius: "6px",
  color: "#fff",
  fontSize: "16px",
  fontWeight: "bold",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "12px 32px",
};

const hr: React.CSSProperties = {
  borderColor: "#e6ebf1",
  margin: "24px 0 16px",
};

const footer: React.CSSProperties = {
  fontSize: "12px",
  color: "#999",
  textAlign: "center" as const,
};
