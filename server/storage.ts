import { type Event, type InsertEvent, type EventFilter, type City, type CitySearch } from "@shared/schema";
import { randomUUID } from "crypto";
import { CityDataLoader } from "./city-data-loader";

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
  
  // City methods
  searchCities(search: CitySearch): Promise<City[]>;
  getCityByGeoid(geoid: string): Promise<City | undefined>;
  getCityByName(cityName: string, state?: string): Promise<City | undefined>;
  getAllCities(): Promise<City[]>;
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

  // City methods
  async searchCities(search: CitySearch): Promise<City[]> {
    const cities = await CityDataLoader.loadCities();
    const query = search.query.toLowerCase();
    
    let results = Array.from(cities.values()).filter(city => {
      const matchesName = city.municipality.toLowerCase().includes(query);
      const matchesState = city.state.toLowerCase().includes(query);
      return matchesName || matchesState;
    });

    // Filter by state if specified
    if (search.state) {
      const stateFilter = search.state.toLowerCase();
      results = results.filter(city => city.state.toLowerCase().includes(stateFilter));
    }

    // Filter by website requirement if specified
    if (search.websiteRequired) {
      results = results.filter(city => city.websiteAvailable === 1 && city.websiteUrl);
    }

    // Limit results and prioritize exact matches
    return results
      .sort((a, b) => {
        const aExact = a.municipality.toLowerCase() === query;
        const bExact = b.municipality.toLowerCase() === query;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        return a.municipality.localeCompare(b.municipality);
      })
      .slice(0, 50); // Limit to 50 results
  }

  async getCityByGeoid(geoid: string): Promise<City | undefined> {
    const cities = await CityDataLoader.loadCities();
    return cities.get(geoid);
  }

  async getCityByName(cityName: string, state?: string): Promise<City | undefined> {
    const cities = await CityDataLoader.loadCities();
    const query = cityName.toLowerCase();
    
    // Find cities that match the name
    const matchingCities = Array.from(cities.values()).filter(city => {
      const municipalityMatch = city.municipality.toLowerCase() === query;
      const stateMatch = !state || city.state.toLowerCase() === state.toLowerCase();
      return municipalityMatch && stateMatch;
    });

    // If we have an exact match with state preference, return it
    if (matchingCities.length === 1) {
      return matchingCities[0];
    }

    // If multiple matches, prioritize based on state filter or return first exact match
    if (matchingCities.length > 1) {
      if (state) {
        const stateFiltered = matchingCities.filter(city => 
          city.state.toLowerCase() === state.toLowerCase()
        );
        if (stateFiltered.length > 0) {
          return stateFiltered[0];
        }
      }
      return matchingCities[0]; // Return first match if no state preference
    }

    // If no exact match, try partial matching
    const partialMatches = Array.from(cities.values()).filter(city => {
      const municipalityPartial = city.municipality.toLowerCase().includes(query);
      const stateMatch = !state || city.state.toLowerCase() === state.toLowerCase();
      return municipalityPartial && stateMatch;
    });

    if (partialMatches.length > 0) {
      // Sort by closest match (shortest municipality name that contains the query)
      partialMatches.sort((a, b) => a.municipality.length - b.municipality.length);
      return partialMatches[0];
    }

    return undefined;
  }

  async getAllCities(): Promise<City[]> {
    const cities = await CityDataLoader.loadCities();
    return Array.from(cities.values());
  }
}

export const storage = new MemStorage();