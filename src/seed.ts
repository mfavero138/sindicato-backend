import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "admin@sindicato.org";
  const exists = await prisma.user.findUnique({ where: { email } as any });
  if (!exists) {
    const passwordHash = await bcrypt.hash("123456", 10);
    await prisma.user.create({
      data: { name: "Administrador", email, password: passwordHash, role: "ADMIN" } as any
    });
    console.log("Admin seed criado:", email);
  } else {
    console.log("Admin já existe:", email);
  }
}

main().finally(async () => prisma.$disconnect());
