import axios from 'axios';
import * as cheerio from 'cheerio';
import { CalendarSource } from './calendar-collector';
import { cityDiscoverer, US_CITIES_DATABASE } from './us-cities-database';

interface LocationInfo {
  city: string;
  state: string;
  county?: string;
  type: 'city' | 'county' | 'township' | 'village';
}

interface DiscoveredFeed {
  source: CalendarSource;
  confidence: number; // 0-1 score indicating feed reliability
  lastChecked: Date;
}

interface RegionalDiscoveryRequest {
  regions: string[]; // Array of city names like "Portland, OR"
  includeAllTypes?: boolean;
  populationRange?: { min: number; max: number };
}

export class LocationFeedDiscoverer {
  private commonFeedPaths = [
    '/calendar',
    '/events',
    '/apps/events',
    '/calendar.ics',
    '/events.ics',
    '/calendar/feed',
    '/events/feed',
    '/calendar.rss',
    '/events.rss',
    '/api/events',
    '/api/calendar',
    '/feeds/calendar',
    '/feeds/events',
    '/ICalendarHandler?calendarId=12712452'
  ];

  private governmentDomainPatterns = [
    '{city}.gov',
    '{city}.{state}.gov', 
    'www.{city}.gov',
    'www.{city}.{state}.gov',
    '{city}{state}.gov',
    'city{city}.gov',
    'cityof{city}.gov'
  ];

  private schoolDistrictPatterns = [
    '{city}.K12.{state}.us',
    '{city}schools.org',
    '{city}schools.edu',
    '{city}sd.org',
    '{city}isd.org',
    '{city}usd.org',
    'www.{city}schools.org',
    'www.{city}schools.edu'
  ];

  private chamberPatterns = [
    '{city}chamber.org',
    '{city}chamber.com',
    'www.{city}chamber.org',
    'www.{city}chamber.com',
    '{city}chamberofcommerce.org',
    '{city}chamberofcommerce.com'
  ];

  private libraryPatterns = [
    '{city}library.org',
    '{city}publiclibrary.org',
    'www.{city}library.org',
    'www.{city}pl.org',
    '{city}lib.org'
  ];

  private parkRecPatterns = [
    '{city}parks.org',
    '{city}recreation.org',
    'www.{city}parks.org',
    '{city}parksandrec.org'
  ];

  async discoverFeedsForLocation(location: LocationInfo): Promise<DiscoveredFeed[]> {
    console.log(`Discovering calendar feeds for ${location.city}, ${location.state}...`);
    
    const discoveredFeeds: DiscoveredFeed[] = [];
    const citySlug = this.createCitySlug(location.city);
    const stateSlug = location.state.toLowerCase();

    // Discover government feeds
    const govFeeds = await this.discoverGovernmentFeeds(location, citySlug, stateSlug);
    discoveredFeeds.push(...govFeeds);

    // Discover school district feeds
    const schoolFeeds = await this.discoverSchoolFeeds(location, citySlug, stateSlug);
    discoveredFeeds.push(...schoolFeeds);

    // Discover chamber of commerce feeds
    const chamberFeeds = await this.discoverChamberFeeds(location, citySlug, stateSlug);
    discoveredFeeds.push(...chamberFeeds);

    // Discover library feeds
    const libraryFeeds = await this.discoverLibraryFeeds(location, citySlug, stateSlug);
    discoveredFeeds.push(...libraryFeeds);

    // Discover parks and recreation feeds
    const parkRecFeeds = await this.discoverParkRecFeeds(location, citySlug, stateSlug);
    discoveredFeeds.push(...parkRecFeeds);

    // Sort by confidence score
    discoveredFeeds.sort((a, b) => b.confidence - a.confidence);

    console.log(`Discovered ${discoveredFeeds.length} potential feeds for ${location.city}, ${location.state} (${govFeeds.length} city, ${schoolFeeds.length} school, ${chamberFeeds.length} chamber, ${libraryFeeds.length} library, ${parkRecFeeds.length} parks)`);
    return discoveredFeeds;
  }

  private async discoverGovernmentFeeds(location: LocationInfo, citySlug: string, stateSlug: string): Promise<DiscoveredFeed[]> {
    const feeds: DiscoveredFeed[] = [];
    
    for (const domainPattern of this.governmentDomainPatterns) {
      const domain = domainPattern
        .replace('{city}', citySlug)
        .replace('{state}', stateSlug);

      const discoveredFeeds = await this.checkDomainForFeeds(domain, {
        ...location,
        type: 'city',
        organizationType: 'city' as const
      });
      
      feeds.push(...discoveredFeeds);
    }

    return feeds;
  }

