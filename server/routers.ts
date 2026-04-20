import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import {
  createWhiteboardSession,
  getSessionByShareCode,
  getSessionById,
  getSessionsByTeacher,
  updateSessionCanvas,
  updateSessionTitle,
  createStudentSubmission,
  getSubmissionsBySession,
  getSubmissionById,
  updateSubmissionCanvas,
  updateSubmissionCorrection,
  deleteSession,
  createQuiz,
  getQuizByShareCode,
  getQuizById,
  getQuizzesByTeacher,
  updateQuizTitle,
  publishQuiz,
  deleteQuiz,
  addQuizQuestion,
  getQuestionsByQuiz,
  updateQuizQuestion,
  deleteQuizQuestion,
  submitQuizAnswers,
  getQuizSubmissions,
} from "./db";
import { storagePut } from "./storage";

// ===== Quiz Router =====
const quizRouter = router({
  // إنشاء اختبار جديد
  createQuiz: protectedProcedure
    .input(z.object({ title: z.string().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => {
      const shareCode = nanoid(10);
      const quiz = await createQuiz({
        shareCode,
        teacherId: ctx.user.id,
        title: input.title,
        isPublished: 0,
      });
      return quiz;
    }),

  // الحصول على اختبارات المعلم
  getMyQuizzes: protectedProcedure.query(async ({ ctx }) => {
    return await getQuizzesByTeacher(ctx.user.id);
  }),

  // الحصول على اختبار بالـ ID (للمعلم)
  getQuizById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const quiz = await getQuizById(input.id);
      if (!quiz) throw new TRPCError({ code: "NOT_FOUND" });
      if (quiz.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      const questions = await getQuestionsByQuiz(input.id);
      return { ...quiz, questions };
    }),

  // تحديث عنوان الاختبار
  updateTitle: protectedProcedure
    .input(z.object({ quizId: z.number(), title: z.string().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => {
      const quiz = await getQuizById(input.quizId);
      if (!quiz) throw new TRPCError({ code: "NOT_FOUND" });
      if (quiz.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      await updateQuizTitle(input.quizId, input.title);
      return { success: true };
    }),

  // نشر الاختبار أو إلغاء نشره
  publish: protectedProcedure
    .input(z.object({ quizId: z.number(), publish: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const quiz = await getQuizById(input.quizId);
      if (!quiz) throw new TRPCError({ code: "NOT_FOUND" });
      if (quiz.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      await publishQuiz(input.quizId, input.publish);
      return { success: true };
    }),

  // حذف الاختبار
  deleteQuiz: protectedProcedure
    .input(z.object({ quizId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const quiz = await getQuizById(input.quizId);
      if (!quiz) throw new TRPCError({ code: "NOT_FOUND" });
      if (quiz.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      await deleteQuiz(input.quizId);
      return { success: true };
    }),

  // إضافة سؤال
  addQuestion: protectedProcedure
    .input(z.object({
      quizId: z.number(),
      questionText: z.string().min(1),
      options: z.array(z.string().min(1)).min(2).max(6),
      correctAnswer: z.number().min(0).max(5),
      imageUrl: z.string().nullable().optional(),
      imageKey: z.string().nullable().optional(),
      questionOrder: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const quiz = await getQuizById(input.quizId);
      if (!quiz) throw new TRPCError({ code: "NOT_FOUND" });
      if (quiz.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      const q = await addQuizQuestion({
        quizId: input.quizId,
        questionText: input.questionText,
        options: JSON.stringify(input.options),
        correctAnswer: input.correctAnswer,
        imageUrl: input.imageUrl ?? null,
        imageKey: input.imageKey ?? null,
        questionOrder: input.questionOrder ?? 0,
      });
      return q;
    }),

  // تحديث سؤال
  updateQuestion: protectedProcedure
    .input(z.object({
      questionId: z.number(),
      questionText: z.string().min(1).optional(),
      options: z.array(z.string().min(1)).min(2).max(6).optional(),
      correctAnswer: z.number().min(0).max(5).optional(),
      imageUrl: z.string().nullable().optional(),
      imageKey: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { questionId, options, ...rest } = input;
      const updateData: Record<string, unknown> = { ...rest };
      if (options) updateData.options = JSON.stringify(options);
      await updateQuizQuestion(questionId, updateData as Parameters<typeof updateQuizQuestion>[1]);
      return { success: true };
    }),

  // حذف سؤال
  deleteQuestion: protectedProcedure
    .input(z.object({ questionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteQuizQuestion(input.questionId);
      return { success: true };
    }),

  // رفع صورة سؤال (base64 إلى S3)
  uploadQuestionImage: protectedProcedure
    .input(z.object({
      quizId: z.number(),
      imageBase64: z.string(),
      mimeType: z.string().default("image/jpeg"),
    }))
    .mutation(async ({ ctx, input }) => {
      const quiz = await getQuizById(input.quizId);
      if (!quiz) throw new TRPCError({ code: "NOT_FOUND" });
      if (quiz.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      const base64Data = input.imageBase64.replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const ext = input.mimeType.split("/")[1] || "jpg";
      const key = `quiz-images/${ctx.user.id}/${nanoid(12)}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      return { url, key };
    }),

  // الحصول على الاختبار برمز المشاركة (للطالب)
  getQuizByCode: publicProcedure
    .input(z.object({ shareCode: z.string() }))
    .query(async ({ input }) => {
      const quiz = await getQuizByShareCode(input.shareCode);
      if (!quiz) throw new TRPCError({ code: "NOT_FOUND", message: "رمز الاختبار غير صحيح" });
      if (!quiz.isPublished) throw new TRPCError({ code: "FORBIDDEN", message: "الاختبار ليس متاحاً بعد" });
      const questions = await getQuestionsByQuiz(quiz.id);
      // لا نرسل الإجابة الصحيحة للطالب
      return {
        id: quiz.id,
        title: quiz.title,
        questions: questions.map(q => ({
          id: q.id,
          questionText: q.questionText,
          imageUrl: q.imageUrl,
          options: JSON.parse(q.options) as string[],
          questionOrder: q.questionOrder,
        })),
      };
    }),

  // تسليم إجابات الطالب
  submitAnswers: publicProcedure
    .input(z.object({
      quizId: z.number(),
      studentName: z.string().min(1).max(255),
      answers: z.array(z.number()),
    }))
    .mutation(async ({ input }) => {
      const questions = await getQuestionsByQuiz(input.quizId);
      if (questions.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
      // احتساب الدرجة
      let score = 0;
      questions.forEach((q, i) => {
        if (input.answers[i] === q.correctAnswer) score++;
      });
      await submitQuizAnswers({
        quizId: input.quizId,
        studentName: input.studentName,
        answers: JSON.stringify(input.answers),
        score,
        totalQuestions: questions.length,
      });
      return { score, totalQuestions: questions.length, percentage: Math.round((score / questions.length) * 100) };
    }),

  // الحصول على نتائج الاختبار (للمعلم - فورية)
  getResults: protectedProcedure
    .input(z.object({ quizId: z.number() }))
    .query(async ({ ctx, input }) => {
      const quiz = await getQuizById(input.quizId);
      if (!quiz) throw new TRPCError({ code: "NOT_FOUND" });
      if (quiz.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      const submissions = await getQuizSubmissions(input.quizId);
      return submissions.map(s => ({
        id: s.id,
        studentName: s.studentName,
        score: s.score,
        totalQuestions: s.totalQuestions,
        percentage: s.totalQuestions > 0 ? Math.round((s.score / s.totalQuestions) * 100) : 0,
        submittedAt: s.submittedAt,
      }));
    }),
});


export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ===== Whiteboard Sessions =====
  whiteboard: router({
    // إنشاء جلسة جديدة (للمعلم المسجل)
    createSession: protectedProcedure
      .input(z.object({ title: z.string().min(1).max(255).default("سبورة جديدة") }))
      .mutation(async ({ ctx, input }) => {
        const shareCode = nanoid(10);
        const session = await createWhiteboardSession({
          shareCode,
          teacherId: ctx.user.id,
          title: input.title,
          canvasData: null,
        });
        return session;
      }),

    // الحصول على جلسات المعلم
    getMySessions: protectedProcedure.query(async ({ ctx }) => {
      return await getSessionsByTeacher(ctx.user.id);
    }),

    // الحصول على جلسة بالـ ID (للمعلم)
    getSessionById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const session = await getSessionById(input.id);
        if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "الجلسة غير موجودة" });
        if (session.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        return session;
      }),

    // الحصول على جلسة بكود المشاركة (عام - للطلاب)
    getSessionByCode: publicProcedure
      .input(z.object({ shareCode: z.string() }))
      .query(async ({ input }) => {
        const session = await getSessionByShareCode(input.shareCode);
        if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "رمز الجلسة غير صحيح" });
        return {
          id: session.id,
          title: session.title,
          canvasData: session.canvasData,
          shareCode: session.shareCode,
        };
      }),

    // حفظ بيانات سبورة المعلم
    saveCanvas: protectedProcedure
      .input(z.object({ sessionId: z.number(), canvasData: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const session = await getSessionById(input.sessionId);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });
        if (session.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        await updateSessionCanvas(input.sessionId, input.canvasData);
        return { success: true };
      }),

    // حذف الجلسة وجميع إجابات طلابها
    deleteSession: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const session = await getSessionById(input.sessionId);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });
        if (session.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        await deleteSession(input.sessionId);
        return { success: true };
      }),

    // تحديث عنوان الجلسة
    updateTitle: protectedProcedure
      .input(z.object({ sessionId: z.number(), title: z.string().min(1).max(255) }))
      .mutation(async ({ ctx, input }) => {
        const session = await getSessionById(input.sessionId);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });
        if (session.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        await updateSessionTitle(input.sessionId, input.title);
        return { success: true };
      }),

    // الحصول على إجابات الطلاب لجلسة معينة (للمعلم)
    getSubmissions: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ ctx, input }) => {
        const session = await getSessionById(input.sessionId);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });
        if (session.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        return await getSubmissionsBySession(input.sessionId);
      }),

    // الحصول على إجابة طالب معين (للمعلم)
    getSubmissionById: protectedProcedure
      .input(z.object({ submissionId: z.number() }))
      .query(async ({ ctx, input }) => {
        const submission = await getSubmissionById(input.submissionId);
        if (!submission) throw new TRPCError({ code: "NOT_FOUND" });
        const session = await getSessionById(submission.sessionId);
        if (!session || session.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        return submission;
      }),

    // تصحيح إجابة الطالب (للمعلم)
    correctSubmission: protectedProcedure
      .input(z.object({ submissionId: z.number(), correctionData: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const submission = await getSubmissionById(input.submissionId);
        if (!submission) throw new TRPCError({ code: "NOT_FOUND" });
        const session = await getSessionById(submission.sessionId);
        if (!session || session.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        await updateSubmissionCorrection(input.submissionId, input.correctionData);
        return { success: true };
      }),
  }),

  // ===== Quiz Endpoints =====
  quiz: quizRouter,

  // ===== Student Endpoints (عامة) =====
  student: router({
    // إنشاء إجابة طالب جديدة - يُرجع أيضاً بيانات سبورة المعلم كنقطة بداية
    joinSession: publicProcedure
      .input(z.object({ shareCode: z.string(), studentName: z.string().min(1).max(255) }))
      .mutation(async ({ input }) => {
        const session = await getSessionByShareCode(input.shareCode);
        if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "رمز الجلسة غير صحيح" });
        // نبدأ سبورة الطالب بنفس محتوى سبورة المعلم
        const submission = await createStudentSubmission({
          sessionId: session.id,
          studentName: input.studentName,
          canvasData: session.canvasData, // ← نسخ محتوى المعلم
          correctionData: null,
          status: "pending",
        });
        return {
          submissionId: submission!.id,
          sessionId: session.id,
          sessionTitle: session.title,
          teacherCanvasData: session.canvasData, // ← إرسال المحتوى للواجهة
        };
      }),

    // حفظ إجابة الطالب
    submitAnswer: publicProcedure
      .input(z.object({ submissionId: z.number(), canvasData: z.string() }))
      .mutation(async ({ input }) => {
        const submission = await getSubmissionById(input.submissionId);
        if (!submission) throw new TRPCError({ code: "NOT_FOUND" });
        await updateSubmissionCanvas(input.submissionId, input.canvasData);
        return { success: true };
      }),

    // الحصول على إجابة الطالب مع التصحيح
    getMySubmission: publicProcedure
      .input(z.object({ submissionId: z.number() }))
      .query(async ({ input }) => {
        const submission = await getSubmissionById(input.submissionId);
        if (!submission) throw new TRPCError({ code: "NOT_FOUND" });
        return submission;
      }),

    // الحصول على سبورة المعلم للجلسة
    getTeacherCanvas: publicProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => {
        const session = await getSessionById(input.sessionId);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });
        return { canvasData: session.canvasData, title: session.title };
      }),
  }),
});

export type AppRouter = typeof appRouter;
