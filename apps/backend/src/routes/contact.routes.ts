import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { logger } from "../logger.js";

const router = Router();

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Valid email required").max(200),
  subject: z.string().trim().min(1, "Subject is required").max(200),
  message: z.string().trim().min(1, "Message is required").max(5000),
  // Honeypot. Real browsers leave this empty; bots fill every field.
  // Silently 200 if filled so the bot thinks it worked.
  website: z.string().optional().default(""),
});

router.post("/", async (req, res) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const { name, email, subject, message, website } = parsed.data;

  if (website.length > 0) {
    logger.info({ email, subject }, "contact: honeypot tripped, dropping silently");
    return res.json({ ok: true });
  }

  if (!config.RESEND_API_KEY) {
    logger.warn(
      { name, email, subject },
      "contact: RESEND_API_KEY missing — submission logged but not emailed",
    );
    return res.json({ ok: true, delivered: false });
  }

  try {
    const escapedMsg = message.replace(/[<>&]/g, (c) =>
      c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;",
    );
    const html = `
      <h2>New Beacon contact form submission</h2>
      <p><strong>From:</strong> ${name} &lt;${email}&gt;</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <hr/>
      <pre style="white-space: pre-wrap; font-family: -apple-system, system-ui, sans-serif;">${escapedMsg}</pre>
    `;
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Beacon <onboarding@resend.dev>",
        to: config.CONTACT_EMAIL_TO,
        reply_to: email,
        subject: `[Beacon contact] ${subject}`,
        html,
      }),
    });

    if (!r.ok) {
      const body = await r.text();
      logger.error(
        { status: r.status, body, name, email },
        "contact: Resend API rejected the request",
      );
      return res.status(502).json({
        ok: false,
        message: "Email delivery failed. Please email us directly.",
      });
    }

    logger.info({ email, subject }, "contact: message delivered");
    return res.json({ ok: true, delivered: true });
  } catch (err) {
    logger.error(
      { err: (err as Error).message, name, email },
      "contact: unexpected error sending email",
    );
    return res.status(500).json({
      ok: false,
      message: "Something went wrong. Please email us directly.",
    });
  }
});

export default router;
