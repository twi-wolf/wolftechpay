import { pgTable, text, serial, integer, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  amount: integer("amount").notNull(),
  reference: varchar("reference", { length: 255 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
  status: true,
  reference: true
});

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;
