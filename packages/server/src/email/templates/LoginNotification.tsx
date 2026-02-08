import {
  Body,
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

interface LoginNotificationProps {
  userName: string;
  loginTime: string;
  ipAddress: string;
  appName?: string;
}

export function LoginNotification({
  userName = "用户",
  loginTime = "2026-01-01 12:00:00",
  ipAddress = "127.0.0.1",
  appName = "Miu2D Engine",
}: LoginNotificationProps) {
  return (
    <Html>
      <Head />
      <Preview>新的登录活动 - {appName}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>🔐 登录通知</Heading>
          <Text style={greeting}>你好，{userName}：</Text>
          <Text style={paragraph}>
            你的账号刚刚完成了一次登录操作，以下是本次登录的详细信息：
          </Text>
          <Section style={infoBox}>
            <Text style={infoRow}>
              <strong>📅 登录时间：</strong>
              {loginTime}
            </Text>
            <Text style={infoRow}>
              <strong>🌐 登录 IP：</strong>
              {ipAddress}
            </Text>
          </Section>
          <Text style={paragraph}>
            如果这不是你本人的操作，请立即修改密码以确保账号安全。
          </Text>
          <Hr style={hr} />
          <Text style={footer}>
            此邮件由 {appName} 自动发送，请勿直接回复。
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default LoginNotification;

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

const infoBox: React.CSSProperties = {
  backgroundColor: "#f0f4f8",
  borderRadius: "6px",
  padding: "16px 20px",
  margin: "16px 0",
};

const infoRow: React.CSSProperties = {
  fontSize: "14px",
  color: "#333",
  margin: "4px 0",
  lineHeight: "22px",
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
