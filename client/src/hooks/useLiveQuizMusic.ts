import { useEffect, useRef, useCallback } from "react";

// رابط الموسيقى الخلفية المُولَّدة بالذكاء الاصطناعي
const BGM_URL = "/manus-storage/kahoot-bgm_b8bb2705.mp3";

export function useLiveQuizMusic() {
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const oscillatorsRef = useRef<OscillatorNode[]>([]);

  // تهيئة عنصر الصوت للموسيقى الخلفية
  const getBgm = useCallback(() => {
    if (!bgmRef.current) {
      bgmRef.current = new Audio(BGM_URL);
      bgmRef.current.loop = true;
      bgmRef.current.volume = 0.35;
    }
    return bgmRef.current;
  }, []);

  // Web Audio API للأصوات القصيرة
  const getCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      gainNodeRef.current = audioCtxRef.current.createGain();
      gainNodeRef.current.connect(audioCtxRef.current.destination);
      gainNodeRef.current.gain.value = 0.15;
    }
    return audioCtxRef.current;
  }, []);

  const stopOscillators = useCallback(() => {
    oscillatorsRef.current.forEach(osc => { try { osc.stop(); } catch {} });
    oscillatorsRef.current = [];
  }, []);

  const stopAll = useCallback(() => {
    stopOscillators();
    if (bgmRef.current) {
      bgmRef.current.pause();
      bgmRef.current.currentTime = 0;
    }
  }, [stopOscillators]);

  // موسيقى الانتظار - تشغيل الموسيقى الخلفية
  const playWaiting = useCallback(() => {
    stopOscillators();
    const bgm = getBgm();
    bgm.volume = 0.3;
    bgm.currentTime = 0;
    bgm.play().catch(() => {});
  }, [getBgm, stopOscillators]);

  // موسيقى السؤال - نفس الموسيقى بصوت أعلى قليلاً
  const playQuestion = useCallback(() => {
    stopOscillators();
    const bgm = getBgm();
    bgm.volume = 0.4;
    if (bgm.paused) {
      bgm.currentTime = 0;
      bgm.play().catch(() => {});
    }
  }, [getBgm, stopOscillators]);

  // موسيقى العد التنازلي الأخير (5 ثوانٍ) - نغمات تيك تاك
  const playUrgent = useCallback(() => {
    stopOscillators();
    const ctx = getCtx();
    if (ctx.state === "suspended") ctx.resume();
    const beats = [880, 880, 880, 880, 1046.5];
    beats.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(gainNodeRef.current!);
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 1.0;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.05);
      gain.gain.linearRampToValueAtTime(0, t + 0.4);
      osc.start(t);
      osc.stop(t + 0.5);
      oscillatorsRef.current.push(osc);
    });
  }, [getCtx, stopOscillators]);

  // صوت الإجابة الصحيحة
  const playCorrect = useCallback(() => {
    stopOscillators();
    const ctx = getCtx();
    if (ctx.state === "suspended") ctx.resume();
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(gainNodeRef.current!);
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.1);
      osc.start(t);
      osc.stop(t + 0.15);
      oscillatorsRef.current.push(osc);
    });
  }, [getCtx, stopOscillators]);

  // صوت الإجابة الخاطئة
  const playWrong = useCallback(() => {
    stopOscillators();
    const ctx = getCtx();
    if (ctx.state === "suspended") ctx.resume();
    const notes = [220, 196, 174.61];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(gainNodeRef.current!);
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.15;
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.12);
      osc.start(t);
      osc.stop(t + 0.15);
      oscillatorsRef.current.push(osc);
    });
  }, [getCtx, stopOscillators]);

  // موسيقى لوحة المراكز - فانفار احتفالية
  const playLeaderboard = useCallback(() => {
    stopAll();
    const ctx = getCtx();
    if (ctx.state === "suspended") ctx.resume();
    const fanfare = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5];
    fanfare.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(gainNodeRef.current!);
      osc.type = "triangle";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.4, t + 0.02);
      gain.gain.linearRampToValueAtTime(0, t + 0.16);
      osc.start(t);
      osc.stop(t + 0.2);
      oscillatorsRef.current.push(osc);
    });
  }, [getCtx, stopAll]);

  useEffect(() => {
    return () => {
      stopAll();
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, [stopAll]);

  return { playWaiting, playQuestion, playUrgent, playCorrect, playWrong, playLeaderboard, stopAll };
}
