import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, whiteboardSessions, studentSubmissions, InsertWhiteboardSession, InsertStudentSubmission, quizzes, quizQuestions, quizSubmissions, InsertQuiz, InsertQuizQuestion, InsertQuizSubmission, liveQuizSessions, InsertLiveQuizSession, padletBoards, padletCards, InsertPadletBoard, InsertPadletCard } from "../drizzle/schema";
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

export async function updateLiveCanvasData(submissionId: number, liveCanvasData: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(studentSubmissions).set({ liveCanvasData }).where(eq(studentSubmissions.id, submissionId));
}

export async function setLiveBroadcast(sessionId: number, submissionId: number | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(whiteboardSessions).set({ liveSubmissionId: submissionId }).where(eq(whiteboardSessions.id, sessionId));
}

export async function deleteSession(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(studentSubmissions).where(eq(studentSubmissions.sessionId, id));
  await db.delete(whiteboardSessions).where(eq(whiteboardSessions.id, id));
}

// ===== Quizzes =====

export async function createQuiz(data: InsertQuiz) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(quizzes).values(data);
  const result = await db.select().from(quizzes).where(eq(quizzes.shareCode, data.shareCode!)).limit(1);
  return result[0];
}

export async function getQuizByShareCode(shareCode: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(quizzes).where(eq(quizzes.shareCode, shareCode)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getQuizById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(quizzes).where(eq(quizzes.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getQuizzesByTeacher(teacherId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(quizzes).where(eq(quizzes.teacherId, teacherId)).orderBy(desc(quizzes.createdAt));
}

export async function updateQuizTitle(id: number, title: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(quizzes).set({ title }).where(eq(quizzes.id, id));
}

export async function publishQuiz(id: number, publish: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(quizzes).set({ isPublished: publish ? 1 : 0 }).where(eq(quizzes.id, id));
}

export async function deleteQuiz(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(quizSubmissions).where(eq(quizSubmissions.quizId, id));
  await db.delete(quizQuestions).where(eq(quizQuestions.quizId, id));
  await db.delete(quizzes).where(eq(quizzes.id, id));
}

// ===== Quiz Questions =====

export async function addQuizQuestion(data: InsertQuizQuestion) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(quizQuestions).values(data);
  const result = await db.select().from(quizQuestions)
    .where(eq(quizQuestions.quizId, data.quizId))
    .orderBy(desc(quizQuestions.createdAt))
    .limit(1);
  return result[0];
}

export async function getQuestionsByQuiz(quizId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(quizQuestions)
    .where(eq(quizQuestions.quizId, quizId))
    .orderBy(quizQuestions.questionOrder);
}

export async function updateQuizQuestion(id: number, data: Partial<InsertQuizQuestion>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(quizQuestions).set(data).where(eq(quizQuestions.id, id));
}

export async function deleteQuizQuestion(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(quizQuestions).where(eq(quizQuestions.id, id));
}

// ===== Quiz Submissions =====

export async function submitQuizAnswers(data: InsertQuizSubmission) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(quizSubmissions).values(data);
}

export async function getQuizSubmissions(quizId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(quizSubmissions)
    .where(eq(quizSubmissions.quizId, quizId))
    .orderBy(desc(quizSubmissions.submittedAt));
}

export async function deleteQuizSubmissions(quizId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(quizSubmissions).where(eq(quizSubmissions.quizId, quizId));
}

export async function deleteSubmission(submissionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(studentSubmissions).where(eq(studentSubmissions.id, submissionId));
}

export async function deleteAllSubmissionsInSession(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(studentSubmissions).where(eq(studentSubmissions.sessionId, sessionId));
}

export async function deleteAllSessionsByTeacher(teacherId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const sessions = await db.select({ id: whiteboardSessions.id }).from(whiteboardSessions).where(eq(whiteboardSessions.teacherId, teacherId));
  for (const s of sessions) {
    await db.delete(studentSubmissions).where(eq(studentSubmissions.sessionId, s.id));
  }
  await db.delete(whiteboardSessions).where(eq(whiteboardSessions.teacherId, teacherId));
}

export async function deleteAllQuizzesByTeacher(teacherId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const myQuizzes = await db.select({ id: quizzes.id }).from(quizzes).where(eq(quizzes.teacherId, teacherId));
  for (const q of myQuizzes) {
    await db.delete(quizSubmissions).where(eq(quizSubmissions.quizId, q.id));
    await db.delete(quizQuestions).where(eq(quizQuestions.quizId, q.id));
    await db.delete(liveQuizSessions).where(eq(liveQuizSessions.quizId, q.id));
  }
  await db.delete(quizzes).where(eq(quizzes.teacherId, teacherId));
}

// ===== Live Quiz Sessions =====

export async function createLiveSession(quizId: number): Promise<typeof liveQuizSessions.$inferSelect> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(liveQuizSessions).values({
    quizId,
    state: "waiting",
    currentQuestionIndex: 0,
    participants: "[]",
    currentAnswers: "[]",
  });
  const result = await db.select().from(liveQuizSessions)
    .where(eq(liveQuizSessions.quizId, quizId))
    .orderBy(desc(liveQuizSessions.createdAt))
    .limit(1);
  return result[0];
}

export async function getLiveSessionByQuiz(quizId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(liveQuizSessions)
    .where(eq(liveQuizSessions.quizId, quizId))
    .orderBy(desc(liveQuizSessions.createdAt))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getLiveSessionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(liveQuizSessions).where(eq(liveQuizSessions.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateLiveSession(id: number, data: Partial<InsertLiveQuizSession>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(liveQuizSessions).set(data).where(eq(liveQuizSessions.id, id));
}

export async function deleteLiveSession(quizId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(liveQuizSessions).where(eq(liveQuizSessions.quizId, quizId));
}

// ===================== البادلت =====================

export async function createPadletBoard(data: InsertPadletBoard) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(padletBoards).values(data);
  const id = (result[0] as { insertId: number }).insertId;
  const rows = await db.select().from(padletBoards).where(eq(padletBoards.id, id)).limit(1);
  return rows[0];
}

export async function getPadletBoardsByTeacher(teacherId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(padletBoards).where(eq(padletBoards.teacherId, teacherId));
}

export async function getPadletBoardById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(padletBoards).where(eq(padletBoards.id, id)).limit(1);
  return rows[0];
}

export async function getPadletBoardByCode(shareCode: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(padletBoards).where(eq(padletBoards.shareCode, shareCode)).limit(1);
  return rows[0];
}

export async function updatePadletBoard(id: number, data: Partial<InsertPadletBoard>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(padletBoards).set(data).where(eq(padletBoards.id, id));
}

export async function deletePadletBoard(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(padletCards).where(eq(padletCards.boardId, id));
  await db.delete(padletBoards).where(eq(padletBoards.id, id));
}

export async function deleteAllPadletBoardsByTeacher(teacherId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const boards = await db.select({ id: padletBoards.id }).from(padletBoards).where(eq(padletBoards.teacherId, teacherId));
  for (const b of boards) {
    await db.delete(padletCards).where(eq(padletCards.boardId, b.id));
  }
  await db.delete(padletBoards).where(eq(padletBoards.teacherId, teacherId));
}

export async function createPadletCard(data: InsertPadletCard) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(padletCards).values(data);
  const id = (result[0] as { insertId: number }).insertId;
  const rows = await db.select().from(padletCards).where(eq(padletCards.id, id)).limit(1);
  return rows[0];
}

export async function getPadletCardsByBoard(boardId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(padletCards).where(eq(padletCards.boardId, boardId));
}

export async function deletePadletCard(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(padletCards).where(eq(padletCards.id, id));
}

export async function updatePadletCard(id: number, data: Partial<InsertPadletCard>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(padletCards).set(data).where(eq(padletCards.id, id));
}

export async function likePadletCard(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.execute(`UPDATE padlet_cards SET likes = likes + 1 WHERE id = ${id}`);
}
