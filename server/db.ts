import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, whiteboardSessions, studentSubmissions, InsertWhiteboardSession, InsertStudentSubmission } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ===== Whiteboard Sessions =====

export async function createWhiteboardSession(data: InsertWhiteboardSession) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(whiteboardSessions).values(data);
  const result = await db.select().from(whiteboardSessions).where(eq(whiteboardSessions.shareCode, data.shareCode!)).limit(1);
  return result[0];
}

export async function getSessionByShareCode(shareCode: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(whiteboardSessions).where(eq(whiteboardSessions.shareCode, shareCode)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getSessionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(whiteboardSessions).where(eq(whiteboardSessions.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getSessionsByTeacher(teacherId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(whiteboardSessions).where(eq(whiteboardSessions.teacherId, teacherId)).orderBy(desc(whiteboardSessions.createdAt));
}

export async function updateSessionCanvas(id: number, canvasData: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(whiteboardSessions).set({ canvasData }).where(eq(whiteboardSessions.id, id));
}

export async function updateSessionTitle(id: number, title: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(whiteboardSessions).set({ title }).where(eq(whiteboardSessions.id, id));
}

// ===== Student Submissions =====

export async function createStudentSubmission(data: InsertStudentSubmission) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(studentSubmissions).values(data);
  const result = await db.select().from(studentSubmissions)
    .where(eq(studentSubmissions.sessionId, data.sessionId))
    .orderBy(desc(studentSubmissions.createdAt))
    .limit(1);
  return result[0];
}

export async function getSubmissionsBySession(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(studentSubmissions)
    .where(eq(studentSubmissions.sessionId, sessionId))
    .orderBy(desc(studentSubmissions.createdAt));
}

export async function getSubmissionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(studentSubmissions).where(eq(studentSubmissions.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateSubmissionCanvas(id: number, canvasData: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(studentSubmissions).set({
    canvasData,
    status: "submitted",
    submittedAt: new Date(),
  }).where(eq(studentSubmissions.id, id));
}

export async function updateSubmissionCorrection(id: number, correctionData: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(studentSubmissions).set({
    correctionData,
    status: "corrected",
    correctedAt: new Date(),
  }).where(eq(studentSubmissions.id, id));
}

export async function deleteSession(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // حذف جميع إجابات الطلاب أولاً
  await db.delete(studentSubmissions).where(eq(studentSubmissions.sessionId, id));
  // ثم حذف الجلسة
  await db.delete(whiteboardSessions).where(eq(whiteboardSessions.id, id));
}
