import {index,integer,pgTable,serial,timestamp,varchar} from "drizzle-orm/pg-core";
export const aiInferenceMetricsTable=pgTable("ai_inference_metrics",{
 id:serial("id").primaryKey(),
 operation:varchar("operation",{length:40}).notNull(),
 provider:varchar("provider",{length:24}).notNull(),
 model:varchar("model",{length:120}).notNull(),
 outcome:varchar("outcome",{length:20}).notNull(),
 durationMs:integer("duration_ms").notNull(),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[index("ai_inference_metrics_created_idx").on(t.createdAt)]);
