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

interface ChangeEmailVerificationProps {
  userName: string;
  newEmail: string;
  verifyUrl: string;
  expiresIn?: string;
  appName?: string;
}

export function ChangeEmailVerification({
  userName = "用户",
  newEmail = "new@example.com",
  verifyUrl = "https://miu2d.com/verify-change-email?token=xxx",
  expiresIn = "1 小时",
  appName = "Miu2D Engine",
}: ChangeEmailVerificationProps) {
  return (
    <Html>
      <Head />
      <Preview>确认修改邮箱 - {appName}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>✉️ 修改邮箱确认</Heading>
          <Text style={greeting}>你好，{userName}：</Text>
          <Text style={paragraph}>
            你正在将账号邮箱修改为：
          </Text>
          <Section style={infoBox}>
            <Text style={newEmailText}>{newEmail}</Text>
          </Section>
          <Text style={paragraph}>
            请点击下方按钮确认此修改。确认后你的账号将使用新邮箱登录。
          </Text>
          <Section style={buttonSection}>
            <Button style={button} href={verifyUrl}>
              确认修改邮箱
            </Button>
          </Section>
          <Text style={paragraph}>
            如果按钮无法点击，请复制以下链接到浏览器中打开：
          </Text>
          <Text style={linkText}>{verifyUrl}</Text>
          <Text style={expireText}>⏰ 此链接将在 {expiresIn} 后失效。</Text>
          <Hr style={hr} />
          <Text style={footer}>
            如果你没有请求此修改，请忽略此邮件，你的邮箱地址不会改变。
            <br />
            此邮件由 {appName} 自动发送，请勿直接回复。
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default ChangeEmailVerification;

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
  padding: "12px 20px",
  margin: "12px 0",
  textAlign: "center" as const,
};

const newEmailText: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: "bold",
  color: "#4f46e5",
  margin: "0",
};

const buttonSection: React.CSSProperties = {
  textAlign: "center" as const,
  margin: "24px 0",
};

const button: React.CSSProperties = {
  backgroundColor: "#f59e0b",
  borderRadius: "6px",
  color: "#fff",
  fontSize: "16px",
  fontWeight: "bold",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "12px 32px",
};

const linkText: React.CSSProperties = {
  fontSize: "12px",
  color: "#6366f1",
  wordBreak: "break-all",
  lineHeight: "20px",
  margin: "0 0 16px",
};

const expireText: React.CSSProperties = {
  fontSize: "13px",
  color: "#f59e0b",
  margin: "0 0 16px",
};

const hr: React.CSSProperties = {
  borderColor: "#e6ebf1",
  margin: "24px 0 16px",
};

const footer: React.CSSProperties = {
  fontSize: "12px",
  color: "#999",
  textAlign: "center" as const,
  lineHeight: "20px",
};
