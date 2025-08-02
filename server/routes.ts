import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { eventFilterSchema, insertEventSchema } from "@shared/schema";
import { dataCollector } from "./data-collector";
import { calendarCollector } from "./calendar-collector";
import { feedDiscoverer } from "./location-feed-discoverer";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get all events
  app.get("/api/events", async (req, res) => {
    try {
      const events = await storage.getAllEvents();
      res.json(events);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  // Get filtered events
  app.post("/api/events/filter", async (req, res) => {
    try {
      const filters = eventFilterSchema.parse(req.body);
      const events = await storage.getFilteredEvents(filters);
      res.json(events);
    } catch (error) {
      res.status(400).json({ message: "Invalid filter parameters" });
    }
  });

  // Get events by date range
  app.get("/api/events/date-range", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        res.status(400).json({ message: "Start date and end date are required" });
        return;
      }

      const events = await storage.getEventsByDateRange(startDate as string, endDate as string);
      res.json(events);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch events by date range" });
    }
  });

  // Get events by category
  app.get("/api/events/category/:category", async (req, res) => {
    try {
      const { category } = req.params;
      const events = await storage.getEventsByCategory(category);
      res.json(events);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch events by category" });
    }
  });

  // Get single event
  app.get("/api/events/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const event = await storage.getEvent(id);
      
      if (!event) {
        res.status(404).json({ message: "Event not found" });
        return;
      }

      res.json(event);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch event" });
    }
  });

  // Create new event
  app.post("/api/events", async (req, res) => {
    try {
      const eventData = insertEventSchema.parse(req.body);
      const event = await storage.createEvent(eventData);
      res.status(201).json(event);
    } catch (error) {
      res.status(400).json({ message: "Invalid event data" });
    }
  });

  // Update event
  app.patch("/api/events/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = insertEventSchema.partial().parse(req.body);
      const event = await storage.updateEvent(id, updateData);
      
      if (!event) {
        res.status(404).json({ message: "Event not found" });
        return;
      }

      res.json(event);
    } catch (error) {
      res.status(400).json({ message: "Invalid update data" });
    }
  });

  // Delete event
  app.delete("/api/events/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteEvent(id);
      
      if (!deleted) {
        res.status(404).json({ message: "Event not found" });
        return;
      }

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete event" });
    }
  });

  // Data collection routes
  app.get("/api/data-sources", async (req, res) => {
    try {
      const sources = dataCollector.getSources();
      res.json({
        sources,
        activeCount: dataCollector.getActiveSourcesCount(),
        totalCount: sources.length
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch data sources" });
    }
  });

  app.post("/api/data-sources/:id/toggle", async (req, res) => {
    try {
      const { id } = req.params;
      const isActive = dataCollector.toggleSource(id);
      res.json({ sourceId: id, isActive });
    } catch (error) {
      res.status(500).json({ message: "Failed to toggle data source" });
    }
  });

  app.post("/api/sync-events", async (req, res) => {
    try {
      console.log("Starting event synchronization from all sources...");
      const syncedCount = await dataCollector.syncEventsToStorage();
      res.json({ 
        message: "Event synchronization completed",
        syncedCount,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Event sync failed:", error);
      res.status(500).json({ message: "Failed to sync events" });
    }
  });

  // Calendar feed sources management
  app.get("/api/calendar-sources", async (req, res) => {
    try {
      const sources = calendarCollector.getSources();
      const activeSources = sources.filter(s => s.isActive);
      
      res.json({
        sources,
        activeCount: activeSources.length,
        totalCount: sources.length,
        states: Array.from(new Set(sources.map(s => s.state))).sort(),
        cities: Array.from(new Set(sources.map(s => s.city))).sort(),
        types: Array.from(new Set(sources.map(s => s.type))).sort()
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch calendar sources" });
    }
  });

  app.get("/api/calendar-sources/by-state/:state", async (req, res) => {
    try {
      const { state } = req.params;
      const sources = calendarCollector.getSourcesByState(state.toUpperCase());
      res.json(sources);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sources by state" });
    }
  });

  app.get("/api/calendar-sources/by-type/:type", async (req, res) => {
    try {
      const { type } = req.params;
      const sources = calendarCollector.getSourcesByType(type);
      res.json(sources);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sources by type" });
    }
  });

  app.post("/api/calendar-sources/:id/toggle", async (req, res) => {
    try {
      const { id } = req.params;
      const isActive = calendarCollector.toggleSource(id);
      res.json({ sourceId: id, isActive });
    } catch (error) {
      res.status(500).json({ message: "Failed to toggle calendar source" });
    }
  });

  // Location-based feed discovery
  app.post("/api/discover-feeds", async (req, res) => {
    try {
      const { city, state } = req.body;
      
      if (!city || !state) {
        res.status(400).json({ message: "City and state are required" });
        return;
      }

      console.log(`Discovering feeds for ${city}, ${state}...`);
      const discoveredFeeds = await feedDiscoverer.discoverFeedsForPopularLocation(city, state);
      
      res.json({
        location: { city, state },
        discoveredFeeds: discoveredFeeds.map(df => ({
          source: df.source,
          confidence: df.confidence,
          lastChecked: df.lastChecked
        })),
        count: discoveredFeeds.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Feed discovery failed:", error);
      res.status(500).json({ message: "Failed to discover feeds for location" });
    }
  });

  app.post("/api/add-discovered-feed", async (req, res) => {
    try {
      const { source } = req.body;
      
      if (!source || !source.feedUrl) {
        res.status(400).json({ message: "Valid source with feedUrl is required" });
        return;
      }

      // Add the discovered source to the calendar collector
      const success = calendarCollector.addSource(source);
      
      if (success) {
        res.json({ 
          message: "Feed added successfully",
          sourceId: source.id,
          isActive: source.isActive
        });
      } else {
        res.status(400).json({ message: "Failed to add feed - may already exist" });
      }
    } catch (error) {
      console.error("Failed to add discovered feed:", error);
      res.status(500).json({ message: "Failed to add discovered feed" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
