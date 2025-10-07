// src/index.ts
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const app = express();

const PORT = Number(process.env.PORT || 10000);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const DISABLE_2FA = (process.env.DISABLE_2FA || 'false').toLowerCase() === 'true';

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// --- Auth middleware ---
function auth(req: any, res: any, next: any) {
  const h = req.headers['authorization'];
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: 'token ausente' });
  const token = h.substring('Bearer '.length);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { uid: number; role: string };
    (req as any).user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'token inválido' });
  }
}

// --- Login ---
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password, code } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email e senha obrigatórios' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'credenciais inválidas' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'credenciais inválidas' });

    // 2FA: para testes podemos ignorar se DISABLE_2FA=true
    if (!DISABLE_2FA) {
      if (!code) return res.status(401).json({ error: '2FA necessário' });
      // aqui você validaria o TOTP (ex: speakeasy). Omitido por enquanto.
    }

    const token = jwt.sign({ uid: user.id, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
    return res.json({ accessToken: token });
  } catch (e: any) {
    console.error('[login] erro', e);
    return res.status(500).json({ error: 'erro interno' });
  }
});

// --- Listar pautas ---
app.get('/motions', auth, async (_req, res) => {
  try {
    const motions = await prisma.motion.findMany({ orderBy: { id: 'desc' } });
    res.json(motions);
  } catch (e: any) {
    console.error('[motions] erro', e);
    res.status(500).json({ error: 'erro interno' });
  }
});

// --- Votar ---
app.post('/votes', auth, async (req: any, res) => {
  try {
    const { motionId, choice, deviceModel, ip, imei } = req.body || {};
    const uid = req.user.uid as number;

    if (!motionId || !choice) return res.status(400).json({ error: 'motionId e choice são obrigatórios' });

    // cria ou atualiza o voto do usuário nessa pauta
    const vote = await prisma.vote.upsert({
      where: {
        userId_motionId: {
          userId: uid,
          motionId: Number(motionId),
        },
      },
      create: {
        userId: uid,
        motionId: Number(motionId),
        choice,
        deviceModel: deviceModel || null,
        ip: ip || null,
        imei: imei || null,
      },
      update: {
        choice,
        deviceModel: deviceModel || null,
        ip: ip || null,
        imei: imei || null,
        timestamp: new Date(),
      },
    });

    res.json({ status: 'ok', voteId: vote.id });
  } catch (e: any) {
    console.error('[votes] erro', e);
    res.status(500).json({ error: 'erro interno' });
  }
});

app.listen(PORT, () => {
  console.log(`API up on :${PORT}`);
});
