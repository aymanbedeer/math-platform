import { sql, type AnyColumn } from "drizzle-orm";

const TZ = process.env.APP_TIMEZONE || "Africa/Cairo";

/** A timestamp column as a YYYY-MM-DD date in the teacher's time zone. */
export function localDate(col: AnyColumn) {
  return sql<string>`to_char(${col} at time zone ${TZ}, 'YYYY-MM-DD')`;
}
