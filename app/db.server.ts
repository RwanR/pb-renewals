import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient;
  // eslint-disable-next-line no-var
  var prismaShutdownRegistered: boolean | undefined;
}

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient();
  }
}

const prisma = global.prismaGlobal ?? new PrismaClient();

// Teardown gracieux : libère les connexions Postgres à l'arrêt (SIGTERM Railway,
// SIGINT en local). Enregistré une seule fois — garde contre le hot-reload en dev.
if (!global.prismaShutdownRegistered) {
  global.prismaShutdownRegistered = true;

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[DB] ${signal} reçu - déconnexion Prisma`);
    // Filet de sécurité : si $disconnect traîne (DB injoignable), on sort quand même.
    const force = setTimeout(() => process.exit(0), 5000);
    force.unref();
    try {
      await prisma.$disconnect();
    } catch (err) {
      console.error("[DB] Erreur lors de la déconnexion Prisma:", err);
    } finally {
      clearTimeout(force);
      process.exit(0);
    }
  };

  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.once(signal, () => shutdown(signal));
  }
}

export default prisma;