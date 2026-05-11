import { execSync } from 'node:child_process';

const app = process.env.APP_NAME ?? 'renewals';
const schema = app === 'pbis'
  ? 'prisma/pbis/schema.prisma'
  : 'prisma/schema.prisma';

console.log(`[prisma] app=${app} schema=${schema}`);
execSync(`npx prisma generate --schema=${schema}`, { stdio: 'inherit' });
execSync(`npx prisma migrate deploy --schema=${schema}`, { stdio: 'inherit' });