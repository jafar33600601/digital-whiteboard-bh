import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock db helpers
vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    getDb: vi.fn().mockResolvedValue(null),
  };
});

// Mock quiz db helpers
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  createSession: vi.fn(),
  getSessionsByTeacher: vi.fn().mockResolvedValue([]),
  getSessionById: vi.fn(),
  saveWhiteboardData: vi.fn(),
  getWhiteboardData: vi.fn(),
  createSubmission: vi.fn(),
  getSubmissionsBySession: vi.fn().mockResolvedValue([]),
  getSubmissionById: vi.fn(),
  saveCorrection: vi.fn(),
  deleteSessionAndSubmissions: vi.fn(),
  createQuiz: vi.fn(),
  getQuizById: vi.fn(),
  getQuizzesByTeacher: vi.fn().mockResolvedValue([]),
  getQuizByShareCode: vi.fn(),
  publishQuiz: vi.fn(),
  deleteQuiz: vi.fn(),
  addQuizQuestion: vi.fn(),
  updateQuizQuestion: vi.fn(),
  deleteQuizQuestion: vi.fn(),
  getQuestionsByQuiz: vi.fn().mockResolvedValue([]),
  submitQuizAnswers: vi.fn(),
  getQuizSubmissions: vi.fn().mockResolvedValue([]),
}));

import * as db from "./db";

function createTeacherContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "teacher-1",
      email: "teacher@example.com",
      name: "أستاذ أحمد",
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

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("quiz.createQuiz", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ينشئ اختباراً جديداً بنجاح", async () => {
    const mockQuiz = { id: 1, title: "اختبار الرياضيات", shareCode: "ABC123", teacherId: 1, isPublished: false, createdAt: new Date() };
    vi.mocked(db.createQuiz).mockResolvedValue(mockQuiz as any);

    const caller = appRouter.createCaller(createTeacherContext());
    const result = await caller.quiz.createQuiz({ title: "اختبار الرياضيات" });

    expect(result).toMatchObject({ id: 1, title: "اختبار الرياضيات", shareCode: "ABC123" });
    expect(db.createQuiz).toHaveBeenCalledWith(expect.objectContaining({ title: "اختبار الرياضيات", teacherId: 1 }));
  });

  it("يرفض الإنشاء بدون مصادقة", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.quiz.createQuiz({ title: "اختبار" })).rejects.toThrow();
  });
});

describe("quiz.getMyQuizzes", () => {
  it("يعيد قائمة اختبارات المعلم", async () => {
    const mockQuizzes = [
      { id: 1, title: "اختبار 1", shareCode: "A1", teacherId: 1, isPublished: true, createdAt: new Date() },
      { id: 2, title: "اختبار 2", shareCode: "B2", teacherId: 1, isPublished: false, createdAt: new Date() },
    ];
    vi.mocked(db.getQuizzesByTeacher).mockResolvedValue(mockQuizzes as any);

    const caller = appRouter.createCaller(createTeacherContext());
    const result = await caller.quiz.getMyQuizzes();

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ title: "اختبار 1" });
  });
});

describe("quiz.getQuizByCode", () => {
  it("يعيد الاختبار للطالب بدون الإجابات الصحيحة", async () => {
    const mockQuiz = { id: 1, title: "اختبار العلوم", shareCode: "SCI1", teacherId: 1, isPublished: true, createdAt: new Date() };
    const mockQuestions = [
      { id: 1, quizId: 1, questionText: "ما هو كوكب الأرض؟", imageUrl: null, options: JSON.stringify(["كوكب", "نجم", "قمر", "مجرة"]), correctAnswer: 0, questionOrder: 1 },
    ];
    vi.mocked(db.getQuizByShareCode).mockResolvedValue(mockQuiz as any);
    vi.mocked(db.getQuestionsByQuiz).mockResolvedValue(mockQuestions as any);

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.quiz.getQuizByCode({ shareCode: "SCI1" });

    expect(result.title).toBe("اختبار العلوم");
    expect(result.questions).toHaveLength(1);
    // التأكد من عدم إرسال الإجابة الصحيحة
    expect((result.questions[0] as any).correctAnswer).toBeUndefined();
  });

  it("يرفض الاختبار غير المنشور", async () => {
    const mockQuiz = { id: 1, title: "مسودة", shareCode: "DRAFT1", teacherId: 1, isPublished: false, createdAt: new Date() };
    vi.mocked(db.getQuizByShareCode).mockResolvedValue(mockQuiz as any);

    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.quiz.getQuizByCode({ shareCode: "DRAFT1" })).rejects.toThrow("الاختبار ليس متاحاً بعد");
  });

  it("يرفض الرمز غير الموجود", async () => {
    vi.mocked(db.getQuizByShareCode).mockResolvedValue(undefined as any);

    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.quiz.getQuizByCode({ shareCode: "NOTFOUND" })).rejects.toThrow("رمز الاختبار غير صحيح");
  });
});

describe("quiz.submitAnswers", () => {
  it("يحتسب الدرجة بشكل صحيح", async () => {
    const mockQuestions = [
      { id: 1, quizId: 1, questionText: "س1", imageUrl: null, options: JSON.stringify(["أ", "ب", "ج"]), correctAnswer: 0, questionOrder: 1 },
      { id: 2, quizId: 1, questionText: "س2", imageUrl: null, options: JSON.stringify(["أ", "ب", "ج"]), correctAnswer: 2, questionOrder: 2 },
    ];
    vi.mocked(db.getQuestionsByQuiz).mockResolvedValue(mockQuestions as any);
    vi.mocked(db.submitQuizAnswers).mockResolvedValue(undefined as any);

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.quiz.submitAnswers({
      quizId: 1,
      studentName: "طالب تجريبي",
      answers: [0, 1], // الأولى صحيحة، الثانية خاطئة
    });

    expect(result.score).toBe(1);
    expect(result.totalQuestions).toBe(2);
    expect(result.percentage).toBe(50);
  });
});

describe("quiz.deleteQuiz", () => {
  it("يحذف الاختبار بنجاح", async () => {
    const mockQuiz = { id: 5, title: "اختبار للحذف", shareCode: "DEL1", teacherId: 1, isPublished: false, createdAt: new Date() };
    vi.mocked(db.getQuizById).mockResolvedValue(mockQuiz as any);
    vi.mocked(db.deleteQuiz).mockResolvedValue(undefined as any);

    const caller = appRouter.createCaller(createTeacherContext());
    const result = await caller.quiz.deleteQuiz({ quizId: 5 });

    expect(result).toMatchObject({ success: true });
    expect(db.deleteQuiz).toHaveBeenCalledWith(5);
  });

  it("يرفض حذف اختبار معلم آخر", async () => {
    const mockQuiz = { id: 5, title: "اختبار معلم آخر", shareCode: "OTH1", teacherId: 99, isPublished: false, createdAt: new Date() };
    vi.mocked(db.getQuizById).mockResolvedValue(mockQuiz as any);

    const caller = appRouter.createCaller(createTeacherContext());
    await expect(caller.quiz.deleteQuiz({ quizId: 5 })).rejects.toThrow();
  });
});
