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
  // معرف إجابة الطالب المُبث حالياً (null = لا يوجد بث)
  liveSubmissionId: int("liveSubmissionId"),
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
  // بيانات canvas الطالب اللحظية (للبث المباشر - تُحدَّث كل ثانيتين)
  liveCanvasData: longtext("liveCanvasData"),
  status: mysqlEnum("status", ["pending", "submitted", "corrected"]).default("pending").notNull(),
  submittedAt: timestamp("submittedAt"),
  correctedAt: timestamp("correctedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StudentSubmission = typeof studentSubmissions.$inferSelect;
export type InsertStudentSubmission = typeof studentSubmissions.$inferInsert;

// جدول الاختبارات (اختيار من متعدد)
export const quizzes = mysqlTable("quizzes", {
  id: int("id").autoincrement().primaryKey(),
  shareCode: varchar("shareCode", { length: 32 }).notNull().unique(),
  teacherId: int("teacherId").notNull(),
  title: varchar("title", { length: 255 }).notNull().default("اختبار جديد"),
  isPublished: int("isPublished").default(0).notNull(), // 0=draft, 1=published
  // مدة كل سؤال بالثواني في وضع الكاهوت (0 = بلا حد زمني)
  timeLimitSeconds: int("timeLimitSeconds").default(30).notNull(),
  // quizMode: normal = الطالب يجيب بوقته | live = كاهوت-style
  quizMode: mysqlEnum("quizMode", ["normal", "live", "quizizz"]).default("normal").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Quiz = typeof quizzes.$inferSelect;
export type InsertQuiz = typeof quizzes.$inferInsert;

// جدول أسئلة الاختبار
export const quizQuestions = mysqlTable("quiz_questions", {
  id: int("id").autoincrement().primaryKey(),
  quizId: int("quizId").notNull(),
  questionText: text("questionText").notNull(),
  imageUrl: text("imageUrl"), // رابط الصورة (S3)
  imageKey: varchar("imageKey", { length: 512 }), // مفتاح S3
  // options: JSON array of strings e.g. ["A","B","C","D"]
  options: longtext("options").notNull(),
  // correctAnswer: index 0-3
  correctAnswer: int("correctAnswer").notNull().default(0),
  questionOrder: int("questionOrder").notNull().default(0),
  // وقت الإجابة بالثواني (للوضع المباشر)
  timeLimit: int("timeLimit").notNull().default(30),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type QuizQuestion = typeof quizQuestions.$inferSelect;
export type InsertQuizQuestion = typeof quizQuestions.$inferInsert;

// جدول إجابات الطلاب على الاختبار
export const quizSubmissions = mysqlTable("quiz_submissions", {
  id: int("id").autoincrement().primaryKey(),
  quizId: int("quizId").notNull(),
  studentName: varchar("studentName", { length: 255 }).notNull(),
  // answers: JSON array of selected indices e.g. [0,2,1,3]
  answers: longtext("answers").notNull(),
  score: int("score").notNull().default(0),
  totalQuestions: int("totalQuestions").notNull().default(0),
  submittedAt: timestamp("submittedAt").defaultNow().notNull(),
});

export type QuizSubmission = typeof quizSubmissions.$inferSelect;
export type InsertQuizSubmission = typeof quizSubmissions.$inferInsert;

// جدول جلسات الاختبار المباشر (Kahoot-style)
export const liveQuizSessions = mysqlTable("live_quiz_sessions", {
  id: int("id").autoincrement().primaryKey(),
  quizId: int("quizId").notNull(),
  // الحالة: waiting=انتظار الطلاب | countdown=عد تنازلي 5-1 | question=يعرض سؤالاً | results=نتائج السؤال | leaderboard=المراكز | ended=انتهى
  state: mysqlEnum("state", ["waiting", "countdown", "question", "results", "leaderboard", "ended"]).default("waiting").notNull(),
  currentQuestionIndex: int("currentQuestionIndex").default(0).notNull(),
  questionStartedAt: timestamp("questionStartedAt"),
  // قائمة الطلاب المنضمين: JSON array of {name, score}
  participants: longtext("participants").notNull(),
  // إجابات السؤال الحالي: JSON array of {studentName, answerIndex, timeMs}
  currentAnswers: longtext("currentAnswers").notNull(),
  // الاختبار مقفل (لا يقبل طلاباً جدداً بعد البدء)
  isLocked: int("isLocked").default(0).notNull(),
  // قائمة الطلاب المطرودين: JSON array of studentName strings
  kickedParticipants: longtext("kickedParticipants").notNull().default("[]"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LiveQuizSession = typeof liveQuizSessions.$inferSelect;
export type InsertLiveQuizSession = typeof liveQuizSessions.$inferInsert;

// جدول حظر IP المؤقت (24 ساعة)
export const bannedIps = mysqlTable("banned_ips", {
  id: int("id").autoincrement().primaryKey(),
  ipAddress: varchar("ipAddress", { length: 64 }).notNull(),
  reason: text("reason"),
  bannedAt: timestamp("bannedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
});

export type BannedIp = typeof bannedIps.$inferSelect;
export type InsertBannedIp = typeof bannedIps.$inferInsert;

// ===================== البادلت =====================

// جدول لوحات البادلت (يُنشئها المعلم)
export const padletBoards = mysqlTable("padlet_boards", {
  id: int("id").autoincrement().primaryKey(),
  shareCode: varchar("shareCode", { length: 32 }).notNull().unique(),
  teacherId: int("teacherId").notNull(),
  title: varchar("title", { length: 255 }).notNull().default("لوحة جديدة"),
  description: text("description"),
  // نوع اللوحة: grid=شبكة | stream=تيار | freeform=حر
  layout: mysqlEnum("layout", ["grid", "stream", "freeform"]).default("grid").notNull(),
  // لون خلفية اللوحة
  bgColor: varchar("bgColor", { length: 32 }).default("#f8fafc").notNull(),
  // هل يسمح للطلاب بإضافة بطاقات
  allowStudentCards: int("allowStudentCards").default(1).notNull(),
  // هل يتطلب موافقة المعلم قبل نشر بطاقات الطلاب
  requireApproval: int("requireApproval").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PadletBoard = typeof padletBoards.$inferSelect;
export type InsertPadletBoard = typeof padletBoards.$inferInsert;

// جدول بطاقات البادلت
export const padletCards = mysqlTable("padlet_cards", {
  id: int("id").autoincrement().primaryKey(),
  boardId: int("boardId").notNull(),
  // اسم منشئ البطاقة (المعلم أو اسم الطالب)
  authorName: varchar("authorName", { length: 255 }).notNull(),
  // هل البطاقة من المعلم (للتمييز)
  isTeacher: int("isTeacher").default(0).notNull(),
  title: varchar("title", { length: 255 }),
  content: text("content"),
  // رابط الصورة (S3)
  imageUrl: text("imageUrl"),
  imageKey: varchar("imageKey", { length: 512 }),
  // عدد الإعجابات
  likes: int("likes").default(0).notNull(),
  // مثبتة (من المعلم)
  isPinned: int("isPinned").default(0).notNull(),
  // تقييم المعلم على البطاقة
  teacherComment: text("teacherComment"),
  // تقييم النجوم (0 = لا يوجد، 1-5 = عدد النجوم)
  starRating: int("starRating").default(0).notNull(),
  // هل البطاقة منشورة (1=منشورة، 0=قيد المراجعة) - تُستخدم مع requireApproval
  isPublished: int("isPublished").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PadletCard = typeof padletCards.$inferSelect;
export type InsertPadletCard = typeof padletCards.$inferInsert;

// ===================== Quizizz-style sessions =====================

// جدول جلسات Quizizz (كل طالب بسرعته مع تغذية فورية)
export const quizizzSessions = mysqlTable("quizizz_sessions", {
  id: int("id").autoincrement().primaryKey(),
  quizId: int("quizId").notNull(),
  shareCode: varchar("shareCode", { length: 32 }).notNull().unique(),
  // الحالة: waiting=انتظار | active=جاري | ended=انتهى
  state: mysqlEnum("state", ["waiting", "active", "ended"]).default("waiting").notNull(),
  // هل الجلسة مغلقة (1=مغلقة، 0=مفتوحة) - تمنع انضمام طلاب جدد
  isLocked: int("isLocked").default(0).notNull(),
  // وقت الانتهاء (ملليثاني epoch) - null = بلا حد زمني
  endsAt: timestamp("endsAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type QuizizzSession = typeof quizizzSessions.$inferSelect;
export type InsertQuizizzSession = typeof quizizzSessions.$inferInsert;

// جدول تتبع تقدم كل طالب في Quizizz
export const quizizzProgress = mysqlTable("quizizz_progress", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  studentName: varchar("studentName", { length: 255 }).notNull(),
  // السؤال الحالي (0-based)
  currentQuestion: int("currentQuestion").default(0).notNull(),
  // عدد الأسئلة المنجزة
  questionsCompleted: int("questionsCompleted").default(0).notNull(),
  // النقاط الإجمالية
  score: int("score").default(0).notNull(),
  // تفاصيل إجابات كل سؤال: JSON array of {questionIndex, answerIndex, isCorrect, attempts, pointsEarned}
  answers: longtext("answers").notNull(),
  // هل أنهى الطالب جميع الأسئلة
  isFinished: int("isFinished").default(0).notNull(),
  finishedAt: timestamp("finishedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type QuizizzProgress = typeof quizizzProgress.$inferSelect;
export type InsertQuizizzProgress = typeof quizizzProgress.$inferInsert;

// جدول الطلاب المحظورين في Quizizz (يُضاف عند حذف الطالب)
export const quizizzBanned = mysqlTable("quizizz_banned", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  studentName: varchar("studentName", { length: 100 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type QuizizzBanned = typeof quizizzBanned.$inferSelect;
export type InsertQuizizzBanned = typeof quizizzBanned.$inferInsert;
