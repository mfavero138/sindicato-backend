import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const router = Router();

// GET /setup-admin?token=XYZ&email=admin@sindicato.org&password=123456&name=Administrador
router.get("/", async (req, res) => {
  try {
    const setupToken = process.env.SETUP_TOKEN;
    if (!setupToken) return res.status(403).json({ error: "SETUP desativado (defina SETUP_TOKEN)" });
    const token = String(req.query.token || "");
    if (token !== setupToken) return res.status(401).json({ error: "Token inválido" });

    const email = String(req.query.email || "").toLowerCase();
    const password = String(req.query.password || "");
    const name = String(req.query.name || "Administrador");
    if (!email || !password) return res.status(400).json({ error: "Parâmetros obrigatórios: email, password" });

    let user = await prisma.user.findUnique({ where: { email } as any });
    if (user) return res.json({ status: "ok", message: "Usuário já existe", email });

    const passwordHash = await bcrypt.hash(password, 10);
    user = await prisma.user.create({
      data: { name, email, password: passwordHash, role: "ADMIN" } as any
    });

    return res.json({ status: "ok", message: "ADMIN criado com sucesso", email: user.email });
  } catch (err: any) {
    console.error("setup-admin error:", err);
    return res.status(500).json({ error: err?.message || "Erro interno" });
  }
});

export default router;
