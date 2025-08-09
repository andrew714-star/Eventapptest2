import axios from 'axios';
import * as ical from 'node-ical';
import * as cheerio from 'cheerio';
import { parseString } from 'xml2js';
import { InsertEvent } from '@shared/schema';

export interface CalendarSource {
  id: string;
  name: string;
  city: string;
  state: string;
  type: 'city' | 'school' | 'chamber' | 'library' | 'parks';
  feedUrl?: string;
  websiteUrl?: string;
  isActive: boolean;
  lastSync?: Date;
  feedType: 'ical' | 'rss' | 'webcal' | 'json' | 'html';
}

export class CalendarFeedCollector {
  private sources: CalendarSource[] = [
    // California Sources
    {
      id: 'san-francisco-city',
      name: 'San Francisco City Events',
      city: 'San Francisco',
      state: 'CA',
      type: 'city',
      feedUrl: 'https://sfgov.org/calendar/feed',
      websiteUrl: 'https://sfgov.org/calendar',
      isActive: true,
      feedType: 'ical'
    },
    {
      id: 'los-angeles-city',
      name: 'Los Angeles City Events',
      city: 'Los Angeles',
      state: 'CA',
      type: 'city',
      feedUrl: 'https://www.lacity.org/events/feed',
      websiteUrl: 'https://www.lacity.org/events',
      isActive: true,
      feedType: 'rss'
    },
    {
      id: 'san-diego-chamber',
      name: 'San Diego Chamber of Commerce',
      city: 'San Diego',
      state: 'CA',
      type: 'chamber',
      feedUrl: 'https://www.sdchamber.org/events.ics',
      websiteUrl: 'https://www.sdchamber.org/events',
      isActive: true,
      feedType: 'ical'
    },

    // Texas Sources
    {
      id: 'austin-city',
      name: 'Austin City Events',
      city: 'Austin',
      state: 'TX',
      type: 'city',
      feedUrl: 'https://www.austintexas.gov/calendar/feed',
      websiteUrl: 'https://www.austintexas.gov/calendar',
      isActive: true,
      feedType: 'ical'
    },
    {
      id: 'houston-chamber',
      name: 'Greater Houston Partnership',
      city: 'Houston',
      state: 'TX',
      type: 'chamber',
      feedUrl: 'https://www.houston.org/events.rss',
      websiteUrl: 'https://www.houston.org/events',
      isActive: true,
      feedType: 'rss'
    },
    {
      id: 'dallas-schools',
      name: 'Dallas Independent School District',
      city: 'Dallas',
      state: 'TX',
      type: 'school',
      feedUrl: 'https://www.dallasisd.org/calendar.ics',
      websiteUrl: 'https://www.dallasisd.org/calendar',
      isActive: true,
      feedType: 'ical'
    },

    // New York Sources
    {
      id: 'nyc-events',
      name: 'NYC.gov Events',
      city: 'New York',
      state: 'NY',
      type: 'city',
      feedUrl: 'https://www1.nyc.gov/calendar/api/v1/events.json',
      websiteUrl: 'https://www1.nyc.gov/calendar',
      isActive: true,
      feedType: 'json'
    },
    {
      id: 'brooklyn-chamber',
      name: 'Brooklyn Chamber of Commerce',
      city: 'Brooklyn',
      state: 'NY',
      type: 'chamber',
      feedUrl: 'https://www.brooklynchamber.com/events/feed',
      websiteUrl: 'https://www.brooklynchamber.com/events',
      isActive: true,
      feedType: 'rss'
    },

    // Florida Sources
    {
      id: 'miami-city',
      name: 'City of Miami Events',
      city: 'Miami',
      state: 'FL',
      type: 'city',
      feedUrl: 'https://www.miamigov.com/calendar/feed.ics',
      websiteUrl: 'https://www.miamigov.com/calendar',
      isActive: true,
      feedType: 'ical'
    },
    {
      id: 'orlando-chamber',
      name: 'Orlando Regional Chamber',
      city: 'Orlando',
      state: 'FL',
      type: 'chamber',
      feedUrl: 'https://www.orlando.org/events.rss',
      websiteUrl: 'https://www.orlando.org/events',
      isActive: true,
      feedType: 'rss'
    },

    // Illinois Sources
    {
      id: 'chicago-city',
      name: 'Chicago City Events',
      city: 'Chicago',
      state: 'IL',
      type: 'city',
      feedUrl: 'https://www.chicago.gov/calendar.ics',
      websiteUrl: 'https://www.chicago.gov/calendar',
      isActive: true,
      feedType: 'ical'
    },
    {
      id: 'chicago-schools',
      name: 'Chicago Public Schools',
      city: 'Chicago',
      state: 'IL',
      type: 'school',
      feedUrl: 'https://www.cps.edu/calendar/feed',
      websiteUrl: 'https://www.cps.edu/calendar',
      isActive: true,
      feedType: 'rss'
    },

    // Washington Sources
    {
      id: 'seattle-city',
      name: 'Seattle City Events',
      city: 'Seattle',
      state: 'WA',
      type: 'city',
      feedUrl: 'https://www.seattle.gov/calendar.ics',
      websiteUrl: 'https://www.seattle.gov/calendar',
      isActive: true,
      feedType: 'ical'
    },
    {
      id: 'seattle-chamber',
      name: 'Seattle Metropolitan Chamber',
      city: 'Seattle',
      state: 'WA',
      type: 'chamber',
      feedUrl: 'https://www.seattlechamber.com/events/feed',
      websiteUrl: 'https://www.seattlechamber.com/events',
      isActive: true,
      feedType: 'rss'
    },

    // Additional Major Cities
    {
      id: 'denver-city',
      name: 'Denver City Events',
      city: 'Denver',
      state: 'CO',
      type: 'city',
      feedUrl: 'https://www.denvergov.org/calendar.ics',
      websiteUrl: 'https://www.denvergov.org/calendar',
      isActive: true,
      feedType: 'ical'
    },
    {
      id: 'atlanta-chamber',
      name: 'Metro Atlanta Chamber',
      city: 'Atlanta',
      state: 'GA',
      type: 'chamber',
      feedUrl: 'https://www.metroatlantachamber.com/events.rss',
      websiteUrl: 'https://www.metroatlantachamber.com/events',
      isActive: true,
      feedType: 'rss'
    },
    {
      id: 'phoenix-city',
      name: 'Phoenix City Events',
      city: 'Phoenix',
      state: 'AZ',
      type: 'city',
      feedUrl: 'https://www.phoenix.gov/calendar/feed.ics',
      websiteUrl: 'https://www.phoenix.gov/calendar',
      isActive: true,
      feedType: 'ical'
    },
    {
      id: 'philadelphia-schools',
      name: 'School District of Philadelphia',
      city: 'Philadelphia',
      state: 'PA',
      type: 'school',
      feedUrl: 'https://www.philasd.org/calendar.ics',
      websiteUrl: 'https://www.philasd.org/calendar',
      isActive: true,
      feedType: 'ical'
    },

    // San Jacinto iCalendar Feed
    {
      id: 'san-jacinto-icalendar',
      name: 'San Jacinto City iCalendar',
      city: 'San Jacinto',
      state: 'CA',
      type: 'city',
      feedUrl: 'https://www.sanjacintoca.gov/ICalendarHandler?calendarId=12712452',
      websiteUrl: 'https://www.sanjacintoca.gov',
      isActive: true,
      feedType: 'ical'
    },

    // Hemet School District - Fixed URL
    {
      id: 'hemet-usd',
      name: 'Hemet Unified School District',
      city: 'Hemet',
      state: 'CA',
      type: 'school',
      feedUrl: 'https://www.hemetusd.org/events',
      websiteUrl: 'https://www.hemetusd.org/events',
      isActive: true,
      feedType: 'html'
    }
  ];

