import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

export default function Join({ params }: { params?: { code?: string } }) {
  const [pin, setPin] = useState(params?.code ?? "");
  const [error, setError] = useState("");
  const [, navigate] = useLocation();

  const lookup = trpc.lookupCode.useQuery(
    { code: pin },
    { enabled: false, retry: false }
  );

  const handleEnter = async () => {
    const code = pin.trim();
    if (!code) { setError("أدخل رمز اللعبة"); return; }
    if (!/^\d{6}$/.test(code)) { setError("الرمز 6 أرقام"); return; }
    setError("");
    const result = await lookup.refetch();
    const data = result.data;
    if (!data) { setError("رمز غير صحيح أو انتهت الجلسة"); return; }
    if (data.type === "kahoot") navigate(`/quiz-join/${code}`);
    else if (data.type === "quizizz") navigate(`/quizizz/${code}`);
    else if (data.type === "quiz") navigate(`/quiz/${code}`);
  };

  const pressDigit = (d: string) => {
    if (pin.length < 6) { setPin(p => p + d); setError(""); }
  };
  const deleteLast = () => setPin(p => p.slice(0, -1));

  const digits = ["1","2","3","4","5","6","7","8","9","","0","⌫"];

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-between"
      style={{ background: "linear-gradient(135deg, #46178f 0%, #7c3aed 50%, #4f46e5 100%)" }}
    >
      {/* Header */}
      <div className="w-full flex items-center justify-center py-5 px-6">
        <span className="text-white font-extrabold text-2xl select-none" style={{ fontFamily: "'Cairo', sans-serif" }}>
          ديجيتال البحرين
        </span>
      </div>

      {/* Main Card */}
      <div className="flex flex-col items-center w-full px-4">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 flex flex-col items-center gap-4"
          style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.35)" }}
        >
          <h1 className="text-gray-700 font-extrabold text-lg text-center" style={{ fontFamily: "'Cairo', sans-serif" }}>
            Game PIN
          </h1>

          {/* PIN Display */}
          <div className="w-full flex items-center justify-center gap-2 bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 min-h-[56px]">
            {pin ? (
              <span className="text-3xl font-extrabold tracking-widest text-gray-900" style={{ letterSpacing: "0.25em", fontFamily: "monospace" }}>
                {pin}
              </span>
            ) : (
              <span className="text-gray-300 text-xl" style={{ fontFamily: "'Cairo', sans-serif" }}>أدخل الرمز</span>
            )}
          </div>

          {error && (
            <p className="text-red-500 text-sm font-semibold text-center" style={{ fontFamily: "'Cairo', sans-serif" }}>{error}</p>
          )}

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-2 w-full">
            {digits.map((d, i) => (
              d === "" ? <div key={i} /> :
              d === "⌫" ? (
                <button
                  key={i}
                  onClick={deleteLast}
                  className="h-12 rounded-xl bg-gray-100 hover:bg-gray-200 active:scale-95 transition-all text-gray-600 text-xl font-bold flex items-center justify-center"
                >⌫</button>
              ) : (
                <button
                  key={i}
                  onClick={() => pressDigit(d)}
                  className="h-12 rounded-xl bg-gray-100 hover:bg-purple-100 active:scale-95 transition-all text-gray-900 text-xl font-bold"
                >{d}</button>
              )
            ))}
          </div>

          <button
            onClick={handleEnter}
            disabled={lookup.isFetching || pin.length !== 6}
            className="w-full py-3 rounded-xl font-extrabold text-white text-lg transition-all active:scale-95 disabled:opacity-50"
            style={{ background: pin.length === 6 && !lookup.isFetching ? "#1a1a2e" : "#9ca3af", fontFamily: "'Cairo', sans-serif" }}
          >
            {lookup.isFetching ? "جاري البحث..." : "دخول"}
          </button>
        </div>

        <p className="text-white/70 text-sm mt-4 text-center" style={{ fontFamily: "'Cairo', sans-serif" }}>
          أدخل الرمز الظاهر على شاشة المعلم
        </p>
      </div>

      {/* Footer */}
      <div className="w-full flex items-center justify-center py-5">
        <span className="text-white/50 text-xs" style={{ fontFamily: "'Cairo', sans-serif" }}>digitalbh.biz/join</span>
      </div>
    </div>
  );
}
