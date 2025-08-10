import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { eventFilterSchema, insertEventSchema } from "@shared/schema";
import { dataCollector } from "./data-collector";
import { calendarCollector } from "./calendar-collector";
import { feedDiscoverer } from './location-feed-discoverer';
import { cityDiscoverer } from './us-cities-database';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

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
          const { locations } = req.body;

          if (locations && Array.isArray(locations) && locations.length > 0) {
              console.log(`Starting event synchronization for specific locations: ${locations.join(', ')}`);

              // Get active calendar sources that match the specified locations
              const allSources = calendarCollector.getSources();
              const relevantSources = allSources.filter(source => {
                  const sourceLocation = `${source.city}, ${source.state}`;
                  return source.isActive && locations.some(location => 
                      location.toLowerCase().includes(source.city.toLowerCase()) &&
                      location.toLowerCase().includes(source.state.toLowerCase())
                  );
              });

              console.log(`Found ${relevantSources.length} active sources for specified locations`);

              if (relevantSources.length === 0) {
                  return res.json({ 
                      message: "No active calendar sources found for specified locations",
                      syncedCount: 0,
                      timestamp: new Date().toISOString()
                  });
              }

              // Sync events only from relevant sources
              let syncedCount = 0;
              for (const source of relevantSources) {
                  try {
                      console.log(`Syncing events from ${source.name} (${source.city}, ${source.state})`);
                      const events = await calendarCollector.collectFromSource(source);

                      // Add events to storage (check for duplicates)
                      const existingEvents = await storage.getAllEvents();
                      const existingEventKeys = new Set(existingEvents.map(event => 
                          `${event.title}::${event.location}::${event.organizer}::${event.source}::${event.startDate?.toDateString()}`
                      ));

                      for (const event of events) {
                          const key = `${event.title}::${event.location}::${event.organizer}::${event.source}::${event.startDate?.toDateString()}`;
                          if (!existingEventKeys.has(key)) {
                              await storage.createEvent(event);
                              syncedCount++;
                              console.log(`Storage: Created event ${event.title}. Total synced: ${syncedCount}`);
                          }
                      }
                  } catch (sourceError) {
                      console.error(`Failed to sync from ${source.name}:`, sourceError);
                  }
              }

              res.json({ 
                  message: `Event synchronization completed for ${locations.length} location(s)`,
                  syncedCount,
                  locationsProcessed: locations,
                  sourcesProcessed: relevantSources.length,
                  timestamp: new Date().toISOString()
              });
          } else {
              console.log("Starting event synchronization from all sources...");
              const syncedCount = await dataCollector.syncEventsToStorage();
              res.json({ 
                  message: "Event synchronization completed",
                  syncedCount,
                  timestamp: new Date().toISOString()
              });
          }
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
      // Use real congressional district data from CSV
      const realDistricts = await loadRealCongressionalDistricts();

      const geoJsonData = {
        type: "FeatureCollection",
        features: realDistricts
      };

      res.json(geoJsonData);
    } catch (error) {
      console.error("Error loading congressional districts:", error);
      // Fallback to generated districts if CSV loading fails
      const allDistricts = generateAllCongressionalDistricts();
      const geoJsonData = {
        type: "FeatureCollection",
        features: allDistricts
      };
      res.json(geoJsonData);
    }
  });

  // Load real congressional districts from GeoJSON data
  async function loadRealCongressionalDistricts() {
    try {
      const geoJsonPath = path.join(process.cwd(), 'attached_assets/congressional-districts.geojson');

      if (!fs.existsSync(geoJsonPath)) {
        console.log('GeoJSON file not found, using fallback data');
        return generateAllCongressionalDistricts();
      }

      const geoJsonContent = fs.readFileSync(geoJsonPath, 'utf-8');
      const geoJsonData = JSON.parse(geoJsonContent);

      if (!geoJsonData.features || !Array.isArray(geoJsonData.features)) {
        throw new Error('Invalid GeoJSON format');
      }

      // Process and standardize the features
      const districts: any[] = geoJsonData.features.map((feature: any) => {
        const props = feature.properties || {};

        // Extract district info from various possible field names
        const cd = props.CD119FP || props.CD118FP || props.DISTRICT || props.district;
        const state = props.STUSPS || props.STATE || props.state || fipsToState[props.STATEFP] || fipsToState[props.GEOID?.substring(0, 2)];
        const namelsad = props.NAMELSAD || `Congressional District ${cd}`;

        // Extract representative information from the accurate GeoJSON data
        const firstName = props.FIRSTNAME || '';
        const middleName = props.MIDDLENAME || '';
        const lastName = props.LASTNAME || '';
        const party = props.PARTY || '';
        const representativeName = firstName && lastName 
          ? `${firstName}${middleName ? ' ' + middleName : ''} ${lastName}`.trim()
          : `Representative District ${cd}`;

        return {
          type: "Feature",
          properties: {
            CD119FP: cd ? cd.toString().padStart(2, '0') : '00',
            STATEFP: props.STATEFP || getStateFips(state) || '00',
            NAMELSAD: namelsad,
            state: state || 'US',
            district: parseInt(cd) || 0,
            representative: representativeName,
            party: party,
            firstName: firstName,
            lastName: lastName,
            fips: props.STATEFP || getStateFips(state) || '00'
          },
          geometry: feature.geometry
        };
      });

      console.log(`Loaded ${districts.length} congressional districts from GeoJSON`);
      return districts;
    } catch (error) {
      console.error('Error loading GeoJSON data:', error);
      return generateAllCongressionalDistricts();
    }
  }

  // FIPS to state mapping (shared)
  const fipsToState: { [key: string]: string } = {
    '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT',
    '10': 'DE', '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL',
    '18': 'IN', '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD',
    '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE',
    '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND',
    '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI', '45': 'SC', '46': 'SD',
    '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV',
    '55': 'WI', '56': 'WY'
  };

  function getStateFromFips(fips: string): string {
    return fipsToState[fips] || 'US';
  }

  // Generate all 435 congressional districts with proper geographic distribution
  function generateAllCongressionalDistricts() {
    const districts: any[] = [];

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

      // Discover all types of feeds for each city in the district
      for (const city of cities) {
        try {
          console.log(`Discovering feeds for ${city.name}, ${state} - searching city, school district, and chamber events...`);

          // Use the comprehensive discovery method that searches for:
          // - City government events
          // - School district events  
          // - Chamber of commerce events
          const discoveredFeeds = await feedDiscoverer.discoverFeedsForLocation({
            city: city.name,
            state: state,
            type: 'city'
          });

          totalDiscovered += discoveredFeeds.length;

          // Auto-add discovered feeds and immediately sync them
          for (const feed of discoveredFeeds) {
            const success = calendarCollector.addSource(feed.source);
            if (success) {
              totalAdded++;

              // Immediately sync events from this new source
              try {
                console.log(`Immediately syncing events from newly added source: ${feed.source.name}`);
                const events = await calendarCollector.collectFromSource(feed.source);

                // Add events to storage with duplicate checking
                const existingEvents = await storage.getAllEvents();
                const existingEventKeys = new Set(existingEvents.map(event => 
                    `${event.title}::${event.location}::${event.organizer}::${event.source}::${event.startDate?.toDateString()}`
                ));

                for (const event of events) {
                    const key = `${event.title}::${event.location}::${event.organizer}::${event.source}::${event.startDate?.toDateString()}`;
                    if (!existingEventKeys.has(key)) {
                        await storage.createEvent(event);
                        syncedCount++;
                    }
                }
              } catch (syncError) {
                console.error(`Failed to immediately sync from ${feed.source.name}:`, syncError);
              }
            }
          }

          // Group feeds by organization type for better reporting
          const cityFeeds = discoveredFeeds.filter(f => f.source.type === 'city');
          const schoolFeeds = discoveredFeeds.filter(f => f.source.type === 'school');
          const chamberFeeds = discoveredFeeds.filter(f => f.source.type === 'chamber');
          const libraryFeeds = discoveredFeeds.filter(f => f.source.type === 'library');
          const parksFeeds = discoveredFeeds.filter(f => f.source.type === 'parks');

          results.push({
            city: city.name,
            discovered: discoveredFeeds.length,
            breakdown: {
              city: cityFeeds.length,
              school: schoolFeeds.length,
              chamber: chamberFeeds.length,
              library: libraryFeeds.length,
              parks: parksFeeds.length
            },
            feeds: discoveredFeeds.map(df => ({
              name: df.source.name,
              type: df.source.type,
              url: df.source.feedUrl,
              confidence: df.confidence
            }))
          });

          console.log(`Found ${discoveredFeeds.length} feeds for ${city.name}: ${cityFeeds.length} city, ${schoolFeeds.length} school, ${chamberFeeds.length} chamber, ${libraryFeeds.length} library, ${parksFeeds.length} parks`);
        } catch (error) {
          console.error(`Failed to discover feeds for ${city.name}, ${state}:`, error);
        }
      }

      // Events are now automatically synced immediately after feed discovery above
      const cityLocations = cities.map(city => `${city.name}, ${state}`);

      // Initialize syncedCount if not already defined
      if (typeof syncedCount === 'undefined') {
        syncedCount = 0;
      }

      res.json({
        district: `${state}-${district}`,
        citiesProcessed: cities.length,
        totalDiscovered,
        totalAdded,
        syncedEvents: syncedCount,
        cityLocations,
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

  // Add multiple discovered feeds at once
  app.post("/api/add-multiple-feeds", async (req, res) => {
    try {
      const { sources } = req.body;

      if (!sources || !Array.isArray(sources)) {
        return res.status(400).json({ error: "Sources array is required" });
      }

      const results = [];
      const errors = [];
      let successCount = 0;

      for (const source of sources) {
        try {
          // Check if source already exists
          const existingSource = calendarCollector.getSources().find(s => 
            s.feedUrl === source.feedUrl || s.id === source.id || 
            (s.name === source.name && s.city === source.city && s.state === source.state)
          );

          if (existingSource) {
            errors.push({
              source: source.name,
              error: `Already exists for ${source.city}, ${source.state}`,
              existing: true
            });
            continue;
          }

          // Add the source
          const success = await dataCollector.addCalendarSource(source);

          if (success) {
            results.push({
              source: source.name,
              city: source.city,
              state: source.state,
              status: 'added'
            });
            successCount++;
          } else {
            errors.push({
              source: source.name,
              error: 'Failed to add - invalid URL or duplicate entry',
              existing: false
            });
          }
        } catch (error) {
          errors.push({
            source: source.name,
            error: String(error),
            existing: false
          });
        }
      }

      // Trigger sync for new sources
      if (successCount > 0) {
        try {
          await dataCollector.syncEventsToStorage();
        } catch (syncError) {
          console.error("Failed to sync after bulk add:", syncError);
        }
      }

      res.json({
        success: true,
        added: successCount,
        total: sources.length,
        results,
        errors
      });
    } catch (error) {
      console.error("Bulk add feeds error:", error);
      res.status(500).json({ error: "Internal server error" });
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

  // Debug endpoint to test feed discovery patterns on specific websites
  app.post("/api/debug-feed-discovery", async (req, res) => {
    try {
      const { websiteUrl } = req.body;
      
      if (!websiteUrl) {
        return res.status(400).json({ error: "websiteUrl is required" });
      }

      console.log(`\n=== DEBUG: Analyzing ${websiteUrl} for downloadable feeds ===`);

      const response = await axios.get(websiteUrl, {
        timeout: 5000,
        headers: { 
          'User-Agent': 'CityWide Events Calendar Debug Bot 1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        maxRedirects: 3
      });

      const $ = cheerio.load(response.data);
      const discoveredPatterns: {
        directLinks: { href: string; text: string }[];
        downloadButtons: { href: string; text: string }[];
        exportButtons: { onclick: string | undefined; dataUrl: string | undefined; text: string }[];
        subscribeButtons: { href: string | undefined; onclick: string | undefined; text: string }[];
        metaLinks: { href: string | undefined; type: string | undefined; title: string | undefined }[];
        jsPatterns: string[];
        formActions: { action: string | undefined; method: string }[];
        commonPaths: string[];
      } = {
        directLinks: [],
        downloadButtons: [],
        exportButtons: [],
        subscribeButtons: [],
        metaLinks: [],
        jsPatterns: [],
        formActions: [],
        commonPaths: []
      };

      // Direct calendar/events links
      $('a[href*="calendar"], a[href*="events"]').each((_, element) => {
        const href = $(element).attr('href');
        const text = $(element).text().trim();
        if (href) {
          discoveredPatterns.directLinks.push({ href, text });
        }
      });

      // Download-related links
      $('a[href*=".ics"], a[href*=".rss"], a[href*="download"], a[href*="export"], a[href*="subscribe"]').each((_, element) => {
        const href = $(element).attr('href');
        const text = $(element).text().trim();
        if (href) {
          discoveredPatterns.downloadButtons.push({ href, text });
        }
      });

      // Buttons with download/export text
      $('button:contains("Download"), a:contains("Download")').each((_, element) => {
        const $el = $(element);
        const onclick = $el.attr('onclick');
        const dataUrl = $el.attr('data-url') || $el.attr('data-href');
        const text = $el.text().trim();
        discoveredPatterns.exportButtons.push({ onclick, dataUrl, text });
      });

      // Subscribe buttons
      $('button:contains("Subscribe"), a:contains("Subscribe")').each((_, element) => {
        const $el = $(element);
        const href = $el.attr('href');
        const onclick = $el.attr('onclick');
        const text = $el.text().trim();
        discoveredPatterns.subscribeButtons.push({ href, onclick, text });
      });

      // Meta links
      $('link[rel="alternate"]').each((_, element) => {
        const href = $(element).attr('href');
        const type = $(element).attr('type');
        const title = $(element).attr('title');
        discoveredPatterns.metaLinks.push({ href, type, title });
      });

      // JavaScript patterns
      $('script').each((_, element) => {
        const scriptContent = $(element).html() || '';
        if (scriptContent.includes('calendar') || scriptContent.includes('events') || scriptContent.includes('.ics') || scriptContent.includes('.rss')) {
          const matches: string[] = [];
          const patterns = [
            /(['"])(\/[^'"]*\.(?:ics|rss|xml))\1/g,
            /(['"])(\/[^'"]*(?:calendar|events|download|export)[^'"]*)\1/g
          ];
          
          patterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(scriptContent)) !== null) {
              if (match[2]) matches.push(match[2]);
            }
          });
          
          if (matches.length > 0) {
            discoveredPatterns.jsPatterns.push(...matches);
          }
        }
      });

      // Form actions
      $('form[action*="calendar"], form[action*="events"], form[action*="export"], form[action*="download"]').each((_, element) => {
        const action = $(element).attr('action');
        const method = $(element).attr('method') || 'GET';
        discoveredPatterns.formActions.push({ action, method });
      });

      res.json({
        success: true,
        websiteUrl,
        discoveredPatterns,
        totalPatterns: Object.values(discoveredPatterns).flat().length,
        recommendations: {
          highConfidenceFeeds: [
            ...discoveredPatterns.metaLinks.map(meta => ({ type: 'meta', ...meta })),
            ...discoveredPatterns.downloadButtons.map(btn => ({ type: 'download', ...btn }))
          ],
          mediumConfidenceFeeds: [
            ...discoveredPatterns.directLinks.map(link => ({ type: 'direct', ...link })),
            ...discoveredPatterns.jsPatterns.map(pattern => ({ type: 'js', href: pattern, text: 'JavaScript Pattern' }))
          ],
          requiresInteraction: [
            ...discoveredPatterns.exportButtons.map(btn => ({ type: 'export', ...btn })),
            ...discoveredPatterns.formActions.map(form => ({ type: 'form', ...form, text: 'Form Action' }))
          ]
        }
      });

    } catch (error) {
      console.error("Debug feed discovery error:", error);
      res.status(500).json({ error: "Failed to analyze website", details: String(error) });
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

  // Manual event collection from all sources
  app.post("/api/collect-events", async (req, res) => {
    try {
      console.log("Manual event collection triggered...");
      const events = await dataCollector.collectFromAllSources();

      await storage.saveEvents(events);

      res.json({
        message: "Event collection completed",
        eventCount: events.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Manual event collection failed:", error);
      res.status(500).json({ message: "Event collection failed" });
    }
  });

  // Force scrape feeds for a specific location
  app.post("/api/scrape-location-feeds", async (req, res) => {
    try {
      const { city, state } = req.body;

      if (!city || !state) {
        return res.status(400).json({ message: "City and state are required" });
      }

      console.log(`Force scraping feeds for ${city}, ${state}...`);

      // Get all active sources for this location
      const allSources = calendarCollector.getSources();
      const locationSources = allSources.filter(source => 
        source.city.toLowerCase() === city.toLowerCase() && 
        source.state.toUpperCase() === state.toUpperCase() && 
        source.isActive
      );

      console.log(`Found ${locationSources.length} active sources for ${city}, ${state}`);

      const allEvents: any[] = [];

      for (const source of locationSources) {
        try {
          console.log(`Scraping source: ${source.name} (${source.feedType}) - ${source.feedUrl}`);
          const events = await calendarCollector.collectFromSource(source);
          allEvents.push(...events);
          console.log(`✓ Collected ${events.length} events from ${source.name}`);
        } catch (error) {
          console.error(`✗ Failed to scrape ${source.name}:`, error);
        }
      }

      // Save the events
      if (allEvents.length > 0) {
        await storage.saveEvents(allEvents);
        console.log(`Saved ${allEvents.length} events to storage`);
      }

      res.json({
        message: `Scraped ${locationSources.length} feeds for ${city}, ${state}`,
        sources: locationSources.map(s => s.name),
        eventCount: allEvents.length,
        events: allEvents.slice(0, 10), // Return first 10 events as preview
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Force scraping failed:", error);
      res.status(500).json({ message: "Force scraping failed" });
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