import { defineConfig } from "drizzle-kit";
import {config} from "./src/config.js";

export default defineConfig({
    schema: './src/db/shcema/index.ts',
    out: './src/db/migrations',
    dialect: 'postgresql',
    dbCredentials:{
        url: config.db.dbURL,
    }
})


