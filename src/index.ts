import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import setupAdminRouter from "./setupAdmin.js";

const app = express();
const prisma = new PrismaClient();

const PORT = Number(process.env.PORT || 10000);
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

app.use(cors());
app.use(express.json());

// healthcheck
app.get("/", (_req, res) => res.json({ ok: true, service: "sindicato-backend", ts: new Date().toISOString() }));

// Ativa /setup-admin apenas se SETUP_TOKEN estiver definido
if (process.env.SETUP_TOKEN) {
  app.use("/setup-admin", setupAdminRouter);
}

// Registro simples (opcional)
app.post("/auth/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "email e password são obrigatórios" });
    const exist = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } as any });
    if (exist) return res.status(409).json({ error: "Usuário já existe" });
    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.default.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name: name || "Usuário",
        email: String(email).toLowerCase(),
        password: passwordHash,
        role: role || "MEMBER"
      } as any
    });
    res.status(201).json({ id: user.id, email: user.email });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err?.message || "Erro interno" });
  }
});

// Login
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "email e password são obrigatórios" });
    const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } as any });
    if (!user) return res.status(401).json({ error: "Credenciais inválidas" });
    const bcrypt = await import("bcryptjs");
    const ok = await bcrypt.default.compare(password, (user as any).password);
    if (!ok) return res.status(401).json({ error: "Credenciais inválidas" });
    const accessToken = jwt.sign({ sub: user.id, email: user.email, role: (user as any).role || "MEMBER" }, JWT_SECRET, { expiresIn: "12h" });
    res.json({ accessToken });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err?.message || "Erro interno" });
  }
});

// Middleware de Bearer
function bearerAuth(req: any, res: any, next: any) {
  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Falta Bearer token" });
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

// Endpoints de exemplo (mock)
app.get("/motions", bearerAuth, async (_req, res) => {
  res.json([
    { id: 1, title: "Aprovação de pauta X", description: "Texto da pauta X" },
    { id: 2, title: "Orçamento 2025", description: "Aprovação do orçamento" }
  ]);
});

app.post("/votes", bearerAuth, async (req, res) => {
  const { motionId, choice, deviceInfo, geo } = req.body || {};
  if (!motionId || !choice) return res.status(400).json({ error: "motionId e choice são obrigatórios" });
  res.json({
    id: Math.floor(Math.random() * 1_000_000),
    motionId, choice, deviceInfo: deviceInfo || null, geo: geo || null,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`API up on :${PORT}`);
});
