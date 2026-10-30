"use client";
import React, { useRef, useState } from "react";

type Props = {
  onSend: (text: string, files?: File[]) => void;
  onHandoff: () => void;
  disabled?: boolean;
};

export function ChatInput({ onSend, onHandoff, disabled }: Props) {
  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (!text.trim() && files.length === 0) return;
    onSend(text.trim(), files);
    setText("");
    setFiles([]);
  };

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      // mock transcription
      setText((t) => t + (t ? " " : "") + "\u0e2a\u0e23\u0e49\u0e32\u0e07\u0e23\u0e32\u0e22\u0e07\u0e32\u0e19\u0e2a\u0e23\u0e38\u0e1b\u0e22\u0e2d\u0e14\u0e02\u0e32\u0e22 Q3 \u0e43\u0e2b\u0e49\u0e2b\u0e19\u0e48\u0e2d\u0e22");
    } else {
      setIsRecording(true);
      setTimeout(() => setIsRecording(false), 3000);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(Array.from(e.target.files));
  };

  return (
    <div style={{ background: "#fff", borderTop: "1px solid #e5e7eb", padding: 12 }}>
      {files.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          {files.map((f, i) => (
            <span key={i} style={{ background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 8, padding: "4px 8px", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
              \uD83D\uDCCE {f.name} <button onClick={() => setFiles(files.filter((_, idx) => idx !== i))} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 12 }}>\u2715</button>
            </span>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <button onClick={() => fileRef.current?.click()} style={{ width: 36, height: 36, borderRadius: 999, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", fontSize: 14 }} title="\u0e2d\u0e31\u0e1b\u0e42\u0e2b\u0e25\u0e14\u0e44\u0e1f\u0e25\u0e4c">\uD83D\uDCCE</button>
        <input ref={fileRef} type="file" multiple style={{ display: "none" }} onChange={handleFileChange} accept=".pdf,.docx,.xlsx,.pptx,.png,.jpg,.jpeg,.csv,.txt" />

        <div style={{ flex: 1, position: "relative" }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="\u0e1e\u0e34\u0e21\u0e1e\u0e4c\u0e02\u0e49\u0e2d\u0e04\u0e27\u0e32\u0e21 \u0e2b\u0e23\u0e37\u0e2d\u0e2a\u0e31\u0e48\u0e07\u0e07\u0e32\u0e19 Work... (Shift+Enter \u0e02\u0e36\u0e49\u0e19\u0e1a\u0e23\u0e23\u0e17\u0e31\u0e14\u0e43\u0e2b\u0e21\u0e48)"
            rows={1}
            style={{ width: "100%", minHeight: 36, maxHeight: 100, resize: "none", border: "1px solid #e5e7eb", borderRadius: 16, padding: "9px 40px 9px 14px", fontSize: 14, outline: "none", fontFamily: "inherit" }}
          />
          <span style={{ position: "absolute", right: 8, bottom: 6, fontSize: 10, color: "#9ca3af" }}>{text.length}/2000</span>
        </div>

        <button
          onClick={toggleRecording}
          style={{
            width: 36, height: 36, borderRadius: 999, border: "1px solid " + (isRecording ? "#fecaca" : "#e5e7eb"),
            background: isRecording ? "#fef2f2" : "#fff", cursor: "pointer", fontSize: 14, color: isRecording ? "#dc2626" : "#374151"
          }}
          title="Voice input (stub)"
        >
          {isRecording ? "\u25CF" : "\uD83C\uDFA4"}
        </button>

        <button
          onClick={handleSend}
          disabled={disabled || (!text.trim() && files.length === 0)}
          style={{
            width: 36, height: 36, borderRadius: 999, border: "none",
            background: (!text.trim() && files.length === 0) ? "#e5e7eb" : "#0d0d0d",
            color: "#fff", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center"
          }}
        >
          \u2191
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={onHandoff} style={{ background: "#1757d7", color: "#fff", border: "none", borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          \u2197 Handoff \u2192 Work
        </button>
        <span style={{ fontSize: 11, color: "#9ca3af" }}>\u0e2a\u0e48\u0e07\u0e07\u0e32\u0e19\u0e2b\u0e19\u0e31\u0e01\u0e44\u0e1b Work \u2022 \u0e21\u0e35 Estimate \u0e01\u0e48\u0e2d\u0e19\u0e40\u0e23\u0e34\u0e48\u0e21 \u2022 \u0e41\u0e22\u0e01 ledger \u0e0a\u0e31\u0e14\u0e40\u0e08\u0e19</span>
        <span style={{ marginLeft: "auto", fontSize: 11, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#15803d", padding: "2px 8px", borderRadius: 999 }}>\u25CF Cloud Only \u2022 Always On</span>
      </div>
      {isRecording && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 6, height: 6, background: "#dc2626", borderRadius: 999, display: "inline-block", animation: "pulse 1s infinite" }} /> \u0e01\u0e33\u0e25\u0e31\u0e07\u0e1f\u0e31\u0e07... (stub \u2014 \u0e08\u0e30 transcribe \u0e40\u0e1b\u0e47\u0e19\u0e02\u0e49\u0e2d\u0e04\u0e27\u0e32\u0e21)</div>}
      <style>{`@keyframes pulse{0%{opacity:1}50%{opacity:.3}100%{opacity:1}}`}</style>
    </div>
  );
}