  private async discoverSchoolFeeds(location: LocationInfo, citySlug: string, stateSlug: string): Promise<DiscoveredFeed[]> {
    const feeds: DiscoveredFeed[] = [];
    
    for (const domainPattern of this.schoolDistrictPatterns) {
      const domain = domainPattern
        .replace('{city}', citySlug)
        .replace('{state}', stateSlug);

      const discoveredFeeds = await this.checkDomainForFeeds(domain, {
        ...location,
        type: 'city',
        organizationType: 'school' as const
      });
      
      feeds.push(...discoveredFeeds);
    }

    return feeds;
  }

  private async discoverChamberFeeds(location: LocationInfo, citySlug: string, stateSlug: string): Promise<DiscoveredFeed[]> {
    const feeds: DiscoveredFeed[] = [];
    
    for (const domainPattern of this.chamberPatterns) {
      const domain = domainPattern
        .replace('{city}', citySlug)
        .replace('{state}', stateSlug);

      const discoveredFeeds = await this.checkDomainForFeeds(domain, {
        ...location,
        type: 'city',
        organizationType: 'chamber' as const
      });
      
      feeds.push(...discoveredFeeds);
    }

    return feeds;
  }

  private async discoverLibraryFeeds(location: LocationInfo, citySlug: string, stateSlug: string): Promise<DiscoveredFeed[]> {
    const feeds: DiscoveredFeed[] = [];
    
    for (const domainPattern of this.libraryPatterns) {
      const domain = domainPattern
        .replace('{city}', citySlug)
        .replace('{state}', stateSlug);

      const discoveredFeeds = await this.checkDomainForFeeds(domain, {
        ...location,
        type: 'city',
        organizationType: 'library' as const
      });
      
      feeds.push(...discoveredFeeds);
    }

    return feeds;
  }

  private async discoverParkRecFeeds(location: LocationInfo, citySlug: string, stateSlug: string): Promise<DiscoveredFeed[]> {
    const feeds: DiscoveredFeed[] = [];
    
    for (const domainPattern of this.parkRecPatterns) {
      const domain = domainPattern
        .replace('{city}', citySlug)
        .replace('{state}', stateSlug);

      const discoveredFeeds = await this.checkDomainForFeeds(domain, {
        ...location,
        type: 'city',
        organizationType: 'parks' as const
      });
      
      feeds.push(...discoveredFeeds);
    }

    return feeds;
  }

  private async checkDomainForFeeds(domain: string, location: LocationInfo & { organizationType: 'city' | 'school' | 'chamber' | 'library' | 'parks' }): Promise<DiscoveredFeed[]> {
    const feeds: DiscoveredFeed[] = [];
    
    try {
      // First check if domain exists
      const baseUrl = `https://${domain}`;
      const response = await axios.get(baseUrl, {
        timeout: 5000,
        headers: { 'User-Agent': 'CityWide Events Calendar Discovery Bot 1.0' },
        validateStatus: (status) => status < 500 // Accept 404s but not server errors
      });

      if (response.status === 404) {
        return feeds; // Domain doesn't exist
      }

      // Parse the homepage to look for calendar/events links
      const $ = cheerio.load(response.data);
      const discoveredPaths = new Set<string>();

      // Look for obvious calendar/events links
      $('a[href*="calendar"], a[href*="events"]').each((_, element) => {
        const href = $(element).attr('href');
        if (href) {
          const path = href.startsWith('/') ? href : new URL(href, baseUrl).pathname;
          discoveredPaths.add(path);
        }
      });

      // Add common paths to check
      this.commonFeedPaths.forEach(path => discoveredPaths.add(path));

      // Check each discovered path for feeds
      for (const path of Array.from(discoveredPaths).slice(0, 10)) { // Limit to 10 paths per domain
        const feedUrl = path.startsWith('http') ? path : `${baseUrl}${path}`;
        const feed = await this.validateFeedUrl(feedUrl, location);
        
        if (feed) {
          feeds.push(feed);
        }
      }

    } catch (error) {
      // Domain doesn't exist or is not accessible
      console.log(`Domain ${domain} not accessible: ${error}`);
    }

    return feeds;
  }

