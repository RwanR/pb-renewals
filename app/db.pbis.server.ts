import { PrismaClient } from "@prisma-pbis/client";

declare global {
  // eslint-disable-next-line no-var
  var pbisPrismaGlobal: PrismaClient | undefined;
}

const pbisDb = global.pbisPrismaGlobal ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.pbisPrismaGlobal = pbisDb;
}

export default pbisDb;