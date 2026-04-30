import { useState, useEffect } from "react";
import { HelpCircle, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface QuestionCardProps {
  question: { id: number; question: string; options: string[]; correctAnswer?: number | null };
}

export function QuestionCard({ question }: QuestionCardProps) {
  const hasOptions = question.options && question.options.length > 0;
  const letters = ["أ", "ب", "ج", "د"];
  const [selectedIdx, setSelectedIdx] = useState<number>(-1);

  // إعادة الضبط عند تغيير السؤال
  useEffect(() => {
    setSelectedIdx(-1);
  }, [question.id]);

  if (!hasOptions) {
    return (
      <div className="bg-blue-950 border border-blue-700 rounded-xl p-4">
        <div className="flex items-start gap-2">
          <HelpCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-white text-lg font-semibold leading-relaxed">{question.question}</p>
        </div>
        <Badge variant="outline" className="mt-3 text-blue-300 border-blue-600">سؤال مفتوح</Badge>
      </div>
    );
  }

  const answered = selectedIdx !== -1;
  const isCorrectAnswer = answered && selectedIdx === question.correctAnswer;

  return (
    <div className="bg-indigo-950 border border-indigo-700 rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-2">
        <HelpCircle className="w-5 h-5 text-indigo-400 mt-0.5 flex-shrink-0" />
        <p className="text-white text-lg font-semibold leading-relaxed">{question.question}</p>
      </div>

      {/* نتيجة الإجابة */}
      {answered && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg font-bold text-lg transition-all ${
          isCorrectAnswer
            ? "bg-green-800/80 border border-green-500 text-green-200"
            : "bg-red-900/80 border border-red-500 text-red-200"
        }`}>
          {isCorrectAnswer ? (
            <><CheckCircle2 className="w-6 h-6" /> إجابة صحيحة! 🎉</>
          ) : (
            <><XCircle className="w-6 h-6" /> إجابة خاطئة</>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-2">
        {question.options.map((opt, idx) => {
          const isSelected = selectedIdx === idx;
          const isCorrect = question.correctAnswer === idx;

          // تحديد لون الخيار
          let colorClass = "bg-indigo-900/40 border-indigo-700/50 text-indigo-200 hover:bg-indigo-800/60 hover:border-indigo-500 cursor-pointer";
          if (answered) {
            if (isCorrect) {
              colorClass = "bg-green-900/60 border-green-500 text-green-200 cursor-default";
            } else if (isSelected) {
              colorClass = "bg-red-900/60 border-red-500 text-red-200 cursor-default";
            } else {
              colorClass = "bg-indigo-900/20 border-indigo-800/30 text-indigo-400 cursor-default opacity-50";
            }
          }

          let circleClass = "bg-indigo-700 text-indigo-200";
          if (answered) {
            if (isCorrect) circleClass = "bg-green-500 text-white";
            else if (isSelected) circleClass = "bg-red-500 text-white";
          }

          return (
            <div
              key={idx}
              onClick={() => !answered && setSelectedIdx(idx)}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-all select-none ${colorClass}`}
            >
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0 ${circleClass}`}>
                {letters[idx] || idx + 1}
              </span>
              <span className="flex-1 text-base font-medium">{opt}</span>
              {answered && isCorrect && <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />}
              {answered && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />}
            </div>
          );
        })}
      </div>

      {!answered && (
        <p className="text-indigo-400 text-xs text-center pt-1">👉 اضغط على الخيار للإجابة</p>
      )}
    </div>
  );
}
