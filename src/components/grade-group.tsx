"use client";
import { useState } from "react";

type Opt = { id: number; name: string };
type GroupOpt = Opt & { gradeId: number };

/** Grade select plus a group select that only offers the chosen grade's groups. */
export default function GradeGroupFields({ grades, groups, grade, group, labels, stacked = false }: {
  grades: Opt[]; groups: GroupOpt[]; grade?: number | null; group?: number | null;
  labels: { grade: string; group: string; none: string; empty: string }; stacked?: boolean;
}) {
  const [g, setG] = useState<number>(grade ?? grades[0]?.id ?? 0);
  const [gr, setGr] = useState<number | "">(group ?? "");
  const mine = groups.filter((x) => x.gradeId === g);
  return (
    <div className={stacked ? "space-y-3" : "grid grid-cols-2 gap-3"}>
      <div>
        <label className="label">{labels.grade}</label>
        <select name="grade" className="input" required value={g}
          onChange={(e) => { const v = Number(e.target.value); setG(v); if (!groups.some((x) => x.id === gr && x.gradeId === v)) setGr(""); }}>
          {grades.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">{labels.group}</label>
        <select name="group" className="input" value={gr} onChange={(e) => setGr(e.target.value ? Number(e.target.value) : "")}>
          <option value="">{mine.length ? labels.none : labels.empty}</option>
          {mine.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </div>
    </div>
  );
}
