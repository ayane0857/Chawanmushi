import { pgTable, serial, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
	id: serial("id").primaryKey(),
	minecraftuuid: uuid("minecraftuuid").notNull().unique(),
	email: text("email").notNull().unique(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const temp = pgTable("temp", {
	id: serial("id").primaryKey(),
	minecraftuuid: uuid("minecraftuuid").notNull(),
	code: text("code").notNull().unique(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	expiresAt: timestamp("expires_at").notNull(),
});
