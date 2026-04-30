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
  deleteAllSessionsByTeacher,
  setLiveBroadcast,
  updateLiveCanvasData,
  deleteSubmission,
  deleteAllSubmissionsInSession,
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
  deleteQuizSubmissions,
  createLiveSession,
  getLiveSessionByQuiz,
  getLiveSessionById,
  updateLiveSession,
  deleteLiveSession,
  deleteAllQuizzesByTeacher,
  createPadletBoard,
  getPadletBoardsByTeacher,
  getPadletBoardById,
  getPadletBoardByCode,
  updatePadletBoard,
  deletePadletBoard,
  deleteAllPadletBoardsByTeacher,
  createPadletCard,
  getPadletCardsByBoard,
  deletePadletCard,
  updatePadletCard,
  likePadletCard,
  banIp,
  isIpBanned,
  deleteQuizSubmission,
  createQuizizzSession,
  getQuizizzSessionByCode,
  getQuizizzSessionById,
  updateQuizizzSession,
  getOrCreateQuizizzProgress,
  updateQuizizzProgress,
  getAllQuizizzProgress,
  deleteQuizizzSession,
  deleteQuizizzProgressById,
  banQuizizzStudent,
  isQuizizzStudentBanned,
  getClassroomsByUser,
  createClassroom,
  deleteClassroom,
  updateClassroomName,
  getStudentsByClassroom,
  getWheelQuestionsByUser,
  addStudentsToClassroom,
  deleteStudentFromClassroom,
  replaceStudentsInClassroom,
  createWheelQuestion,
  deleteWheelQuestion,
  updateWheelQuestion,
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

  deleteAllQuizzes: protectedProcedure
    .mutation(async ({ ctx }) => {
      await deleteAllQuizzesByTeacher(ctx.user.id);
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

  // حذف جميع نتائج الاختبار
  deleteSubmissions: protectedProcedure
    .input(z.object({ quizId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const quiz = await getQuizById(input.quizId);
      if (!quiz) throw new TRPCError({ code: "NOT_FOUND" });
      if (quiz.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      await deleteQuizSubmissions(input.quizId);
      return { success: true };
    }),

  // تحديث نوع الاختبار (normal/live)
  updateMode: protectedProcedure
    .input(z.object({ quizId: z.number(), mode: z.enum(["normal", "live", "quizizz"]) }))
    .mutation(async ({ ctx, input }) => {
      const quiz = await getQuizById(input.quizId);
      if (!quiz) throw new TRPCError({ code: "NOT_FOUND" });
      if (quiz.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      const db = (await import("./db")).getDb;
      const drizzleDb = await db();
      if (!drizzleDb) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { quizzes } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await drizzleDb.update(quizzes).set({ quizMode: input.mode }).where(eq(quizzes.id, input.quizId));
      return { success: true };
    }),

  // تحديث المدة الزمنية لكل سؤال
  updateTimeLimit: protectedProcedure
    .input(z.object({ quizId: z.number(), timeLimitSeconds: z.number().min(0).max(300) }))
    .mutation(async ({ ctx, input }) => {
      const quiz = await getQuizById(input.quizId);
      if (!quiz) throw new TRPCError({ code: "NOT_FOUND" });
      if (quiz.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      const db = (await import("./db")).getDb;
      const drizzleDb = await db();
      if (!drizzleDb) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { quizzes } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await drizzleDb.update(quizzes).set({ timeLimitSeconds: input.timeLimitSeconds }).where(eq(quizzes.id, input.quizId));
      return { success: true };
    }),

  // ===== Live Quiz (Kahoot-style) =====

  // بدء جلسة مباشرة (المعلم)
  startLive: protectedProcedure
    .input(z.object({ quizId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const quiz = await getQuizById(input.quizId);
      if (!quiz) throw new TRPCError({ code: "NOT_FOUND" });
      if (quiz.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      // حذف الجلسة القديمة إن وجدت
      await deleteLiveSession(input.quizId);
      const session = await createLiveSession(input.quizId);
      return session;
    }),

  // الحصول على حالة الجلسة المباشرة (polling للطالب والمعلم)
  getLiveState: publicProcedure
    .input(z.object({ quizId: z.number() }))
    .query(async ({ input }) => {
      const session = await getLiveSessionByQuiz(input.quizId);
      if (!session) return null;
      // جلب المدة الزمنية من جدول الاختبارات
      const db = (await import("./db")).getDb;
      const drizzleDb = await db();
      let timeLimitSeconds = 30;
      if (drizzleDb) {
        const { quizzes } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const [quizRow] = await drizzleDb.select({ timeLimitSeconds: quizzes.timeLimitSeconds })
          .from(quizzes).where(eq(quizzes.id, session.quizId)).limit(1);
        if (quizRow) timeLimitSeconds = quizRow.timeLimitSeconds;
      }
      return {
        id: session.id,
        state: session.state,
        currentQuestionIndex: session.currentQuestionIndex,
        questionStartedAt: session.questionStartedAt,
        participants: JSON.parse(session.participants || "[]") as { name: string; score: number }[],
        currentAnswers: JSON.parse(session.currentAnswers || "[]") as { studentName: string; answerIndex: number; timeMs: number }[],
        timeLimitSeconds,
      };
    }),

  // الطالب ينضم للجلسة المباشرة
  joinLive: publicProcedure
    .input(z.object({ quizId: z.number(), studentName: z.string().min(1).max(255) }))
    .mutation(async ({ input }) => {
      const session = await getLiveSessionByQuiz(input.quizId);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "لا توجد جلسة مباشرة نشطة" });
      if (session.state === "ended") throw new TRPCError({ code: "FORBIDDEN", message: "انتهت الجلسة" });
      // منع الدخول بعد بدء الأسئلة (الجلسة مقفلة أو الحالة ليست waiting)
      const sessionLocked = (session as { isLocked?: number }).isLocked ?? 0;
      if (sessionLocked === 1 || session.state !== "waiting") {
        throw new TRPCError({ code: "FORBIDDEN", message: "بدأ الاختبار بالفعل، لا يمكن الانضمام الآن" });
      }
      const participants = JSON.parse(session.participants || "[]") as { name: string; score: number }[];
      const exists = participants.find(p => p.name === input.studentName);
      if (!exists) {
        participants.push({ name: input.studentName, score: 0 });
        await updateLiveSession(session.id, { participants: JSON.stringify(participants) });
      }
      return { sessionId: session.id, quizId: input.quizId };
    }),

  // المعلم ينتقل للسؤال التالي
  nextQuestion: protectedProcedure
    .input(z.object({ quizId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const quiz = await getQuizById(input.quizId);
      if (!quiz) throw new TRPCError({ code: "NOT_FOUND" });
      if (quiz.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      const session = await getLiveSessionByQuiz(input.quizId);
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      const questions = await getQuestionsByQuiz(input.quizId);
      const nextIndex = session.state === "waiting" ? 0 : session.currentQuestionIndex + 1;
      if (nextIndex >= questions.length) {
        // انتهت الأسئلة - عرض المراكز
        await updateLiveSession(session.id, { state: "leaderboard", currentAnswers: "[]" });
        return { state: "leaderboard", questionIndex: nextIndex };
      }
      // عند بدء المسابقة (السؤال الأول): ابدأ بحالة countdown لمدة 5 ثواني
      if (session.state === "waiting") {
        await updateLiveSession(session.id, {
          state: "countdown",
          currentQuestionIndex: nextIndex,
          currentAnswers: "[]",
          isLocked: 1,
        });
        // بعد 5 ثواني انتقل للسؤال تلقائياً
        setTimeout(async () => {
          const sess = await getLiveSessionByQuiz(input.quizId);
          if (sess && sess.state === "countdown") {
            await updateLiveSession(sess.id, {
              state: "question",
              questionStartedAt: new Date(),
            });
          }
        }, 5000);
        return { state: "countdown", questionIndex: nextIndex };
      }
      await updateLiveSession(session.id, {
        state: "question",
        currentQuestionIndex: nextIndex,
        questionStartedAt: new Date(),
        currentAnswers: "[]",
        isLocked: 1,
      });
      return { state: "question", questionIndex: nextIndex };
    }),

  // عرض نتائج السؤال الحالي (المعلم)
  showQuestionResults: protectedProcedure
    .input(z.object({ quizId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const quiz = await getQuizById(input.quizId);
      if (!quiz) throw new TRPCError({ code: "NOT_FOUND" });
      if (quiz.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      const session = await getLiveSessionByQuiz(input.quizId);
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      await updateLiveSession(session.id, { state: "results" });
      return { success: true };
    }),

  // الطالب يرسل إجابته في الوضع المباشر
  submitLiveAnswer: publicProcedure
    .input(z.object({
      quizId: z.number(),
      studentName: z.string().min(1).max(255),
      answerIndex: z.number(),
      timeMs: z.number(),
    }))
    .mutation(async ({ input }) => {
      const session = await getLiveSessionByQuiz(input.quizId);
      // السماح بالإجابة في حالة question أو results (لفترة قصيرة بعد انتهاء الوقت)
      if (!session || (session.state !== "question" && session.state !== "results")) throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكن الإجابة الآن" });
      const currentAnswers = JSON.parse(session.currentAnswers || "[]") as { studentName: string; answerIndex: number; timeMs: number }[];
      // منع الإجابة المكررة
      if (currentAnswers.find(a => a.studentName === input.studentName)) {
        return { success: true, alreadyAnswered: true };
      }
      currentAnswers.push({ studentName: input.studentName, answerIndex: input.answerIndex, timeMs: input.timeMs });
      // تحديث الدرجات
      const questions = await getQuestionsByQuiz(input.quizId);
      const currentQ = questions[session.currentQuestionIndex];
      const isCorrect = currentQ && input.answerIndex === currentQ.correctAnswer;
      if (isCorrect) {
        const participants = JSON.parse(session.participants || "[]") as { name: string; score: number }[];
        const p = participants.find(p => p.name === input.studentName);
        if (p) {
          // نقاط أكثر للإجابة الأسرع (max 1000 نقطة)
          const timeLimit = currentQ.timeLimit * 1000;
          const points = Math.max(100, Math.round(1000 * (1 - input.timeMs / timeLimit)));
          p.score += points;
          await updateLiveSession(session.id, {
            currentAnswers: JSON.stringify(currentAnswers),
            participants: JSON.stringify(participants),
          });
        } else {
          await updateLiveSession(session.id, { currentAnswers: JSON.stringify(currentAnswers) });
        }
      } else {
        await updateLiveSession(session.id, { currentAnswers: JSON.stringify(currentAnswers) });
      }
      return { success: true, isCorrect, alreadyAnswered: false };
    }),

  // إنهاء الجلسة المباشرة
  endLive: protectedProcedure
    .input(z.object({ quizId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const quiz = await getQuizById(input.quizId);
      if (!quiz) throw new TRPCError({ code: "NOT_FOUND" });
      if (quiz.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      const session = await getLiveSessionByQuiz(input.quizId);
      if (session) await updateLiveSession(session.id, { state: "ended" });
      return { success: true };
    }),

  // طرد طالب من الكاهوت + حظر IP
  kickParticipant: protectedProcedure
    .input(z.object({ quizId: z.number(), studentName: z.string(), studentIp: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const quiz = await getQuizById(input.quizId);
      if (!quiz) throw new TRPCError({ code: "NOT_FOUND" });
      if (quiz.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      const session = await getLiveSessionByQuiz(input.quizId);
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      // إزالة الطالب من participants
      const participants = JSON.parse(session.participants || "[]") as { name: string; score: number }[];
      const filtered = participants.filter(p => p.name !== input.studentName);
      // إضافة الاسم لقائمة المطرودين
      const kicked = JSON.parse((session as { kickedParticipants?: string }).kickedParticipants || "[]") as string[];
      if (!kicked.includes(input.studentName)) kicked.push(input.studentName);
      await updateLiveSession(session.id, {
        participants: JSON.stringify(filtered),
        kickedParticipants: JSON.stringify(kicked),
      } as Parameters<typeof updateLiveSession>[1]);
      // حظر IP إذا تم تمريره
      if (input.studentIp) {
        await banIp(input.studentIp, `طرد من الكاهوت - الاسم: ${input.studentName}`);
      }
      return { success: true };
    }),

  // فحص حظر IP للطالب
  checkBan: publicProcedure
    .input(z.object({ ip: z.string() }))
    .query(async ({ input }) => {
      const banned = await isIpBanned(input.ip);
      return { banned };
    }),

  // حذف استجابة طالب في الكويزيز العادي
  deleteSubmission: protectedProcedure
    .input(z.object({ submissionId: z.number(), quizId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const quiz = await getQuizById(input.quizId);
      if (!quiz) throw new TRPCError({ code: "NOT_FOUND" });
      if (quiz.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      await deleteQuizSubmission(input.submissionId);
      return { success: true };
    }),

  // جلب نتائج الكاهوت النهائية مرتبة من الأعلى للأدنى
  getLiveResults: protectedProcedure
    .input(z.object({ quizId: z.number() }))
    .query(async ({ ctx, input }) => {
      const quiz = await getQuizById(input.quizId);
      if (!quiz) throw new TRPCError({ code: "NOT_FOUND" });
      if (quiz.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      const session = await getLiveSessionByQuiz(input.quizId);
      if (!session) return { participants: [], quizTitle: quiz.title };
      const participants = JSON.parse(session.participants || "[]") as { name: string; score: number }[];
      const sorted = [...participants].sort((a, b) => b.score - a.score);
      return { participants: sorted, quizTitle: quiz.title };
    }),

  // حالة الجلسة المباشرة للطالب (تشمل kickedParticipants)
  getLiveStateStudent: publicProcedure
    .input(z.object({ quizId: z.number(), studentName: z.string() }))
    .query(async ({ input }) => {
      const session = await getLiveSessionByQuiz(input.quizId);
      if (!session) return null;
      const kicked = JSON.parse((session as { kickedParticipants?: string }).kickedParticipants || "[]") as string[];
      const isKicked = kicked.includes(input.studentName);
      // جلب المدة الزمنية من جدول الاختبارات
      const db = (await import("./db")).getDb;
      const drizzleDb = await db();
      let timeLimitSeconds = 30;
      if (drizzleDb) {
        const { quizzes } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const [quizRow] = await drizzleDb.select({ timeLimitSeconds: quizzes.timeLimitSeconds })
          .from(quizzes).where(eq(quizzes.id, session.quizId)).limit(1);
        if (quizRow) timeLimitSeconds = quizRow.timeLimitSeconds;
      }
      return {
        id: session.id,
        state: session.state,
        currentQuestionIndex: session.currentQuestionIndex,
        questionStartedAt: session.questionStartedAt,
        participants: JSON.parse(session.participants || "[]") as { name: string; score: number }[],
        currentAnswers: JSON.parse(session.currentAnswers || "[]") as { studentName: string; answerIndex: number; timeMs: number }[],
        isLocked: (session as { isLocked?: number }).isLocked ?? 0,
        isKicked,
        timeLimitSeconds,
      };
    }),
});

const padletRouter = router({
  // إنشاء لوحة جديدة
  createBoard: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(255).default("لوحة جديدة"),
      description: z.string().max(500).optional(),
      layout: z.enum(["grid", "stream", "freeform"]).default("grid"),
      bgColor: z.string().default("#f8fafc"),
      requireApproval: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const shareCode = nanoid(10);
      const { requireApproval, ...rest } = input;
      return createPadletBoard({ ...rest, teacherId: ctx.user.id, shareCode, requireApproval: requireApproval ? 1 : 0 });
    }),

  // جلب لوحات المعلم
  getMyBoards: protectedProcedure.query(async ({ ctx }) => {
    return getPadletBoardsByTeacher(ctx.user.id);
  }),

  // جلب لوحة بالمعرف (للمعلم)
  getBoardById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const board = await getPadletBoardById(input.id);
      if (!board || board.teacherId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
      return board;
    }),

  // جلب لوحة بالكود (عام - للطالب)
  getBoardByCode: publicProcedure
    .input(z.object({ shareCode: z.string() }))
    .query(async ({ input }) => {
      const board = await getPadletBoardByCode(input.shareCode);
      if (!board) throw new TRPCError({ code: "NOT_FOUND" });
      return board;
    }),

  // تحديث إعدادات اللوحة
  updateBoard: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().min(1).max(255).optional(),
      description: z.string().max(500).optional(),
      layout: z.enum(["grid", "stream", "freeform"]).optional(),
      bgColor: z.string().optional(),
      allowStudentCards: z.boolean().optional(),
      requireApproval: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const board = await getPadletBoardById(input.id);
      if (!board || board.teacherId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
      const { id, allowStudentCards, requireApproval, ...rest } = input;
      await updatePadletBoard(id, {
        ...rest,
        ...(allowStudentCards !== undefined ? { allowStudentCards: allowStudentCards ? 1 : 0 } : {}),
        ...(requireApproval !== undefined ? { requireApproval: requireApproval ? 1 : 0 } : {}),
      });
      return { success: true };
    }),

  // حذف لوحة
  deleteBoard: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const board = await getPadletBoardById(input.id);
      if (!board || board.teacherId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
      await deletePadletBoard(input.id);
      return { success: true };
    }),

  // حذف جميع اللوحات
  deleteAllBoards: protectedProcedure.mutation(async ({ ctx }) => {
    await deleteAllPadletBoardsByTeacher(ctx.user.id);
    return { success: true };
  }),

  // جلب بطاقات لوحة (عام) - يقبل studentName لإظهار بطاقة الطالب نفسه حتى لو كانت قيد المراجعة
  getCards: publicProcedure
    .input(z.object({ boardId: z.number(), studentName: z.string().optional() }))
    .query(async ({ input }) => {
      const board = await getPadletBoardById(input.boardId);
      if (!board) throw new TRPCError({ code: "NOT_FOUND" });
      const allCards = await getPadletCardsByBoard(input.boardId);
      // إذا لم تكن اللوحة تتطلب موافقة، أرجع كل البطاقات
      if (!board.requireApproval) return allCards;
      // إذا كانت تتطلب موافقة: أرجع المنشورة + بطاقة الطالب نفسه (حتى لو كانت قيد المراجعة)
      return allCards.filter(c =>
        c.isPublished === 1 ||
        c.isTeacher === 1 ||
        (input.studentName && c.authorName === input.studentName)
      );
    }),

  // جلب جميع البطاقات للمعلم (بما فيها غير المنشورة)
  getAllCardsTeacher: protectedProcedure
    .input(z.object({ boardId: z.number() }))
    .query(async ({ ctx, input }) => {
      const board = await getPadletBoardById(input.boardId);
      if (!board || board.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      return getPadletCardsByBoard(input.boardId);
    }),

  // إضافة بطاقة من المعلم
  addTeacherCard: protectedProcedure
    .input(z.object({
      boardId: z.number(),
      title: z.string().max(255).optional(),
      content: z.string().max(2000).optional(),
      imageUrl: z.string().optional(),
      imageKey: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const board = await getPadletBoardById(input.boardId);
      if (!board || board.teacherId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
      return createPadletCard({ ...input, authorName: ctx.user.name || "المعلم", isTeacher: 1 });
    }),

  // إضافة بطاقة من طالب
  addStudentCard: publicProcedure
    .input(z.object({
      boardId: z.number(),
      studentName: z.string().min(1).max(255),
      title: z.string().max(255).optional(),
      content: z.string().max(2000).optional(),
      imageUrl: z.string().optional(),
      imageKey: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const board = await getPadletBoardById(input.boardId);
      if (!board) throw new TRPCError({ code: "NOT_FOUND" });
      if (!board.allowStudentCards) throw new TRPCError({ code: "FORBIDDEN", message: "إضافة البطاقات معطلة حالياً" });
      const { studentName, boardId, ...rest } = input;
      // إذا كانت اللوحة تتطلب موافقة، البطاقة تبدأ غير منشورة
      const isPublished = board.requireApproval ? 0 : 1;
      return createPadletCard({ ...rest, boardId, authorName: studentName, isTeacher: 0, isPublished });
    }),

  // نشر بطاقة واحدة (for المعلم)
  publishCard: protectedProcedure
    .input(z.object({ cardId: z.number(), boardId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const board = await getPadletBoardById(input.boardId);
      if (!board || board.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      await updatePadletCard(input.cardId, { isPublished: 1 });
      return { success: true };
    }),

  // نشر جميع البطاقات المعلقة (for المعلم)
  publishAllCards: protectedProcedure
    .input(z.object({ boardId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const board = await getPadletBoardById(input.boardId);
      if (!board || board.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      const allCards = await getPadletCardsByBoard(input.boardId);
      const pending = allCards.filter(c => c.isPublished === 0 && c.isTeacher === 0);
      await Promise.all(pending.map(c => updatePadletCard(c.id, { isPublished: 1 })));
      return { success: true, count: pending.length };
    }),

  // حذف بطاقة (للمعلم فقط)
  deleteCard: protectedProcedure
    .input(z.object({ cardId: z.number(), boardId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const board = await getPadletBoardById(input.boardId);
      if (!board || board.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      await deletePadletCard(input.cardId);
      return { success: true };
    }),

  // تثبيت/إلغاء تثبيت بطاقة
  togglePin: protectedProcedure
    .input(z.object({ cardId: z.number(), boardId: z.number(), isPinned: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const board = await getPadletBoardById(input.boardId);
      if (!board || board.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      await updatePadletCard(input.cardId, { isPinned: input.isPinned ? 1 : 0 });
      return { success: true };
    }),

  // إعجاب بطاقة
  likeCard: publicProcedure
    .input(z.object({ cardId: z.number() }))
    .mutation(async ({ input }) => {
      await likePadletCard(input.cardId);
      return { success: true };
    }),

  // تقييم المعلم على بطاقة طالب
  addTeacherComment: protectedProcedure
    .input(z.object({ cardId: z.number(), boardId: z.number(), comment: z.string(), starRating: z.number().min(0).max(5).default(0) }))
    .mutation(async ({ ctx, input }) => {
      const board = await getPadletBoardById(input.boardId);
      if (!board || board.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      await updatePadletCard(input.cardId, { teacherComment: input.comment || null, starRating: input.starRating });
      return { success: true };
    }),

  // رفع صورة بطاقة
  uploadCardImage: protectedProcedure
    .input(z.object({
      boardId: z.number(),
      imageBase64: z.string(),
      mimeType: z.string().default("image/jpeg"),
    }))
    .mutation(async ({ ctx, input }) => {
      const board = await getPadletBoardById(input.boardId);
      if (!board || board.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      const buffer = Buffer.from(input.imageBase64, "base64");
      const key = `padlet/${ctx.user.id}/${Date.now()}.jpg`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      return { url, key };
    }),
});


// ===== Quizizz Router =====
const quizizzRouter = router({
  // إنشاء جلسة Quizizz جديدة (المعلم)
  createSession: protectedProcedure
    .input(z.object({ quizId: z.number(), durationMinutes: z.number().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const quiz = await getQuizById(input.quizId);
      if (!quiz || quiz.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      const session = await createQuizizzSession(input.quizId, input.durationMinutes);
      return session;
    }),
  // الطالب ينضم للجلسة
  joinSession: publicProcedure
    .input(z.object({ shareCode: z.string(), studentName: z.string().min(1).max(100) }))
    .mutation(async ({ input }) => {
      const session = await getQuizizzSessionByCode(input.shareCode);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "رمز الجلسة غير صحيح" });
      if (session.state === "ended") throw new TRPCError({ code: "BAD_REQUEST", message: "انتهت الجلسة" });
      if (session.isLocked === 1) throw new TRPCError({ code: "BAD_REQUEST", message: "الجلسة مغلقة حالياً. انتظر حتى يفتحها المعلم" });
      // فحص الحظر قبل السماح بالانضمام
      const studentBanned = await isQuizizzStudentBanned(session.id, input.studentName);
      if (studentBanned) throw new TRPCError({ code: "FORBIDDEN", message: "تم إزالتك من الجلسة من قِبل المعلم" });
      const quiz = await getQuizById(session.quizId);
      if (!quiz) throw new TRPCError({ code: "NOT_FOUND" });
      const questions = await getQuestionsByQuiz(session.quizId);
      const progress = await getOrCreateQuizizzProgress(session.id, input.studentName);
      return { session, quiz, questions, progress };
    }),
  // الطالب يجيب على سؤال
  submitAnswer: publicProcedure
    .input(z.object({
      sessionId: z.number(),
      studentName: z.string(),
      questionIndex: z.number(),
      answerIndex: z.number(),
      isRetry: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      const session = await getQuizizzSessionById(input.sessionId);
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      // فحص الحظر قبل قبول الإجابة
      const banned = await isQuizizzStudentBanned(input.sessionId, input.studentName);
      if (banned) throw new TRPCError({ code: "FORBIDDEN", message: "تم إزالتك من الجلسة من قِبل المعلم" });
      const quiz = await getQuizById(session.quizId);
      if (!quiz) throw new TRPCError({ code: "NOT_FOUND" });
      const questions = await getQuestionsByQuiz(session.quizId);
      const question = questions[input.questionIndex];
      if (!question) throw new TRPCError({ code: "NOT_FOUND" });
      const isCorrect = question.correctAnswer === input.answerIndex;
      // نقاط: 1000 للإجابة الأولى الصحيحة، 500 للمحاولة الثانية
      const pointsEarned = isCorrect ? (input.isRetry ? 500 : 1000) : 0;
      const progress = await getOrCreateQuizizzProgress(input.sessionId, input.studentName);
      const answers: Array<{questionIndex: number; answerIndex: number; isCorrect: boolean; attempts: number; pointsEarned: number}> = JSON.parse(progress.answers || "[]");
      const existingIdx = answers.findIndex(a => a.questionIndex === input.questionIndex);
      if (existingIdx >= 0) {
        answers[existingIdx] = { questionIndex: input.questionIndex, answerIndex: input.answerIndex, isCorrect, attempts: answers[existingIdx].attempts + 1, pointsEarned };
      } else {
        answers.push({ questionIndex: input.questionIndex, answerIndex: input.answerIndex, isCorrect, attempts: 1, pointsEarned });
      }
      const newScore = answers.reduce((sum, a) => sum + a.pointsEarned, 0);
      const questionsCompleted = isCorrect ? progress.questionsCompleted + (input.isRetry ? 0 : 1) : progress.questionsCompleted;
      const nextQuestion = isCorrect ? input.questionIndex + 1 : input.questionIndex;
      const isFinished = isCorrect && nextQuestion >= questions.length ? 1 : 0;
      await updateQuizizzProgress(progress.id, {
        answers: JSON.stringify(answers),
        score: newScore,
        questionsCompleted,
        currentQuestion: nextQuestion,
        isFinished,
        finishedAt: isFinished ? new Date() : undefined,
      });
      return { isCorrect, pointsEarned, nextQuestion, isFinished: isFinished === 1, totalQuestions: questions.length };
    }),
  // المعلم يرى تقدم جميع الطلاب
  getProgress: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(async ({ ctx, input }) => {
      const session = await getQuizizzSessionById(input.sessionId);
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      const quiz = await getQuizById(session.quizId);
      if (!quiz || quiz.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      const progress = await getAllQuizizzProgress(input.sessionId);
      const questions = await getQuestionsByQuiz(session.quizId);
      return { session, quiz, progress, totalQuestions: questions.length };
    }),
  // المعلم ينهي الجلسة
  endSession: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const session = await getQuizizzSessionById(input.sessionId);
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      const quiz = await getQuizById(session.quizId);
      if (!quiz || quiz.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      await updateQuizizzSession(input.sessionId, { state: "ended" });
      return { success: true };
    }),
  // حذف طالب من جلسة Quizizz (مع حظره من العودة)
  removeStudent: protectedProcedure
    .input(z.object({ sessionId: z.number(), progressId: z.number(), studentName: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await getQuizizzSessionById(input.sessionId);
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      const quiz = await getQuizById(session.quizId);
      if (!quiz || quiz.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      // حذف السجل وإضافته لقائمة المحظورين
      await deleteQuizizzProgressById(input.progressId);
      await banQuizizzStudent(input.sessionId, input.studentName);
      return { success: true };
    }),
  // الطالب يتحقق من حالة الجلسة
  getSessionState: publicProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(async ({ input }) => {
      const session = await getQuizizzSessionById(input.sessionId);
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      return { state: session.state, endsAt: session.endsAt, isLocked: session.isLocked === 1 };
    }),
  // المعلم يفتح/يغلق الجلسة
  toggleSessionLock: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const session = await getQuizizzSessionById(input.sessionId);
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      const quiz = await getQuizById(session.quizId);
      if (!quiz || quiz.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      const newLocked = session.isLocked === 1 ? 0 : 1;
      await updateQuizizzSession(input.sessionId, { isLocked: newLocked });
      return { isLocked: newLocked === 1 };
    }),
});
// ===== Wheel Router =====
const wheelRouter = router({
  // --- الصفوف الدراسية ---
  getClassrooms: protectedProcedure
    .query(async ({ ctx }) => {
      const classrooms = await getClassroomsByUser(ctx.user.id);
      const result = await Promise.all(
        classrooms.map(async (classroom) => {
          const students = await getStudentsByClassroom(classroom.id);
          return { ...classroom, students };
        })
      );
      return result;
    }),
  createClassroom: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const id = await createClassroom(ctx.user.id, input.name);
      return { id };
    }),
  deleteClassroom: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteClassroom(input.id, ctx.user.id);
      return { success: true };
    }),
  updateClassroomName: protectedProcedure
    .input(z.object({ id: z.number(), name: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      await updateClassroomName(input.id, ctx.user.id, input.name);
      return { success: true };
    }),
  // --- طلاب الصف ---
  getStudents: protectedProcedure
    .input(z.object({ classroomId: z.number() }))
    .query(async ({ input }) => {
      return getStudentsByClassroom(input.classroomId);
    }),
  addStudents: protectedProcedure
    .input(z.object({ classroomId: z.number(), names: z.array(z.string().min(1).max(100)).min(1).max(500) }))
    .mutation(async ({ input }) => {
      await addStudentsToClassroom(input.classroomId, input.names);
      return { success: true };
    }),
  replaceStudents: protectedProcedure
    .input(z.object({ classroomId: z.number(), names: z.array(z.string().min(1).max(100)).max(500) }))
    .mutation(async ({ input }) => {
      await replaceStudentsInClassroom(input.classroomId, input.names);
      return { success: true };
    }),
  deleteStudent: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteStudentFromClassroom(input.id);
      return { success: true };
    }),
  // --- أسئلة العجلة ---
  getQuestions: protectedProcedure
    .query(async ({ ctx }) => {
      const questions = await getWheelQuestionsByUser(ctx.user.id);
      return questions.map((q) => ({
        ...q,
        options: q.options ? JSON.parse(q.options) : [],
        correctAnswer: q.correctAnswer ?? null,
      }));
    }),
  createQuestion: protectedProcedure
    .input(z.object({
      question: z.string().min(1).max(500),
      options: z.array(z.string().max(200)).max(10),
      correctAnswer: z.number().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const id = await createWheelQuestion(ctx.user.id, input.question, input.options, input.correctAnswer ?? null);
      return { id };
    }),
  updateQuestion: protectedProcedure
    .input(z.object({
      id: z.number(),
      question: z.string().min(1).max(500),
      options: z.array(z.string().max(200)).max(10),
      correctAnswer: z.number().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await updateWheelQuestion(input.id, ctx.user.id, input.question, input.options, input.correctAnswer ?? null);
      return { success: true };
    }),
  deleteQuestion: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteWheelQuestion(input.id, ctx.user.id);
      return { success: true };
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

    // حذف إجابة طالب واحد
    deleteStudentSubmission: protectedProcedure
      .input(z.object({ submissionId: z.number(), sessionId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const session = await getSessionById(input.sessionId);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });
        if (session.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        await deleteSubmission(input.submissionId);
        return { success: true };
      }),
    // حذف جميع إجابات الطلاب في جلسة (بدون حذف سبورة المعلم)
    deleteAllStudentSubmissions: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const session = await getSessionById(input.sessionId);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });
        if (session.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        await deleteAllSubmissionsInSession(input.sessionId);
        return { success: true };
      }),
    // حذف جميع السبورات دفعة واحدة
    deleteAllSessions: protectedProcedure
      .mutation(async ({ ctx }) => {
        await deleteAllSessionsByTeacher(ctx.user.id);
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

    // بدء بث سبورة طالب محدد للفصل
    startBroadcast: protectedProcedure
      .input(z.object({ submissionId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const submission = await getSubmissionById(input.submissionId);
        if (!submission) throw new TRPCError({ code: "NOT_FOUND" });
        const session = await getSessionById(submission.sessionId);
        if (!session || session.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        await setLiveBroadcast(session.id, input.submissionId);
        return { success: true };
      }),

    // إيقاف البث المباشر
    stopBroadcast: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const session = await getSessionById(input.sessionId);
        if (!session || session.teacherId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        await setLiveBroadcast(session.id, null);
        return { success: true };
      }),

    // الحصول على حالة البث (للطالب)
    getBroadcastState: publicProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => {
        const session = await getSessionById(input.sessionId);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });
        if (!session.liveSubmissionId) return { isLive: false, submission: null };
        const submission = await getSubmissionById(session.liveSubmissionId);
        return {
          isLive: true,
          submission: submission ? {
            id: submission.id,
            studentName: submission.studentName,
            // أولوية liveCanvasData (بث لحظي) ثم canvasData (إرسال رسمي)
            canvasData: submission.liveCanvasData ?? submission.canvasData,
            correctionData: submission.correctionData,
          } : null,
        };
      }),

    // إرسال canvas الطالب لحظة بلحظة (للبث المباشر)
    updateLiveCanvas: publicProcedure
      .input(z.object({ submissionId: z.number(), canvasData: z.string() }))
      .mutation(async ({ input }) => {
        await updateLiveCanvasData(input.submissionId, input.canvasData);
        return { ok: true };
      }),

    // جلب بيانات canvas الطالب اللحظية (لواجهة المعلم)
    getLiveCanvas: publicProcedure
      .input(z.object({ submissionId: z.number() }))
      .query(async ({ input }) => {
        const submission = await getSubmissionById(input.submissionId);
        if (!submission) throw new TRPCError({ code: "NOT_FOUND" });
        return {
          canvasData: submission.liveCanvasData ?? submission.canvasData,
          studentName: submission.studentName,
        };
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
  padlet: padletRouter,
  quizizz: quizizzRouter,
  wheel: wheelRouter,
});
export type AppRouter = typeof appRouter;
