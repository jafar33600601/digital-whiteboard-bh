import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);
await conn.execute(`
  CREATE TABLE IF NOT EXISTS \`quizizz_banned\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`sessionId\` int NOT NULL,
    \`studentName\` varchar(100) NOT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`quizizz_banned_id\` PRIMARY KEY(\`id\`)
  )
`);
console.log("✅ quizizz_banned table created successfully");
await conn.end();
