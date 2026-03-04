import 'dotenv/config';
import { z } from 'zod';
import type { MigrationConfig } from "drizzle-orm/migrator";

const envSchema = z.object({
  PLATFORM: z.string().min(1),
  POLKA_KEY: z.string().min(1),
  DB_URL: z.string().url(),
  secret: z.string().min(8),
  PORT: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  process.exit(1);
}
const env = parsed.data;

type APIConfig = {
  platform: string,
  polkaKey: string,
};

type DBConfig = {
  dbURL: string;
  migrationConfig: MigrationConfig;
};

type Config = {
  api: APIConfig;
  db: DBConfig;
  secret: string;
};

const migrationConfig: MigrationConfig = {
  migrationsFolder: "./src/db/migrations",
};

export const configApi: APIConfig = {
  platform: env.PLATFORM,
  polkaKey: env.POLKA_KEY,
};

export const config: Config = {
  api: configApi,
  db: {
    dbURL: env.DB_URL,
    migrationConfig: migrationConfig,
  },
  secret: env.secret,
};