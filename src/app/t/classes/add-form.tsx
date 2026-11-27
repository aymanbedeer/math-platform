"use client";
import { useActionState } from "react";
import { SubmitButton } from "@/components/client";
import type { ClassMsg } from "@/app/actions/classes";

export default function AddForm({ action, placeholder, button, hidden }: {
  action: (s: ClassMsg, f: FormData) => Promise<ClassMsg>; placeholder: string; button: string; hidden?: Record<string, string | number>;
}) {
  const [state, run] = useActionState(action, undefined);
  return (
    <form action={run} className="space-y-2" key={state?.ok}>
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <div className="flex gap-2">
        <input name="name" className="input min-w-0 flex-1" placeholder={placeholder} required maxLength={60} />
        <SubmitButton className="btn-light whitespace-nowrap">{button}</SubmitButton>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-700">{state.ok}</p>}
    </form>
  );
}
