import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

// تشغيل SQL مباشرة لإضافة الأعمدة المفقودة في Railway
async function ensureDbSchema() {
  if (!process.env.DATABASE_URL) {
    console.log("[Schema] No DATABASE_URL, skipping schema check");
    return;
  }
  try {
    const mysql2 = await import("mysql2/promise");
    const conn = await mysql2.createConnection(process.env.DATABASE_URL);

    // قائمة SQL statements لإضافة الأعمدة المفقودة بأمان (IF NOT EXISTS بديل)
    const alterStatements = [
      // live_quiz_sessions - إضافة isLocked إذا لم يكن موجوداً
      `ALTER TABLE live_quiz_sessions ADD COLUMN IF NOT EXISTS \`isLocked\` int NOT NULL DEFAULT 0`,
      // live_quiz_sessions - إضافة kickedParticipants إذا لم يكن موجوداً
      `ALTER TABLE live_quiz_sessions ADD COLUMN IF NOT EXISTS \`kickedParticipants\` longtext NOT NULL DEFAULT '[]'`,
      // quizizz_sessions - إضافة isLocked إذا لم يكن موجوداً
      `ALTER TABLE quizizz_sessions ADD COLUMN IF NOT EXISTS \`isLocked\` int NOT NULL DEFAULT 0`,
      // quizizz_banned - إنشاء الجدول إذا لم يكن موجوداً
      `CREATE TABLE IF NOT EXISTS \`quizizz_banned\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`sessionId\` int NOT NULL,
        \`studentName\` varchar(100) NOT NULL,
        \`createdAt\` timestamp NOT NULL DEFAULT (now()),
        CONSTRAINT \`quizizz_banned_id\` PRIMARY KEY(\`id\`)
      )`,
      // classrooms - إنشاء الجدول إذا لم يكن موجوداً
      `CREATE TABLE IF NOT EXISTS \`classrooms\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`userId\` int NOT NULL,
        \`name\` varchar(255) NOT NULL,
        \`createdAt\` timestamp NOT NULL DEFAULT (now()),
        \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`classrooms_id\` PRIMARY KEY(\`id\`)
      )`,
      // classroom_students - إنشاء الجدول إذا لم يكن موجوداً
      `CREATE TABLE IF NOT EXISTS \`classroom_students\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`classroomId\` int NOT NULL,
        \`name\` varchar(255) NOT NULL,
        \`createdAt\` timestamp NOT NULL DEFAULT (now()),
        CONSTRAINT \`classroom_students_id\` PRIMARY KEY(\`id\`)
      )`,
      // wheel_questions - إنشاء الجدول إذا لم يكن موجوداً
      `CREATE TABLE IF NOT EXISTS \`wheel_questions\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`userId\` int NOT NULL,
        \`question\` varchar(500) NOT NULL,
        \`options\` longtext NOT NULL,
        \`correctAnswer\` int,
        \`createdAt\` timestamp NOT NULL DEFAULT (now()),
        \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`wheel_questions_id\` PRIMARY KEY(\`id\`)
      )`,
      // local_users - إنشاء الجدول إذا لم يكن موجوداً
      `CREATE TABLE IF NOT EXISTS \`local_users\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`name\` varchar(255) NOT NULL,
        \`email\` varchar(255) NOT NULL,
        \`password_hash\` varchar(255) NOT NULL,
        \`role\` enum('admin','user') NOT NULL DEFAULT 'user',
        \`createdAt\` timestamp NOT NULL DEFAULT (now()),
        CONSTRAINT \`local_users_id\` PRIMARY KEY(\`id\`),
        CONSTRAINT \`local_users_email_unique\` UNIQUE(\`email\`)
      )`,
      `ALTER TABLE \`local_users\` ADD COLUMN \`isVerified\` int NOT NULL DEFAULT 0`,
      `ALTER TABLE \`local_users\` ADD COLUMN \`isActive\` int NOT NULL DEFAULT 1`,
      `ALTER TABLE \`local_users\` ADD COLUMN \`lastActiveAt\` timestamp`,
    ];

    for (const sql of alterStatements) {
      try {
        await conn.execute(sql);
        console.log("[Schema] ✅ OK:", sql.substring(0, 60) + "...");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        // تجاهل خطأ "Duplicate column name" - يعني العمود موجود بالفعل
        if (msg.includes("Duplicate column") || msg.includes("already exists")) {
          console.log("[Schema] ℹ️ Already exists (OK):", sql.substring(0, 60) + "...");
        } else {
          console.warn("[Schema] ⚠️ Warning:", msg);
        }
      }
    }

    await conn.end();
    console.log("[Schema] ✅ Schema check completed");
  } catch (error) {
    console.error("[Schema] ❌ Schema check failed:", error);
    // لا نوقف التطبيق إذا فشل - نكمل بدونه
  }
}

async function startServer() {
  // التأكد من schema قاعدة البيانات أولاً
  await ensureDbSchema();

  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
