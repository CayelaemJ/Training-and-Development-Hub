import {check,index,integer,pgTable,real,serial,timestamp,uniqueIndex,varchar} from "drizzle-orm/pg-core";
import {sql} from "drizzle-orm";
export const aiInferenceMetricsTable=pgTable("ai_inference_metrics",{
 id:serial("id").primaryKey(),
 operation:varchar("operation",{length:40}).notNull(),
 provider:varchar("provider",{length:24}).notNull(),
 model:varchar("model",{length:120}).notNull(),
 outcome:varchar("outcome",{length:20}).notNull(),
 durationMs:integer("duration_ms").notNull(),
 inputTokens:integer("input_tokens"),
 outputTokens:integer("output_tokens"),
 estimatedCostUsd:real("estimated_cost_usd"),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},t=>[
 index("ai_inference_metrics_created_idx").on(t.createdAt),
 check("ai_inference_metrics_token_check",sql`${t.inputTokens} is null or ${t.inputTokens} between 0 and 1000000`),
 check("ai_inference_metrics_output_token_check",sql`${t.outputTokens} is null or ${t.outputTokens} between 0 and 1000000`),
 check("ai_inference_metrics_cost_check",sql`${t.estimatedCostUsd} is null or ${t.estimatedCostUsd} between 0 and 1000`),
]);

export const clientPlatformHeartbeatsTable=pgTable("client_platform_heartbeats",{
 id:serial("id").primaryKey(),
 platform:varchar("platform",{length:16}).notNull(),
 version:varchar("version",{length:40}).notNull(),
 lastSeenAt:timestamp("last_seen_at",{withTimezone:true}).notNull().defaultNow(),
 lastHttpStatus:integer("last_http_status").notNull().default(200),
},t=>[
 uniqueIndex("client_platform_heartbeats_platform_version_unique").on(t.platform,t.version),
 index("client_platform_heartbeats_last_seen_idx").on(t.platform,t.lastSeenAt),
 check("client_platform_heartbeats_platform_check",sql`${t.platform} in ('web','ios','android','windows')`),
 check("client_platform_heartbeats_http_status_check",sql`${t.lastHttpStatus} between 100 and 599`),
]);