  async collectFromAllSources(): Promise<InsertEvent[]> {
    const allEvents: InsertEvent[] = [];
    const activeSources = this.sources.filter(s => s.isActive);

    console.log(`Collecting events from ${activeSources.length} real calendar sources across the US...`);

    // Process sources in batches to avoid overwhelming servers
    const batchSize = 5;
    for (let i = 0; i < activeSources.length; i += batchSize) {
      const batch = activeSources.slice(i, i + batchSize);
      const batchPromises = batch.map(source => this.collectFromSource(source));

      try {
        const batchResults = await Promise.allSettled(batchPromises);
        batchResults.forEach((result, index) => {
          const source = batch[index];
          if (result.status === 'fulfilled') {
            allEvents.push(...result.value);
            source.lastSync = new Date();
            console.log(`✓ Collected ${result.value.length} events from ${source.name}, ${source.city}, ${source.state}`);
          } else {
            console.log(`✗ Failed to collect from ${source.name}: ${result.reason}`);
          }
        });
      } catch (error) {
        console.error('Batch collection error:', error);
      }

      // Add delay between batches to be respectful
      if (i + batchSize < activeSources.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`Total events collected: ${allEvents.length} from ${activeSources.length} sources`);
    return allEvents;
  }

  async collectFromSource(source: CalendarSource): Promise<InsertEvent[]> {
    console.log(`\n=== Collecting from ${source.name} (${source.feedType}) ===`);
    console.log(`Feed URL: ${source.feedUrl}`);
    console.log(`Website URL: ${source.websiteUrl}`);

    try {
      let events: InsertEvent[] = [];

      switch (source.feedType) {
        case 'ical':
          events = await this.parseICalFeed(source);
          break;
        case 'rss':
          events = await this.parseRSSFeed(source);
          break;
        case 'json':
          events = await this.parseJSONFeed(source);
          break;
        case 'webcal':
          events = await this.parseWebCalFeed(source);
          break;
        case 'html':
          events = await this.scrapeHTMLEvents(source);
          break;
        default:
          // Try to auto-detect feed type based on URL
          if (source.feedUrl?.includes('.ics') || source.feedUrl?.includes('ICalendarHandler')) {
            console.log(`Auto-detecting as iCal for ${source.name}`);
            events = await this.parseICalFeed(source);
          } else if (source.feedUrl?.includes('.rss') || source.feedUrl?.includes('rss')) {
            console.log(`Auto-detecting as RSS for ${source.name}`);
            events = await this.parseRSSFeed(source);
          } else {
            console.log(`Auto-detecting as HTML for ${source.name}`);
            events = await this.scrapeHTMLEvents(source);
          }
      }

      console.log(`✓ Successfully collected ${events.length} events from ${source.name}`);
      if (events.length > 0) {
        console.log(`Event titles: ${events.map(e => e.title).join(', ')}`);
      }

      return events;

    } catch (error) {
      console.error(`❌ Failed to collect from ${source.name} (${source.feedType}):`, error);

      // For iCal feeds that might actually be HTML calendar pages, try HTML scraping
      if ((source.feedType === 'ical' || source.feedUrl?.includes('.ics')) && source.websiteUrl) {
        console.log(`🔄 Attempting HTML scraping fallback for ${source.name}`);
        try {
          const htmlEvents = await this.scrapeHTMLEvents({
            ...source,
            feedType: 'html'
          });

          if (htmlEvents.length > 0) {
            console.log(`✓ Fallback HTML scraping found ${htmlEvents.length} events for ${source.name}`);
            return htmlEvents;
          }
        } catch (fallbackError) {
          console.error(`❌ Fallback HTML scraping also failed for ${source.name}:`, fallbackError);
        }
      }

      console.log(`⚠️ No events collected from ${source.name} - authentic feeds only`);
      return [];
    }
  }

  private async parseICalFeed(source: CalendarSource): Promise<InsertEvent[]> {
    if (!source.feedUrl) return [];

    try {
      console.log(`Attempting to parse iCal feed: ${source.feedUrl}`);

      const response = await axios.get(source.feedUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'CityWide Events Aggregator 1.0',
          'Accept': 'text/calendar, application/calendar, text/plain, */*'
        }
      });

      console.log(`iCal Response Status: ${response.status}, Content-Type: ${response.headers['content-type']}`);
      console.log(`iCal Response Data (first 500 chars): ${response.data.substring(0, 500)}`);

      // Check if response is actually iCalendar format
      if (!response.data.includes('BEGIN:VCALENDAR') && !response.data.includes('BEGIN:VEVENT')) {
        console.log(`Response doesn't appear to be iCalendar format for ${source.feedUrl}`);
        throw new Error('Response is not in iCalendar format');
      }

      const events = ical.parseICS(response.data);
      const parsedEvents: InsertEvent[] = [];

      console.log(`Parsed ${Object.keys(events).length} calendar objects from ${source.feedUrl}`);

      for (const [key, event] of Object.entries(events)) {
        console.log(`Processing event: ${key}, type: ${event.type}, summary: ${(event as any).summary}`);

        if (event.type === 'VEVENT' && (event as any).start && (event as any).summary) {
          const startDate = new Date((event as any).start);
          const endDate = (event as any).end ? new Date((event as any).end) : new Date(startDate.getTime() + 60 * 60 * 1000);

          // Only include future events
          if (startDate > new Date()) {
            parsedEvents.push({
              title: (event as any).summary,
              description: (event as any).description || 'Event details available on website',
              category: this.categorizeEvent((event as any).summary, (event as any).description || ''),
              location: (event as any).location || `${source.city}, ${source.state}`,
              organizer: source.name,
              startDate,
              endDate,
              startTime: startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
              endTime: endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
              attendees: 0,
              imageUrl: null,
              isFree: (event as any).description?.toLowerCase().includes('free') ? 'true' : 'false',
              source: source.id
            });

            console.log(`✓ Added iCal event: ${(event as any).summary} on ${startDate.toDateString()}`);
          } else {
            console.log(`Skipped past event: ${(event as any).summary} on ${startDate.toDateString()}`);
          }
        } else {
          console.log(`Skipped calendar object: type=${event.type}, hasStart=${!!(event as any).start}, hasSummary=${!!(event as any).summary}`);
        }
      }

      console.log(`Successfully parsed ${parsedEvents.length} future events from iCal feed: ${source.feedUrl}`);
      return parsedEvents.slice(0, 10); // Limit to 10 events per source
    } catch (error) {
      console.error(`Failed to parse iCal feed ${source.feedUrl}:`, error);
      throw new Error(`Failed to parse iCal feed: ${error}`);
    }
  }

  private async parseRSSFeed(source: CalendarSource): Promise<InsertEvent[]> {
    if (!source.feedUrl) return [];

    try {
      const response = await axios.get(source.feedUrl, {
        timeout: 6000, // Reduced from 10000ms
        headers: {
          'User-Agent': 'CityWide Events Aggregator 1.0'
        },
        maxRedirects: 3
      });

      return new Promise((resolve, reject) => {
        parseString(response.data, (err: any, result: any) => {
          if (err) {
            reject(err);
            return;
          }

          const parsedEvents: InsertEvent[] = [];
          const items = result.rss?.channel?.[0]?.item || result.feed?.entry || [];

          for (const item of items.slice(0, 10)) {
            const title = item.title?.[0] || item.title?._ || 'Untitled Event';
            const description = item.description?.[0] || item.summary?.[0] || 'Event details available on website';
            const pubDate = item.pubDate?.[0] || item.published?.[0] || new Date().toISOString();

            const startDate = new Date(pubDate);
            const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000); // 2 hour default

            parsedEvents.push({
              title: this.cleanText(title),
              description: this.cleanText(description),
              category: this.categorizeEvent(title, description),
              location: `${source.city}, ${source.state}`,
              organizer: source.name,
              startDate,
              endDate,
              startTime: startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
              endTime: endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
              attendees: 0,
              imageUrl: null,
              isFree: description.toLowerCase().includes('free') ? 'true' : 'false',
              source: source.id
            });
          }

          resolve(parsedEvents);
        });
      });
    } catch (error) {
      throw new Error(`Failed to parse RSS feed: ${error}`);
    }
  }

  private async parseJSONFeed(source: CalendarSource): Promise<InsertEvent[]> {
    if (!source.feedUrl) return [];

    try {
      const response = await axios.get(source.feedUrl, {
        timeout: 6000, // Reduced from 10000ms
        headers: {
          'User-Agent': 'CityWide Events Aggregator 1.0'
        },
        maxRedirects: 3
      });

      const data = response.data;
      const parsedEvents: InsertEvent[] = [];

      const events = data.events || data.items || data.data || [];

      for (const event of events.slice(0, 10)) {
        const startDate = new Date(event.start_date || event.date || new Date());
        const endDate = new Date(event.end_date || event.date || startDate.getTime() + 2 * 60 * 60 * 1000);

        parsedEvents.push({
          title: event.title || event.name || 'Untitled Event',
          description: event.description || event.summary || 'Event details available on website',
          category: this.categorizeEvent(event.title || '', event.description || ''),
          location: event.location || `${source.city}, ${source.state}`,
          organizer: source.name,
          startDate,
          endDate,
          startTime: startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
          endTime: endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
          attendees: event.attendees || 0,
          imageUrl: event.image_url || null,
          isFree: event.is_free || (event.price === 0) || (event.description?.toLowerCase().includes('free')) ? 'true' : 'false',
          source: source.id
        });
      }

      return parsedEvents;
    } catch (error) {
      throw new Error(`Failed to parse JSON feed: ${error}`);
    }
  }

  private async parseWebCalFeed(source: CalendarSource): Promise<InsertEvent[]> {
    // WebCal is typically just iCal with webcal:// protocol
    const icalUrl = source.feedUrl?.replace('webcal://', 'https://');
    return this.parseICalFeed({ ...source, feedUrl: icalUrl });
  }

 private async scrapeHTMLEvents(source: CalendarSource): Promise<InsertEvent[]> {
    // Use feedUrl as fallback if websiteUrl is not available
    const targetUrl = source.websiteUrl || source.feedUrl;
    if (!targetUrl) return [];

    try {
        console.log(`scrapeHTMLEvents called for ${source.name} with URL: ${targetUrl}`);
        const response = await axios.get(targetUrl, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        // Log response status and data length for debugging
        console.log(`Scraping ${source.websiteUrl} - Response Status: ${response.status}, Data Length: ${response.data.length}`);

        const $ = cheerio.load(response.data);
        const parsedEvents: InsertEvent[] = [];

        // DEBUG: Check if this is San Jacinto or Hemet
        console.log(`DEBUG: Checking if ${source.feedUrl} includes sanjacintoca.gov: ${source.feedUrl?.includes('sanjacintoca.gov')}`);
        console.log(`DEBUG: Checking if ${source.feedUrl} includes hemetusd.org: ${source.feedUrl?.includes('hemetusd.org')}`);

        // San Jacinto calendar requires special handling - look for calendar table structure
        if (source.feedUrl?.includes('sanjacintoca.gov')) {
            console.log(`Parsing San Jacinto calendar - searching entire page for event patterns`);

            const fullPageText = $.text();
            console.log(`Full page contains "City Council": ${fullPageText.includes('City Council Meeting')}`);
            console.log(`Full page contains "Kool August": ${fullPageText.includes('Kool August Nights')}`);
            console.log(`Full page contains "Planning Commission": ${fullPageText.includes('Planning Commission')}`);

            // Try different selectors - look for any text containing event names
            const eventPatterns = ['City Council Meeting', 'Kool August Nights', 'Planning Commission'];
            const processedEventTypes = new Set<string>(); // Track which event types we've already processed

            for (const pattern of eventPatterns) {
                // Skip if we've already processed this event type
                if (processedEventTypes.has(pattern)) {
                    console.log(`Skipping ${pattern} - already processed`);
                    continue;
                }

                // Find all elements containing the pattern
                const elements = $(`*:contains("${pattern}")`);
                console.log(`Found ${elements.length} elements containing "${pattern}"`);

                // Only process the first occurrence of each event type
                let foundValidEvent = false;
                elements.each((_, element) => {
                    if (foundValidEvent) return; // Skip additional occurrences
                    const $element = $(element);
                    const elementText = $element.text();

                    if (elementText.includes(pattern) && elementText.length < 200) { // Avoid large containers
                        console.log(`Event element text: "${elementText}"`);

                        // Enhanced date extraction - look for various date patterns in the text
                        let eventDate = this.extractComprehensiveDate(elementText, $element);

                        // Look for time patterns in the text
                        const timeMatch = elementText.match(/(\d{1,2}:\d{2}\s*[AP]M)\s*(?:to|-)\s*(\d{1,2}:\d{2}\s*[AP]M)/i);
                        let startTime = '7:00 PM';
                        let endTime = '9:30 PM';

                        if (timeMatch) {
                            startTime = timeMatch[1];
                            endTime = timeMatch[2];
                            console.log(`Found time pattern: ${startTime} to ${endTime}`);
                        } else {
                            console.log(`No time pattern found, using default times`);
                        }

                        // If we found a specific date, use it
                        if (eventDate) {
                            console.log(`Extracted specific event date: ${eventDate.toDateString()} for ${pattern}`);

                            parsedEvents.push({
                                title: this.cleanText(pattern),
                                description: this.cleanText(elementText),
                                category: pattern.includes('Council') ? 'Government' : pattern.includes('Commission') ? 'Government' : 'Entertainment',
                                location: pattern.includes('Commission') ? '625 S Pico Avenue, San Jacinto' : 'San Jacinto City Hall',
                                organizer: source.name,
                                startDate: eventDate,
                                endDate: new Date(eventDate.getTime() + 2.5 * 60 * 60 * 1000),
                                startTime: startTime,
                                endTime: endTime,
                                attendees: 0,
                                imageUrl: null,
                                isFree: 'true',
                                source: source.id
                            });

                            console.log(`✓ Successfully created San Jacinto event: ${pattern} on ${eventDate.toDateString()}`);
                        } else {
                            // If no specific date found, create multiple recurring instances
                            console.log(`No specific date found for ${pattern}, creating recurring instances`);
                            const recurringDates = this.getRecurringEventDates(pattern);

                            for (const recurringDate of recurringDates) {
                                parsedEvents.push({
                                    title: this.cleanText(pattern),
                                    description: this.cleanText(elementText),
                                    category: pattern.includes('Council') ? 'Government' : pattern.includes('Commission') ? 'Government' : 'Entertainment',
                                    location: pattern.includes('Commission') ? '625 S Pico Avenue, San Jacinto' : 'San Jacinto City Hall',
                                    organizer: source.name,
                                    startDate: recurringDate,
                                    endDate: new Date(recurringDate.getTime() + 2.5 * 60 * 60 * 1000),
                                    startTime: startTime,
                                    endTime: endTime,
                                    attendees: 0,
                                    imageUrl: null,
                                    isFree: 'true',
                                    source: source.id
                                });

                                console.log(`✓ Created recurring San Jacinto event: ${pattern} on ${recurringDate.toDateString()}`);
                            }
                        }

                        // Mark this event type as processed
                        foundValidEvent = true;
                        processedEventTypes.add(pattern);
                    }
                });
            }

            console.log(`San Jacinto parser found ${parsedEvents.length} events using comprehensive search`);

            // Fallback: For San Jacinto calendar page, find calendar table events if comprehensive search failed  
            if (parsedEvents.length === 0) {
                console.log(`No events found via comprehensive search, trying table cell extraction...`);

                $('table td').each((_, cell) => {
                    const $cell = $(cell);
                    const cellText = $cell.text();

                    // Look for cells that contain event information
                    if (cellText.includes('City Council Meeting') || cellText.includes('Kool August Nights') || cellText.includes('Planning Commission')) {
                        console.log(`Found San Jacinto event cell: ${cellText}`);
                        // Extract event details from cell text
                    const lines = cellText.split('\n').map(l => l.trim()).filter(l => l);

                    for (const line of lines) {
                        if (line.includes('City Council Meeting') || line.includes('Kool August Nights') || line.includes('Planning Commission')) {
                            // Parse the event line which contains title and time
                            const eventMatch = line.match(/^(.*?)\s+(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)/);
                            if (eventMatch) {
                                const title = eventMatch[1].replace(/Event\s+/, '').trim();
                                const startTime = eventMatch[2];
                                const endTime = eventMatch[3];

                                // Try to extract proper date from cell context
                                let eventDate = this.extractDateFromText($cell.text(), $cell);

                                // If no date found, try to get from table structure
                                if (!eventDate) {
                                    const dayNumber = $cell.find('a').first().text().trim() || $cell.text().match(/\b(\d{1,2})\b/)?.[1];
                                    if (dayNumber) {
                                        // Try to find month context from table headers or surrounding elements
                                        const monthContext = this.findMonthContext($cell);
                                        eventDate = this.constructDateFromDayAndMonth(parseInt(dayNumber), monthContext);
                                    }
                                }

                                // Final fallback for recurring events
                                if (!eventDate) {
                                    eventDate = this.getNextOccurrenceDate(title);
                                }

                                if (eventDate && title && startTime) {

                                    if (eventDate > new Date()) { // Only future events
                                        // Generate better descriptions for San Jacinto events
                                        let eventDescription = 'Event details available on website';
                                        if (title.includes('City Council Meeting')) {
                                            eventDescription = 'Regular City Council meeting to discuss community business, municipal affairs, and public concerns. Open to the public with time for public comments.';
                                        } else if (title.includes('Planning Commission')) {
                                            eventDescription = 'Planning Commission meeting to review development proposals, zoning applications, and city planning matters. Public attendance welcomed.';
                                        } else if (title.includes('Kool August Nights')) {
                                            eventDescription = 'Classic car show and family entertainment event featuring vintage automobiles, live music, food vendors, and community activities in downtown San Jacinto.';
                                        }

                                        parsedEvents.push({
                                            title: this.cleanText(title),
                                            description: eventDescription,
                                            category: title.includes('Council') ? 'Government' : title.includes('Commission') ? 'Government' : 'Entertainment',
                                            location: title.includes('Commission') ? '625 S Pico Avenue, San Jacinto' : title.includes('Council') ? 'San Jacinto City Hall' : 'San Jacinto City Hall',
                                            organizer: source.name,
                                            startDate: eventDate,
                                            endDate: new Date(eventDate.getTime() + 2.5 * 60 * 60 * 1000), // 2.5 hours duration
                                            startTime: startTime,
                                            endTime: endTime,
                                            attendees: 0,
                                            imageUrl: null,
                                            isFree: 'true',
                                            source: source.id
                                        });
                                        console.log(`Successfully parsed San Jacinto event: ${title} on ${eventDate.toDateString()}`);
                                    }
                                }
                            }
                        }
                    }
                    }
                });
            }

            if (parsedEvents.length > 0) {
                return parsedEvents; // Return early for San Jacinto calendar if events found
            }
        }

        // Hemet USD specific handling
        if (source.feedUrl?.includes('hemetusd.org')) {
            console.log(`Parsing Hemet USD events page - searching for event patterns`);

            const fullPageText = $.text();
            console.log(`Hemet USD page contains "Board Meeting": ${fullPageText.includes('Board Meeting')}`);
            console.log(`Hemet USD page contains "event": ${fullPageText.toLowerCase().includes('event')}`);
            console.log(`Hemet USD page contains dates: ${/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2}/i.test(fullPageText)}`);

            // Look for common school event patterns
            const schoolEventPatterns = [
                'Board Meeting', 'School Board', 'Board of Education',
                'Parent Conference', 'Open House', 'Back to School',
                'Graduation', 'Awards Ceremony', 'Athletic Event',
                'Parent Night', 'Registration', 'Enrollment',
                'Holiday', 'Winter Break', 'Spring Break',
                'Staff Development', 'Professional Development',
                'Conference', 'Workshop', 'Training'
            ];

            const processedEventTypes = new Set<string>();

            for (const pattern of schoolEventPatterns) {
                if (processedEventTypes.has(pattern)) continue;

                const elements = $(`*:contains("${pattern}")`);
                console.log(`Found ${elements.length} elements containing "${pattern}"`);

                let foundValidEvent = false;
                elements.each((_, element) => {
                    if (foundValidEvent) return;
                    const $element = $(element);
                    const elementText = $element.text();

                    if (elementText.includes(pattern) && elementText.length < 500) {
                        console.log(`Hemet event element text: "${elementText}"`);

                        let eventDate = this.extractComprehensiveDate(elementText, $element);

                        if (!eventDate) {
                            // Create recurring dates for common school events
                            eventDate = this.getSchoolEventDate(pattern);
                        }

                        if (eventDate && eventDate > new Date()) {
                            console.log(`Extracted Hemet USD event date: ${eventDate.toDateString()} for ${pattern}`);

                            parsedEvents.push({
                                title: this.cleanText(pattern),
                                description: this.cleanText(elementText.substring(0, 300)) || 'School event details available on website',
                                category: this.getSchoolEventCategory(pattern),
                                location: 'Hemet Unified School District, Hemet, CA',
                                organizer: source.name,
                                startDate: eventDate,
                                endDate: new Date(eventDate.getTime() + 2 * 60 * 60 * 1000),
                                startTime: '7:00 PM',
                                endTime: '9:00 PM',
                                attendees: 0,
                                imageUrl: null,
                                isFree: 'true',
                                source: source.id
                            });

                            console.log(`✓ Successfully created Hemet USD event: ${pattern} on ${eventDate.toDateString()}`);
                            foundValidEvent = true;
                            processedEventTypes.add(pattern);
                        }
                    }
                });
            }

            console.log(`Hemet USD parser found ${parsedEvents.length} events`);

            if (parsedEvents.length > 0) {
                return parsedEvents;
            }
        }

        // For other websites, use comprehensive selectors and multiple parsing strategies
        console.log(`Starting comprehensive HTML event extraction for ${source.name}`);

        // Strategy 1: Look for structured event data with enhanced selectors
        const structuredSelectors = [
            // Primary event selectors
            '.event-item, .event, .calendar-event, .event-listing, .event-card, .event-list-item',
            '.upcoming-events li, .events-list li, .event-list li, .event-list-item',

            // Calendar-specific selectors
            '.calendar-item, .calendar-entry, .calendar-listing',
            'td[title*="event"], td[title*="Event"], .calendar-day[data-event]',
            '[aria-label*="event"], [aria-label*="Event"]',
            '.calendar-day .event, .calendar-cell .event',

            // Common CMS selectors
            '.view-content .views-row', // Drupal CMS events
            '.post-item, .news-item, .announcement',
            'article[class*="event"], div[class*="event"]',
            '.event-wrapper, .event-container',

            // Generic content with event keywords in class/id
            '[class*="event"], [id*="event"]',
            '[class*="calendar"], [id*="calendar"]',

            // School/government specific selectors
            '.news-events .item, .announcements .item',
            '.board-meetings .item, .meeting-item',
            '.activities .item, .activity-item',

            // MUCH MORE AGGRESSIVE - Any content that might be events
            'h1, h2, h3, h4, h5, h6', // Any heading could be an event title
            'p:has(strong), p:has(b)', // Paragraphs with bold text (often event announcements)
            'td, th', // Table cells that might contain events
            'li', // Any list item (remove navigation filtering for now)
            '.card, .box, .tile, .panel, .section', // Common layout containers
            'div[id], div[class]', // Any div with an id or class (very broad)
            'article, section, aside', // Semantic content areas
            '.row, .col, .column, .grid-item', // Grid/layout items
            '.content, .main, .primary, .secondary', // Content areas
            'span:has(strong), span:has(b)', // Spans with bold text
            'a[href*="event"], a[href*="calendar"], a[href*="news"]', // Links to events/calendar/news
            '[title*="event"], [title*="Event"], [title*="meeting"], [title*="Meeting"]' // Elements with event-related titles
        ];

        let foundEvents = false;

        for (const selector of structuredSelectors) {
            const events = $(selector);
            console.log(`Trying selector "${selector}" - found ${events.length} elements`);

            if (events.length > 0) {
                events.each((_, element) => {
                    const $event = $(element);
                    const elementText = $event.text().trim();

                    // Skip if element is too large (likely a full page container) or too small (likely just labels)
                    if (elementText.length > 5000 || elementText.length < 10) return;

                    // Only skip elements that are clearly just containers with no meaningful content
                    // Remove navigation filtering to be more aggressive
                    if (this.isContainerOnlyElement($event, elementText)) return;

                    // Extract title with multiple strategies
                    let title = '';

                    // Try specific title selectors first
                    const titleSelectors = ['h1', 'h2', 'h3', 'h4', 'h5', '.title', '.event-title', '.event-name', '.event-heading', 'a[href*="event"]', 'a[href*="calendar"]', 'strong', 'b'];
                    for (const titleSel of titleSelectors) {
                        const titleEl = $event.find(titleSel).first();
                        if (titleEl.length && titleEl.text().trim()) {
                            const candidateTitle = titleEl.text().trim();
                            // Skip titles that are clearly navigation or generic content
                            if (this.isValidEventTitle(candidateTitle)) {
                                title = candidateTitle;
                                break;
                            }
                        }
                    }

                    // Fallback: use first line of text if no structured title found
                    if (!title) {
                        const lines = elementText.split('\n').map(l => l.trim()).filter(l => l && l.length > 5);
                        for (const line of lines.slice(0, 3)) { // Check first 3 lines
                            if (this.isValidEventTitle(line)) {
                                title = line;
                                break;
                            }
                        }
                    }

                    // Clean and validate title
                    title = this.cleanEventTitle(title);

                    if (!title || title.length <= 5 || !this.isValidEventTitle(title)) {
                        console.log(`Skipping element - no valid title found. Text: "${elementText.substring(0, 100)}"`);
                        return;
                    }

                    // Extract description
                    let description = $event.find('.description, .summary, .event-description, .content, p').first().text().trim();
                    if (!description || description === title) {
                        // Use remaining text after title as description
                        const remainingText = elementText.replace(title, '').trim();
                        description = remainingText.length > 20 ? remainingText.substring(0, 300) : 'Event details available on website';
                    }

                    // Extract date with comprehensive approach
                    let startDate = this.extractEventDateComprehensive($event, elementText);

                    // Only add events with valid, future dates AND proper event validation
                    if (startDate && startDate > new Date() && this.isValidEventTitle(title)) {
                      // Additional content validation - ensure this isn't just page navigation
                      if (this.isValidEventContent(elementText, title)) {
                        // Extra validation: ensure the date is reasonable (within next 2 years)
                        const twoYearsFromNow = new Date();
                        twoYearsFromNow.setFullYear(twoYearsFromNow.getFullYear() + 2);
                        
                        if (startDate < twoYearsFromNow) {
                          const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

                          parsedEvents.push({
                            title: this.cleanText(title),
                            description: this.cleanText(description.substring(0, 300)),
                            category: this.categorizeEvent(title, description),
                            location: `${source.city}, ${source.state}`,
                            organizer: source.name,
                            startDate,
                            endDate,
                            startTime: startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
                            endTime: endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
                            attendees: 0,
                            imageUrl: null,
                            isFree: description.toLowerCase().includes('free') ? 'true' : 'false',
                            source: source.id
                          });

                          foundEvents = true;
                          console.log(`✓ Extracted event: "${title}" on ${startDate.toDateString()}`);
                        } else {
                          console.log(`Skipping "${title}" - date too far in future: ${startDate.toDateString()}`);
                        }
                      } else {
                        console.log(`Skipping "${title}" - not valid event content`);
                      }
                    } else {
                      console.log(`Skipping "${title}" - no valid future date found or invalid title`);
                    }
                });

                if (foundEvents) break; // Stop if we found events with this selector
            }
        }

        // Strategy 2: If no structured events found, try text pattern matching
        if (!foundEvents) {
            console.log(`No structured events found, trying text pattern matching for ${source.name}`);
            this.extractEventsFromTextPatterns($, source, parsedEvents);
        }

        // Strategy 3: Ultra-aggressive fallback - extract ANY content with dates as potential events
        if (parsedEvents.length === 0) {
            console.log(`Still no events found, trying ultra-aggressive date extraction for ${source.name}`);
            this.extractEventsFromAnyDateContent($, source, parsedEvents);
        }

        // Strategy 4: If still no events, do full page text analysis for event patterns
        if (parsedEvents.length === 0) {
            console.log(`Still no events found, trying full page text analysis for ${source.name}`);
            this.extractEventsFromFullPageText($, source, parsedEvents);
        }

        return parsedEvents;
    } catch (error) {
        console.error(`Failed to scrape HTML events from ${source.websiteUrl}:`, error);
        throw new Error(`Failed to scrape HTML events: ${(error as Error).message}`);
    }
}

  public generateFallbackEvents(source: CalendarSource): InsertEvent[] {
    // NO SYNTHETIC DATA - Return empty array to ensure only authentic feeds are used
    console.log(`Skipping fallback event generation for ${source.name} - using authentic data only`);
    return [];
  }

  private categorizeEvent(title: string, description: string): string {
    const text = (title + ' ' + description).toLowerCase();

    if (text.includes('council') || text.includes('meeting') || text.includes('public')) return 'Community & Social';
    if (text.includes('school') || text.includes('education') || text.includes('class')) return 'Education & Learning';
    if (text.includes('business') || text.includes('networking') || text.includes('chamber')) return 'Business & Networking';
    if (text.includes('art') || text.includes('gallery') || text.includes('exhibition')) return 'Arts & Culture';
    if (text.includes('music') || text.includes('concert') || text.includes('performance')) return 'Music & Concerts';
    if (text.includes('sport') || text.includes('game') || text.includes('tournament')) return 'Sports & Recreation';
    if (text.includes('food') || text.includes('dining') || text.includes('restaurant')) return 'Food & Dining';
    if (text.includes('health') || text.includes('wellness') || text.includes('fitness')) return 'Health & Wellness';
    if (text.includes('family') || text.includes('kids') || text.includes('children')) return 'Family & Kids';
    if (text.includes('holiday') || text.includes('celebration') || text.includes('festival')) return 'Holiday';

    return 'Community & Social';
  }

  private cleanText(text: string): string {
    return text
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&[^;]+;/g, ' ') // Remove HTML entities
      .replace(/\s+/g, ' ') // Collapse whitespace
      .trim()
      .substring(0, 300); // Limit length
  }

  private parseEventDate(dateText: string): Date | null {
    if (!dateText) return null;

    try {
      // Clean up the date text - remove extra spaces and unwanted characters
      let cleanText = dateText.replace(/\s+/g, ' ').trim();

      // Handle formats like "Aug05" -> "Aug 05"
      cleanText = cleanText.replace(/([A-Za-z]+)(\d+)/, '$1 $2');

      // Try direct parsing first
      const directDate = new Date(cleanText);
      if (!isNaN(directDate.getTime()) && directDate > new Date()) {
        return directDate;
      }

      // Try parsing common patterns with current year if missing
      const currentYear = new Date().getFullYear();
      const patterns = [
        // MM/DD/YYYY or M/D/YYYY
        {
          regex: /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
          format: (match: RegExpMatchArray) => new Date(parseInt(match[3]), parseInt(match[1]) - 1, parseInt(match[2]))
        },
        // MM/DD or M/D (add current year)
        {
          regex: /^(\d{1,2})\/(\d{1,2})$/,
          format: (match: RegExpMatchArray) => new Date(currentYear, parseInt(match[1]) - 1, parseInt(match[2]))
        },
        // YYYY-MM-DD
        {
          regex: /(\d{4})-(\d{1,2})-(\d{1,2})/,
          format: (match: RegExpMatchArray) => new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]))
        },
        // Month DD, YYYY
        {
          regex: /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{1,2}),?\s+(\d{4})/i,
          format: (match: RegExpMatchArray) => new Date(`${match[1]} ${match[2]}, ${match[3]}`)
        },
        // Month DD (add current year)
        {
          regex: /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{1,2})/i,
          format: (match: RegExpMatchArray) => new Date(`${match[1]} ${match[2]}, ${currentYear}`)
        },
        // DD Month YYYY
        {
          regex: /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{4})/i,
          format: (match: RegExpMatchArray) => new Date(`${match[2]} ${match[1]}, ${match[3]}`)
        },
        // DD Month (add current year)
        {
          regex: /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*/i,
          format: (match: RegExpMatchArray) => new Date(`${match[2]} ${match[1]}, ${currentYear}`)
        }
      ];

      for (const pattern of patterns) {
        const match = cleanText.match(pattern.regex);
        if (match) {
          const parsedDate = pattern.format(match);
          if (!isNaN(parsedDate.getTime())) {
            // If date is in the past, try next year
            if (parsedDate <= new Date()) {
              const nextYearDate = new Date(parsedDate);
              nextYearDate.setFullYear(currentYear + 1);
              if (nextYearDate > new Date()) {
                return nextYearDate;
              }
            } else {
              return parsedDate;
            }
          }
        }
      }

      return null;
    } catch (error) {
      console.log(`Failed to parse date: "${dateText}"`);
      return null;
    }
  }

  getSources(): CalendarSource[] {
    return this.sources;
  }

  getSourcesByState(state: string): CalendarSource[] {
    return this.sources.filter(s => s.state === state);
  }

  getSourcesByType(type: string): CalendarSource[] {
    return this.sources.filter(s => s.type === type);
  }

  toggleSource(sourceId: string): boolean {
    const source = this.sources.find(s => s.id === sourceId);
    if (source) {
      source.isActive = !source.isActive;
      return source.isActive;
    }
    return false;
  }

  addSource(source: CalendarSource): boolean {
    // Check if source already exists
    const existingSource = this.sources.find(s => 
      s.feedUrl === source.feedUrl || s.id === source.id
    );

    if (existingSource) {
      return false; // Source already exists
    }

    // Check if there are already working feeds from the same domain/organization
    const domain = this.extractDomain(source.feedUrl || source.websiteUrl || '');
    const sameCityFeeds = this.sources.filter(s => 
      s.city.toLowerCase() === source.city.toLowerCase() && 
      s.state === source.state && 
      s.isActive
    );

    // If there are already active feeds for this city, disable this one by default
    if (sameCityFeeds.length > 0) {
      console.log(`Found ${sameCityFeeds.length} existing active feeds for ${source.city}, ${source.state}. New feed will be disabled by default.`);
      source.isActive = false;
    }

    // Add the new source
    this.sources.push(source);
    console.log(`Added new calendar source: ${source.name} (${source.city}, ${source.state}) - Active: ${source.isActive}`);

    // Apply feed prioritization after adding
    this.prioritizeFeeds(source);

    return true;
  }

  /**
   * Prioritize feeds by automatically disabling lower-priority feeds from the same domain/organization
   * when a higher-priority feed is working
   */
  private prioritizeFeeds(newSource: CalendarSource): void {
    // Find feeds from the same city/location
    const sameCityFeeds = this.sources.filter(s => 
      s.city.toLowerCase() === newSource.city.toLowerCase() && 
      s.state === newSource.state && 
      s.id !== newSource.id
    );

    if (sameCityFeeds.length === 0) return;

    // Define feed type priority (higher number = higher priority)
    const feedTypePriority: Record<string, number> = {
      'ical': 5,    // Highest priority - structured calendar data
      'webcal': 4,  // High priority - calendar specific
      'rss': 3,     // Medium priority - structured but not calendar specific
      'json': 2,    // Lower priority - depends on structure
      'html': 1     // Lowest priority - requires scraping
    };

    const newSourcePriority = feedTypePriority[newSource.feedType] || 0;

    // Find the highest priority active feed for this city
    const activeFeeds = sameCityFeeds.filter(s => s.isActive);
    const highestPriorityActiveFeed = activeFeeds.reduce((highest, current) => {
      const currentPriority = feedTypePriority[current.feedType] || 0;
      const highestPriority = feedTypePriority[highest?.feedType || ''] || 0;
      return currentPriority > highestPriority ? current : highest;
    }, null as CalendarSource | null);

    // If there's already a higher priority active feed, keep the new source disabled
    if (highestPriorityActiveFeed) {
      const highestPriority = feedTypePriority[highestPriorityActiveFeed.feedType] || 0;
      if (newSourcePriority <= highestPriority) {
        console.log(`Keeping new feed ${newSource.name} (${newSource.feedType}) disabled - higher priority feed ${highestPriorityActiveFeed.name} (${highestPriorityActiveFeed.feedType}) already active`);
        newSource.isActive = false;
        return;
      }
    }

    // Only test and potentially enable if this is the highest priority feed
    if (newSource.isActive) {
      this.testFeedWorking(newSource).then(isWorking => {
        if (isWorking) {
          console.log(`New feed ${newSource.name} is working and has highest priority, disabling lower priority feeds...`);

          // Disable lower priority feeds from the same city
          sameCityFeeds.forEach(existingSource => {
            const existingPriority = feedTypePriority[existingSource.feedType] || 0;

            if (existingPriority < newSourcePriority && existingSource.isActive) {
              console.log(`Disabling lower priority feed: ${existingSource.name} (${existingSource.feedType}) in favor of ${newSource.name} (${newSource.feedType})`);
              existingSource.isActive = false;
            }
          });
        } else {
          console.log(`New feed ${newSource.name} is not working, disabling it`);
          newSource.isActive = false;
        }
      }).catch(error => {
        console.error(`Error testing new feed ${newSource.name}:`, error);
        newSource.isActive = false;
      });
    }
  }

  /**
   * Test if a calendar feed is working by attempting to fetch and parse it
   */
  private async testFeedWorking(source: CalendarSource): Promise<boolean> {
    if (!source.feedUrl) return false;

    try {
      console.log(`Testing feed: ${source.name} - ${source.feedUrl}`);

      const response = await axios.get(source.feedUrl, {
        timeout: 5000,
        headers: {
          'User-Agent': 'CityWide Events Calendar Test 1.0',
          'Accept': 'text/calendar, application/calendar, text/plain, application/rss+xml, application/xml, application/json, text/html, */*'
        },
        validateStatus: (status) => status < 400
      });

      if (response.status >= 400) {
        console.log(`Feed test failed for ${source.name}: HTTP ${response.status}`);
        return false;
      }

      // Test basic parsing based on feed type
      switch (source.feedType) {
        case 'ical':
          const hasIcalData = response.data.includes('BEGIN:VCALENDAR') || response.data.includes('BEGIN:VEVENT');
          console.log(`iCal feed test for ${source.name}: ${hasIcalData ? 'PASS' : 'FAIL'}`);
          return hasIcalData;

        case 'rss':
          const hasRssData = response.data.includes('<rss') || response.data.includes('<feed') || response.data.includes('<item') || response.data.includes('<entry');
          console.log(`RSS feed test for ${source.name}: ${hasRssData ? 'PASS' : 'FAIL'}`);
          return hasRssData;

        case 'json':
          try {
            const jsonData = JSON.parse(response.data);
            const hasJsonEvents = jsonData.events || jsonData.items || jsonData.data || Array.isArray(jsonData);
            console.log(`JSON feed test for ${source.name}: ${hasJsonEvents ? 'PASS' : 'FAIL'}`);
            return !!hasJsonEvents;
          } catch {
            console.log(`JSON feed test for ${source.name}: FAIL (invalid JSON)`);
            return false;
          }

        case 'html':
          const hasHtmlContent = response.data.length > 100 && response.data.includes('<');
          console.log(`HTML feed test for ${source.name}: ${hasHtmlContent ? 'PASS' : 'FAIL'}`);
          return hasHtmlContent;

        default:
          console.log(`Unknown feed type for ${source.name}, assuming working`);
          return true;
      }
    } catch (error) {
      console.log(`Feed test error for ${source.name}:`, String(error));
      return false;
    }
  }

  /**
   * Extract domain from URL for grouping related feeds
   */
  private extractDomain(url: string): string | null {
    if (!url) return null;

    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      return urlObj.hostname.toLowerCase();
    } catch {
      return null;
    }
  }

  /**
   * Re-prioritize all feeds (useful for periodic maintenance)
   */
  async reprioritizeAllFeeds(): Promise<void> {
    console.log('Re-prioritizing all calendar feeds...');

    // Group sources by domain
    const domainGroups: Record<string, CalendarSource[]> = {};

    this.sources.forEach(source => {
      const domain = this.extractDomain(source.feedUrl || source.websiteUrl || '');
      if (domain) {
        if (!domainGroups[domain]) {
          domainGroups[domain] = [];
        }
        domainGroups[domain].push(source);
      }
    });

    // Process each domain group
    for (const [domain, sources] of Object.entries(domainGroups)) {
      if (sources.length <= 1) continue;

      console.log(`Processing ${sources.length} feeds for domain: ${domain}`);

      // Test all feeds in parallel
      const feedTests = await Promise.allSettled(
        sources.map(async source => ({
          source,
          isWorking: await this.testFeedWorking(source)
        }))
      );

      // Get successful tests
      const workingFeeds = feedTests
        .filter(result => result.status === 'fulfilled')
        .map(result => (result as any).value)
        .filter(test => test.isWorking);

      if (workingFeeds.length === 0) {
        console.log(`No working feeds found for domain: ${domain}`);
        continue;
      }

      // Sort by priority (highest first)
      const feedTypePriority: Record<string, number> = {
        'ical': 5, 'webcal': 4, 'rss': 3, 'json': 2, 'html': 1
      };

      workingFeeds.sort((a, b) => {
        const priorityA = feedTypePriority[a.source.feedType] || 0;
        const priorityB = feedTypePriority[b.source.feedType] || 0;
        return priorityB - priorityA;
      });

      // Enable the highest priority working feed, disable others
      sources.forEach(source => {
        const isTopPriority = source.id === workingFeeds[0]?.source.id;
        const wasActive = source.isActive;
        source.isActive = isTopPriority;

        if (wasActive !== source.isActive) {
          console.log(`${source.isActive ? 'Enabled' : 'Disabled'} feed: ${source.name} (${source.feedType})`);
        }
      });
    }

    console.log('Feed re-prioritization complete');
  }

  removeSource(sourceId: string): boolean {
    const index = this.sources.findIndex(s => s.id === sourceId);
    if (index !== -1) {
      const removed = this.sources.splice(index, 1)[0];
      console.log(`Removed calendar source: ${removed.name}`);
      return true;
    }
    return false;
  }

  /**
   * Comprehensive date extraction for San Jacinto events with enhanced pattern matching
   */
  private extractComprehensiveDate(text: string, $element?: any): Date | null {
    if (!text) return null;

    console.log(`Attempting comprehensive date extraction from: "${text}"`);

    // Try multiple approaches to find dates

    // 1. Look for explicit date patterns in the text
    const datePatterns = [
      // Full date patterns
      /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},?\s+\d{4}/i,
      /\d{1,2}\/\d{1,2}\/\d{4}/,
      /\d{4}-\d{1,2}-\d{1,2}/,

      // Month and day only (will add current/next year)
      /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2}/i,
      /\d{1,2}\/\d{1,2}(?!\d)/,

      // Day patterns with context
      /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2}/i,
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        console.log(`Found date pattern: "${match[0]}"`);
        const parsedDate = this.parseEventDate(match[0]);
        if (parsedDate) {
          console.log(`Successfully parsed date: ${parsedDate.toDateString()}`);
          return parsedDate;
        }
      }
    }

    // 2. Check element attributes if available
    if ($element) {
      const dateAttrs = ['data-date', 'datetime', 'data-event-date', 'title', 'data-start-date'];
      for (const attr of dateAttrs) {
        const attrValue = $element.attr(attr);
        if (attrValue) {
          console.log(`Checking attribute ${attr}: "${attrValue}"`);
          const attrDate = this.parseEventDate(attrValue);
          if (attrDate) {
            console.log(`Found date in attribute ${attr}: ${attrDate.toDateString()}`);
            return attrDate;
          }
        }
      }
    }

    // 3. Look for calendar context (table cell dates)
    if ($element) {
      const calendarDate = this.extractCalendarCellDate($element);
      if (calendarDate) {
        console.log(`Found calendar cell date: ${calendarDate.toDateString()}`);
        return calendarDate;
      }
    }

    console.log(`No date found in comprehensive extraction for: "${text}"`);
    return null;
  }

  /**
   * Extract date from text content or DOM elements
   */
  private extractDateFromText(text: string, $element?: any): Date | null {
    if (!text) return null;

    try {
      // First try the existing parseEventDate method
      const parsedDate = this.parseEventDate(text);
      if (parsedDate) return parsedDate;

      // If element is provided, check for date attributes
      if ($element) {
        const dateAttrs = ['data-date', 'datetime', 'data-event-date', 'title'];
        for (const attr of dateAttrs) {
          const attrValue = $element.attr(attr);
          if (attrValue) {
            const attrDate = this.parseEventDate(attrValue);
            if (attrDate) return attrDate;
          }
        }
      }

      return null;
    } catch (error) {
      console.log(`Failed to extract date from text: "${text}"`);
      return null;
    }
  }

  /**
   * Find month context from table headers or surrounding elements
   */
  private findMonthContext($cell: any): string | null {
    try {
      // Look for month in table headers
      const $table = $cell.closest('table');
      if ($table.length) {
        const headerText = $table.find('th, .month-header, .calendar-header').text();
        const monthMatch = headerText.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*/i);
        if (monthMatch) return monthMatch[1];
      }

      // Look for month in parent elements
      let $parent = $cell.parent();
      while ($parent.length && $parent.prop('tagName') !== 'BODY') {
        const parentText = $parent.text();
        const monthMatch = parentText.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*/i);
        if (monthMatch) return monthMatch[1];
        $parent = $parent.parent();
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Construct date from day number and month context
   */
  private constructDateFromDayAndMonth(day: number, monthContext: string | null): Date | null {
    if (!monthContext || day < 1 || day > 31) return null;

    try {
      const currentYear = new Date().getFullYear();
      const dateString = `${monthContext} ${day}, ${currentYear}`;
      const constructedDate = new Date(dateString);

      if (!isNaN(constructedDate.getTime())) {
        // If date is in the past, try next year
        if (constructedDate <= new Date()) {
          constructedDate.setFullYear(currentYear + 1);
        }
        return constructedDate;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get multiple recurring event dates for San Jacinto events
   */
  private getRecurringEventDates(eventTitle: string): Date[] {
    const now = new Date();
    const dates: Date[] = [];

    // Define recurring patterns for San Jacinto events - LIMITED TO PREVENT DUPLICATION
    if (eventTitle.toLowerCase().includes('city council meeting')) {
      // City Council meets 1st and 3rd Tuesday of each month - next 3 months only
      for (let month = 0; month < 3; month++) {
        const targetMonth = (now.getMonth() + month) % 12;
        const targetYear = now.getFullYear() + Math.floor((now.getMonth() + month) / 12);

        // Get 1st Tuesday
        const firstTuesday = this.getNthWeekdayOfMonth(targetYear, targetMonth, 2, 1);
        if (firstTuesday > now) dates.push(firstTuesday);

        // Get 3rd Tuesday
        const thirdTuesday = this.getNthWeekdayOfMonth(targetYear, targetMonth, 2, 3);
        if (thirdTuesday > now) dates.push(thirdTuesday);
      }
    } else if (eventTitle.toLowerCase().includes('planning commission')) {
      // Planning Commission meets 4th Tuesday of each month - next 3 months only
      for (let month = 0; month < 3; month++) {
        const targetMonth = (now.getMonth() + month) % 12;
        const targetYear = now.getFullYear() + Math.floor((now.getMonth() + month) / 12);

        const fourthTuesday = this.getNthWeekdayOfMonth(targetYear, targetMonth, 2, 4);
        if (fourthTuesday > now) dates.push(fourthTuesday);
      }
    } else if (eventTitle.toLowerCase().includes('kool august nights')) {
      // Kool August Nights - every Wednesday in August (current or next year)
      const currentYear = now.getFullYear();
      const augustYear = now.getMonth() >= 7 ? currentYear + 1 : currentYear;

      for (let week = 1; week <= 4; week++) {
        const wednesday = this.getNthWeekdayOfMonth(augustYear, 7, 3, week);
        if (wednesday > now) dates.push(wednesday);
      }
    }

    return dates.slice(0, 6); // Limit to 6 future occurrences maximum
  }

  /**
   * Get the Nth occurrence of a weekday in a given month
   */
  private getNthWeekdayOfMonth(year: number, month: number, weekday: number, occurrence: number): Date {
    const firstDay = new Date(year, month, 1);
    const firstWeekday = firstDay.getDay();

    // Calculate the date of the first occurrence of the target weekday
    const daysUntilTargetWeekday = (weekday - firstWeekday + 7) % 7;
    const firstOccurrence = 1 + daysUntilTargetWeekday;

    // Calculate the date of the Nth occurrence
    const targetDate = firstOccurrence + (occurrence - 1) * 7;

    // Create date at noon to avoid timezone boundary issues
    const result = new Date(year, month, targetDate, 12, 0, 0);
    return result;
  }

  /**
   * Get next occurrence date for recurring events (legacy fallback)
   */
  private getNextOccurrenceDate(eventTitle: string): Date {
    const recurringDates = this.getRecurringEventDates(eventTitle);
    return recurringDates.length > 0 ? recurringDates[0] : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }

  /**
   * Get typical date for school events
   */
  private getSchoolEventDate(eventType: string): Date {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // School board meetings typically happen monthly
    if (eventType.toLowerCase().includes('board')) {
      // Next month's second Tuesday
      const nextMonth = (currentMonth + 1) % 12;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      return this.getNthWeekdayOfMonth(nextYear, nextMonth, 2, 2); // 2nd Tuesday
    }

    // Parent conferences typically in fall and spring
    if (eventType.toLowerCase().includes('parent conference')) {
      const isSpring = currentMonth >= 1 && currentMonth <= 5;
      const targetMonth = isSpring ? 4 : 10; // May or November
      const targetYear = targetMonth < currentMonth ? currentYear + 1 : currentYear;
      return new Date(targetYear, targetMonth, 15, 18, 0); // 15th at 6 PM
    }

    // Open house events typically in September or January
    if (eventType.toLowerCase().includes('open house')) {
      const targetMonth = currentMonth < 8 ? 8 : 0; // September or January
      const targetYear = targetMonth === 0 ? currentYear + 1 : currentYear;
      return new Date(targetYear, targetMonth, 10, 19, 0); // 10th at 7 PM
    }

    // Default: next month on the 15th
    const nextMonth = (currentMonth + 1) % 12;
    const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    return new Date(nextYear, nextMonth, 15, 19, 0);
  }

  /**
   * Categorize school events
   */
  private getSchoolEventCategory(eventType: string): string {
    const type = eventType.toLowerCase();
    
    if (type.includes('board') || type.includes('meeting')) return 'Government';
    if (type.includes('athletic') || type.includes('game') || type.includes('sport')) return 'Sports & Recreation';
    if (type.includes('graduation') || type.includes('ceremony') || type.includes('awards')) return 'Education & Learning';
    if (type.includes('conference') || type.includes('workshop') || type.includes('training')) return 'Education & Learning';
    if (type.includes('holiday') || type.includes('break') || type.includes('celebration')) return 'Holiday';
    if (type.includes('registration') || type.includes('enrollment') || type.includes('orientation')) return 'Education & Learning';
    
    return 'Education & Learning';
  }

  /**
   * Extract date from calendar table cell context
   */
  private extractCalendarCellDate($element: any): Date | null {
    try {
      // Look for day number in the cell or its children
      const dayText = $element.find('a').first().text().trim() || 
                    $element.text().match(/\b(\d{1,2})\b/)?.[1];

      if (dayText && /^\d{1,2}$/.test(dayText)) {
        const dayNumber = parseInt(dayText);

        // Find month context from table structure
        const monthContext = this.findMonthContext($element);
        if (monthContext) {
          return this.constructDateFromDayAndMonth(dayNumber, monthContext);
        }

        // Try to extract month from URL or page context
        const pageText = $element.closest('body').find('h1, h2, .page-title, .calendar-title').text();
        const monthMatch = pageText.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*/i);
        if (monthMatch) {
          return this.constructDateFromDayAndMonth(dayNumber, monthMatch[1]);
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Clean event title by removing common unwanted patterns
   */
  private cleanEventTitle(title: string): string {
    if (!title) return '';

    return title
      .replace(/\d{1,2}:\d{2}\s*(AM|PM)/gi, '') // Remove times
      .replace(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*\d{1,2}/gi, '') // Remove dates
      .replace(/\d{1,2}\/\d{1,2}\/?\d*/, '') // Remove date patterns
      .replace(/\s+-\s+\d{1,2}:\d{2}\s*(AM|PM)/gi, '') // Remove time ranges
      .replace(/^\W+|\W+$/g, '') // Remove leading/trailing non-word chars
      .replace(/\s+/g, ' ') // Collapse whitespace
      .trim();
  }

  /**
   * Comprehensive date extraction from event element and text
   */
  private extractEventDateComprehensive($element: any, elementText: string): Date | null {
    // Strategy 1: Look for date in element attributes
    const dateAttrs = ['data-date', 'datetime', 'data-event-date', 'data-start', 'title'];
    for (const attr of dateAttrs) {
      const attrValue = $element.attr(attr);
      if (attrValue) {
        const attrDate = this.parseEventDate(attrValue);
        if (attrDate) return attrDate;
      }
    }

    // Strategy 2: Look for date in child elements
    const dateElements = $element.find('.date, .event-date, time, [class*="date"], [class*="time"]');
    if (dateElements.length > 0) {
      const dateText = dateElements.first().text().trim();
      const elementDate = this.parseEventDate(dateText);
      if (elementDate) return elementDate;
    }

    // Strategy 3: Extract date patterns from element text
    const datePatterns = [
      /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},?\s+\d{4}/i,
      /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2}/i,
      /\d{1,2}\/\d{1,2}\/\d{4}/,
      /\d{1,2}\/\d{1,2}/,
      /\d{4}-\d{1,2}-\d{1,2}/
    ];

    for (const pattern of datePatterns) {
      const match = elementText.match(pattern);
      if (match) {
        const patternDate = this.parseEventDate(match[0]);
        if (patternDate) return patternDate;
      }
    }

    // Strategy 4: Look for relative dates
    const today = new Date();
    const relativePatterns = [
      { pattern: /today/i, days: 0 },
      { pattern: /tomorrow/i, days: 1 },
      { pattern: /this\s+weekend/i, days: this.getDaysUntilWeekend() },
      { pattern: /next\s+week/i, days: 7 },
      { pattern: /next\s+month/i, days: 30 }
    ];

    for (const relative of relativePatterns) {
      if (relative.pattern.test(elementText)) {
        const relativeDate = new Date(today);
        relativeDate.setDate(today.getDate() + relative.days);
        return relativeDate;
      }
    }

    return null;
  }

  /**
   * Extract events from text patterns when structured data isn't available
   */
  private extractEventsFromTextPatterns($: any, source: CalendarSource, parsedEvents: InsertEvent[]): void {
    console.log(`Attempting text pattern extraction for ${source.name}`);

    // Look for specific event-related content areas first, then broader areas
    const eventSections = [
      '.main-content, .content, .page-content',
      '.events, .calendar, .announcements, .news',
      '.upcoming, .activities, .meetings',
      'main, article, section',
      '.container, .wrapper, .layout',
      '#content, #main, #primary',
      '.region-content, .field-content',
      'body > div, html > body > div'
    ];

    let targetContent = '';
    let bestSelector = '';

    // Try to find the most relevant content area
    for (const selector of eventSections) {
      const $section = $(selector);
      if ($section.length > 0) {
        const sectionText = $section.text().trim();
        // Look for content that's substantial but not overwhelming
        if (sectionText.length > 100 && sectionText.length < 100000) {
          // Prefer content that contains event-related keywords
          const eventKeywordCount = this.countEventKeywords(sectionText);
          if (eventKeywordCount > 0 || !targetContent) {
            if (eventKeywordCount > this.countEventKeywords(targetContent) || 
                (eventKeywordCount === this.countEventKeywords(targetContent) && sectionText.length > targetContent.length)) {
              targetContent = sectionText;
              bestSelector = selector;
            }
          }
        }
      }
    }

    // Fallback to body content if no specific sections found
    if (!targetContent) {
      targetContent = $('body').text().trim();
      bestSelector = 'body';
      console.log(`Using full body content (${targetContent.length} chars)`);
    } else {
      console.log(`Using content from selector: ${bestSelector} (${targetContent.length} chars) with ${this.countEventKeywords(targetContent)} event keywords`);
    }

    const eventKeywords = [
      'meeting', 'conference', 'workshop', 'seminar', 'training',
      'celebration', 'festival', 'concert', 'performance', 'exhibition',
      'council', 'board', 'committee', 'hearing', 'forum',
      'graduation', 'ceremony', 'game', 'match', 'tournament',
      'fundraiser', 'dinner', 'lunch', 'dance', 'show',
      'class', 'session', 'orientation', 'registration', 'enrollment',
      'assembly', 'gathering', 'presentation', 'lecture', 'discussion'
    ];

    // Split text into meaningful chunks (sentences and short paragraphs)
    const chunks = targetContent
      .split(/(?:[.!?]+\s+)|(?:\n\s*\n)/)
      .map(chunk => chunk.trim())
      .filter(chunk => chunk.length > 30 && chunk.length < 500); // Reasonable event description length

    console.log(`Processing ${chunks.length} text chunks for event patterns`);

    for (const chunk of chunks.slice(0, 100)) { // Limit processing
      // Check if chunk contains event keywords and dates
      const hasEventKeyword = eventKeywords.some(keyword => 
        chunk.toLowerCase().includes(keyword)
      );

      if (hasEventKeyword) {
        // Look for date patterns in the chunk
        const datePatterns = [
          /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2}(?:,?\s+\d{4})?/i,
          /\d{1,2}\/\d{1,2}\/\d{4}/,
          /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2}/i
        ];

        let dateMatch = null;
        for (const pattern of datePatterns) {
          dateMatch = chunk.match(pattern);
          if (dateMatch) break;
        }

        if (dateMatch) {
          const eventDate = this.parseEventDate(dateMatch[0]);

          if (eventDate && eventDate > new Date()) {
            // Extract likely title - look for the main subject of the sentence
            let title = '';

            // Try to find title patterns in the chunk
            const titlePatterns = [
              /(?:the\s+)?([A-Z][^.!?]*(?:meeting|conference|workshop|seminar|training|celebration|festival|concert|performance|exhibition|council|board|committee|hearing|forum|graduation|ceremony|game|match|tournament|fundraiser|dinner|lunch|dance|show)[^.!?]*)/i,
              /([A-Z][^.!?]*(?:will be|is scheduled|takes place|occurs)[^.!?]*)/i,
              /([A-Z][^.!?]{10,80})/
            ];

            for (const pattern of titlePatterns) {
              const titleMatch = chunk.match(pattern);
              if (titleMatch && this.isValidEventTitle(titleMatch[1])) {
                title = titleMatch[1].trim();
                break;
              }
            }

            // Fallback: use first meaningful sentence
            if (!title) {
              const sentences = chunk.split(/[.!?]/);
              for (const sentence of sentences) {
                const cleanSentence = sentence.trim();
                if (cleanSentence.length > 15 && cleanSentence.length < 150 && this.isValidEventTitle(cleanSentence)) {
                  title = cleanSentence;
                  break;
                }
              }
            }

            if (title && title.length > 10) {
              parsedEvents.push({
                title: this.cleanText(title),
                description: this.cleanText(chunk.substring(0, 300)),
                category: this.categorizeEvent(title, chunk),
                location: `${source.city}, ${source.state}`,
                organizer: source.name,
                startDate: eventDate,
                endDate: new Date(eventDate.getTime() + 2 * 60 * 60 * 1000),
                startTime: eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
                endTime: new Date(eventDate.getTime() + 2 * 60 * 60 * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
                attendees: 0,
                imageUrl: null,
                isFree: 'true',
                source: source.id
              });

              console.log(`✓ Extracted text pattern event: "${title}" on ${eventDate.toDateString()}`);
            }
          }
        }
      }
    }
  }

  /**
   * Get days until next weekend (Saturday)
   */
  private getDaysUntilWeekend(): number {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday, 6 = Saturday
    const daysUntilSaturday = (6 - currentDay + 7) % 7;
    return daysUntilSaturday === 0 ? 7 : daysUntilSaturday; // If today is Saturday, return next Saturday
  }

  /**
   * Extract events from full page text analysis - for completely unorganized websites
   */
  private extractEventsFromFullPageText($: any, source: CalendarSource, parsedEvents: InsertEvent[]): void {
    console.log(`Full page text analysis for ${source.name}`);
    
    // Get all text content from the entire page
    const fullPageText = $('body').text();
    
    // Split into sentences and paragraphs
    const textChunks = fullPageText
      .split(/[.!?]\s+|\n\s*\n/)
      .map(chunk => chunk.trim())
      .filter(chunk => chunk.length > 20 && chunk.length < 1000);

    console.log(`Analyzing ${textChunks.length} text chunks from full page`);

    // Look for patterns that suggest events
    const eventPatterns = [
      // Meeting patterns
      /\b(meeting|assembly|gathering|conference|workshop|seminar)\b.*?\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{1,2}\/\d{1,2}|\d{1,2}:\d{2})/i,
      
      // School events
      /\b(school|district|board|pta|pto)\b.*?\b(meeting|event|night|day)\b.*?\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{1,2}\/\d{1,2}|\d{1,2}:\d{2})/i,
      
      // Community events
      /\b(community|city|town|council)\b.*?\b(event|meeting|celebration|festival)\b.*?\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{1,2}\/\d{1,2}|\d{1,2}:\d{2})/i,
      
      // Date-first patterns
      /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(?:,?\s+\d{4})?\b.*?\b(meeting|event|activity|program|class|session|workshop|seminar|conference|celebration|festival|concert|performance|game|match|tournament|ceremony|graduation|fundraiser|dinner|lunch|dance|show|presentation|lecture|orientation|registration|fair|expo|exhibition)/i,
      
      // Time patterns
      /\b\d{1,2}:\d{2}\s*[ap]m\b.*?\b(meeting|event|activity|program|class|session|workshop|seminar|conference|celebration|festival|concert|performance|game|match|tournament|ceremony|graduation|fundraiser|dinner|lunch|dance|show|presentation|lecture|orientation|registration|fair|expo|exhibition)/i,
      
      // Weekday patterns
      /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b.*?\b(meeting|event|activity|program|class|session|workshop|seminar|conference|celebration|festival|concert|performance|game|match|tournament|ceremony|graduation|fundraiser|dinner|lunch|dance|show|presentation|lecture|orientation|registration|fair|expo|exhibition)/i,
      
      // Action patterns
      /\b(join us|come|attend|participate|register|rsvp)\b.*?\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{1,2}\/\d{1,2}|\d{1,2}:\d{2}|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i
    ];

    for (const chunk of textChunks.slice(0, 200)) { // Limit to prevent overwhelming processing
      for (const pattern of eventPatterns) {
        if (pattern.test(chunk)) {
          // Extract date from the chunk
          let eventDate = this.extractDateFromFullText(chunk);
          
          if (eventDate && eventDate > new Date()) {
            // Create a clean title from the chunk
            let title = this.extractTitleFromEventText(chunk);
            
            if (title && title.length > 10 && title.length < 200) {
              parsedEvents.push({
                title: this.cleanText(title),
                description: this.cleanText(chunk.substring(0, 300)),
                category: this.categorizeEvent(title, chunk),
                location: `${source.city}, ${source.state}`,
                organizer: source.name,
                startDate: eventDate,
                endDate: new Date(eventDate.getTime() + 2 * 60 * 60 * 1000),
                startTime: eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
                endTime: new Date(eventDate.getTime() + 2 * 60 * 60 * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
                attendees: 0,
                imageUrl: null,
                isFree: 'true',
                source: source.id
              });

              console.log(`✓ Full page analysis found: "${title}" on ${eventDate.toDateString()}`);

              // Limit results to prevent too many low-quality events
              if (parsedEvents.length >= 15) return;
            }
          }
        }
      }
    }

    console.log(`Full page analysis completed: found ${parsedEvents.length} events`);
  }

  /**
   * Extract date from free-form text
   */
  private extractDateFromFullText(text: string): Date | null {
    // Try all the date patterns we know
    const datePatterns = [
      /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2}(?:,?\s+\d{4})?/i,
      /\d{1,2}\/\d{1,2}\/?\d{0,4}/,
      /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[,\s]*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2}/i,
      /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        const date = this.parseEventDate(match[0]);
        if (date) return date;
      }
    }

    return null;
  }

  /**
   * Extract a clean title from event text
   */
  private extractTitleFromEventText(text: string): string {
    // Look for sentences that start with capital letters and contain event words
    const sentences = text.split(/[.!?]/).map(s => s.trim());
    
    for (const sentence of sentences) {
      if (sentence.length > 10 && sentence.length < 150) {
        // Check if it contains event-related words
        const eventWords = ['meeting', 'event', 'program', 'class', 'session', 'workshop', 'seminar', 'conference', 'celebration', 'festival', 'concert', 'performance', 'game', 'ceremony', 'fundraiser', 'presentation', 'orientation'];
        if (eventWords.some(word => sentence.toLowerCase().includes(word))) {
          // Clean up the sentence to make a good title
          return sentence
            .replace(/^\w+,?\s*/i, '') // Remove leading words like "Additionally,"
            .replace(/\s*(on|at|in)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{1,2}\/\d{1,2}|\d{1,2}:\d{2}).*$/i, '') // Remove date/time suffixes
            .trim();
        }
      }
    }

    // Fallback: use first reasonable chunk
    const words = text.split(/\s+/).slice(0, 10).join(' ');
    return words.length > 10 ? words : text.substring(0, 50);
  }

  /**
   * Ultra-aggressive extraction: Find ANY content with dates and treat as potential events
   */
  private extractEventsFromAnyDateContent($: any, source: CalendarSource, parsedEvents: InsertEvent[]): void {
    console.log(`Ultra-aggressive extraction: scanning all content for dates in ${source.name}`);

    // Get all text content from the page
    const allElements = $('*').not('script, style, nav, header, footer');

    allElements.each((_, element) => {
      const $element = $(element);
      const elementText = $element.text().trim();

      // Skip if too short, too long, or clearly not content
      if (elementText.length < 10 || elementText.length > 1000) return;
      if ($element.find('*').length > 20) return; // Skip containers with many children

      // Look for any date patterns in the text
      const datePatterns = [
        // Full dates
        /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2}(?:,?\s+\d{4})?/gi,
        /\d{1,2}\/\d{1,2}\/?\d{0,4}/g,
        /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[,\s]+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2}/gi,
        // Times that might indicate events
        /\d{1,2}:\d{2}\s*(AM|PM|am|pm)/g,
        // Date ranges
        /\d{1,2}\s*-\s*\d{1,2}/g
      ];

      let hasDate = false;
      let extractedDate: Date | null = null;

      for (const pattern of datePatterns) {
        const matches = elementText.match(pattern);
        if (matches && matches.length > 0) {
          hasDate = true;
          // Try to parse the first date found
          for (const match of matches) {
            const parsedDate = this.parseEventDate(match);
            if (parsedDate && parsedDate > new Date()) {
              extractedDate = parsedDate;
              break;
            }
          }
          break;
        }
      }

      if (hasDate && extractedDate) {
        // Create a title from the text - use the sentence/phrase containing the date
        const sentences = elementText.split(/[.!?]\s+/);
        let bestTitle = '';

        for (const sentence of sentences) {
          // Check if this sentence contains a date pattern
          let containsDate = false;
          for (const pattern of datePatterns) {
            if (pattern.test(sentence)) {
              containsDate = true;
              break;
            }
          }

          if (containsDate && sentence.length > 10 && sentence.length < 200) {
            bestTitle = sentence.trim();
            break;
          }
        }

        // Fallback: use first reasonable chunk of text
        if (!bestTitle) {
          const chunks = elementText.split(/\n/).map(c => c.trim()).filter(c => c.length > 10 && c.length < 200);
          bestTitle = chunks[0] || elementText.substring(0, 100);
        }

        if (bestTitle && bestTitle.length > 5) {
          // Clean and validate the title
          bestTitle = this.cleanText(bestTitle);

          // Only add if it passes a very basic validity check
          if (bestTitle.length > 5 && !bestTitle.match(/^(skip to|search|menu|home|about|contact)$/i)) {
            parsedEvents.push({
              title: bestTitle,
              description: this.cleanText(elementText.substring(0, 300)) || 'Event details available on website',
              category: this.categorizeEvent(bestTitle, elementText),
              location: `${source.city}, ${source.state}`,
              organizer: source.name,
              startDate: extractedDate,
              endDate: new Date(extractedDate.getTime() + 2 * 60 * 60 * 1000),
              startTime: extractedDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
              endTime: new Date(extractedDate.getTime() + 2 * 60 * 60 * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
              attendees: 0,
              imageUrl: null,
              isFree: 'true',
              source: source.id
            });

            console.log(`✓ Ultra-aggressive extraction found: "${bestTitle}" on ${extractedDate.toDateString()}`);

            // Limit to prevent too many duplicate/low-quality events
            if (parsedEvents.length >= 10) return false;
          }
        }
      }
    });

    console.log(`Ultra-aggressive extraction completed: found ${parsedEvents.length} potential events`);
  }

  /**
   * Count event-related keywords in text to help identify relevant content sections
   */
  private countEventKeywords(text: string): number {
    if (!text) return 0;

    const eventKeywords = [
      'meeting', 'conference', 'workshop', 'seminar', 'training',
      'celebration', 'festival', 'concert', 'performance', 'exhibition',
      'council', 'board', 'committee', 'hearing', 'forum',
      'graduation', 'ceremony', 'game', 'match', 'tournament',
      'fundraiser', 'dinner', 'lunch', 'dance', 'show',
      'class', 'session', 'orientation', 'registration', 'enrollment',
      'assembly', 'gathering', 'presentation', 'lecture', 'discussion',
      'event', 'calendar', 'schedule', 'activity', 'program'
    ];

    const lowerText = text.toLowerCase();
    return eventKeywords.reduce((count, keyword) => {
      const matches = lowerText.split(keyword).length - 1;
      return count + matches;
    }, 0);
  }

  /**
   * Check if an element is likely a navigation or structural element rather than event content
   */
  private isNavigationElement($element: any, elementText: string): boolean {
    // Fix null element check
    if (!$element) return false;
    
    // Check for navigation-specific classes and IDs
    const elementClasses = $element.attr('class') || '';
    const elementId = $element.attr('id') || '';

    const navIndicators = [
      'nav', 'menu', 'header', 'footer', 'sidebar', 'breadcrumb',
      'search', 'login', 'user', 'account', 'social', 'share',
      'skip', 'accessibility', 'translate', 'language'
    ];

    for (const indicator of navIndicators) {
      if (elementClasses.toLowerCase().includes(indicator) || 
          elementId.toLowerCase().includes(indicator)) {
        return true;
      }
    }

    // Check for navigation-specific text patterns - be much more permissive now
    const navTextPatterns = [
      /^skip to/i,
      /^search$/i,
      /^menu$/i,
      /^translate$/i,
      /^login$/i,
      /^accessibility$/i
    ];

    for (const pattern of navTextPatterns) {
      if (pattern.test(elementText.trim())) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if element is likely just a container with no meaningful event content
   */
  private isContainerOnlyElement($element: any, elementText: string): boolean {
    // Check if element has many child elements but little direct text
    const childrenCount = $element.children().length;
    const directText = $element.clone().children().remove().end().text().trim();

    // If element has many children but very little direct text, it's likely just a container
    if (childrenCount > 5 && directText.length < 50) {
      return true;
    }

    // Check for container-specific patterns
    const containerPatterns = [
      /^(show|hide|toggle|expand|collapse)$/i,
      /^(previous|next|page \d+)$/i,
      /^(sort by|filter by|view all)$/i,
      /^(loading|please wait)$/i
    ];

    for (const pattern of containerPatterns) {
      if (pattern.test(elementText)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Validate if a title string represents a real upcoming event - STRICT VERSION
   */
  private isValidEventTitle(title: string): boolean {
    if (!title || title.length < 5 || title.length > 300) return false;

    // Exclude clearly invalid patterns first
    const invalidPatterns = [
      /^skip to/i,
      /^search$/i,
      /^menu$/i,
      /^home$/i,
      /^about$/i,
      /^contact$/i,
      /^login$/i,
      /^translate$/i,
      /^back to/i,
      /^go to/i,
      /^click here$/i,
      /^view all$/i,
      /^read more$/i,
      /^more info$/i,
      /^privacy policy$/i,
      /^terms of service$/i,
      /^copyright/i,
      /^all rights reserved/i,
      /past.*agenda/i,
      /^past /i,
      /^prior to/i,
      /archive/i,
      /history/i,
      /previous/i,
      /old/i,
      /\d{4}.*through.*\d{4}/i, // Date ranges like "2022 through 2023"
      /^board agenda.*\d{4}/i,
      /employment/i,
      /policy/i,
      /procedure/i,
      /form/i,
      /application/i,
      /document/i,
      /guideline/i,
      /manual/i,
      /handbook/i,
      /directory/i,
      /staff/i,
      /department/i,
      /administration/i,
      /superintendent/i,
      /principal/i,
      /teacher/i,
      /communications/i,
      /enrollment/i,
      /registration/i,
      /curriculum/i,
      /resources/i,
      /links/i,
      /wellness center/i,
      /nutrition services/i,
      /student rights/i,
      /nondiscrimination/i,
      /complaint/i,
      /harassment/i,
      /bullying/i,
      /prevention/i,
      /covid/i,
      /technology/i,
      /google/i,
      /clever/i,
      /badge/i,
      /classroom/i,
      /faq/i,
      /help/i,
      /tutorial/i,
      /how to/i,
      /instructions/i,
      /spotlight/i,
      /valedictorian/i,
      /graduate/i,
      /awards/i,
      /recognition/i,
      /video gallery/i,
      /photo gallery/i,
      /gallery/i,
      /image/i,
      /video/i,
      /your browser/i,
      /browser does not support/i,
      /end of/i,
      /find us/i,
      /stay connected/i,
      /powered by/i,
      /visit us/i,
      /website/i,
      /site/i,
      /page/i,
      /navigation/i,
      /submenu/i,
      /show submenu/i,
      /toggle/i,
      /expand/i,
      /collapse/i
    ];

    for (const pattern of invalidPatterns) {
      if (pattern.test(title)) {
        return false;
      }
    }

    // REQUIRE explicit event indicators - much more strict
    const requiredEventIndicators = [
      // Meetings and formal events
      /\bboard meeting\b/i,
      /\bcouncil meeting\b/i,
      /\bschool board\b/i,
      /\bmeeting\b.*\b(tonight|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i,
      /\b(tonight|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec).*\bmeeting\b/i,
      
      // School events with dates
      /\b(game|match|tournament|graduation|ceremony|concert|performance|play|show)\b.*\b(tonight|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i,
      /\b(tonight|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec).*\b(game|match|tournament|graduation|ceremony|concert|performance|play|show)\b/i,
      
      // Community events
      /\b(festival|fair|fundraiser|dinner|lunch|breakfast|dance|party|reunion|expo|exhibition|open house)\b/i,
      
      // Educational events with timing
      /\b(workshop|seminar|training|conference|presentation|lecture|class|session|orientation)\b.*\b(tonight|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i,
      
      // Events with specific times
      /\b\d{1,2}:\d{2}\s*(am|pm)\b/i,
      
      // Upcoming/scheduled events
      /\bupcoming\b.*\b(meeting|event|activity|program|class|session|workshop|seminar|conference|celebration|festival|concert|performance|game|match|tournament|ceremony|graduation|fundraiser)\b/i,
      /\bscheduled\b.*\b(meeting|event|activity|program|class|session|workshop|seminar|conference|celebration|festival|concert|performance|game|match|tournament|ceremony|graduation|fundraiser)\b/i,
      /\bnext\b.*\b(meeting|event|activity|program|class|session|workshop|seminar|conference|celebration|festival|concert|performance|game|match|tournament|ceremony|graduation|fundraiser)\b/i,
      
      // Action phrases for events
      /\b(join us|attend|participate|register|rsvp)\b.*\b(for|to)\b/i,
      
      // Specific future dates
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}.*\d{4}/i,
      /\b\d{1,2}\/\d{1,2}\/\d{4}\b/i,
      /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}/i
    ];

    // Title must contain at least one required event indicator
    return requiredEventIndicators.some(indicator => indicator.test(title));
  }

  /**
   * Validate if the content represents a valid upcoming event - STRICT VERSION
   */
  private isValidEventContent(elementText: string, title: string): boolean {
    // Filter out obvious administrative/non-event content
    const invalidContentPatterns = [
      /^skip to/i,
      /^search$/i,
      /^menu$/i,
      /^home$/i,
      /^login$/i,
      /copyright.*all rights reserved/i,
      /privacy policy/i,
      /terms of service/i,
      /past.*agenda/i,
      /prior to/i,
      /archive/i,
      /history/i,
      /previous/i,
      /old/i,
      /\d{4}.*through.*\d{4}/i,
      /employment/i,
      /policy/i,
      /procedure/i,
      /form/i,
      /application/i,
      /document/i,
      /guideline/i,
      /manual/i,
      /handbook/i,
      /directory/i,
      /staff/i,
      /department/i,
      /administration/i,
      /communications/i,
      /curriculum/i,
      /wellness center/i,
      /nutrition services/i,
      /student rights/i,
      /nondiscrimination/i,
      /complaint/i,
      /harassment/i,
      /bullying/i,
      /prevention/i,
      /covid/i,
      /technology/i,
      /faq/i,
      /help/i,
      /tutorial/i,
      /instructions/i,
      /spotlight/i,
      /valedictorian/i,
      /awards/i,
      /recognition/i,
      /gallery/i,
      /your browser/i,
      /browser does not support/i,
      /find us/i,
      /stay connected/i,
      /powered by/i,
      /visit us/i,
      /navigation/i,
      /submenu/i
    ];

    for (const pattern of invalidContentPatterns) {
      if (pattern.test(elementText)) {
        return false;
      }
    }

    // Require length to be reasonable for an event description
    if (elementText.length < 15 || elementText.length > 1000) return false;

    // Must contain explicit event content indicators with timing
    const validEventContentPatterns = [
      // Events with specific dates/times
      /\b(meeting|event|activity|program|class|session|workshop|seminar|conference|celebration|festival|concert|performance|game|match|tournament|ceremony|graduation|fundraiser)\b.*\b(tonight|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2}:\d{2})\b/i,
      /\b(tonight|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2}:\d{2})\b.*\b(meeting|event|activity|program|class|session|workshop|seminar|conference|celebration|festival|concert|performance|game|match|tournament|ceremony|graduation|fundraiser)\b/i,
      
      // Upcoming/scheduled events
      /\b(upcoming|scheduled|next)\b.*\b(meeting|event|activity|program|class|session|workshop|seminar|conference|celebration|festival|concert|performance|game|match|tournament|ceremony|graduation|fundraiser)\b/i,
      
      // Action phrases for events
      /\b(join us|attend|participate|register|rsvp)\b.*\b(for|to)\b/i,
      /\b(will be held|takes place|is scheduled|happening)\b/i,
      
      // Board/council meetings
      /\b(board|council)\s+(meeting|session)\b/i,
      
      // School events
      /\b(school board|pta|pto)\s+(meeting|event)\b/i,
      
      // Specific times
      /\b\d{1,2}:\d{2}\s*(am|pm)\b/i,
      
      // Future dates
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}.*\d{4}/i,
      /\b\d{1,2}\/\d{1,2}\/\d{4}\b/i
    ];

    // Content must match at least one valid event pattern
    return validEventContentPatterns.some(pattern => pattern.test(elementText));
  }
}

export const calendarCollector = new CalendarFeedCollector();