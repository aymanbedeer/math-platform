// Shared by server and client components (no server-only imports here).
export type Kind = "single" | "multi" | "truefalse" | "short" | "essay" | "file";

export const KIND_LABEL: Record<Kind, string> = {
  single: "اختيار من متعدد (إجابة واحدة)",
  multi: "اختيار من متعدد (أكثر من إجابة)",
  truefalse: "صح أم خطأ",
  short: "إجابة قصيرة",
  essay: "سؤال مقالي",
  file: "رفع ملف (واجب)",
};
