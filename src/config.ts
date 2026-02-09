import 'dotenv/config';
import type { MigrationConfig } from "drizzle-orm/migrator";

type APIConfig = {
  platform: string,
  polkaKey: string, /*for future webhoook*/
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
    platform: getRequiredEnv('PLATFORM'),
    polkaKey: getRequiredEnv('POLKA_KEY'),
}

function getRequiredEnv(key: string): string {
  const val = process.env[key];
  if (typeof val === 'undefined' || val === '') {
    throw new Error(`Environment variable ${key} is required`);
  }
  return val;
}


export const config: Config = {
  api: configApi,
  db: {
    dbURL: getRequiredEnv('DB_URL'),
    migrationConfig: migrationConfig,
  },
  secret: getRequiredEnv("secret"),
};


