import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, longtext } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// جدول جلسات السبورة (يُنشئها المعلم)
export const whiteboardSessions = mysqlTable("whiteboard_sessions", {
  id: int("id").autoincrement().primaryKey(),
  shareCode: varchar("shareCode", { length: 32 }).notNull().unique(),
  teacherId: int("teacherId").notNull(),
  title: varchar("title", { length: 255 }).notNull().default("سبورة جديدة"),
  // بيانات السبورة كـ JSON (مسارات الرسم + النصوص)
  canvasData: longtext("canvasData"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WhiteboardSession = typeof whiteboardSessions.$inferSelect;
export type InsertWhiteboardSession = typeof whiteboardSessions.$inferInsert;

// جدول إجابات الطلاب
export const studentSubmissions = mysqlTable("student_submissions", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  studentName: varchar("studentName", { length: 255 }).notNull(),
  // بيانات سبورة الطالب كـ JSON
  canvasData: longtext("canvasData"),
  // بيانات تصحيح المعلم كـ JSON
  correctionData: longtext("correctionData"),
  status: mysqlEnum("status", ["pending", "submitted", "corrected"]).default("pending").notNull(),
  submittedAt: timestamp("submittedAt"),
  correctedAt: timestamp("correctedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StudentSubmission = typeof studentSubmissions.$inferSelect;
export type InsertStudentSubmission = typeof studentSubmissions.$inferInsert;