  private async validateFeedUrl(feedUrl: string, location: LocationInfo & { organizationType: 'city' | 'school' | 'chamber' | 'library' | 'parks' }): Promise<DiscoveredFeed | null> {
    try {
      const response = await axios.head(feedUrl, {
        timeout: 3000,
        headers: { 'User-Agent': 'CityWide Events Calendar Discovery Bot 1.0' }
      });

      const contentType = response.headers['content-type'] || '';
      let feedType: 'ical' | 'rss' | 'json' | 'html' = 'html';
      let confidence = 0.3; // Base confidence

      // Determine feed type and confidence based on content type and URL
      if (contentType.includes('text/calendar') || feedUrl.endsWith('.ics')) {
        feedType = 'ical';
        confidence = 0.9;
      } else if (contentType.includes('application/rss') || contentType.includes('xml') || feedUrl.includes('rss') || feedUrl.includes('.xml')) {
        feedType = 'rss';
        confidence = 0.8;
      } else if (contentType.includes('application/json') || feedUrl.includes('api') || feedUrl.includes('.json')) {
        feedType = 'json';
        confidence = 0.7;
      } else if (feedUrl.includes('calendar') || feedUrl.includes('events')) {
        feedType = 'html';
        confidence = 0.5;
      }

      // Boost confidence for government domains
      if (feedUrl.includes('.gov')) {
        confidence += 0.2;
      }

      // Create the calendar source
      const source: CalendarSource = {
        id: `discovered-${location.city.toLowerCase().replace(/\s+/g, '-')}-${location.organizationType}-${Date.now()}`,
        name: this.generateSourceName(location),
        city: location.city,
        state: location.state,
        type: location.organizationType as any,
        feedUrl: feedUrl,
        websiteUrl: new URL(feedUrl).origin,
        isActive: true, // Automatically activate discovered feeds
        feedType: feedType
      };

      return {
        source,
        confidence: Math.min(confidence, 1.0),
        lastChecked: new Date()
      };

    } catch (error) {
      return null;
    }
  }

  private generateSourceName(location: LocationInfo & { organizationType: 'city' | 'school' | 'chamber' | 'library' | 'parks' }): string {
    switch (location.organizationType) {
      case 'city':
        return `${location.city} City Government`;
      case 'school':
        return `${location.city} School District`;
      case 'chamber':
        return `${location.city} Chamber of Commerce`;
      case 'library':
        return `${location.city} Public Library`;
      case 'parks':
        return `${location.city} Parks & Recreation`;
      default:
        return `${location.city} ${location.organizationType}`;
    }
  }

