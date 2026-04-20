import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import LiveQuizHost from "./LiveQuizHost";
import LiveQuizStudent from "./LiveQuizStudent";
import QuizStudent from "./QuizStudent";
import QuizResults from "./QuizResults";
import { Loader2 } from "lucide-react";

interface QuizPageProps {
  shareCode: string;
  mode?: "host" | "results";
}

export default function QuizPage({ shareCode, mode }: QuizPageProps) {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  const { data: quiz, isLoading } = trpc.quiz.getQuizByCode.useQuery(
    { shareCode },
    { enabled: !!shareCode }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center" dir="rtl">
        <div className="flex flex-col items-center gap-4 text-white">
          <Loader2 className="w-12 h-12 animate-spin" />
          <p className="text-xl">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center" dir="rtl">
        <div className="text-center text-white">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="text-2xl font-bold">الاختبار غير موجود</h2>
          <p className="text-blue-200 mt-2">تأكد من صحة الرابط</p>
        </div>
      </div>
    );
  }

  const quizMode = (quiz as unknown as { quizMode?: string }).quizMode;

  // وضع المضيف (المعلم)
  if (mode === "host" && isAuthenticated) {
    if (quizMode === "live") {
      return <LiveQuizHost quizId={quiz.id} />;
    }
    return <QuizResults params={{ id: String(quiz.id) }} />;
  }

  // وضع النتائج
  if (mode === "results" && isAuthenticated) {
    return <QuizResults params={{ id: String(quiz.id) }} />;
  }

  // وضع الطالب
  if (quizMode === "live") {
    return <LiveQuizStudent quizId={quiz.id} shareCode={shareCode} />;
  }

  return <QuizStudent params={{ code: shareCode }} />;
}
