import { db } from "./db";
import { transactions, type Transaction } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  createTransaction(transaction: {
    email: string;
    amount: number;
    reference: string;
    method: string;
    name?: string;
    message?: string;
  }): Promise<Transaction>;
  getTransactionByReference(reference: string): Promise<Transaction | undefined>;
  updateTransactionStatus(reference: string, status: string): Promise<Transaction | undefined>;
}

export class DatabaseStorage implements IStorage {
  async createTransaction(transaction: {
    email: string;
    amount: number;
    reference: string;
    method: string;
    name?: string;
    message?: string;
  }): Promise<Transaction> {
    const [newTransaction] = await db.insert(transactions).values(transaction).returning();
    return newTransaction;
  }

  async getTransactionByReference(reference: string): Promise<Transaction | undefined> {
    const [transaction] = await db.select().from(transactions).where(eq(transactions.reference, reference));
    return transaction;
  }

  async updateTransactionStatus(reference: string, status: string): Promise<Transaction | undefined> {
    const [updated] = await db.update(transactions)
      .set({ status })
      .where(eq(transactions.reference, reference))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
