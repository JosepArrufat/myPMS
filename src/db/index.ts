import {drizzle} from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema/index.js";
import {config} from "../config.js";

const conn = postgres(config.db.dbURL);
export const db = drizzle(conn, { schema });