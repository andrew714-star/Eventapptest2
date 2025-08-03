import { type Event, type InsertEvent, type EventFilter } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getEvent(id: string): Promise<Event | undefined>;
  getAllEvents(): Promise<Event[]>;
  getFilteredEvents(filters: EventFilter): Promise<Event[]>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: string, event: Partial<InsertEvent>): Promise<Event | undefined>;
  deleteEvent(id: string): Promise<boolean>;
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
    const mockEvents: InsertEvent[] = [
      {
        title: "Holiday Market Opening",
        description: "Join us for the grand opening of our annual holiday market featuring local vendors, festive food, and holiday entertainment for the whole family.",
        category: "Community & Social",
        location: "Downtown Plaza",
        organizer: "City Parks Department",
        startDate: new Date("2024-12-10T09:00:00"),
        endDate: new Date("2024-12-10T18:00:00"),
        startTime: "9:00 AM",
        endTime: "6:00 PM",
        attendees: 234,
        imageUrl: "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?ixlib=rb-4.0.3",
        isFree: "true",
        source: "city-website"
      },
      {
        title: "Holiday Tree Lighting Ceremony",
        description: "Annual tree lighting ceremony with carolers, hot cocoa, and a special appearance by Santa Claus. Family-friendly event with activities for children.",
        category: "Holiday",
        location: "City Hall Square",
        organizer: "Mayor's Office",
        startDate: new Date("2024-12-10T14:00:00"),
        endDate: new Date("2024-12-10T16:00:00"),
        startTime: "2:00 PM",
        endTime: "4:00 PM",
        attendees: 456,
        imageUrl: "https://images.unsplash.com/photo-1544962503-4f6aebb8ecda?ixlib=rb-4.0.3",
        isFree: "true",
        source: "city-website"
      },
      {
        title: "Winter Jazz Concert",
        description: "Enjoy an evening of smooth jazz featuring the City Jazz Ensemble. Warm beverages and light refreshments available for purchase.",
        category: "Music & Concerts",
        location: "Community Center Auditorium",
        organizer: "Community Arts Center",
        startDate: new Date("2024-12-10T18:30:00"),
        endDate: new Date("2024-12-10T21:00:00"),
        startTime: "6:30 PM",
        endTime: "9:00 PM",
        attendees: 89,
        imageUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?ixlib=rb-4.0.3",
        isFree: "false",
        source: "community-center"
      },
      {
        title: "Winter Festival",
        description: "Celebrate winter with ice sculptures, hot chocolate, and winter activities for all ages.",
        category: "Community & Social",
        location: "Central Park",
        organizer: "Parks & Recreation",
        startDate: new Date("2024-12-01T10:00:00"),
        endDate: new Date("2024-12-01T20:00:00"),
        startTime: "10:00 AM",
        endTime: "8:00 PM",
        attendees: 312,
        imageUrl: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?ixlib=rb-4.0.3",
        isFree: "true",
        source: "city-website"
      },
      {
        title: "Yoga Class",
        description: "Morning yoga session for all skill levels. Bring your own mat or rent one at the venue.",
        category: "Health & Wellness",
        location: "Community Center",
        organizer: "Wellness Center",
        startDate: new Date("2024-12-03T07:00:00"),
        endDate: new Date("2024-12-03T08:00:00"),
        startTime: "7:00 AM",
        endTime: "8:00 AM",
        attendees: 25,
        imageUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3",
        isFree: "false",
        source: "wellness-center"
      },
      {
        title: "Art Workshop",
        description: "Learn watercolor painting techniques with local artist Maria Santos. All materials provided.",
        category: "Arts & Culture",
        location: "Art Studio Downtown",
        organizer: "Downtown Art Collective",
        startDate: new Date("2024-12-03T14:00:00"),
        endDate: new Date("2024-12-03T16:00:00"),
        startTime: "2:00 PM",
        endTime: "4:00 PM",
        attendees: 18,
        imageUrl: "https://images.unsplash.com/photo-1541961017774-22349e4a1262?ixlib=rb-4.0.3",
        isFree: "false",
        source: "art-collective"
      }
    ];

    mockEvents.forEach(event => {
      const id = randomUUID();
      this.events.set(id, { 
        ...event, 
        id,
        attendees: event.attendees ?? 0,
        imageUrl: event.imageUrl ?? null,
        isFree: event.isFree ?? "true"
      });
    });
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

    return events;
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const id = randomUUID();
    const event: Event = { 
      ...insertEvent, 
      id,
      attendees: insertEvent.attendees ?? 0,
      imageUrl: insertEvent.imageUrl ?? null,
      isFree: insertEvent.isFree ?? "true"
    };
    this.events.set(id, event);
    return event;
  }

  async updateEvent(id: string, updateData: Partial<InsertEvent>): Promise<Event | undefined> {
    const event = this.events.get(id);
    if (!event) return undefined;

    const updatedEvent = { ...event, ...updateData };
    this.events.set(id, updatedEvent);
    return updatedEvent;
  }

  async deleteEvent(id: string): Promise<boolean> {
    return this.events.delete(id);
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
    return Array.from(this.events.values()).filter(event => event.category === category);
  }
}

export const storage = new MemStorage();
