import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { ArrowRight, Trophy, Medal } from "lucide-react";

interface LiveQuizResultsProps {
  quizId: number;
}

export default function LiveQuizResults({ quizId }: LiveQuizResultsProps) {
  const [, setLocation] = useLocation();

  const { data, isLoading } = trpc.quiz.getLiveResults.useQuery({ quizId });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-indigo-950 to-black" dir="rtl">
        <div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-indigo-950 to-black" dir="rtl">
        <p className="text-white text-xl">لا توجد نتائج لهذا الاختبار</p>
        <Button onClick={() => setLocation(-1 as unknown as string)} variant="outline" className="border-white/30 text-white hover:bg-white/10">
          <ArrowRight className="ml-2 w-4 h-4" />
          رجوع
        </Button>
      </div>
    );
  }

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-950 via-purple-950 to-black p-6" dir="rtl">
      {/* رأس الصفحة */}
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="outline"
            size="sm"
            className="border-white/30 text-white hover:bg-white/10"
            onClick={() => setLocation(-1 as unknown as string)}
          >
            <ArrowRight className="ml-1 w-4 h-4" />
            رجوع
          </Button>
          <div className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-400" />
            <h1 className="text-2xl font-black text-white">نتائج الكاهوت</h1>
          </div>
        </div>

        <p className="text-purple-300 text-center mb-6 text-lg font-semibold">{data.quizTitle}</p>

        {data.participants.length === 0 ? (
          <div className="text-center py-16">
            <Medal className="w-16 h-16 text-white/30 mx-auto mb-4" />
            <p className="text-white/60 text-lg">لم يشارك أي طالب في هذا الاختبار</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {data.participants.map((p, i) => {
              const isTop3 = i < 3;
              const bgColor =
                i === 0 ? "bg-yellow-500/20 border-yellow-400/60" :
                i === 1 ? "bg-gray-400/20 border-gray-300/60" :
                i === 2 ? "bg-orange-500/20 border-orange-400/60" :
                "bg-white/5 border-white/10";

              return (
                <div
                  key={i}
                  className={`flex items-center gap-4 rounded-2xl px-5 py-4 border ${bgColor} transition-all`}
                >
                  {/* الترتيب */}
                  <div className="w-10 text-center flex-shrink-0">
                    {isTop3 ? (
                      <span className="text-2xl">{medals[i]}</span>
                    ) : (
                      <span className="text-white/50 font-bold text-lg">#{i + 1}</span>
                    )}
                  </div>

                  {/* الاسم */}
                  <div className="flex-1">
                    <p className={`font-bold text-lg ${i === 0 ? "text-yellow-300" : i === 1 ? "text-gray-200" : i === 2 ? "text-orange-300" : "text-white"}`}>
                      {p.name}
                    </p>
                  </div>

                  {/* النقاط */}
                  <div className="text-right flex-shrink-0">
                    <p className={`font-black text-xl ${i === 0 ? "text-yellow-400" : "text-white/80"}`}>
                      {p.score.toLocaleString()}
                    </p>
                    <p className="text-white/40 text-xs">نقطة</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ملخص */}
        {data.participants.length > 0 && (
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="bg-white/5 rounded-xl p-4 text-center border border-white/10">
              <p className="text-white/50 text-xs mb-1">عدد المشاركين</p>
              <p className="text-white font-black text-2xl">{data.participants.length}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 text-center border border-white/10">
              <p className="text-white/50 text-xs mb-1">أعلى نقطة</p>
              <p className="text-yellow-400 font-black text-2xl">{data.participants[0]?.score.toLocaleString()}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 text-center border border-white/10">
              <p className="text-white/50 text-xs mb-1">متوسط النقاط</p>
              <p className="text-purple-300 font-black text-2xl">
                {Math.round(data.participants.reduce((s, p) => s + p.score, 0) / data.participants.length).toLocaleString()}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
