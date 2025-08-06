import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { eventFilterSchema, insertEventSchema } from "@shared/schema";
import { dataCollector } from "./data-collector";
import { calendarCollector } from "./calendar-collector";
import { feedDiscoverer } from './location-feed-discoverer';
import { cityDiscoverer } from './us-cities-database';

export async function registerRoutes(app: Express): Promise<Server> {
  // Get all events
  app.get("/api/events", async (req, res) => {
    try {
      const events = await storage.getAllEvents();
      console.log(`API /api/events called - returning ${events.length} events`);
      res.json(events);
    } catch (error) {
      console.error("Error in /api/events:", error);
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  // Get filtered events
  app.post("/api/events/filter", async (req, res) => {
    try {
      const filters = eventFilterSchema.parse(req.body);
      console.log(`API /api/events/filter called with filters:`, filters);
      const events = await storage.getFilteredEvents(filters);
      console.log(`Returning ${events.length} filtered events`);
      res.json(events);
    } catch (error) {
      console.error("Error in /api/events/filter:", error);
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

  // Clear all events
  app.delete("/api/events", async (req, res) => {
    try {
      await storage.clearAllEvents();
      res.json({ message: "All events cleared successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to clear events" });
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

  // Congressional district routes
  app.get("/api/congressional-districts", async (req, res) => {
    try {
      // Generate comprehensive congressional districts for all 435 districts
      const allDistricts = generateAllCongressionalDistricts();

      const geoJsonData = {
        type: "FeatureCollection",
        features: allDistricts
      };

      res.json(geoJsonData);
    } catch (error) {
      console.error("Error generating congressional districts:", error);
      res.status(500).json({ message: "Failed to load congressional districts" });
    }
  });

  // Generate all 435 congressional districts with proper geographic distribution
  function generateAllCongressionalDistricts() {
    const districts = [];

    // State districts mapping (current 118th Congress)
    const stateDistricts: { [key: string]: { count: number; lat: number; lng: number; fips: string } } = {
      'AL': { count: 7, lat: 32.3617, lng: -86.2792, fips: '01' },
      'AK': { count: 1, lat: 64.0685, lng: -152.2782, fips: '02' },
      'AZ': { count: 9, lat: 34.2744, lng: -111.2847, fips: '04' },
      'AR': { count: 4, lat: 34.7519, lng: -92.1313, fips: '05' },
      'CA': { count: 52, lat: 36.7783, lng: -119.4179, fips: '06' },
      'CO': { count: 8, lat: 39.5501, lng: -105.7821, fips: '08' },
      'CT': { count: 5, lat: 41.6032, lng: -73.0877, fips: '09' },
      'DE': { count: 1, lat: 38.9108, lng: -75.5277, fips: '10' },
      'FL': { count: 28, lat: 27.7663, lng: -81.6868, fips: '12' },
      'GA': { count: 14, lat: 32.1656, lng: -82.9001, fips: '13' },
      'HI': { count: 2, lat: 19.8968, lng: -155.5828, fips: '15' },
      'ID': { count: 2, lat: 44.0682, lng: -114.7420, fips: '16' },
      'IL': { count: 17, lat: 40.6331, lng: -89.3985, fips: '17' },
      'IN': { count: 9, lat: 40.2731, lng: -86.1349, fips: '18' },
      'IA': { count: 4, lat: 41.8780, lng: -93.0977, fips: '19' },
      'KS': { count: 4, lat: 38.5266, lng: -96.7265, fips: '20' },
      'KY': { count: 6, lat: 37.8393, lng: -84.2700, fips: '21' },
      'LA': { count: 6, lat: 31.2448, lng: -92.1450, fips: '22' },
      'ME': { count: 2, lat: 45.2538, lng: -69.4455, fips: '23' },
      'MD': { count: 8, lat: 39.0458, lng: -76.6413, fips: '24' },
      'MA': { count: 9, lat: 42.4072, lng: -71.3824, fips: '25' },
      'MI': { count: 13, lat: 44.3148, lng: -85.6024, fips: '26' },
      'MN': { count: 8, lat: 46.7296, lng: -94.6859, fips: '27' },
      'MS': { count: 4, lat: 32.3547, lng: -89.3985, fips: '28' },
      'MO': { count: 8, lat: 37.9643, lng: -91.8318, fips: '29' },
      'MT': { count: 2, lat: 47.0527, lng: -109.6333, fips: '30' },
      'NE': { count: 3, lat: 41.4925, lng: -99.9018, fips: '31' },
      'NV': { count: 4, lat: 38.8026, lng: -116.4194, fips: '32' },
      'NH': { count: 2, lat: 43.1939, lng: -71.5724, fips: '33' },
      'NJ': { count: 12, lat: 40.0583, lng: -74.4057, fips: '34' },
      'NM': { count: 3, lat: 34.8405, lng: -106.2485, fips: '35' },
      'NY': { count: 26, lat: 42.1657, lng: -74.9481, fips: '36' },
      'NC': { count: 14, lat: 35.7596, lng: -79.0193, fips: '37' },
      'ND': { count: 1, lat: 47.5515, lng: -101.0020, fips: '38' },
      'OH': { count: 15, lat: 40.4173, lng: -82.9071, fips: '39' },
      'OK': { count: 5, lat: 35.0078, lng: -97.0929, fips: '40' },
      'OR': { count: 6, lat: 43.8041, lng: -120.5542, fips: '41' },
      'PA': { count: 17, lat: 41.2033, lng: -77.1945, fips: '42' },
      'RI': { count: 2, lat: 41.6809, lng: -71.5118, fips: '44' },
      'SC': { count: 7, lat: 33.8361, lng: -81.1637, fips: '45' },
      'SD': { count: 1, lat: 44.2998, lng: -99.4388, fips: '46' },
      'TN': { count: 9, lat: 35.7478, lng: -86.7923, fips: '47' },
      'TX': { count: 38, lat: 31.9686, lng: -99.9018, fips: '48' },
      'UT': { count: 4, lat: 39.3210, lng: -111.0937, fips: '49' },
      'VT': { count: 1, lat: 44.0409, lng: -72.7093, fips: '50' },
      'VA': { count: 11, lat: 37.7693, lng: -78.2057, fips: '51' },
      'WA': { count: 10, lat: 47.3511, lng: -121.5135, fips: '53' },
      'WV': { count: 2, lat: 38.4680, lng: -80.9696, fips: '54' },
      'WI': { count: 8, lat: 43.7844, lng: -88.7879, fips: '55' },
      'WY': { count: 1, lat: 42.7475, lng: -107.2085, fips: '56' }
    };

    // Generate districts for each state
    Object.entries(stateDistricts).forEach(([state, info]) => {
      for (let districtNum = 1; districtNum <= info.count; districtNum++) {
        // Create geographic spread for multiple districts in a state
        const latOffset = (districtNum % 3 - 1) * 0.5; // -0.5, 0, 0.5
        const lngOffset = (Math.floor((districtNum - 1) / 3) % 3 - 1) * 0.7; // Geographic spread

        const districtLat = info.lat + latOffset;
        const districtLng = info.lng + lngOffset;

        // Create realistic district boundaries (simplified rectangles)
        const boundarySize = 0.3; // Degrees

        districts.push({
          type: "Feature",
          properties: {
            CD118FP: districtNum.toString().padStart(2, '0'),
            STATEFP: info.fips,
            NAMELSAD: `Congressional District ${districtNum} (${state})`,
            state: state,
            district: districtNum,
            representative: `Representative District ${districtNum}`
          },
          geometry: {
            type: "Polygon",
            coordinates: [[
              [districtLng - boundarySize, districtLat - boundarySize],
              [districtLng + boundarySize, districtLat - boundarySize],
              [districtLng + boundarySize, districtLat + boundarySize],
              [districtLng - boundarySize, districtLat + boundarySize],
              [districtLng - boundarySize, districtLat - boundarySize]
            ]]
          }
        });
      }
    });

    console.log(`Generated ${districts.length} congressional districts`);
    return districts;
  }

  // Helper functions for district processing
  function getStateCenter(state: string): { lat: number; lng: number } | null {
    const stateCenters: { [key: string]: { lat: number; lng: number } } = {
      'CA': { lat: 36.7783, lng: -119.4179 },
      'TX': { lat: 31.9686, lng: -99.9018 },
      'NY': { lat: 40.7589, lng: -73.9851 },
      'FL': { lat: 27.6648, lng: -81.5158 },
      'IL': { lat: 40.6331, lng: -89.3985 },
      'PA': { lat: 41.2033, lng: -77.1945 },
      'OH': { lat: 40.4173, lng: -82.9071 },
      'GA': { lat: 32.1656, lng: -82.9001 },
      'NC': { lat: 35.7596, lng: -79.0193 },
      'MI': { lat: 44.3148, lng: -85.6024 }
    };
    return stateCenters[state] || null;
  }

  function getStateFips(state: string): string {
    const stateFips: { [key: string]: string } = {
      'AL': '01', 'AK': '02', 'AZ': '04', 'AR': '05', 'CA': '06', 'CO': '08', 'CT': '09',
      'DE': '10', 'DC': '11', 'FL': '12', 'GA': '13', 'HI': '15', 'ID': '16', 'IL': '17',
      'IN': '18', 'IA': '19', 'KS': '20', 'KY': '21', 'LA': '22', 'ME': '23', 'MD': '24',
      'MA': '25', 'MI': '26', 'MN': '27', 'MS': '28', 'MO': '29', 'MT': '30', 'NE': '31',
      'NV': '32', 'NH': '33', 'NJ': '34', 'NM': '35', 'NY': '36', 'NC': '37', 'ND': '38',
      'OH': '39', 'OK': '40', 'OR': '41', 'PA': '42', 'RI': '44', 'SC': '45', 'SD': '46',
      'TN': '47', 'TX': '48', 'UT': '49', 'VT': '50', 'VA': '51', 'WA': '53', 'WV': '54',
      'WI': '55', 'WY': '56'
    };
    return stateFips[state] || '00';
  }

  // Get cities within a congressional district
  app.post("/api/congressional-district/cities", async (req, res) => {
    try {
      const { district, state } = req.body;

      if (!district || !state) {
        return res.status(400).json({ message: "District and state are required" });
      }

      // Get cities within the district using reverse geocoding and boundary checking
      const cities = await cityDiscoverer.getCitiesInDistrict(state, district);

      res.json({
        district: `${state}-${district}`,
        cities,
        count: cities.length
      });
    } catch (error) {
      console.error("Error getting cities in district:", error);
      res.status(500).json({ message: "Failed to get cities in congressional district" });
    }
  });

  // Discover feeds for congressional district
  app.post("/api/congressional-district/discover-feeds", async (req, res) => {
    try {
      const { district, state } = req.body;

      if (!district || !state) {
        return res.status(400).json({ message: "District and state are required" });
      }

      console.log(`Discovering feeds for Congressional District ${state}-${district}...`);

      // Get all cities in the district
      const cities = await cityDiscoverer.getCitiesInDistrict(state, district);

      let totalDiscovered = 0;
      let totalAdded = 0;
      const results = [];

      // Discover feeds for each city in the district
      for (const city of cities) {
        try {
          const discoveredFeeds = await feedDiscoverer.discoverFeedsForPopularLocation(city.name, state);
          totalDiscovered += discoveredFeeds.length;

          // Auto-add discovered feeds
          for (const feed of discoveredFeeds) {
            const success = calendarCollector.addSource(feed.source);
            if (success) totalAdded++;
          }

          results.push({
            city: city.name,
            discovered: discoveredFeeds.length,
            feeds: discoveredFeeds.map(df => df.source)
          });
        } catch (error) {
          console.error(`Failed to discover feeds for ${city.name}, ${state}:`, error);
        }
      }

      res.json({
        district: `${state}-${district}`,
        citiesProcessed: cities.length,
        totalDiscovered,
        totalAdded,
        results
      });
    } catch (error) {
      console.error("Error discovering feeds for district:", error);
      res.status(500).json({ message: "Failed to discover feeds for congressional district" });
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

      // Add discovered feeds to the calendar collector automatically
      for (const discoveredFeed of discoveredFeeds) {
        try {
          const added = calendarCollector.addSource(discoveredFeed.source);
          console.log(`Auto-adding discovered feed: ${discoveredFeed.source.name} - Success: ${added}`);
          if (!added) {
            console.log(`Failed to add feed: ${discoveredFeed.source.name} - may already exist`);
          }
        } catch (error) {
          console.error(`Error adding discovered feed ${discoveredFeed.source.name}:`, error);
        }
      }

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
      console.error('Feed discovery error:', error);
      res.status(500).json({ message: "Failed to discover feeds" });
    }
  });

  // Comprehensive regional feed discovery
  app.post("/api/discover-regional-feeds", async (req, res) => {
    try {
      const { regions } = req.body;

      if (!regions || !Array.isArray(regions) || regions.length === 0) {
        res.status(400).json({ message: "Regions array is required" });
        return;
      }

      console.log(`Discovering feeds for ${regions.length} regions...`);
      const result = await feedDiscoverer.discoverFeedsForRegions({ regions });

      res.json({
        ...result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Regional feed discovery error:', error);
      res.status(500).json({ message: "Failed to discover regional feeds" });
    }
  });

  // Discover feeds for entire state
  app.post("/api/discover-state-feeds/:stateCode", async (req, res) => {
    try {
      const { stateCode } = req.params;
      const { populationRange, cityTypes, limit } = req.body;

      console.log(`Discovering feeds for state: ${stateCode}`);
      const result = await feedDiscoverer.discoverFeedsForState(stateCode, {
        populationRange,
        cityTypes,
        limit: limit || 50
      });

      res.json({
        state: stateCode,
        ...result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('State feed discovery error:', error);
      res.status(500).json({ message: "Failed to discover state feeds" });
    }
  });

  // Discover feeds by population range
  app.post("/api/discover-population-feeds", async (req, res) => {
    try {
      const { minPopulation, maxPopulation, limit } = req.body;

      if (!minPopulation) {
        res.status(400).json({ message: "minPopulation is required" });
        return;
      }

      console.log(`Discovering feeds for cities with population ${minPopulation} - ${maxPopulation || 'unlimited'}`);
      const result = await feedDiscoverer.discoverFeedsByPopulation(
        minPopulation, 
        maxPopulation, 
        limit || 100
      );

      res.json({
        populationRange: { min: minPopulation, max: maxPopulation || 'unlimited' },
        ...result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Population-based discovery error:', error);
      res.status(500).json({ message: "Failed to discover feeds by population" });
    }
  });

  // Get city suggestions for autocomplete
  app.get("/api/city-suggestions", async (req, res) => {
    try {
      const { q: query, limit } = req.query;

      if (!query || typeof query !== 'string') {
        res.status(400).json({ message: "Query parameter 'q' is required" });
        return;
      }

      const suggestions = feedDiscoverer.getCitySuggestions(query, parseInt(limit as string) || 20);

      res.json({
        query,
        suggestions,
        count: suggestions.length
      });
    } catch (error) {
      console.error('City suggestions error:', error);
      res.status(500).json({ message: "Failed to get city suggestions" });
    }
  });

  // Discover feeds for top cities by population
  app.post("/api/discover-top-cities", async (req, res) => {
    try {
      const { count } = req.body;

      console.log(`Discovering feeds for top ${count || 50} cities...`);
      const result = await feedDiscoverer.discoverFeedsForTopCities(count || 50);

      res.json({
        ...result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Top cities discovery error:', error);
      res.status(500).json({ message: "Failed to discover feeds for top cities" });
    }
  });

  // Get all cities with calendar potential
  app.get("/api/cities-with-calendar-potential", async (req, res) => {
    try {
      const cities = feedDiscoverer.getAllCitiesWithCalendarPotential();

      res.json({
        cities,
        count: cities.length
      });
    } catch (error) {
      console.error('Cities with calendar potential error:', error);
      res.status(500).json({ message: "Failed to get cities with calendar potential" });
    }
  });

  app.post("/api/add-discovered-feed", async (req, res) => {
    try {
      const { source } = req.body;

      if (!source) {
        return res.status(400).json({ error: "Source is required" });
      }

      // Check if source already exists before attempting to add
      const existingSource = calendarCollector.getSources().find(s => 
        s.feedUrl === source.feedUrl || s.id === source.id || 
        (s.name === source.name && s.city === source.city && s.state === source.state)
      );

      if (existingSource) {
        return res.status(409).json({ 
          error: "Calendar source already exists", 
          message: `${source.name} is already added for ${source.city}, ${source.state}`,
          existingSource: {
            id: existingSource.id,
            name: existingSource.name,
            isActive: existingSource.isActive
          }
        });
      }

      // Add the source to the collector's sources
      const success = await dataCollector.addCalendarSource(source);

      if (success) {
        // Trigger a sync to collect events from this new source
        await dataCollector.syncEventsToStorage();

        res.json({ 
          success: true, 
          message: `Added calendar source: ${source.name}` 
        });
      } else {
        res.status(400).json({ 
          error: "Failed to add calendar source", 
          message: "The calendar source could not be added. This may be due to an invalid URL or duplicate entry." 
        });
      }
    } catch (error) {
      console.error("Add discovered feed error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Re-prioritize all calendar feeds
  app.post("/api/reprioritize-feeds", async (req, res) => {
    try {
      console.log("Manual feed re-prioritization requested");
      await calendarCollector.reprioritizeAllFeeds();

      res.json({ 
        success: true, 
        message: "Feed prioritization complete",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Feed re-prioritization error:", error);
      res.status(500).json({ error: "Failed to re-prioritize feeds" });
    }
  });

  // Get feed prioritization status
  app.get("/api/feed-priorities", async (req, res) => {
    try {
      const sources = calendarCollector.getSources();

      // Group by domain for priority analysis
      const domainGroups: Record<string, any[]> = {};

      sources.forEach(source => {
        const domain = source.websiteUrl ? new URL(source.websiteUrl).hostname : 'unknown';
        if (!domainGroups[domain]) {
          domainGroups[domain] = [];
        }
        domainGroups[domain].push({
          id: source.id,
          name: source.name,
          feedType: source.feedType,
          isActive: source.isActive,
          city: source.city,
          state: source.state
        });
      });

      res.json({
        domainGroups,
        totalSources: sources.length,
        activeSources: sources.filter(s => s.isActive).length
      });
    } catch (error) {
      console.error("Feed priorities error:", error);
      res.status(500).json({ error: "Failed to get feed priorities" });
    }
  });

  app.post("/api/discover-regional-feeds", async (req, res) => {
    try {
      const { regions } = req.body;

      if (!regions || !Array.isArray(regions) || regions.length === 0) {
        return res.status(400).json({ error: "Regions array is required" });
      }

      const discoveredFeeds = [];

      // Regional mapping of major cities by state
      const regionalCities: Record<string, string[]> = {
        "California": ["Los Angeles", "San Francisco", "San Diego", "Sacramento", "Fresno"],
        "Texas": ["Houston", "Dallas", "Austin", "San Antonio", "Fort Worth"],
        "Florida": ["Miami", "Orlando", "Tampa", "Jacksonville", "Tallahassee"],
        "New York": ["New York City", "Buffalo", "Albany", "Rochester", "Syracuse"],
        "Illinois": ["Chicago", "Springfield", "Rockford", "Peoria", "Aurora"],
        "Washington": ["Seattle", "Spokane", "Tacoma", "Vancouver", "Bellevue"],
        "Colorado": ["Denver", "Boulder", "Colorado Springs", "Fort Collins", "Pueblo"],
        "Georgia": ["Atlanta", "Savannah", "Augusta", "Columbus", "Macon"]
      };

      for (const region of regions) {
        const cities = regionalCities[region] || [];

        for (const city of cities) {
          // Discover feeds for each city in the region
          const cityFeeds = await feedDiscoverer.discoverFeedsForPopularLocation(city, region);
          discoveredFeeds.push(...cityFeeds);
        }
      }

      // Remove duplicates based on source URL
      const uniqueFeeds = discoveredFeeds.filter((feed, index, self) => 
        index === self.findIndex(f => f.source.feedUrl === feed.source.feedUrl)
      );

      res.json({
        regions,
        discoveredFeeds: uniqueFeeds,
        count: uniqueFeeds.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Regional feed discovery error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}