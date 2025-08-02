import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  location: text("location").notNull(),
  organizer: text("organizer").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  startTime: varchar("start_time", { length: 10 }).notNull(),
  endTime: varchar("end_time", { length: 10 }).notNull(),
  attendees: integer("attendees").default(0),
  imageUrl: text("image_url"),
  isFree: text("is_free").default("true"),
  source: text("source").notNull(), // city website, school, community center, etc.
});

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
});

export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;

// Additional schemas for filtering
export const eventFilterSchema = z.object({
  search: z.string().optional(),
  categories: z.array(z.string()).optional(),
  location: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type EventFilter = z.infer<typeof eventFilterSchema>;

export const categories = [
  "Music & Concerts",
  "Sports & Recreation", 
  "Community & Social",
  "Education & Learning",
  "Arts & Culture",
  "Food & Dining",
  "Holiday",
  "Business & Networking",
  "Health & Wellness",
  "Family & Kids"
] as const;

export const locations = [
  "Downtown",
  "Midtown", 
  "Uptown",
  "Suburbs",
  "City Hall",
  "Community Center",
  "Parks",
  "Schools"
] as const;
