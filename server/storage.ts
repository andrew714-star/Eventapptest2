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
    const events = Array.from(this.events.values());
    console.log(`Storage: getAllEvents() returning ${events.length} events from ${this.events.size} stored events`);
    return events;
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

    // Location filter - support both single location and multiple locations
    const locations: string[] = [];
    if (filters.location && filters.location.trim() !== '') {
      locations.push(filters.location);
    }
    if (filters.locations && Array.isArray(filters.locations)) {
      locations.push(...filters.locations);
    }
    
    if (locations.length > 0) {
      events = events.filter(event => 
        locations.some(location => {
          const locationLower = location.toLowerCase();
          const eventLocationLower = event.location.toLowerCase();
          const eventOrganizerLower = event.organizer.toLowerCase();
          const eventSourceLower = event.source?.toLowerCase() || '';
          
          // More flexible matching for city names
          return eventLocationLower.includes(locationLower) ||
                 eventOrganizerLower.includes(locationLower) ||
                 eventSourceLower.includes(locationLower) ||
                 // Handle "City, State" format searches
                 (locationLower.includes(',') && (
                   eventLocationLower.includes(locationLower.split(',')[0].trim()) ||
                   eventOrganizerLower.includes(locationLower.split(',')[0].trim()) ||
                   eventSourceLower.includes(locationLower.split(',')[0].trim())
                 )) ||
                 // Handle single city name searches matching various formats
                 (!locationLower.includes(',') && (
                   eventLocationLower.includes(locationLower) ||
                   eventOrganizerLower.includes(locationLower) ||
                   eventSourceLower.includes(locationLower)
                 ));
        })
      );
      
      console.log(`Storage: Filtered events for locations [${locations.join(', ')}] - found ${events.length} matching events`);
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
    console.log(`Storage: Created event ${newEvent.title} (ID: ${id}). Total events: ${this.events.size}`);
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