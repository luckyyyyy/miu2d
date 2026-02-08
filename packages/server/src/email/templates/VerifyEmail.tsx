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

interface VerifyEmailProps {
  userName: string;
  verifyUrl: string;
  expiresIn?: string;
  appName?: string;
}

export function VerifyEmail({
  userName = "用户",
  verifyUrl = "https://miu2d.com/verify?token=xxx",
  expiresIn = "24 小时",
  appName = "Miu2D Engine",
}: VerifyEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>验证你的邮箱 - {appName}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>📧 邮箱验证</Heading>
          <Text style={greeting}>你好，{userName}：</Text>
          <Text style={paragraph}>
            请点击下方按钮验证你的邮箱地址。验证后你将获得完整的账号功能。
          </Text>
          <Section style={buttonSection}>
            <Button style={button} href={verifyUrl}>
              验证邮箱
            </Button>
          </Section>
          <Text style={paragraph}>
            如果按钮无法点击，请复制以下链接到浏览器中打开：
          </Text>
          <Text style={linkText}>{verifyUrl}</Text>
          <Text style={expireText}>⏰ 此链接将在 {expiresIn} 后失效。</Text>
          <Hr style={hr} />
          <Text style={footer}>
            如果你没有进行此操作，请忽略此邮件。
            <br />
            此邮件由 {appName} 自动发送，请勿直接回复。
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default VerifyEmail;

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

const buttonSection: React.CSSProperties = {
  textAlign: "center" as const,
  margin: "24px 0",
};

const button: React.CSSProperties = {
  backgroundColor: "#16a34a",
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
