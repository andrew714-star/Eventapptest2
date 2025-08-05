import { type Event, type InsertEvent, type EventFilter } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getEvent(id: string): Promise<Event | undefined>;
  getAllEvents(): Promise<Event[]>;
  getFilteredEvents(filters: EventFilter): Promise<Event[]>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: string, event: Partial<InsertEvent>): Promise<Event | undefined>;
  deleteEvent(id: string): Promise<boolean>;
  clearAllEvents(): Promise<void>;
  getEventsByDateRange(startDate: string, endDate: string): Promise<Event[]>;
  getEventsByCategory(category: string): Promise<Event[]>;
}

export class MemStorage implements IStorage {
  private events: Map<string, Event>;

  constructor() {
    this.events = new Map();
    this.seedInitialData();
  }

  private seedInitialData() {
    // NO SYNTHETIC DATA - Start with empty storage for authentic data only
    console.log('Storage initialized - awaiting authentic calendar feed data only');
    // Events will come from authentic calendar feeds only
  }

  async getEvent(id: string): Promise<Event | undefined> {
    return this.events.get(id);
  }

  async getAllEvents(): Promise<Event[]> {
    return Array.from(this.events.values());
  }

  async getFilteredEvents(filters: EventFilter): Promise<Event[]> {
    let events = Array.from(this.events.values());

    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      events = events.filter(event => 
        event.title.toLowerCase().includes(searchTerm) ||
        event.description.toLowerCase().includes(searchTerm) ||
        event.location.toLowerCase().includes(searchTerm) ||
        event.organizer.toLowerCase().includes(searchTerm)
      );
    }

    if (filters.categories && filters.categories.length > 0) {
      events = events.filter(event => filters.categories!.includes(event.category));
    }

    if (filters.location) {
      events = events.filter(event => 
        event.location.toLowerCase().includes(filters.location!.toLowerCase()) ||
        event.organizer.toLowerCase().includes(filters.location!.toLowerCase())
      );
    }

    if (filters.startDate) {
      const startDate = new Date(filters.startDate);
      events = events.filter(event => new Date(event.startDate) >= startDate);
    }

    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      events = events.filter(event => new Date(event.startDate) <= endDate);
    }

    if (filters.isFree !== undefined) {
      events = events.filter(event => event.isFree === filters.isFree);
    }

    return events;
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const id = randomUUID();
    const newEvent: Event = { 
      ...event, 
      id,
      attendees: event.attendees ?? 0,
      imageUrl: event.imageUrl ?? null,
      isFree: event.isFree ?? "true"
    };
    this.events.set(id, newEvent);
    return newEvent;
  }

  async updateEvent(id: string, eventData: Partial<InsertEvent>): Promise<Event | undefined> {
    const existingEvent = this.events.get(id);
    if (!existingEvent) return undefined;

    const updatedEvent: Event = { 
      ...existingEvent, 
      ...eventData,
      id // Preserve the original ID
    };
    this.events.set(id, updatedEvent);
    return updatedEvent;
  }

  async deleteEvent(id: string): Promise<boolean> {
    return this.events.delete(id);
  }

  async clearAllEvents(): Promise<void> {
    this.events.clear();
    console.log('All events cleared from storage');
  }

  async getEventsByDateRange(startDate: string, endDate: string): Promise<Event[]> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    return Array.from(this.events.values()).filter(event => {
      const eventDate = new Date(event.startDate);
      return eventDate >= start && eventDate <= end;
    });
  }

  async getEventsByCategory(category: string): Promise<Event[]> {
    return Array.from(this.events.values()).filter(event => 
      event.category === category
    );
  }
}

export const storage = new MemStorage();