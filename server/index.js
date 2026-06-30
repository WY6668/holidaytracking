import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "data", "holidays.json");
const APP_PASSWORD = process.env.APP_PASSWORD || "";
const AUTH_SECRET = process.env.AUTH_SECRET || "dev-only-secret-change-me";
const PORT = process.env.PORT || 4000;

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// ---------- data helpers ----------

function loadData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { entries: [], allowance: 25 };
  }
}

function saveData(data) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ---------- auth helpers ----------

function expectedToken() {
  return crypto.createHmac("sha256", AUTH_SECRET).update(APP_PASSWORD).digest("hex");
}

function requireAuth(req, res, next) {
  if (!APP_PASSWORD) return next(); // no password configured -> open access
  const token = req.cookies?.auth;
  if (token && token === expectedToken()) return next();
  return res.status(401).json({ error: "Not authenticated" });
}

app.post("/api/login", (req, res) => {
  if (!APP_PASSWORD) return res.json({ ok: true });
  const { password } = req.body || {};
  if (password !== APP_PASSWORD) {
    return res.status(401).json({ error: "Wrong password" });
  }
  res.cookie("auth", expectedToken(), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
  });
  res.json({ ok: true });
});

app.post("/api/logout", (req, res) => {
  res.clearCookie("auth");
  res.json({ ok: true });
});

app.get("/api/session", (req, res) => {
  const needsPassword = Boolean(APP_PASSWORD);
  const authed = !needsPassword || req.cookies?.auth === expectedToken();
  res.json({ needsPassword, authed });
});

// ---------- API routes (protected) ----------

app.get("/api/state", requireAuth, (req, res) => {
  res.json(loadData());
});

app.post("/api/entries", requireAuth, (req, res) => {
  const { name, start, end, type, note } = req.body || {};
  if (!name || !start || !end) {
    return res.status(400).json({ error: "Name, start, and end date are required." });
  }
  if (end < start) {
    return res.status(400).json({ error: "End date can't be before the start date." });
  }
  const data = loadData();
  const entry = {
    id: crypto.randomUUID(),
    name: String(name).trim(),
    start,
    end,
    type: type || "annual",
    note: note || "",
  };
  data.entries.push(entry);
  saveData(data);
  res.status(201).json(entry);
});

app.delete("/api/entries/:id", requireAuth, (req, res) => {
  const data = loadData();
  data.entries = data.entries.filter((e) => e.id !== req.params.id);
  saveData(data);
  res.json({ ok: true });
});

app.put("/api/allowance", requireAuth, (req, res) => {
  const { allowance } = req.body || {};
  const data = loadData();
  data.allowance = Number(allowance) || 0;
  saveData(data);
  res.json({ ok: true, allowance: data.allowance });
});

// ---------- serve built client ----------

const clientDist = path.join(__dirname, "..", "client", "dist");
app.use(express.static(clientDist));
app.get("*", (req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Holiday tracker running on port ${PORT}`);
  if (!APP_PASSWORD) {
    console.log("No APP_PASSWORD set — running with open access.");
  }
});
