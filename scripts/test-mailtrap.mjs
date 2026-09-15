import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";

// Simple .env.local loader
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    }
  }
}

loadEnv();

const host = process.env.SMTP_HOST || "live.smtp.mailtrap.io";
const port = Number(process.env.SMTP_PORT || 587);
const user = process.env.SMTP_USER || "api";
const pass = process.env.SMTP_PASSWORD;
const from = process.env.SMTP_FROM || "JetFlo Funds Portal <noreply@claroenergy.in>";
const to = process.argv[2] || "yash.parashar@claroenergy.in";

console.log("=========================================");
console.log(" JetFlo Mailtrap Notification Verifier");
console.log("=========================================");
console.log(`Host: ${host}:${port}`);
console.log(`User: ${user}`);
console.log(`From: ${from}`);
console.log(`To:   ${to}`);
console.log("-----------------------------------------");

if (!pass) {
  console.error("ERROR: SMTP_PASSWORD is not set in .env.local");
  process.exit(1);
}

const transport = nodemailer.createTransport({
  host,
  port,
  secure: process.env.SMTP_SECURE === "true",
  auth: { user, pass },
});

async function main() {
  try {
    console.log("1. Verifying SMTP connection...");
    await transport.verify();
    console.log("   SMTP connection verified successfully!");

    console.log(`2. Sending test notification to ${to}...`);
    const info = await transport.sendMail({
      from,
      to,
      subject: "JetFlo Notification System — Mailtrap Verification",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px;">
          <div style="background-color: #0f172a; padding: 18px 24px; margin: -24px -24px 20px -24px; border-radius: 10px 10px 0 0;">
            <span style="font-size: 18px; font-weight: 700; color: #ffffff;">JetFlo <span style="color: #60a5fa;">Funds Portal</span></span>
            <span style="display: block; font-size: 11px; color: #94a3b8; text-transform: uppercase; margin-top: 2px;">Claro Energy</span>
          </div>
          <h3 style="color: #0f172a; margin: 0 0 12px 0;">Mailtrap Integration Active</h3>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">
            Email notifications are now enabled for fund requests, approvals, payments, and workflow updates.
          </p>
          <div style="background-color: #f8fafc; border-left: 4px solid #10b981; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
            <p style="margin: 0; font-size: 13px; color: #0f172a;"><strong>Relay:</strong> Mailtrap Live SMTP (<code>${host}</code>)</p>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #059669;">Authenticated Sender: <code>${from}</code></p>
          </div>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
            JetFlo Plant Operations & Finance Workflow
          </p>
        </div>
      `,
    });

    console.log("   Message sent successfully!");
    console.log("   Message ID:", info.messageId);
    console.log("   Server Response:", info.response);
    console.log("-----------------------------------------");
    console.log("Notification system is fully operational!");
  } catch (err) {
    console.error("Verification failed:", err);
    process.exit(1);
  }
}

main();
