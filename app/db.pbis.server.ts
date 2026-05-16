import { PrismaClient } from ".prisma/pbis-client";

declare global {
  // eslint-disable-next-line no-var
  var pbisPrismaGlobal: PrismaClient;
}

if (process.env.NODE_ENV !== "production") {
  if (!global.pbisPrismaGlobal) {
    global.pbisPrismaGlobal = new PrismaClient();
  }
}

const pbisDb = global.pbisPrismaGlobal ?? new PrismaClient();

export default pbisDb;