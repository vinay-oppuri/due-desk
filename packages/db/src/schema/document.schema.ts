import { date, index, integer, pgTable, text } from "drizzle-orm/pg-core";
import { timestamps } from "./common.js";
import { organizations } from "./organization.schema.js";
import { filings } from "./filing.schema.js";
import { user } from "./user.schema.js";

export const documents = pgTable(
  "documents",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    filingId: text("filing_id").references(() => filings.id, { onDelete: "cascade" }),
    r2Key: text("r2_key").notNull(),
    checksum: text("checksum"),
    fileSize: integer("file_size"),
    mimeType: text("mime_type"),
    uploadedBy: text("uploaded_by").references(() => user.id, { onDelete: "set null" }),
    retainUntil: date("retain_until"),
    ...timestamps,
  },
  (table) => [
    index("documents_filing_idx").on(table.filingId),
    index("documents_organization_idx").on(table.organizationId),
  ]
);
