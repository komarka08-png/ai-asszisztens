// backend/server.js
// Node >= 18, ESM (package.json: { "type": "module" })

import cors from "cors";
import crypto from "crypto";
import dotenv from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

import { APP_CONTEXT } from "./appContext.js";

/* -------- env -------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Dotenv csak lokál fejlesztéshez (Renderen ENV a dashboardról jön)
if (process.env.NODE_ENV !== "production") {
  dotenv.config({ path: path.join(__dirname, ".env") });
  if (!process.env.OPENAI_API_KEY) {
    dotenv.config({ path: path.join(__dirname, "..", ".env") });
  }
}

const PORT = Number(process.env.PORT || 3001);
const ORIGIN = process.env.CORS_ORIGIN || "*";
const OPENAI_KEY = process.env.OPENAI_API_KEY || "";
const JWT_SECRET = process.env.JWT_SECRET || "";

/* -------- helpers -------- */
function getLocalIPv4() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return null;
}

/* -------- app -------- */
const app = express();
app.disable("x-powered-by");

// Proxy mögött (Render/Fly/Cloudflare/NGINX) korrekt IP-hez
app.set("trust proxy", 1);

// Security headers
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

// ✅ CORS: ha "*" akkor engedjük minden originről
app.use(
  cors({
    origin: ORIGIN === "*" ? true : ORIGIN,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// JSON limit
app.use(
  express.json({
    limit: "15mb",
  })
);

// Preflight
app.options(/.*/, cors());

// Rate limit
const limiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

// Health check
app.get("/health", (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

/* -------- AUTH: anonymous token (JWT) -------- */
app.post("/auth/anonymous", (_req, res) => {
  if (!JWT_SECRET) return res.status(500).json({ error: "JWT_SECRET hiányzik" });

  const token = jwt.sign({ sub: crypto.randomUUID() }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token });
});

/* -------- JWT middleware -------- */
function requireJwt(req, res, next) {
  if (!JWT_SECRET) return res.status(500).json({ error: "JWT_SECRET hiányzik" });

  const auth = req.header("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";

  if (!token) return res.status(401).json({ error: "Missing token" });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

/* -------- OpenAI helper (timeout) -------- */
async function openAIChat(messages, temperature = 0.5) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    if (!OPENAI_KEY) throw new Error("OPENAI_API_KEY hiányzik");

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature,
        messages,
      }),
    });

    const text = await r.text().catch(() => "");
    if (!r.ok) throw new Error(`OpenAI ${r.status}: ${text}`);

    const data = JSON.parse(text);
    return data?.choices?.[0]?.message?.content || "Most nem tudtam válaszolni.";
  } finally {
    clearTimeout(timeout);
  }
}

/* Normalizálás */
function normalizeMessages(rawArr = []) {
  return rawArr.map((m) => {
    const role = m?.role === "assistant" ? "assistant" : "user";
    let content = m?.content;

    if (!Array.isArray(content)) {
      const asText = typeof content === "string" ? content : String(content ?? "");
      content = [{ type: "text", text: asText }];
    } else {
      content = content
        .map((p) => {
          if (!p || typeof p !== "object") return null;

          if (p.type === "text" && typeof p.text === "string") {
            return { type: "text", text: p.text.slice(0, 4000) };
          }

          if (p.type === "image_url" && p.image_url?.url) {
            return { type: "image_url", image_url: { url: String(p.image_url.url) } };
          }

          return null;
        })
        .filter(Boolean);

      if (content.length === 0) content.push({ type: "text", text: "" });

      let imgCount = 0;
      content = content.filter((c) => {
        if (c.type !== "image_url") return true;
        imgCount += 1;
        return imgCount <= 3;
      });
    }

    return { role, content };
  });
}

/* -------- chat handler -------- */
async function chatHandler(req, res) {
  try {
    const raw = req.body?.messages || [];
    if (!Array.isArray(raw) || raw.length === 0) {
      return res.status(400).json({ error: "Hiányzik a messages tömb." });
    }

    const messages = [
      { role: "system", content: [{ type: "text", text: APP_CONTEXT }] },
      ...normalizeMessages(raw),
    ];

    const reply = await openAIChat(messages, 0.5);
    res.json({ reply });
  } catch (e) {
    res.status(500).json({ error: "Szerverhiba", details: String(e?.message || e) });
  }
}

/* -------- ROUTES (VÉDETT) -------- */
app.post("/chat", requireJwt, limiter, chatHandler);
app.post("/ask", requireJwt, limiter, chatHandler);

app.post("/title", requireJwt, limiter, async (req, res) => {
  try {
    const { messages = [] } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Hiányzik a messages tömb." });
    }

    const take = messages.slice(-60).map((m) => {
      const t = Array.isArray(m.content)
        ? m.content.find((p) => p.type === "text")?.text || ""
        : typeof m.content === "string"
        ? m.content
        : "";
      const txt = (t || "").replace(/\s+/g, " ").trim().slice(0, 600);
      return { role: m.role === "assistant" ? "assistant" : "user", content: txt };
    });

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.15,
        messages: [
          {
            role: "system",
            content: `Feladatod: készíts rövid, MAGYAR beszélgetéscímet úgy, hogy az EGÉSZ beszélgetés fő témáját ragadod meg.
Szabályok:
- 3–7 szó; témaszerű, nem idézet, nem egyetlen szó.
- Ne legyen pont, emoji, idézőjel.
- Döntetlenkor prioritás: cukorbetegség/app > tápérték > kód/hiba > egyéb.
Válasz kizárólag JSON: {"title":"..."}`,
          },
          { role: "user", content: "Itt vannak a beszélgetés üzenetei (időrendben):" },
          ...take.map((x) => ({ role: x.role, content: x.content })),
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!r.ok) throw new Error(await r.text());
    const data = await r.json();

    let title = "";
    try {
      title = JSON.parse(data?.choices?.[0]?.message?.content || "{}").title || "";
    } catch {}

    title = (title || "")
      .replace(/[「」"'\u{1F300}-\u{1FAFF}]/gu, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!title) title = "Új beszélgetés";
    if (title.split(" ").length < 2) title = `${title} témájú beszélgetés`.trim();
    if (title.length > 48) title = title.slice(0, 48).trim() + "…";

    res.json({ title });
  } catch (e) {
    res.status(500).json({ error: "Címgenerálási hiba", details: String(e?.message || e) });
  }
});

/* -------- start -------- */
app.listen(PORT, "0.0.0.0", () => {
  const ip = getLocalIPv4();
  console.log(`Backend fut: http://0.0.0.0:${PORT}`);
  console.log(`Local:       http://localhost:${PORT}`);
  if (ip) console.log(`LAN:         http://${ip}:${PORT}`);
  console.log("Routes: /auth/anonymous  /chat  /ask  /title  /health");
});
