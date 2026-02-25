import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Feedback Notification Route
  app.post("/api/feedback/notify", async (req, res) => {
    const { userName, userEmail, type, message } = req.body;
    const notificationEmail = process.env.NOTIFICATION_EMAIL;

    if (!resend) {
      console.warn("Resend API key missing. Notification not sent.");
      return res.status(200).json({ success: true, message: "Notification skipped (no API key)" });
    }

    if (!notificationEmail) {
      console.warn("NOTIFICATION_EMAIL missing. Notification not sent.");
      return res.status(200).json({ success: true, message: "Notification skipped (no target email)" });
    }

    try {
      await resend.emails.send({
        from: 'Softrify Feedback <onboarding@resend.dev>',
        to: notificationEmail,
        subject: `New Feedback: ${type.toUpperCase()} from ${userName}`,
        html: `
          <h3>New Feedback Received</h3>
          <p><strong>User:</strong> ${userName} (${userEmail})</p>
          <p><strong>Type:</strong> ${type}</p>
          <p><strong>Message:</strong></p>
          <div style="padding: 15px; background: #f5f5f5; border-radius: 8px;">
            ${message.replace(/\n/g, '<br/>')}
          </div>
        `
      });
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to send email:", error);
      res.status(500).json({ error: "Failed to send notification" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
