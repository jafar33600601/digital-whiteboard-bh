import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

export default function Join({ params }: { params?: { code?: string } }) {
  const [pin, setPin] = useState(params?.code?.toUpperCase() ?? "");
  const [error, setError] = useState("");
  const [, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);

  const lookup = trpc.lookupCode.useQuery(
    { code: pin },
    {
      enabled: false,
      retry: false,
    }
  );

  const handleEnter = async () => {
    const code = pin.trim().toUpperCase();
    if (!code) { setError("أدخل رمز اللعبة"); return; }
    setError("");

    const result = await lookup.refetch();
    const data = result.data;

    if (!data) {
      setError("رمز غير صحيح أو انتهت الجلسة");
      return;
    }

    if (data.type === "kahoot") {
      navigate(`/quiz-join/${code}`);
    } else if (data.type === "quizizz") {
      navigate(`/quizizz/${code}`);
    } else if (data.type === "quiz") {
      navigate(`/quiz/${code}`);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-between"
      style={{ background: "linear-gradient(135deg, #46178f 0%, #7c3aed 50%, #4f46e5 100%)" }}
    >
      {/* Header */}
      <div className="w-full flex items-center justify-center py-4 px-6">
        <span
          className="text-white font-extrabold text-2xl tracking-wide select-none"
          style={{ fontFamily: "'Cairo', sans-serif", letterSpacing: "0.05em" }}
        >
          ديجيتال البحرين
        </span>
      </div>

      {/* Main Card */}
      <div className="flex flex-col items-center w-full px-4" style={{ marginTop: "-2rem" }}>
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 flex flex-col items-center gap-5"
          style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.35)" }}
        >
          <h1
            className="text-gray-800 font-extrabold text-xl text-center"
            style={{ fontFamily: "'Cairo', sans-serif" }}
          >
            أدخل رمز اللعبة
          </h1>

          <input
            ref={inputRef}
            type="text"
            inputMode="text"
            value={pin}
            onChange={e => {
              setPin(e.target.value.toUpperCase());
              setError("");
            }}
            onKeyDown={e => e.key === "Enter" && handleEnter()}
            placeholder="Game PIN"
            maxLength={20}
            className="w-full text-center text-2xl font-bold tracking-widest border-2 border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500 transition-colors"
            style={{ fontFamily: "monospace", letterSpacing: "0.2em" }}
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />

          {error && (
            <p className="text-red-500 text-sm font-semibold text-center" style={{ fontFamily: "'Cairo', sans-serif" }}>
              {error}
            </p>
          )}

          <button
            onClick={handleEnter}
            disabled={lookup.isFetching}
            className="w-full py-3 rounded-xl font-extrabold text-white text-lg transition-all active:scale-95 disabled:opacity-60"
            style={{
              background: lookup.isFetching ? "#9ca3af" : "#1a1a2e",
              fontFamily: "'Cairo', sans-serif",
              letterSpacing: "0.05em",
            }}
          >
            {lookup.isFetching ? "جاري البحث..." : "دخول"}
          </button>
        </div>

        {/* Hint */}
        <p
          className="text-white/70 text-sm mt-5 text-center"
          style={{ fontFamily: "'Cairo', sans-serif" }}
        >
          أدخل الرمز الظاهر على شاشة المعلم
        </p>
      </div>

      {/* Footer */}
      <div className="w-full flex items-center justify-center py-5">
        <span
          className="text-white/50 text-xs"
          style={{ fontFamily: "'Cairo', sans-serif" }}
        >
          digitalbh.biz/join
        </span>
      </div>
    </div>
  );
}
