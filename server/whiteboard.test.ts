import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock db module
vi.mock("./db", () => ({
  createWhiteboardSession: vi.fn().mockResolvedValue({
    id: 1,
    shareCode: "testcode123",
    teacherId: 1,
    title: "سبورة اختبار",
    canvasData: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  getSessionByShareCode: vi.fn().mockResolvedValue({
    id: 1,
    shareCode: "testcode123",
    teacherId: 1,
    title: "سبورة اختبار",
    canvasData: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  getSessionById: vi.fn().mockResolvedValue({
    id: 1,
    shareCode: "testcode123",
    teacherId: 1,
    title: "سبورة اختبار",
    canvasData: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  getSessionsByTeacher: vi.fn().mockResolvedValue([]),
  updateSessionCanvas: vi.fn().mockResolvedValue(undefined),
  updateSessionTitle: vi.fn().mockResolvedValue(undefined),
  createStudentSubmission: vi.fn().mockResolvedValue({
    id: 10,
    sessionId: 1,
    studentName: "أحمد محمد",
    canvasData: null,
    correctionData: null,
    status: "pending",
    submittedAt: null,
    correctedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  getSubmissionsBySession: vi.fn().mockResolvedValue([]),
  getSubmissionById: vi.fn().mockResolvedValue({
    id: 10,
    sessionId: 1,
    studentName: "أحمد محمد",
    canvasData: '{"elements":[],"width":1200,"height":700}',
    correctionData: null,
    status: "submitted",
    submittedAt: new Date(),
    correctedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  updateSubmissionCanvas: vi.fn().mockResolvedValue(undefined),
  updateSubmissionCorrection: vi.fn().mockResolvedValue(undefined),
}));

function createTeacherCtx(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "teacher-open-id",
      email: "teacher@test.com",
      name: "المعلم أحمد",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createPublicCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("whiteboard.createSession", () => {
  it("ينشئ جلسة جديدة للمعلم المسجل", async () => {
    const ctx = createTeacherCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.whiteboard.createSession({ title: "سبورة اختبار" });
    expect(result).toBeDefined();
    expect(result?.title).toBe("سبورة اختبار");
    expect(result?.teacherId).toBe(1);
  });
});

describe("whiteboard.getSessionByCode", () => {
  it("يُرجع بيانات الجلسة بكود المشاركة", async () => {
    const ctx = createPublicCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.whiteboard.getSessionByCode({ shareCode: "testcode123" });
    expect(result).toBeDefined();
    expect(result.shareCode).toBe("testcode123");
    expect(result.title).toBe("سبورة اختبار");
  });
});

describe("student.joinSession", () => {
  it("يسمح للطالب بالانضمام بكود صحيح", async () => {
    const ctx = createPublicCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.student.joinSession({
      shareCode: "testcode123",
      studentName: "أحمد محمد",
    });
    expect(result.submissionId).toBe(10);
    expect(result.sessionId).toBe(1);
    expect(result.sessionTitle).toBe("سبورة اختبار");
  });
});

describe("student.submitAnswer", () => {
  it("يحفظ إجابة الطالب بنجاح", async () => {
    const ctx = createPublicCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.student.submitAnswer({
      submissionId: 10,
      canvasData: '{"elements":[],"width":1200,"height":700}',
    });
    expect(result.success).toBe(true);
  });
});

describe("whiteboard.correctSubmission", () => {
  it("يحفظ تصحيح المعلم بنجاح", async () => {
    const ctx = createTeacherCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.whiteboard.correctSubmission({
      submissionId: 10,
      correctionData: '{"elements":[{"type":"text","x":100,"y":100,"text":"ممتاز!","color":"#16a34a","fontSize":24}],"width":1200,"height":700}',
    });
    expect(result.success).toBe(true);
  });
});
