"use client";

/**
 * useVoiceCommand — real press-to-talk dictation built on the browser
 * Web Speech API (SpeechRecognition / webkitSpeechRecognition).
 *
 * No simulated transcripts: when the browser has no speech engine the hook
 * reports `supported: false` and `start()` sets an honest Thai error instead
 * of inventing text.
 *
 * Flow: press mic → `start()` → interim results stream in → press mic again
 * (or wait for the silence timeout) → `stop()` → the full final transcript is
 * delivered once through `onFinal`.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceLang = "th-TH" | "en-US";

export type UseVoiceCommandOptions = {
  /** Recognition language. Defaults to Thai. */
  lang?: VoiceLang;
  /** Called once with the complete transcript after the user stops talking. */
  onFinal?: (text: string) => void;
  /** Hard cap on a single dictation session (ms). Default 45s. */
  maxDurationMs?: number;
};

export type VoiceCommand = {
  supported: boolean;
  listening: boolean;
  /** Finalised text accumulated in the current session. */
  transcript: string;
  /** Text the engine is still revising (shown live while talking). */
  interim: string;
  error: string | null;
  lang: VoiceLang;
  setLang: (lang: VoiceLang) => void;
  start: () => void;
  stop: () => void;
  clear: () => void;
};

/* -- minimal Web Speech API typings (not part of lib.dom) ---------------- */

type SpeechAlternative = { transcript: string; confidence: number };
type SpeechResult = {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: SpeechAlternative;
};
type SpeechResultList = { readonly length: number; readonly [index: number]: SpeechResult };
type SpeechResultEvent = { resultIndex: number; results: SpeechResultList };
type SpeechErrorEvent = { error: string; message?: string };

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

const ERROR_TEXT: Record<string, string> = {
  "not-allowed": "ไม่ได้รับสิทธิ์ใช้ไมโครโฟน — กรุณาอนุญาตไมค์ในเบราว์เซอร์",
  "service-not-allowed": "เบราว์เซอร์บล็อกบริการถอดเสียง (Speech Service)",
  "audio-capture": "ไม่พบไมโครโฟนในเครื่องนี้",
  "no-speech": "ไม่ได้ยินเสียง — ลองพูดอีกครั้ง",
  network: "เชื่อมต่อบริการถอดเสียงไม่สำเร็จ",
  "language-not-supported": "ภาษาที่เลือกยังไม่รองรับการถอดเสียง",
};

export const VOICE_UNSUPPORTED_MESSAGE = "เบราว์เซอร์นี้ไม่รองรับการสั่งงานด้วยเสียง";

export function useVoiceCommand(options: UseVoiceCommandOptions = {}): VoiceCommand {
  const { lang: initialLang = "th-TH", onFinal, maxDurationMs = 45000 } = options;

  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lang, setLangState] = useState<VoiceLang>(initialLang);

  const onFinalRef = useRef<((text: string) => void) | undefined>(onFinal);
  const langRef = useRef<VoiceLang>(initialLang);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  // Feature detection must run after mount so SSR markup matches.
  useEffect(() => {
    mountedRef.current = true;
    setSupported(Boolean(getRecognitionCtor()));
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      if (rec) {
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        try {
          rec.abort();
        } catch {
          /* already stopped */
        }
      }
    };
  }, []);

  const start = useCallback(() => {
    if (typeof window === "undefined") return;
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setSupported(false);
      setError(VOICE_UNSUPPORTED_MESSAGE);
      return;
    }

    // Drop any in-flight session without delivering its transcript.
    const previous = recognitionRef.current;
    if (previous) {
      previous.onresult = null;
      previous.onerror = null;
      previous.onend = null;
      try {
        previous.abort();
      } catch {
        /* already stopped */
      }
      recognitionRef.current = null;
    }

    finalRef.current = "";
    setTranscript("");
    setInterim("");
    setError(null);

    const rec = new Ctor();
    rec.lang = langRef.current;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      if (mountedRef.current) setListening(true);
    };

    rec.onresult = (event) => {
      let liveInterim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const piece = (result?.[0]?.transcript || "").trim();
        if (!piece) continue;
        if (result.isFinal) {
          finalRef.current = `${finalRef.current} ${piece}`.trim();
        } else {
          liveInterim = `${liveInterim} ${piece}`.trim();
        }
      }
      if (!mountedRef.current) return;
      setTranscript(finalRef.current);
      setInterim(liveInterim);
    };

    rec.onerror = (event) => {
      if (event.error === "aborted") return;
      if (!mountedRef.current) return;
      setError(ERROR_TEXT[event.error] || `ถอดเสียงไม่สำเร็จ (${event.error})`);
      setListening(false);
      setInterim("");
    };

    rec.onend = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (recognitionRef.current === rec) recognitionRef.current = null;
      if (!mountedRef.current) return;
      setListening(false);
      setInterim("");
      const text = finalRef.current.trim();
      if (text) onFinalRef.current?.(text);
    };

    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setError("เริ่มอัดเสียงไม่สำเร็จ — ลองกดไมค์อีกครั้ง");
      setListening(false);
      recognitionRef.current = null;
      return;
    }

    timerRef.current = setTimeout(() => {
      const current = recognitionRef.current;
      if (current) {
        try {
          current.stop();
        } catch {
          /* already stopped */
        }
      }
    }, maxDurationMs);
  }, [maxDurationMs]);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const rec = recognitionRef.current;
    if (!rec) {
      setListening(false);
      return;
    }
    try {
      rec.stop();
    } catch {
      /* already stopped */
    }
    setListening(false);
  }, []);

  const clear = useCallback(() => {
    setTranscript("");
    setInterim("");
    setError(null);
  }, []);

  const setLang = useCallback((next: VoiceLang) => {
    langRef.current = next;
    setLangState(next);
    // Changing language mid-session would confuse the engine: end the session.
    const rec = recognitionRef.current;
    if (rec) {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.abort();
      } catch {
        /* already stopped */
      }
      recognitionRef.current = null;
      setListening(false);
      setInterim("");
    }
  }, []);

  return { supported, listening, transcript, interim, error, lang, setLang, start, stop, clear };
}

export default useVoiceCommand;
