import { createPoolFromEnv } from "cgress";

const db = createPoolFromEnv();
export default db;
