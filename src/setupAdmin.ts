// src/setupAdmin.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    console.log("[setupAdmin] SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD não definidos — pulando seed.");
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    console.log(`[setupAdmin] Usuário admin já existe: ${email}`);
  } else {
    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hash,
        name: "Administrador",
        role: "ADMIN",
      },
    });
    console.log(`[setupAdmin] Admin criado: ${user.email}`);
  }

  // Semear algumas pautas (motions) de teste se estiver vazio
  const motionsCount = await prisma.motion.count();
  if (motionsCount === 0) {
    await prisma.motion.createMany({
      data: [
        { title: "Aprovar ata da última assembleia", description: "Leitura e aprovação da ata anterior." },
        { title: "Definição do reajuste 2025", description: "Proposta da diretoria para reajuste anual." },
        { title: "Aquisição de equipamentos", description: "Votação para compra de novos equipamentos de TI." }
      ],
    });
    console.log("[setupAdmin] Pautas de teste criadas.");
  } else {
    console.log("[setupAdmin] Pautas já existentes — semear ignorado.");
  }
}

main()
  .catch((e) => {
    console.error("[setupAdmin] Erro:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
