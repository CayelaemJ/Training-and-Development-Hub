import { customType,pgTable,text,timestamp,varchar } from "drizzle-orm/pg-core";
import {usersTable} from "./auth";
const bytea=customType<{data:Buffer;driverData:Buffer}>({dataType:()=>"bytea"});
/** Isolated Railway fallback. Real deployments should use private S3-compatible object storage. */
export const materialUploadBlobsTable=pgTable("material_upload_blobs",{
 objectPath:text("object_path").primaryKey(),
 userId:varchar("user_id").notNull().references(()=>usersTable.id,{onDelete:"cascade"}),
 bytes:bytea("bytes").notNull(),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
});
