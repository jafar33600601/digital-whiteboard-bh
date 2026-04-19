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
} from "./db";

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
