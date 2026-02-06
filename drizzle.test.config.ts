import { defineConfig } from "drizzle-kit";

export default defineConfig({
    schema: './src/db/schema/index.ts',
    out: './src/db/migrations',
    dialect: 'postgresql',
    dbCredentials:{
        url: process.env.TEST_DATABASE_URL || 'postgresql://hotel_user:hotel_pass@localhost:5433/hotel_pms_test?sslmode=disable',
    }
})
