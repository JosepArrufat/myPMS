const migrationConfig = {
    migrationsFolder: "./src/db/migrations",
};
export const configApi = {
    platform: getRequiredEnv('PLATFORM'),
    polkaKey: getRequiredEnv('POLKA_KEY'),
};
function getRequiredEnv(key) {
    const val = process.env[key];
    if (typeof val === 'undefined' || val === '') {
        throw new Error(`Environment variable ${key} is required`);
    }
    return val;
}
export const config = {
    api: configApi,
    db: {
        dbURL: getRequiredEnv('DB_URL'),
        migrationConfig: migrationConfig,
    },
    secret: getRequiredEnv("secret"),
};
