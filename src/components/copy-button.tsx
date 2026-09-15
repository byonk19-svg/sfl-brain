"use client";
import { useState } from "react";
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [message, setMessage] = useState("");
  return <><button className="text-button" type="button" onClick={async () => { try { await navigator.clipboard.writeText(value); setMessage("Copied"); } catch { setMessage("Copy unavailable — select the text instead."); } }}>{label}</button><span className="copy-feedback" role="status" aria-live="polite">{message}</span></>;
}