  private createCitySlug(city: string): string {
    return city
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  // Enhanced method to discover feeds for popular US locations
  async discoverFeedsForPopularLocation(cityName: string, stateName: string): Promise<DiscoveredFeed[]> {
    const location: LocationInfo = {
      city: cityName,
      state: this.getStateAbbreviation(stateName),
      type: 'city'
    };

    const feeds = await this.discoverFeedsForLocation(location);
    
    // For popular locations, also check known government patterns
    const additionalFeeds = await this.checkKnownPatterns(location);
    feeds.push(...additionalFeeds);

    return feeds.filter((feed, index, self) => 
      index === self.findIndex(f => f.source.feedUrl === feed.source.feedUrl)
    );
  }

  private async checkKnownPatterns(location: LocationInfo): Promise<DiscoveredFeed[]> {
    const feeds: DiscoveredFeed[] = [];
    const citySlug = this.createCitySlug(location.city);

    // Known high-confidence patterns for major cities
    const knownPatterns = [
      `https://www.${citySlug}.gov/calendar`,
      `https://${citySlug}.gov/events`,
      `https://www.${citySlug}.gov/calendar.ics`,
      `https://calendar.${citySlug}.gov`,
      `https://events.${citySlug}.gov`
    ];

    for (const pattern of knownPatterns) {
      const feed = await this.validateFeedUrl(pattern, {
        ...location,
        organizationType: 'city' as const
      });
      
      if (feed) {
        feed.confidence = Math.min(feed.confidence + 0.3, 1.0); // Boost confidence for known patterns
        feeds.push(feed);
      }
    }

    return feeds;
  }

  // Enhanced method to discover feeds for multiple regions
  async discoverFeedsForRegions(request: RegionalDiscoveryRequest): Promise<{
    discoveredFeeds: DiscoveredFeed[];
    regions: LocationInfo[];
    count: number;
    summary: string;
  }> {
    console.log(`Discovering feeds for ${request.regions.length} regions...`);
    
    const allFeeds: DiscoveredFeed[] = [];
    const processedRegions: LocationInfo[] = [];
    
    for (const regionName of request.regions) {
      try {
        // Parse region name (e.g., "Portland, OR" or "New York, NY")
        const [cityName, stateCode] = regionName.split(',').map(s => s.trim());
        
        if (!cityName || !stateCode) {
          console.log(`Invalid region format: ${regionName}`);
          continue;
        }

        // Find city in database
        const cityData = cityDiscoverer.getCityByName(cityName, stateCode);
        
        if (cityData) {
          // Use database information for accurate discovery
          const location: LocationInfo = {
            city: cityData.name,
            state: cityData.stateCode,
            county: cityData.county,
            type: 'city'
          };

          const feeds = await this.discoverFeedsForLocation(location);
          allFeeds.push(...feeds);
          processedRegions.push(location);
          
          console.log(`✓ Discovered ${feeds.length} feeds for ${cityData.name}, ${cityData.stateCode}`);
        } else {
          // Fallback to original discovery method
          const location: LocationInfo = {
            city: cityName,
            state: this.getStateAbbreviation(stateCode),
            type: 'city'
          };

          const feeds = await this.discoverFeedsForLocation(location);
          allFeeds.push(...feeds);
          processedRegions.push(location);
          
          console.log(`✓ Discovered ${feeds.length} feeds for ${cityName}, ${stateCode} (fallback)`);
        }

        // Add delay between requests to be respectful
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Failed to discover feeds for ${regionName}:`, error);
      }
    }

    // Remove duplicates based on feed URL
    const uniqueFeeds = allFeeds.filter((feed, index, self) => 
      index === self.findIndex(f => f.source.feedUrl === feed.source.feedUrl)
    );

    return {
      discoveredFeeds: uniqueFeeds,
      regions: processedRegions,
      count: uniqueFeeds.length,
      summary: `Discovered ${uniqueFeeds.length} calendar feeds across ${processedRegions.length} regions`
    };
  }

  // Discover feeds for all cities in a state
  async discoverFeedsForState(stateCode: string, options?: {
    populationRange?: { min: number; max: number };
    cityTypes?: ('major' | 'medium' | 'small' | 'town')[];
    limit?: number;
  }): Promise<{
    discoveredFeeds: DiscoveredFeed[];
    cities: string[];
    count: number;
  }> {
    console.log(`Discovering feeds for all cities in ${stateCode}...`);
    
    let cities = cityDiscoverer.getCitiesByState(stateCode);
    
    // Apply filters
    if (options?.populationRange) {
      cities = cities.filter(city => 
        city.population >= options.populationRange!.min && 
        city.population <= options.populationRange!.max
      );
    }
    
    if (options?.cityTypes) {
      cities = cities.filter(city => options.cityTypes!.includes(city.type));
    }
    
    if (options?.limit) {
      cities = cities.slice(0, options.limit);
    }

    const regionNames = cities.map(city => `${city.name}, ${city.stateCode}`);
    const result = await this.discoverFeedsForRegions({ regions: regionNames });
    
    return {
      discoveredFeeds: result.discoveredFeeds,
      cities: regionNames,
      count: result.count
    };
  }

  // Discover feeds for cities by population size
  async discoverFeedsByPopulation(
    minPopulation: number, 
    maxPopulation: number = Infinity,
    limit: number = 100
  ): Promise<{
    discoveredFeeds: DiscoveredFeed[];
    cities: string[];
    count: number;
  }> {
    console.log(`Discovering feeds for cities with population ${minPopulation} - ${maxPopulation}...`);
    
    const cities = cityDiscoverer.getCitiesByPopulation(minPopulation, maxPopulation)
      .slice(0, limit);
    
    const regionNames = cities.map(city => `${city.name}, ${city.stateCode}`);
    const result = await this.discoverFeedsForRegions({ regions: regionNames });
    
    return {
      discoveredFeeds: result.discoveredFeeds,
      cities: regionNames,
      count: result.count
    };
  }

  // Get comprehensive city suggestions for autocomplete
  getCitySuggestions(query: string, limit: number = 20): string[] {
    if (!query || query.length < 2) return [];
    
    const results = cityDiscoverer.searchCities(query)
      .slice(0, limit)
      .map(city => `${city.name}, ${city.stateCode}`);
      
    return results;
  }

  // Get all cities with potential calendar sources
  getAllCitiesWithCalendarPotential(): string[] {
    return US_CITIES_DATABASE
      .filter(city => city.potentialSources.length > 0)
      .map(city => `${city.name}, ${city.stateCode}`);
  }

  // Discover feeds for top cities by population
  async discoverFeedsForTopCities(count: number = 50): Promise<{
    discoveredFeeds: DiscoveredFeed[];
    cities: string[];
    totalCount: number;
  }> {
    console.log(`Discovering feeds for top ${count} US cities by population...`);
    
    const topCities = [...US_CITIES_DATABASE]
      .sort((a, b) => b.population - a.population)
      .slice(0, count);
    
    const regionNames = topCities.map(city => `${city.name}, ${city.stateCode}`);
    const result = await this.discoverFeedsForRegions({ regions: regionNames });
    
    return {
      discoveredFeeds: result.discoveredFeeds,
      cities: regionNames,
      totalCount: result.count
    };
  }

  private getStateAbbreviation(stateName: string): string {
    const stateMap: Record<string, string> = {
      'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
      'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
      'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
      'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
      'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
      'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
      'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
      'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
      'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
      'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY'
    };

    const normalized = stateName.toLowerCase().trim();
    return stateMap[normalized] || stateName.toUpperCase().substring(0, 2);
  }
}

export const feedDiscoverer = new LocationFeedDiscoverer();