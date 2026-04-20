import { useEffect, useRef, useCallback } from "react";

// توليد موسيقى تحفيزية باستخدام Web Audio API
export function useLiveQuizMusic() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const oscillatorsRef = useRef<OscillatorNode[]>([]);
  const isPlayingRef = useRef(false);

  const getCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      gainNodeRef.current = audioCtxRef.current.createGain();
      gainNodeRef.current.connect(audioCtxRef.current.destination);
      gainNodeRef.current.gain.value = 0.15;
    }
    return audioCtxRef.current;
  }, []);

  const stopAll = useCallback(() => {
    oscillatorsRef.current.forEach(osc => { try { osc.stop(); } catch {} });
    oscillatorsRef.current = [];
    isPlayingRef.current = false;
  }, []);

  // موسيقى الانتظار - لحن هادئ
  const playWaiting = useCallback(() => {
    stopAll();
    const ctx = getCtx();
    if (ctx.state === "suspended") ctx.resume();
    const notes = [261.63, 329.63, 392.00, 329.63, 261.63, 293.66, 349.23, 293.66];
    let time = ctx.currentTime;
    const playLoop = () => {
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(gainNodeRef.current!);
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, time + i * 0.4);
        gain.gain.linearRampToValueAtTime(0.3, time + i * 0.4 + 0.05);
        gain.gain.linearRampToValueAtTime(0, time + i * 0.4 + 0.35);
        osc.start(time + i * 0.4);
        osc.stop(time + i * 0.4 + 0.4);
        oscillatorsRef.current.push(osc);
      });
      time += notes.length * 0.4;
    };
    playLoop();
    const interval = setInterval(() => {
      if (!isPlayingRef.current) { clearInterval(interval); return; }
      playLoop();
    }, notes.length * 400);
    isPlayingRef.current = true;
    return () => clearInterval(interval);
  }, [getCtx, stopAll]);

  // موسيقى السؤال - إيقاع سريع ومثير
  const playQuestion = useCallback(() => {
    stopAll();
    const ctx = getCtx();
    if (ctx.state === "suspended") ctx.resume();
    isPlayingRef.current = true;

    // لحن رئيسي
    const melody = [523.25, 659.25, 783.99, 659.25, 523.25, 587.33, 698.46, 587.33];
    let time = ctx.currentTime;
    const playMelody = () => {
      melody.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(gainNodeRef.current!);
        osc.type = "square";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, time + i * 0.25);
        gain.gain.linearRampToValueAtTime(0.15, time + i * 0.25 + 0.02);
        gain.gain.linearRampToValueAtTime(0, time + i * 0.25 + 0.22);
        osc.start(time + i * 0.25);
        osc.stop(time + i * 0.25 + 0.25);
        oscillatorsRef.current.push(osc);
      });
      time += melody.length * 0.25;
    };
    playMelody();
    const interval = setInterval(() => {
      if (!isPlayingRef.current) { clearInterval(interval); return; }
      playMelody();
    }, melody.length * 250);
    return () => clearInterval(interval);
  }, [getCtx, stopAll]);

  // موسيقى العد التنازلي الأخير (5 ثوانٍ)
  const playUrgent = useCallback(() => {
    stopAll();
    const ctx = getCtx();
    if (ctx.state === "suspended") ctx.resume();
    isPlayingRef.current = true;
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
  }, [getCtx, stopAll]);

  // صوت الإجابة الصحيحة
  const playCorrect = useCallback(() => {
    stopAll();
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
  }, [getCtx, stopAll]);

  // صوت الإجابة الخاطئة
  const playWrong = useCallback(() => {
    stopAll();
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
  }, [getCtx, stopAll]);

  // موسيقى لوحة المراكز
  const playLeaderboard = useCallback(() => {
    stopAll();
    const ctx = getCtx();
    if (ctx.state === "suspended") ctx.resume();
    isPlayingRef.current = true;
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
