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
    '/ICalendarHandler?calendarId=12712452',
    '/rss.aspx#calendar',
    '/rss.aspx#events',
    '/calendar.xml',
    '/events.xml',
    '/iCalendar.aspx',
    // Common download/export patterns
    '/calendar/download',
    '/calendar/export',
    '/events/download',
    '/events/export',
    '/calendar/subscribe',
    '/events/subscribe',
    '/calendar/ical',
    '/events/ical',
    '/download/calendar',
    '/download/events',
    '/export/calendar',
    '/export/events',
    // Common CMS feed patterns (skip client-side API endpoints)
    '/calendar/rss',
    '/events/rss',
    '/calendar/feed.xml',
    '/events/feed.xml',
    // WordPress and common CMS patterns
    '/wp-content/uploads/calendar.ics',
    '/?feed=calendar',
    '/?feed=events',
    '/feed/?post_type=event',
    '/feed/?post_type=calendar',
    // Government-specific patterns  
    '/modules/calendar/calendar.ics',
    '/modules/events/events.ics',
    '/departments/events/calendar.ics',
    '/calendar/icalendar',
    '/events/icalendar',
    // School district CMS patterns
    '/calendar/feed',
    '/events/feed', 
    '/calendar/calendar.rss',
    '/events/events.rss',
    '/calendar/index.rss',
    '/events/index.rss',
    // Apptegy CMS (common for school districts)
    '/calendar.rss',
    '/events.rss',
    '/news/feed',
    // Finalsite CMS patterns
    '/calendar/feed.rss',
    '/events/feed.rss',
    // Common query parameter patterns
    '/calendar?format=ics',
    '/events?format=ics',
    '/calendar?export=ics',
    '/events?export=ics',
    '/calendar?download=1',
    '/events?download=1',
    // Department-specific calendar patterns (based on screenshots)
    '/calendar/building-department/rss',
    '/calendar/city-council/rss',
    '/calendar/fire-department/rss',
    '/calendar/police-department/rss',
    '/calendar/public-works/rss',
    '/calendar/planning-department/rss',
    '/calendar/main-calendar/rss',
    '/calendar/all/rss',
    '/calendar/housing/rss',
    // Alternative department feed formats
    '/calendar/building-department.rss',
    '/calendar/city-council.rss',
    '/calendar/fire-department.rss',
    '/calendar/police-department.rss',
    '/calendar/public-works.rss',
    '/calendar/planning-department.rss',
    '/calendar/main-calendar.rss',
    '/calendar/all.rss',
    // iCalendar versions of department feeds
    '/calendar/building-department.ics',
    '/calendar/city-council.ics',
    '/calendar/fire-department.ics',
    '/calendar/police-department.ics',
    '/calendar/public-works.ics',
    '/calendar/planning-department.ics',
    '/calendar/main-calendar.ics',
    '/calendar/all.ics'
  ];

  private governmentDomainPatterns = [
    '{city}.gov',
    '{city}.{state}.gov', 
    'www.{city}.gov',
    'www.{city}.{state}.gov',
    '{city}{state}.gov',
    'city{city}.gov',
    'cityof{city}.gov', 
    '{city}.us',
    '{city}.{state}.us', 
    'www.{city}.us',
    'www.{city}.{state}.us',
    '{city}{state}.us',
    'city{city}.us',
    'cityof{city}.us',
    // Initials-based patterns for multi-word cities
    '{initials}.gov',
    '{initials}.{state}.gov',
    'www.{initials}.gov',
    'www.{initials}.{state}.gov',
    '{initials}{state}.gov',
    'city{initials}.gov',
    'cityof{initials}.gov',
    '{initials}.us',
    '{initials}.{state}.us',
    'www.{initials}.us',
    'www.{initials}.{state}.us',
    '{initials}{state}.us',
    'city{initials}.us',
    'cityof{initials}.us'
  ];

  private schoolDistrictPatterns = [
    '{city}.K12.{state}.us',
    '{city}schools.org',
    '{city}schools.edu',
    '{city}schools.net',
    '{city}sd.org',
    '{city}isd.org',
    '{city}usd.org',
    'www.{city}schools.org',
    'www.{city}schools.edu',
    // Initials-based patterns
    '{initials}.K12.{state}.us',
    '{initials}schools.org',
    '{initials}schools.edu',
    '{initials}schools.net',
    '{initials}sd.org',
    '{initials}isd.org',
    '{initials}usd.org',
    'www.{initials}schools.org',
    'www.{initials}schools.edu'
  ];

  private chamberPatterns = [
    '{city}chamber.org',
    '{city}chamber.com',
    'www.{city}chamber.org',
    'www.{city}chamber.com',
    '{city}chamberofcommerce.org',
    '{city}chamberofcommerce.com',
    // Initials-based patterns
    '{initials}chamber.org',
    '{initials}chamber.com',
    'www.{initials}chamber.org',
    'www.{initials}chamber.com',
    '{initials}chamberofcommerce.org',
    '{initials}chamberofcommerce.com'
  ];

  private libraryPatterns = [
    '{city}library.org',
    '{city}library.com',
    'www.{city}library.org',
    'www.{city}library.com',
    '{city}publiclibrary.org',
    // Initials-based patterns
    '{initials}library.org',
    '{initials}library.com',
    'www.{initials}library.org',
    'www.{initials}library.com',
    '{initials}publiclibrary.org'
  ];

  private parkRecPatterns = [
    '{city}parks.org',
    '{city}recreation.org',
    'www.{city}parks.org',
    '{city}parksandrec.org',
    '{city}parksandrecreation.org',
    // Initials-based patterns
    '{initials}parks.org',
    '{initials}recreation.org',
    'www.{initials}parks.org',
    '{initials}parksandrec.org',
    '{initials}parksandrecreation.org'
  ];

  async discoverFeedsForLocation(location: LocationInfo): Promise<DiscoveredFeed[]> {
    console.log(`Discovering calendar feeds for ${location.city}, ${location.state}...`);

    const discoveredFeeds: DiscoveredFeed[] = [];
    const citySlug = this.createCitySlug(location.city);
    const stateSlug = location.state.toLowerCase();

    // Discover government feeds
    const govFeeds = await this.discoverGovernmentFeeds(location, citySlug, stateSlug);
    discoveredFeeds.push(...govFeeds);

    // Find working city website for library and parks discovery
    let workingCityWebsite: string | null = null;
    for (const feed of govFeeds) {
      if (feed.source.feedUrl) {
        try {
          const url = new URL(feed.source.feedUrl);
          workingCityWebsite = `${url.protocol}//${url.hostname}`;
          console.log(`Found working city website for library/parks discovery: ${workingCityWebsite}`);
          break;
        } catch (e) {
          // Continue to next feed
        }
      }
    }

    // Discover school district feeds
    const schoolFeeds = await this.discoverSchoolFeeds(location, citySlug, stateSlug);
    discoveredFeeds.push(...schoolFeeds);

    // Discover chamber of commerce feeds
    const chamberFeeds = await this.discoverChamberFeeds(location, citySlug, stateSlug);
    discoveredFeeds.push(...chamberFeeds);

    // Discover library feeds (use city website if found)
    const libraryFeeds = await this.discoverLibraryFeeds(location, citySlug, stateSlug, workingCityWebsite);
    discoveredFeeds.push(...libraryFeeds);

    // Discover parks and recreation feeds (use city website if found)
    const parkRecFeeds = await this.discoverParkRecFeeds(location, citySlug, stateSlug, workingCityWebsite);
    discoveredFeeds.push(...parkRecFeeds);

    // Sort by confidence score
    discoveredFeeds.sort((a, b) => b.confidence - a.confidence);

    console.log(`Discovered ${discoveredFeeds.length} potential feeds for ${location.city}, ${location.state} (${govFeeds.length} city, ${schoolFeeds.length} school, ${chamberFeeds.length} chamber, ${libraryFeeds.length} library, ${parkRecFeeds.length} parks)`);
    return discoveredFeeds;
  }

  private async discoverGovernmentFeeds(location: LocationInfo, citySlug: string, stateSlug: string): Promise<DiscoveredFeed[]> {
    const feeds: DiscoveredFeed[] = [];

    // First, check if we have the city website in our database
    const databaseWebsite = await this.getCityWebsiteFromDatabase(location.city, location.state);
    if (databaseWebsite) {
      console.log(`✓ Found city website in database: ${databaseWebsite} - checking for feeds`);

      const domain = databaseWebsite.replace(/^https?:\/\//, '');
      const discoveredFeeds = await this.checkDomainForFeeds(domain, {
        ...location,
        type: 'city',
        organizationType: 'city' as const
      });

      feeds.push(...discoveredFeeds);

      // If we found feeds from the database website, we're done
      if (discoveredFeeds.length > 0) {
        console.log(`✓ Found feeds from database website ${databaseWebsite} - stopping search`);
        return feeds;
      }
    }

    // If no database website or no feeds found, try pattern-based discovery
    const cityInitials = this.createCityInitials(location.city);

    for (const domainPattern of this.governmentDomainPatterns) {
      const domain = domainPattern
        .replace('{city}', citySlug)
        .replace('{state}', stateSlug)
        .replace('{initials}', cityInitials);

      const discoveredFeeds = await this.checkDomainForFeeds(domain, {
        ...location,
        type: 'city',
        organizationType: 'city' as const
      });

      feeds.push(...discoveredFeeds);

      // Stop searching once we find a working government website
      if (discoveredFeeds.length > 0) {
        console.log(`✓ Found working government website ${domain} - stopping search for additional government domains`);
        break;
      }
    }

    return feeds;
  }

  private async discoverSchoolFeeds(location: LocationInfo, citySlug: string, stateSlug: string): Promise<DiscoveredFeed[]> {
    const feeds: DiscoveredFeed[] = [];
    const cityInitials = this.createCityInitials(location.city);

    for (const domainPattern of this.schoolDistrictPatterns) {
      const domain = domainPattern
        .replace('{city}', citySlug)
        .replace('{state}', stateSlug)
        .replace('{initials}', cityInitials);

      const discoveredFeeds = await this.checkDomainForFeeds(domain, {
        ...location,
        type: 'city',
        organizationType: 'school' as const
      });

      feeds.push(...discoveredFeeds);

      // Stop searching once we find a working school district website
      if (discoveredFeeds.length > 0) {
        console.log(`✓ Found working school district website ${domain} - stopping search for additional school domains`);
        break;
      }
    }

    return feeds;
  }

  private async discoverChamberFeeds(location: LocationInfo, citySlug: string, stateSlug: string): Promise<DiscoveredFeed[]> {
    const feeds: DiscoveredFeed[] = [];
    const cityInitials = this.createCityInitials(location.city);

    for (const domainPattern of this.chamberPatterns) {
      const domain = domainPattern
        .replace('{city}', citySlug)
        .replace('{state}', stateSlug)
        .replace('{initials}', cityInitials);

      const discoveredFeeds = await this.checkDomainForFeeds(domain, {
        ...location,
        type: 'city',
        organizationType: 'chamber' as const
      });

      feeds.push(...discoveredFeeds);

      // Stop searching once we find a working chamber website
      if (discoveredFeeds.length > 0) {
        console.log(`✓ Found working chamber website ${domain} - stopping search for additional chamber domains`);
        break;
      }
    }

    return feeds;
  }

  private async discoverLibraryFeeds(location: LocationInfo, citySlug: string, stateSlug: string, workingCityWebsite?: string | null): Promise<DiscoveredFeed[]> {
    const feeds: DiscoveredFeed[] = [];

    // First, try searching within the city website if available
    if (workingCityWebsite) {
      console.log(`Searching for library feeds within city website: ${workingCityWebsite}`);
      const libraryPaths = [
        '/library',
        '/libraries',
        '/library/calendar',
        '/library/events',
        '/libraries/calendar',
        '/libraries/events',
        '/departments/library',
        '/departments/library/calendar',
        '/departments/library/events'
      ];

      for (const path of libraryPaths) {
        try {
          const domain = workingCityWebsite.replace(/^https?:\/\//, '');
          const discoveredFeeds = await this.checkSpecificPathForFeeds(domain, path, {
            ...location,
            type: 'city',
            organizationType: 'library' as const
          });
          feeds.push(...discoveredFeeds);
        } catch (error) {
          console.log(`Error checking library path ${path} on ${workingCityWebsite}:`, error);
        }
      }
    }

    // Then try traditional separate library domain patterns
    const cityInitials = this.createCityInitials(location.city);

    for (const domainPattern of this.libraryPatterns) {
      const domain = domainPattern
        .replace('{city}', citySlug)
        .replace('{state}', stateSlug)
        .replace('{initials}', cityInitials);

      const discoveredFeeds = await this.checkDomainForFeeds(domain, {
        ...location,
        type: 'city',
        organizationType: 'library' as const
      });

      feeds.push(...discoveredFeeds);

      // Stop searching once we find a working library website
      if (discoveredFeeds.length > 0) {
        console.log(`✓ Found working library website ${domain} - stopping search for additional library domains`);
        break;
      }
    }

    return feeds;
  }

  private async discoverParkRecFeeds(location: LocationInfo, citySlug: string, stateSlug: string, workingCityWebsite?: string | null): Promise<DiscoveredFeed[]> {
    const feeds: DiscoveredFeed[] = [];

    // First, try searching within the city website if available
    if (workingCityWebsite) {
      console.log(`Searching for parks & recreation feeds within city website: ${workingCityWebsite}`);
      const parksPaths = [
        '/park',
        '/parks',
        '/recreation', 
        '/parks-recreation',
        '/parksandrec',
        '/park/calendar',
        '/parks/calendar',
        '/recreation/calendar',
        '/parks-recreation/calendar',
        '/park/events',
        '/parks/events',
        '/recreation/events',
        '/parks-recreation/events',
        '/departments/parks',
        '/departments/parks/calendar',
        '/departments/parks/events',
        '/departments/recreation',
        '/departments/recreation/calendar',
        '/departments/recreation/events',
        '/departments/parks-recreation',
        '/departments/parks-recreation/calendar',
        '/departments/parks-recreation/events'
      ];

      for (const path of parksPaths) {
        try {
          const domain = workingCityWebsite.replace(/^https?:\/\//, '');
          const discoveredFeeds = await this.checkSpecificPathForFeeds(domain, path, {
            ...location,
            type: 'city',
            organizationType: 'parks' as const
          });
          feeds.push(...discoveredFeeds);
        } catch (error) {
          console.log(`Error checking parks path ${path} on ${workingCityWebsite}:`, error);
        }
      }
    }

    // Then try traditional separate parks domain patterns
    const cityInitials = this.createCityInitials(location.city);

    for (const domainPattern of this.parkRecPatterns) {
      const domain = domainPattern
        .replace('{city}', citySlug)
        .replace('{state}', stateSlug)
        .replace('{initials}', cityInitials);

      const discoveredFeeds = await this.checkDomainForFeeds(domain, {
        ...location,
        type: 'city',
        organizationType: 'parks' as const
      });

      feeds.push(...discoveredFeeds);

      // Stop searching once we find a working parks website
      if (discoveredFeeds.length > 0) {
        console.log(`✓ Found working parks website ${domain} - stopping search for additional parks domains`);
        break;
      }
    }

    return feeds;
  }

  private async checkDomainForFeeds(domain: string, location: LocationInfo & { organizationType: 'city' | 'school' | 'chamber' | 'library' | 'parks' }): Promise<DiscoveredFeed[]> {
    const feeds: DiscoveredFeed[] = [];

    try {
      // First check if domain exists with comprehensive validation
      const baseUrl = `https://${domain}`;

      // Use the website validator for better detection of non-existent/parked domains
      const { WebsiteValidator } = await import('./website-validator');
      const validation = await WebsiteValidator.validateWebsite(baseUrl);

      if (!validation.isValid) {
        console.log(`❌ Website ${domain} is not valid: ${validation.status} - ${validation.error || 'Unknown error'}`);
        return feeds;
      }

      if (validation.status === 'parked' || validation.status === 'redirect') {
        console.log(`❌ Website ${domain} is ${validation.status} - skipping feed discovery`);
        return feeds;
      }

      // Additional check with direct HTTP request
      const response = await axios.get(baseUrl, {
        timeout: 10000,
        headers: { 'User-Agent': 'CityWide Events Calendar Discovery Bot 1.0' },
        validateStatus: (status) => status < 500, // Accept 404s but not server errors
        maxRedirects: 3 // Limit redirects
      });

      // Check if website actually exists and is accessible
      if (response.status === 404 || response.status >= 400) {
        console.log(`❌ Website ${domain} returned HTTP ${response.status} - not accessible`);
        return feeds;
      }

      // Verify we got actual website content, not just a redirect or error page
      if (!response.data || typeof response.data !== 'string' || response.data.length < 100) {
        console.log(`❌ Website ${domain} returned insufficient content (${response.data?.length || 0} bytes) - likely not a real website`);
        return feeds;
      }

      // Check for common "domain for sale" or parking page indicators
      const content = response.data.toLowerCase();
      const parkingIndicators = [
        'domain for sale', 'buy this domain', 'domain parking', 'parked domain',
        'expired domain', 'domain expired', 'godaddy', 'namecheap', 'sedo',
        'underconstruction', 'coming soon', 'site not found', 'page not found',
        'temporarily unavailable', 'this domain may be for sale'
      ];

      const isParkedDomain = parkingIndicators.some(indicator => content.includes(indicator));
      if (isParkedDomain) {
        console.log(`❌ Website ${domain} appears to be a parked or for-sale domain - skipping`);
        return feeds;
      }

      console.log(`✅ Confirmed website ${domain} exists and is accessible - proceeding with feed discovery`);

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

      // Look for download buttons and links that commonly contain feeds
      $('a[href*=".ics"], a[href*=".rss"], a[href*=".xml"], a[href*="download"], a[href*="export"], a[href*="subscribe"]').each((_, element) => {
        const href = $(element).attr('href');
        if (href) {
          const path = href.startsWith('/') ? href : new URL(href, baseUrl).pathname;
          discoveredPaths.add(path);
        }
      });

      // Enhanced button detection for RSS/iCal feeds -  focus on downloadable feeds
      const downloadableButtonSelectors = [
        // Direct download buttons
        'button:contains("Download")', 'a:contains("Download")',
        'button:contains("Export")', 'a:contains("Export")',
        'button:contains("Subscribe")', 'a:contains("Subscribe")',
        'button:contains("iCalendar")', 'a:contains("iCalendar")',
        'button:contains("RSS")', 'a:contains("RSS")',
        'button:contains("Feed")', 'a:contains("Feed")',
        'button:contains("Calendar")', 'a:contains("Calendar")',
        // Title and aria-label attributes for downloadable content
        'button[title*="Download"]', 'a[title*="Download"]',
        'button[title*="Export"]', 'a[title*="Export"]',
        'button[title*="Subscribe"]', 'a[title*="Subscribe"]',
        'button[title*="RSS"]', 'a[title*="RSS"]',
        'button[title*="iCal"]', 'a[title*="iCal"]',
        'button[title*="Feed"]', 'a[title*="Feed"]',
        'button[aria-label*="Subscribe"]', 'a[aria-label*="Subscribe"]',
        'button[aria-label*="Download"]', 'a[aria-label*="Download"]',
        'input[type="button"][value*="Download"]',
        'input[type="submit"][value*="Subscribe"]',
        // Icons that indicate downloadable feeds
        'a[href*=".ics"] img', 'a[href*=".rss"] img',
        'a[href*="download"] img[alt*="calendar"]',
        'a[href*="export"] img[alt*="calendar"]',
        // Third-party calendar service buttons (Trumba, etc.)
        'a[onclick*="subscribe"]', 'button[onclick*="subscribe"]',
        'a[onclick*=".showWindow"]', 'button[onclick*=".showWindow"]',
        'a[onclick*="Trumba"]', 'button[onclick*="Trumba"]',
        'span.ImageLink a', 'div.ImageLink a',
        'a[onclick*="calendar"]', 'button[onclick*="calendar"]',
        'a[onclick*="feed"]', 'button[onclick*="feed"]'
      ];

      $(downloadableButtonSelectors.join(', ')).each((_, element) => {
        const $el = $(element);
        const tagName = (element as any).tagName?.toLowerCase() || 'unknown';

        console.log(`🔍 Found potential downloadable feed button: ${$el.text().trim()} (${tagName})`);

        // Extract potential URLs from various attributes and handlers
        const onclick = $el.attr('onclick') || '';
        const dataUrl = $el.attr('data-url') || $el.attr('data-href') || $el.attr('data-link');
        const formAction = $el.closest('form').attr('action');
        const href = $el.attr('href');

        // Check if button/link directly points to downloadable feed
        if (href && this.isDownloadableFeedUrl(href)) {
          console.log(`✅ Found direct downloadable feed URL in href: ${href}`);
          const path = href.startsWith('/') ? href : href.startsWith('http') ? new URL(href, baseUrl).pathname + new URL(href, baseUrl).search : `/${href}`;
          discoveredPaths.add(path);
        }

        // Enhanced onclick handler parsing for downloadable feeds
        if (onclick) {
          const downloadableFeedPatterns = [
            // Direct file downloads
            /['"]([^'"]*\.(?:ics|rss|xml)[^'"]*)['"]/, 
            // Download/export function calls
            /downloadFile\(['"]([^'"]*)['"]/, 
            /exportCalendar\(['"]([^'"]*)['"]/, 
            /downloadCalendar\(['"]([^'"]*)['"]/, 
            /exportEvents\(['"]([^'"]*)['"]/, 
            // Feed generation endpoints
            /['"]([^'"]*(?:generate_ical|generate_calendar|export_ical)[^'"]*)['"]/, 
            // Subscription endpoints that return feeds
            /['"]([^'"]*\.(?:ics|rss|xml)[^'"]*)['"]/, 
            // Window open calls for downloads
            /window\.open\(['"]([^'"]*(?:\.ics|\.rss|download|export)[^'"]*)['"]/, 
            // Location changes for downloads
            /location\.(?:href|replace)\s*=\s*['"]([^'"]*(?:\.ics|\.rss|download|export)[^'"]*)['"]/, 
            // API endpoints for calendar data
            /['"]([^'"]*\/api\/[^'"]*(?:calendar|events|ical|rss)[^'"]*)['"]/, 
            // Feed URLs with parameters
            /['"]([^'"]*(?:ModID|CID)=[^'"]*\.(?:ics|rss|xml)[^'"]*)['"]/, 
            // Generic downloadable feed patterns
            /['"]([^'"]*(?:RSSFeed\.aspx|iCalendarFeed\.aspx|Feed\.aspx)[^'"]*)['"]/, 
            // Trumba showWindow specific patterns
            /Trumba\.EA2\.showWindow\(['"]([^'"]*)['"]\)/,
            /showWindow\(['"]subscribe['"]\)/,
            // Generic showWindow patterns
            /onclick\s*=\s*["'][^"']*showWindow\(['"]subscribe['"]\)[^"']*["']/,
          ];

          for (const pattern of downloadableFeedPatterns) {
            const match = onclick.match(pattern);
            if (match && match[1]) {
              let potentialUrl = match[1];
              console.log(`🎯 Found potential downloadable feed in onclick: ${potentialUrl}`);

              // Handle relative URLs
              if (potentialUrl.startsWith('/')) {
                discoveredPaths.add(potentialUrl);
              } else if (potentialUrl.startsWith('http')) {
                try {
                  const path = new URL(potentialUrl).pathname + new URL(potentialUrl).search;
                  discoveredPaths.add(path);
                } catch (e) {
                  // Invalid URL, skip
                }
              } else if (this.isDownloadableFeedUrl(potentialUrl)) {
                // Treat as relative path for downloadable feeds
                discoveredPaths.add(`/${potentialUrl}`);
              }
            }
          }

          // Check for third-party calendar service functions (like Trumba)
          if (onclick.includes('showWindow') && onclick.includes('subscribe')) {
            console.log(`🎯 Found third-party subscription button: ${onclick}`);

            // Extract the showWindow parameter for more targeted subscription path discovery
            const showWindowMatch = onclick.match(/showWindow\(['"]([^'"]*)['"]\)/);
            const showWindowParam = showWindowMatch ? showWindowMatch[1] : 'subscribe';
            console.log(`📋 ShowWindow parameter detected: ${showWindowParam}`);

            // Check if this is specifically a Trumba.EA2.showWindow call
            if (onclick.includes('Trumba.EA2.showWindow')) {
              console.log(`🎯 Detected Trumba.EA2.showWindow subscription button`);

              // Look for Trumba spud configuration in the page
              const trumbaSpudMatch = response.data.match(/Trumba\.EA2\.addSpud\([^)]*spudId\s*:\s*['"]([^'"]+)['"]/);
              const trumbaSpudId = trumbaSpudMatch ? trumbaSpudMatch[1] : null;
              console.log(`📋 Trumba spud ID detected: ${trumbaSpudId}`);

              if (trumbaSpudId) {
                // Add Trumba-specific subscription URLs using the spud ID
                const trumbaSubscriptionUrls = [
                  `https://www.trumba.com/${trumbaSpudId}/rss.aspx`,
                  `https://www.trumba.com/${trumbaSpudId}/iCalendar.aspx`,
                  `https://www.trumba.com/${trumbaSpudId}/main.aspx?view=rss`,
                  `https://www.trumba.com/${trumbaSpudId}/main.aspx?view=ical`,
                ];

                trumbaSubscriptionUrls.forEach(trumbaUrl => {
                  console.log(`📋 Adding Trumba spud subscription URL: ${trumbaUrl}`);
                  discoveredPaths.add(trumbaUrl);
                });
              }
            }

            // For third-party services, we need to check if there are subscription page URLs elsewhere
            const currentPath = new URL(baseUrl).pathname;
            const possibleSubscriptionPaths = [
              `${currentPath}/subscribe`,
              `${currentPath}?subscribe=true`,
              '/calendar/subscribe',
              '/events/subscribe',
              '/subscribe',
              '/rss.aspx',
              '/iCalendar.aspx',
              '/calendar/rss.aspx',
              '/calendar/iCalendar.aspx',
              '/events/rss.aspx', 
              '/events/iCalendar.aspx'
            ];

            possibleSubscriptionPaths.forEach(path => {
              console.log(`📋 Adding potential third-party subscription path: ${path}`);
              discoveredPaths.add(path);
            });

            // Look for Trumba-specific subscription URLs in page scripts
            $('script').each((_, scriptEl) => {
              const scriptContent = $(scriptEl).html() || '';
              if (scriptContent.includes('subscribe') || scriptContent.includes('Trumba') || scriptContent.includes('showWindow')) {
                console.log(`📜 Analyzing script content for Trumba subscription URLs`);

                // Enhanced patterns for Trumba and similar services
                const subscriptionUrlPatterns = [
                  // Trumba-specific patterns
                  /subscribe['"]\s*:\s*['"]([^'"]+)['"]/gi,
                  /subscribeUrl['"]\s*:\s*['"]([^'"]+)['"]/gi,
                  /showWindow\(['"]subscribe['"]\)[^}]*url['"]\s*:\s*['"]([^'"]+)['"]/gi,
                  /onclick=["']Trumba\.EA2\.showWindow\(['"]([^'"]+)['"]\)/gi,
                  /Trumba\.EA2\.showWindow\(['"]subscribe['"]\)[^}]*url['"]\s*:\s*['"]([^'"]+)['"]/gi,
                  // Generic subscription URLs in scripts
                  /['"]([^'"]*\/subscribe[^'"]*)['"]/, 
                  /['"]([^'"]*subscribe[^'"]*)['"]/, 
                  /showWindow\(['"]([^'"]*)['"]\)/gi,
                  // Calendar service configuration URLs
                  /calendarUrl['"]\s*:\s*['"]([^'"]+)['"]/gi,
                  /feedUrl['"]\s*:\s*['"]([^'"]+)['"]/gi,
                  /rssUrl['"]\s*:\s*['"]([^'"]+)['"]/gi,
                  /icalUrl['"]\s*:\s*['"]([^'"]+)['"]/gi,
                  // Subscription window configuration
                  /windowUrl['"]\s*:\s*['"]([^'"]*subscribe[^'"]*)['"]/gi,
                  /popupUrl['"]\s*:\s*['"]([^'"]*subscribe[^'"]*)['"]/gi,
                  /onclick=["']Trumba\.EA2\.showWindow\(['"]([^'"]+)['"]\)/gi,

                ];

                subscriptionUrlPatterns.forEach(pattern => {
                  const matches = scriptContent.match(pattern);
                  if (matches) {
                    matches.forEach(match => {
                      const urlMatch = match.match(/['"]([^'"]+)['"]/);
                      if (urlMatch && urlMatch[1]) {
                        const foundUrl = urlMatch[1];
                        // Only add URLs that look like subscription endpoints
                        if (foundUrl.includes('subscribe') || foundUrl.includes('rss') || foundUrl.includes('ical') || foundUrl.includes('feed')) {
                          console.log(`📜 Found subscription URL in script: ${foundUrl}`);
                          discoveredPaths.add(foundUrl);
                        }
                      }
                    });
                  }
                });

                // Look for base subscription domain/path in Trumba configurations
                const trumbaServicePatterns = [
                  /Trumba\.EA2\.config\s*=\s*{[^}]*domain\s*:\s*['"]([^'"]+)['"]/gi,
                  /Trumba\.EA2\.config\s*=\s*{[^}]*baseUrl\s*:\s*['"]([^'"]+)['"]/gi,
                  /['"]([^'"]*trumba\.com[^'"]*)['"]/, 
                  /subscribeUrl\s*:\s*['"]([^'"]+)['"]/gi,
                  /webName\s*:\s*['"]([^'"]+)['"]/gi, // Trumba web name
                  /Trumba\.EA2\.addSpud\([^)]*spudId\s*:\s*['"]([^'"]+)['"]/gi, // Trumba spud ID
                  /Trumba\.EA2\.addSpud\([^)]*webName\s*:\s*['"]([^'"]+)['"]/gi, // Trumba web name in spud config
                ];

                for (const servicePattern of trumbaServicePatterns) {
                  const serviceMatches = scriptContent.match(servicePattern);
                  if (serviceMatches) {
                    serviceMatches.forEach(serviceMatch => {
                      // Handle different pattern types
                      let serviceUrl = '';

                      if (serviceMatch.includes('spudId') || serviceMatch.includes('webName')) {
                        // Extract spudId or webName from Trumba.EA2.addSpud calls
                        const spudMatch = serviceMatch.match(/(?:spudId|webName)\s*:\s*['"]([^'"]+)['"]/);
                        if (spudMatch && spudMatch[1]) {
                          serviceUrl = spudMatch[1];
                          console.log(`📜 Found Trumba spud/web identifier: ${serviceUrl}`);
                        }
                      } else {
                        // Extract URL from other patterns
                        const serviceUrlMatch = serviceMatch.match(/['"]([^'"]+)['"]/);
                        if (serviceUrlMatch && serviceUrlMatch[1]) {
                          serviceUrl = serviceUrlMatch[1];
                          console.log(`📜 Found Trumba service URL: ${serviceUrl}`);
                        }
                      }

                      if (serviceUrl) {
                        // Build subscription URLs based on the service domain or identifier
                        if (serviceUrl.includes('trumba.com')) {
                          const trumbaSubscriptionUrls = [
                            `${serviceUrl}/subscribe`,
                            `${serviceUrl}/calendar/subscribe`,
                            `${serviceUrl}/main.aspx?view=rss`,
                            `${serviceUrl}/main.aspx?view=ical`,
                            `${serviceUrl}/rss.aspx`,
                            `${serviceUrl}/iCalendar.aspx`,
                            // Handle webName pattern for Trumba hosted calendars
                            serviceUrl.includes('/') ? `https://www.trumba.com/${serviceUrl.split('/').pop()}/rss.aspx` : `https://www.trumba.com/${serviceUrl}/rss.aspx`,
                            serviceUrl.includes('/') ? `https://www.trumba.com/${serviceUrl.split('/').pop()}/iCalendar.aspx` : `https://www.trumba.com/${serviceUrl}/iCalendar.aspx`,
                          ];

                          trumbaSubscriptionUrls.forEach(trumbaUrl => {
                            console.log(`📋 Adding Trumba subscription URL: ${trumbaUrl}`);
                            discoveredPaths.add(trumbaUrl);
                          });
                        } else if (serviceUrl && !serviceUrl.startsWith('http')) {
                          // Handle relative or webName-only patterns (spudId/webName)
                          const trumbaWebUrls = [
                            `https://www.trumba.com/${serviceUrl}/rss.aspx`,
                            `https://www.trumba.com/${serviceUrl}/iCalendar.aspx`,
                            `https://www.trumba.com/${serviceUrl}/main.aspx?view=rss`,
                            `https://www.trumba.com/${serviceUrl}/main.aspx?view=ical`,
                            `https://www.trumba.com/${serviceUrl}/subscribe`,
                            `https://www.trumba.com/${serviceUrl}/calendar/subscribe`,
                          ];

                          trumbaWebUrls.forEach(webUrl => {
                            console.log(`📋 Adding Trumba web URL: ${webUrl}`);
                            discoveredPaths.add(webUrl);
                          });
                        }
                      }
                    });
                  }
                }

              }
            });

            // Also check for subscription links in the current page that might be hidden or dynamically generated
            const hiddenSubscriptionSelectors = [
              'a[href*="subscribe"][style*="display:none"]',
              'a[href*="subscribe"][hidden]',
              'div[style*="display:none"] a[href*="subscribe"]',
              'script + a[href*="subscribe"]', // Links that might be shown by scripts
              '.subscription-links a', '.calendar-subscribe a', '.feed-links a'
            ];

            $(hiddenSubscriptionSelectors.join(', ')).each((_, hiddenEl) => {
              const href = $(hiddenEl).attr('href');
              if (href && (href.includes('subscribe') || href.includes('rss') || href.includes('ical'))) {
                console.log(`🔗 Found hidden subscription link: ${href}`);
                discoveredPaths.add(href);
              }
            });
          }
        }

        // Check data attributes for downloadable feeds
        if (dataUrl && this.isDownloadableFeedUrl(dataUrl)) {
          console.log(`📎 Found downloadable feed in data attribute: ${dataUrl}`);
          const path = dataUrl.startsWith('/') ? dataUrl : dataUrl.startsWith('http') ? new URL(dataUrl, baseUrl).pathname + new URL(dataUrl, baseUrl).search : `/${dataUrl}`;
          discoveredPaths.add(path);
        }

        // Check form actions for downloadable feed submissions
        if (formAction && this.isDownloadableFeedUrl(formAction)) {
          console.log(`📋 Found downloadable feed in form action: ${formAction}`);
          const path = formAction.startsWith('/') ? formAction : `/${formAction}`;
          discoveredPaths.add(path);
        }

        // Look for hidden inputs that might contain downloadable feed URLs
        const nearbyInputs = $el.closest('form, div, span').find('input[type="hidden"], input[name*="url"], input[name*="feed"], input[name*="download"]');
        nearbyInputs.each((_, input) => {
          const value = $(input).attr('value');
          if (value && this.isDownloadableFeedUrl(value)) {
            console.log(`🔗 Found downloadable feed in hidden input: ${value}`);
            const path = value.startsWith('/') ? value : `/${value}`;
            discoveredPaths.add(path);
          }
        });
      });

      // Enhanced detection of RSS feed icons and iCalendar subscribe links
      const feedLinkSelectors = [
        'a[href*="ical"]', 'a[href*="rss"]', 'a[href*=".xml"]', 'a[href*="feed"]',
        'a[title*="iCalendar"]', 'a[title*="Subscribe"]', 'a[title*="RSS"]', 'a[title*="Feed"]',
        'img[src*="rss"]', 'img[alt*="RSS"]', 'img[alt*="Feed"]', 'img[alt*="Calendar"]',
        'a[class*="rss"]', 'a[class*="feed"]', 'a[class*="calendar"]', 'a[class*="subscribe"]',
        'span[class*="rss"] a', 'div[class*="feed"] a', 'li[class*="subscribe"] a', 'a.ImageLink',
        // Third-party calendar service specific patterns
        'span.ImageLink a[onclick*="subscribe"]', '.ImageLink a[title*="Subscribe"]',
        'span.ImageLink a[onclick*="showWindow"]', 'div.ImageLink a[onclick*="calendar"]'
      ];

      $(feedLinkSelectors.join(', ')).each((_, element) => {
        const $el = $(element);
        const tagName = (element as any).tagName?.toLowerCase() || 'unknown';

        // Get href from element or parent
        const href = $el.attr('href') || $el.parent('a').attr('href') || $el.closest('a').attr('href');

        if (href) {
          // Check for direct feed links
          if (href.includes('.ics') || href.includes('.rss') || href.includes('.xml') || 
              href.includes('feed') || href.includes('ical') || href.includes('calendar')) {

            const path = href.startsWith('/') ? href : href.startsWith('http') ? new URL(href, baseUrl).pathname + new URL(href, baseUrl).search : `/${href}`;
            discoveredPaths.add(path);
          }
        }

        // For images and elements, check if they're inside clickable elements or ImageLink containers
        if (tagName === 'img' || tagName === 'a') {
          const clickableParent = $el.closest('[onclick], [data-url], [data-href], a, span.ImageLink, div.ImageLink');
          if (clickableParent.length > 0) {
            const parentOnclick = clickableParent.attr('onclick');
            const parentDataUrl = clickableParent.attr('data-url') || clickableParent.attr('data-href');
            const parentClass = clickableParent.attr('class') || '';

            // Special handling for third-party calendar services (like Trumba)
            if (parentOnclick && (parentOnclick.includes('showWindow') || parentOnclick.includes('Trumba'))) {
              console.log(`🎯 Found third-party calendar service button in ImageLink: ${parentOnclick}`);

              // Check if this is a subscription button
              const isSubscriptionButton = parentOnclick.includes('subscribe') || 
                                         $el.attr('title')?.toLowerCase().includes('subscribe') ||
                                         $el.attr('alt')?.toLowerCase().includes('subscribe') ||
                                         $el.text().toLowerCase().includes('subscribe') ||
                                         $el.attr('aria-label')?.toLowerCase().includes('subscribe');

              if (isSubscriptionButton) {
                console.log(`✅ Confirmed ImageLink subscription button - adding comprehensive subscription paths`);

                // Add comprehensive subscription page paths for third-party services
                const subscriptionPaths = [
                  '/subscribe',
                  '/calendar/subscribe', 
                  '/events/subscribe',
                  '/rss.aspx',
                  '/iCalendar.aspx',
                  '/calendar/rss.aspx',
                  '/calendar/iCalendar.aspx',
                  '/events/rss.aspx', 
                  '/events/iCalendar.aspx',
                  '/feed',
                  '/calendar/feed',
                  '/events/feed',
                  '/calendar.rss',
                  '/events.rss',
                  '/calendar.ics',
                  '/events.ics',
                  // Common Trumba paths
                  '/calendar/calendar.rss',
                  '/calendar/events.rss',
                  '/spuds.aspx', // Sometimes used by Trumba
                  '/main.aspx', // Common Trumba calendar page
                  '/main.aspx?view=rss',
                  '/main.aspx?view=ical'
                ];

                subscriptionPaths.forEach(path => {
                  console.log(`📋 Adding ImageLink subscription path: ${path}`);
                  discoveredPaths.add(path);
                });

                // Look for nearby subscription URLs in the same container
                const container = $el.closest('div, span, section, article');
                container.find('a[href*="subscribe"], a[href*="rss"], a[href*="ical"], a[href*="feed"]').each((_, nearbyLink) => {
                  const nearbyHref = $(nearbyLink).attr('href');
                  if (nearbyHref) {
                    console.log(`🔗 Found nearby subscription link in ImageLink container: ${nearbyHref}`);
                    discoveredPaths.add(nearbyHref);
                  }
                });
              }
            }

            if (parentOnclick && (parentOnclick.includes('calendar') || parentOnclick.includes('feed') || parentOnclick.includes('rss'))) {
              // Extract URL from parent onclick
              const urlMatch = parentOnclick.match(/['"]([^'"]*(?:calendar|feed|rss|ical)[^'"]*)['"]/) ||
                              parentOnclick.match(/window\.open\(['"]([^'"]*)['"]/) ||
                              parentOnclick.match(/location\.href\s*=\s*['"]([^'"]*)['"]/) ||
                              parentOnclick.match(/downloadFile\(['"]([^'"]*)['"]/) ||
                              parentOnclick.match(/subscribe\w*\(['"]([^'"]*)['"]/)
              if (urlMatch && urlMatch[1]) {
                const path = urlMatch[1].startsWith('/') ? urlMatch[1] : `/${urlMatch[1]}`;
                discoveredPaths.add(path);
              }
            }

            if (parentDataUrl) {
              const path = parentDataUrl.startsWith('/') ? parentDataUrl : `/${parentDataUrl}`;
              discoveredPaths.add(path);
            }
          }
        }
      });

      // Look for calendar category links that might have individual RSS feeds
      $('a:contains("Calendar"), a:contains("Department"), a[href*="calendar"]').each((_, element) => {
        const $el = $(element);
        const href = $el.attr('href');
        const text = $el.text().toLowerCase();

        if (href && (text.includes('calendar') || text.includes('department') || text.includes('city'))) {
          // Try common feed variations for calendar category pages
          const basePath = href.startsWith('/') ? href : new URL(href, baseUrl).pathname;

          // Add potential feed URLs for this calendar category
          discoveredPaths.add(`${basePath}/feed`);
          discoveredPaths.add(`${basePath}.rss`);
          discoveredPaths.add(`${basePath}/rss`);
          discoveredPaths.add(`${basePath}.ics`);
          discoveredPaths.add(`${basePath}/ical`);
        }
      });

      // Look for form submissions that might generate feeds
      $('form[action*="calendar"], form[action*="events"], form[action*="export"], form[action*="download"]').each((_, element) => {
        const action = $(element).attr('action');
        if (action) {
          const path = action.startsWith('/') ? action : new URL(action, baseUrl).pathname;
          discoveredPaths.add(path);
        }
      });

      // Add common paths to check
      this.commonFeedPaths.forEach(path => discoveredPaths.add(path));

      // Look for meta tags that might indicate RSS/Calendar feeds
      $('link[rel="alternate"]').each((_, element) => {
        const href = $(element).attr('href');
        const type = $(element).attr('type');
        if (href && (type?.includes('calendar') || type?.includes('rss') || type?.includes('xml') || href.includes('.ics') || href.includes('.rss'))) {
          const path = href.startsWith('/') ? href : new URL(href, baseUrl).pathname;
          discoveredPaths.add(path);
        }
      });

      // Enhanced JavaScript and AJAX endpoint discovery
      $('script').each((_, element) => {
        const scriptContent = $(element).html() || '';

        // Look for actual feed files
        if (scriptContent.includes('.ics') || scriptContent.includes('.rss') || scriptContent.includes('.xml')) {
          // Extract URLs for actual feed files (not API endpoints)
          const feedFilePatterns = [
            /(['"])(\/[^'"]*\.(?:ics|rss|xml))\1/g,
            /(['"])(\/[^'"]*(?:calendar|events)[^'"]*\.(?:ics|rss|xml))\1/g,
            /url\s*:\s*(['"])([^'"]*\.(?:ics|rss|xml))\1/g,
            /href\s*:\s*(['"])([^'"]*\.(?:ics|rss|xml))\1/g,
            /(['"])(\/[^'"]*(?:calendar|events)[^'"]*\.xml)\1/g
          ];

          feedFilePatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(scriptContent)) !== null) {
              if (match[2] && !match[2].includes('/api/') && !match[2].includes('/v2/') && !match[2].includes('/v4/')) {
                const path = match[2].startsWith('/') ? match[2] : new URL(match[2], baseUrl).pathname;
                discoveredPaths.add(path);
              }
            }
          });
        }

        // Look for AJAX endpoints and dynamic feed URLs
        if (scriptContent.includes('calendar') || scriptContent.includes('event') || scriptContent.includes('feed')) {
          const ajaxPatterns = [
            /(?:url|endpoint|api)['"]?\s*:\s*['"]([^'"]*(?:calendar|event|feed)[^'"]*)['"]/, // Object property
            /fetch\(['"]([^'"]*(?:calendar|event|feed)[^'"]*)['"]/, // Fetch API
            /ajax\(['"]([^'"]*(?:calendar|event|feed)[^'"]*)['"]/, // AJAX calls
            /\.get\(['"]([^'"]*(?:calendar|event|feed)[^'"]*)['"]/, // HTTP GET
            /\.post\(['"]([^'"]*(?:calendar|event|feed)[^'"]*)['"]/, // HTTP POST
            /downloadUrl\s*=\s*['"]([^'"]*(?:calendar|event|feed)[^'"]*)['"]/, // Download URL variable
            /feedUrl\s*=\s*['"]([^'"]*)['"]/, // Feed URL variable
            /calendarUrl\s*=\s*['"]([^'"]*)['"]/, // Calendar URL variable
            /subscribeUrl\s*=\s*['"]([^'"]*)['"]/, // Subscribe URL variable
            /exportUrl\s*=\s*['"]([^'"]*)['"]/, // Export URL variable
            /iCalUrl\s*=\s*['"]([^'"]*)['"]/, // iCal URL variable
            /rssUrl\s*=\s*['"]([^'"]*)['"]/, // RSS URL variable
          ];

          for (const pattern of ajaxPatterns) {
            const matches = scriptContent.match(pattern);
            if (matches && matches[1]) {
              let url = matches[1];
              // Handle template variables like {categoryId} or {moduleId}
              url = url.replace(/\{[^}]+\}/g, 'all').replace(/%7B[^%]+%7D/g, 'all');
              const path = url.startsWith('/') ? url : `/${url}`;
              discoveredPaths.add(path);
            }
          }

          // Look for parameter-based subscription URLs (common in government CMS)
          const paramPatterns = [
            /ModID['"=:]\s*['"]?(\d+)['"]?/, // ModID parameter
            /CID['"=:]\s*['"]?([^'",\s}]+)['"]?/, // CID parameter
            /calendarId['"=:]\s*['"]?([^'",\s}]+)['"]?/, // calendarId parameter
            /categoryId['"=:]\s*['"]?([^'",\s}]+)['"]?/, // categoryId parameter
          ];

          paramPatterns.forEach(pattern => {
            const matches = scriptContent.match(pattern);
            if (matches && matches[1]) {
              const paramValue = matches[1];
              // Try common subscription page patterns with discovered parameters
              discoveredPaths.add(`/iCalendar.aspx?ModID=${paramValue}&CID=All`);
              discoveredPaths.add(`/RSSFeed.aspx?ModID=${paramValue}&CID=All`);
              discoveredPaths.add(`/calendar.aspx?ModID=${paramValue}`);
              discoveredPaths.add(`/events.aspx?categoryId=${paramValue}`);
            }
          });

          // Look for base64 encoded or obfuscated URLs
          const encodedPatterns = [
            /atob\(['"]([A-Za-z0-9+/=]+)['"]/, // Base64 decode
            /decodeURI(?:Component)?\(['"]([^'"]*)['"]/, // URI decode
          ];

          for (const pattern of encodedPatterns) {
            const matches = scriptContent.match(pattern);
            if (matches && matches[1]) {
              try {
                let decoded = '';
                if (pattern.source.includes('atob')) {
                  decoded = Buffer.from(matches[1], 'base64').toString();
                } else {
                  decoded = decodeURIComponent(matches[1]);
                }

                if (decoded.includes('calendar') || decoded.includes('event') || decoded.includes('feed') || decoded.includes('.ics') || decoded.includes('.rss')) {
                  const path = decoded.startsWith('/') ? decoded : `/${decoded}`;
                  discoveredPaths.add(path);
                }
              } catch (e) {
                // Invalid encoding, skip
              }
            }
          }
        }
      });

      // Add department-specific feed patterns if we detect a calendar system
      const hasCalendarSystem = response.data.includes('calendar') || 
                                response.data.includes('Calendar') ||
                                discoveredPaths.size > 0;

      if (hasCalendarSystem) {
        // Add common department feed patterns that might not be linked but exist
        const commonDepartments = [
          'all', 'main-calendar', 'city-calendar', 'city-council', 'planning',
          'building', 'fire', 'police', 'public-works', 'parks', 'library',
          'utilities', 'administration', 'mayor', 'clerk'
        ];

        commonDepartments.forEach(dept => {
          discoveredPaths.add(`/calendar/${dept}.rss`);
          discoveredPaths.add(`/calendar/${dept}.ics`);
          discoveredPaths.add(`/calendar/${dept}/rss`);
          discoveredPaths.add(`/calendar/${dept}/ical`);
        });
      }

      // Check each discovered path for feeds
      for (const path of Array.from(discoveredPaths).slice(0, 20)) { // Increased limit for department feeds
        const feedUrl = path.startsWith('http') ? path : `${baseUrl}${path}`;
        const feed = await this.validateFeedUrl(feedUrl, location);

        if (feed) {
          feeds.push(feed);
        }
      }

    } catch (error: any) {
      // Domain doesn't exist or is not accessible
      if (error.code === 'ENOTFOUND') {
        console.log(`❌ Domain ${domain} does not exist (DNS resolution failed)`);
      } else if (error.code === 'ECONNREFUSED') {
        console.log(`❌ Domain ${domain} connection refused (server not responding)`);
      } else if (error.code === 'ETIMEDOUT') {
        console.log(`❌ Domain ${domain} request timed out (server too slow or unreachable)`);
      } else if (error.response && error.response.status >= 400) {
        console.log(`❌ Domain ${domain} returned HTTP ${error.response.status} (${error.response.statusText})`);
      } else {
        console.log(`❌ Domain ${domain} not accessible: ${error.message || error}`);
      }
    }

    return feeds;
  }

  private async checkSpecificPathForFeeds(domain: string, specificPath: string, location: LocationInfo & { organizationType: 'city' | 'school' | 'chamber' | 'library' | 'parks' }): Promise<DiscoveredFeed[]> {
    const feeds: DiscoveredFeed[] = [];

    try {
      const baseUrl = `https://${domain}`;
      const fullUrl = `${baseUrl}${specificPath}`;

      console.log(`Checking specific path: ${fullUrl}`);

      // First check if the specific path exists
      const response = await axios.get(fullUrl, {
        headers: { 'User-Agent': 'CityWide Events Calendar Discovery Bot 1.0' },
        validateStatus: (status) => status < 500,
        maxRedirects: 3
      });

      // Check if path actually exists and returns content
      if (response.status === 404 || response.status >= 400) {
        console.log(`Path ${specificPath} on ${domain} returned status ${response.status} - skipping`);
        return feeds;
      }

      // Verify we got actual content
      if (!response.data || typeof response.data !== 'string' || response.data.length < 100) {
        console.log(`Path ${specificPath} on ${domain} returned insufficient content - skipping`);
        return feeds;
      }

      console.log(`✓ Found content at ${specificPath} on ${domain} - searching for feeds`);

      // Parse the page content to look for calendar/events feeds
      const $ = cheerio.load(response.data);
      const discoveredPaths = new Set<string>();

      // Look for calendar/events links on this specific page
      $('a[href*="calendar"], a[href*="events"]').each((_, element) => {
        const href = $(element).attr('href');
        if (href) {
          const path = href.startsWith('/') ? href : new URL(href, fullUrl).pathname;
          discoveredPaths.add(path);
        }
      });

      // Look for direct feed links (.ics, .rss, etc.)
      $('a[href*=".ics"], a[href*=".rss"], a[href*=".xml"], a[href*="download"], a[href*="export"], a[href*="subscribe"]').each((_, element) => {
        const href = $(element).attr('href');
        if (href) {
          const path = href.startsWith('/') ? href : new URL(href, fullUrl).pathname;
          discoveredPaths.add(path);
        }
      });

      // Add common feed paths based on the specific department/section we're looking at
      const pathType = specificPath.toLowerCase();
      if (pathType.includes('library') || pathType.includes('libraries')) {
        discoveredPaths.add(`${specificPath}/calendar.ics`);
        discoveredPaths.add(`${specificPath}/events.ics`);
        discoveredPaths.add(`${specificPath}/calendar.rss`);
        discoveredPaths.add(`${specificPath}/events.rss`);
        discoveredPaths.add(`${specificPath}/calendar`);
        discoveredPaths.add(`${specificPath}/events`);
      } else if (pathType.includes('park') || pathType.includes('recreation')) {
        discoveredPaths.add(`${specificPath}/calendar.ics`);
        discoveredPaths.add(`${specificPath}/events.ics`);
        discoveredPaths.add(`${specificPath}/calendar.rss`);
        discoveredPaths.add(`${specificPath}/events.rss`);
        discoveredPaths.add(`${specificPath}/calendar`);
        discoveredPaths.add(`${specificPath}/events`);
      }

      // Check each discovered path for feeds
      for (const path of Array.from(discoveredPaths).slice(0, 10)) {
        const feedUrl = path.startsWith('http') ? path : `${baseUrl}${path}`;
        const feed = await this.validateFeedUrl(feedUrl, location);

        if (feed) {
          feeds.push(feed);
        }
      }

    } catch (error) {
      console.log(`Error checking specific path ${specificPath} on ${domain}:`, (error as Error).message);
    }

    return feeds;
  }

  private async validateFeedUrl(feedUrl: string, location: LocationInfo & { organizationType: 'city' | 'school' | 'chamber' | 'library' | 'parks' }): Promise<DiscoveredFeed | null> {
    try {
      // Handle dynamic calendar generation APIs (like Thrillshare CMS)
      if (feedUrl.includes('generate_ical') || feedUrl.includes('generate_calendar') || feedUrl.includes('export_ical')) {
        console.log(`Attempting to validate dynamic calendar generation API: ${feedUrl}`);
        return await this.validateDynamicCalendarAPI(feedUrl, location);
      }

      // Skip other API endpoints that are likely to be client-side only
      if (feedUrl.includes('/api/v') && !feedUrl.includes('generate_ical') && !feedUrl.includes('generate_calendar')) {
        if (feedUrl.includes('/cms/') && !feedUrl.includes('generate_ical')) {
          console.log(`Skipping client-side API endpoint: ${feedUrl}`);
          return null;
        }
      }

      // First verify the domain/website exists before checking feed URLs
      const feedDomain = new URL(feedUrl).origin;
      try {
        // Use website validator for comprehensive domain checking
        const { WebsiteValidator } = await import('./website-validator');
        const validation = await WebsiteValidator.validateWebsite(feedDomain);

        if (!validation.isValid) {
          console.log(`❌ Domain ${feedDomain} validation failed: ${validation.status} - ${validation.error} - skipping feed: ${feedUrl}`);
          return null;
        }

        if (validation.status === 'parked' || validation.status === 'redirect') {
          console.log(`❌ Domain ${feedDomain} is ${validation.status} - skipping feed: ${feedUrl}`);
          return null;
        }

        // Additional backup check
        const domainCheck = await axios.get(feedDomain, {
          timeout: 8000,
          headers: { 'User-Agent': 'CityWide Events Calendar Discovery Bot 1.0' },
          validateStatus: (status) => status < 500
        });

        if (domainCheck.status >= 400) {
          console.log(`❌ Domain ${feedDomain} not accessible (HTTP ${domainCheck.status}) - skipping feed: ${feedUrl}`);
          return null;
        }

        console.log(`✅ Domain ${feedDomain} validated successfully - testing feed: ${feedUrl}`);
      } catch (error: any) {
        if (error.code === 'ENOTFOUND') {
          console.log(`❌ Domain ${feedDomain} does not exist - skipping feed: ${feedUrl}`);
        } else if (error.code === 'ECONNREFUSED') {
          console.log(`❌ Domain ${feedDomain} connection refused - skipping feed: ${feedUrl}`);
        } else if (error.code === 'ETIMEDOUT') {
          console.log(`❌ Domain ${feedDomain} timed out - skipping feed: ${feedUrl}`);
        } else {
          console.log(`❌ Domain ${feedDomain} error: ${error.message} - skipping feed: ${feedUrl}`);
        }
        return null;
      }

      // Check if this is a downloadable feed URL first
      const isDownloadableFeed = this.isDownloadableFeedUrl(feedUrl);

      // Identify direct download/API endpoints vs subscription pages
      const isDirectDownloadAPI = isDownloadableFeed ||
                                  feedUrl.includes('generate_ical') || 
                                  feedUrl.includes('generate_calendar') || 
                                  feedUrl.includes('export_ical') ||
                                  feedUrl.includes('/api/') && (feedUrl.includes('ical') || feedUrl.includes('calendar') || feedUrl.includes('events')) ||
                                  feedUrl.endsWith('.ics') ||
                                  feedUrl.endsWith('.rss') ||
                                  feedUrl.endsWith('.xml') ||
                                  // Check for direct feed URLs with parameters that might return calendar data
                                  (feedUrl.includes('Feed.aspx') && feedUrl.includes('CID=')) ||
                                  (feedUrl.includes('RSSFeed.aspx') && feedUrl.includes('ModID=')) ||
                                  (feedUrl.includes('iCalendarFeed.aspx') && feedUrl.includes('CID=')) ||
                                  // Common download/export patterns with parameters
                                  (feedUrl.includes('download') && (feedUrl.includes('calendar') || feedUrl.includes('events'))) ||
                                  (feedUrl.includes('export') && (feedUrl.includes('calendar') || feedUrl.includes('events')));

      const isSubscriptionPage = !isDirectDownloadAPI && (
                                 (feedUrl.includes('iCalendar.aspx') && !feedUrl.includes('CID=')) || 
                                 (feedUrl.includes('rss.aspx') && !feedUrl.includes('ModID=')) || 
                                 (feedUrl.includes('calendar.aspx') && !feedUrl.includes('CID=')) ||
                                 (feedUrl.includes('subscribe') && !feedUrl.includes('.ics') && !feedUrl.includes('.rss') && !this.isDownloadableFeedUrl(feedUrl))
                                );

      if (!feedUrl.includes('.ics') && !feedUrl.includes('.rss') && !feedUrl.includes('.xml') && 
          !feedUrl.includes('calendar') && !feedUrl.includes('events') && !feedUrl.includes('feed') && 
          !isSubscriptionPage && !isDirectDownloadAPI) {
        return null;
      }

      // Handle direct download/API endpoints first (bypass subscription page parsing)
      if (isDirectDownloadAPI) {
        console.log(`🎯 Direct download/API endpoint detected: ${feedUrl}`);
        return await this.validateAndCreateFeed(feedUrl, location);
      }

      // Handle subscription pages by parsing them to find actual feed URLs
      if (isSubscriptionPage) {
        // First, check if the subscription page itself might be a direct download/API endpoint
        console.log(`🔍 Checking if subscription page is actually a direct endpoint: ${feedUrl}`);
        const directEndpointFeed = await this.validateAndCreateFeed(feedUrl, location);
        if (directEndpointFeed) {
          console.log(`✅ Subscription page is actually a direct feed endpoint: ${feedUrl}`);
          return directEndpointFeed;
        }

        // If not a direct endpoint, parse it for feed links
        const discoveredUrls = await this.parseSubscriptionPageForFeeds(feedUrl);
        if (discoveredUrls.length > 0) {
          // Try each discovered URL to see if it works
          for (const discoveredUrl of discoveredUrls) {
            const workingFeed = await this.validateAndCreateFeed(discoveredUrl, location);
            if (workingFeed) {
              return workingFeed;
            }
          }
        }

        // If no feeds found in the page, try common parameter variations
        const parameterVariations = await this.trySubscriptionPageParameters(feedUrl, location);
        if (parameterVariations.length > 0) {
          return parameterVariations[0];
        }
      }

      // Check if this is a calendar page that might have subscription buttons
      if (feedUrl.includes('calendar') || feedUrl.includes('events')) {
        const subscriptionFeeds = await this.findSubscriptionFeedsOnCalendarPage(feedUrl, location);
        if (subscriptionFeeds.length > 0) {
          return subscriptionFeeds[0]; // Return first working subscription feed
        }
      }

      // For potential feeds that might be behind download buttons, try GET instead of HEAD
      const method = feedUrl.includes('download') || feedUrl.includes('export') || feedUrl.includes('.ics') || feedUrl.includes('.rss') || isSubscriptionPage ? 'get' : 'head';

      const response = await axios[method](feedUrl, {
        headers: { 
          'User-Agent': 'CityWide Events Calendar Discovery Bot 1.0',
          'Accept': 'text/calendar, application/calendar, application/rss+xml, application/xml, text/xml, application/json, text/html, */*'
        },
        maxRedirects: 5, // Allow more redirects for download links
        validateStatus: (status) => status < 500 // Accept 404s but check content
      });

      const contentType = response.headers['content-type'] || '';
      let feedType: 'ical' | 'rss' | 'json' | 'html' = 'html';
      let confidence = 0.3; // Base confidence

      // For GET requests, we have actual content to validate
      let actualContent = '';
      if (method === 'get' && response.data) {
        actualContent = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      }

      // Check for actual calendar/event content in the feed
      const hasCalendarContent = actualContent.includes('VEVENT') || 
                                actualContent.includes('DTSTART') ||
                                actualContent.includes('SUMMARY') ||
                                actualContent.includes('<title>') ||
                                actualContent.includes('<description>') ||
                                actualContent.includes('event') ||
                                actualContent.includes('meeting') ||
                                actualContent.includes('council') ||
                                actualContent.includes('calendar');

      // Determine feed type and confidence based on content type, URL, and actual content
      if (contentType.includes('text/calendar') || feedUrl.endsWith('.ics') || actualContent.includes('BEGIN:VCALENDAR') || actualContent.includes('BEGIN:VEVENT')) {
        feedType = 'ical';
        confidence = actualContent.includes('BEGIN:VCALENDAR') && hasCalendarContent ? 0.95 : 
                    actualContent.includes('BEGIN:VCALENDAR') ? 0.85 : 0.9;
      } else if (contentType.includes('application/rss') || contentType.includes('xml') || feedUrl.includes('rss') || feedUrl.includes('.xml') || 
                 actualContent.includes('<rss') || actualContent.includes('<feed') || actualContent.includes('<item') || actualContent.includes('<entry')) {
        feedType = 'rss';
        confidence = (actualContent.includes('<rss') || actualContent.includes('<feed')) && hasCalendarContent ? 0.85 : 
                    actualContent.includes('<rss') || actualContent.includes('<feed') ? 0.75 : 0.8;
      } else if (contentType.includes('application/json') || feedUrl.includes('api') || feedUrl.includes('.json')) {
        feedType = 'json';
        try {
          const jsonData = JSON.parse(actualContent || '{}');
          confidence = (jsonData.events || jsonData.items || jsonData.data || Array.isArray(jsonData)) ? 0.75 : 0.7;
        } catch {
          confidence = 0.7;
        }
      } else if (feedUrl.includes('calendar') || feedUrl.includes('events')) {
        feedType = 'html';
        confidence = 0.5;
      }

      // Require minimum confidence for discovery - higher threshold for calendar feeds
      const minConfidence = feedUrl.includes('calendar') || feedUrl.includes('events') ? 0.6 : 0.5;
      if (confidence < minConfidence) {
        console.log(`Feed validation failed for ${feedUrl}: Low confidence (${confidence})`);
        return null;
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

  private async trySubscriptionPageParameters(feedUrl: string, location: LocationInfo & { organizationType: 'city' | 'school' | 'chamber' | 'library' | 'parks' }): Promise<DiscoveredFeed[]> {
    const variations: DiscoveredFeed[] = [];

    try {
      if (feedUrl.includes('iCalendar.aspx')) {
        // Try common iCalendar parameter combinations without hardcoded ModIDs
        const baseUrl = feedUrl.split('?')[0].split('#')[0]; // Clean base URL
        const iCalVariations = [
          `${baseUrl.replace('iCalendar.aspx', 'iCalendarFeed.aspx')}?CID=All-calendar.ics`,
          `${baseUrl.replace('iCalendar.aspx', 'iCalendarFeed.aspx')}?CID=all`,
          `${baseUrl}?format=ics`,
          `${baseUrl}?calendar=all`,
          `${baseUrl}?type=all`,
          `${baseUrl}?category=all`,
          `${baseUrl}?feed=calendar`,
          `${baseUrl}?CID=1`,
          `${baseUrl}?CID=0`,
          `${baseUrl}?export=ics`
        ];

        for (const variation of iCalVariations.slice(0, 5)) { // Limit to prevent too many requests
          try {
            const response = await axios.get(variation, {

              headers: { 
                'User-Agent': 'CityWide Events Calendar Bot 1.0',
                'Accept': 'text/calendar, application/calendar, text/plain, */*'
              },
              maxRedirects: 3
            });

            // Check if this returns actual calendar data
            if (response.data.includes('BEGIN:VCALENDAR') || response.headers['content-type']?.includes('text/calendar')) {
              variations.push({
                source: {
                  id: `discovered-${location.city.toLowerCase().replace(/\s+/g, '-')}-${location.organizationType}-ical-${Date.now()}`,
                  name: `${this.generateSourceName(location)} (iCalendar)`,
                  city: location.city,
                  state: location.state,
                  type: location.organizationType as any,
                  feedUrl: variation,
                  websiteUrl: new URL(variation).origin,
                  isActive: true,
                  feedType: 'ical' as const
                },
                confidence: 0.9,
                lastChecked: new Date()
              });
            }
          } catch (error) {
            // Continue trying other variations
          }
        }
      }

      if (feedUrl.includes('rss.aspx')) {
        // Try RSS parameter combinations without hardcoded ModIDs
        const baseUrl = feedUrl.split('?')[0].split('#')[0]; // Clean base URL
        const rssVariations = [
          `${baseUrl.replace('rss.aspx', 'RSSFeed.aspx')}?CID=All-calendar.xml`,
          `${baseUrl.replace('rss.aspx', 'RSSFeed.aspx')}?CID=all`,
          `${baseUrl}?format=rss`,
          `${baseUrl}?calendar=all`,
          `${baseUrl}?CID=all`,
          `${baseUrl}?type=calendar`,
          `${baseUrl}?feed=xml`,
          feedUrl.replace('#calendar', '?calendar=all'), // Convert anchor to parameter
          feedUrl.replace('#calendar', '?CID=all'),
          `${baseUrl}?export=xml`
        ];

        for (const variation of rssVariations.slice(0, 5)) {
          try {
            const response = await axios.get(variation, {

              headers: { 
                'User-Agent': 'CityWide Events Calendar Bot 1.0',
                'Accept': 'application/rss+xml, application/xml, text/xml, */*'
              },
              maxRedirects: 3
            });

            // Check if this returns actual RSS data
            if (response.data.includes('<rss') || response.data.includes('<feed') || response.headers['content-type']?.includes('xml')) {
              variations.push({
                source: {
                  id: `discovered-${location.city.toLowerCase().replace(/\s+/g, '-')}-${location.organizationType}-rss-${Date.now()}`,
                  name: `${this.generateSourceName(location)} (RSS)`,
                  city: location.city,
                  state: location.state,
                  type: location.organizationType as any,
                  feedUrl: variation,
                  websiteUrl: new URL(variation).origin,
                  isActive: true,
                  feedType: 'rss' as const
                },
                confidence: 0.85,
                lastChecked: new Date()
              });
            }
          } catch (error) {
            // Continue trying other variations
          }
        }
      }
    } catch (error) {
      console.log(`Error trying subscription page parameters for ${feedUrl}:`, error);
    }

    return variations;
  }

  private async parseSubscriptionPageForFeeds(subscriptionUrl: string): Promise<string[]> {
    try {
      // First verify the website exists
      const subscriptionDomain = new URL(subscriptionUrl).origin;
      try {
        const domainCheck = await axios.get(subscriptionDomain, {

          headers: { 'User-Agent': 'CityWide Events Calendar Bot 1.0' },
          validateStatus: (status) => status < 500
        });

        if (domainCheck.status >= 400) {
          console.log(`Domain ${subscriptionDomain} not accessible - skipping subscription page parsing`);
          return [];
        }
      } catch (error) {
        console.log(`Domain ${subscriptionDomain} not accessible - skipping subscription page parsing`);
        return [];
      }

      const response = await axios.get(subscriptionUrl, {

        headers: { 'User-Agent': 'CityWide Events Calendar Bot 1.0' }
      });

      const feedUrls: string[] = [];
      const html = response.data;
      const baseUrl = new URL(subscriptionUrl);

      console.log(`🔍 Parsing subscription page for downloadable feeds: ${subscriptionUrl}`);

      // Enhanced patterns focusing on downloadable feeds
      const downloadableFeedPatterns = [
        // Direct downloadable feed files
        /href=["']([^"']*\.(?:ics|rss|xml)[^"']*)["']/gi,
        /href=["']([^"']*\.(?:ical)[^"']*)["']/gi,
        /href=["']([^"']*\.(?:ics|rss|xml|ical)[^"']*)["']/gi,

        // RSS Feed endpoints that return downloadable content
        /RSSFeed\.aspx\?[^"'>\s]+/g,
        /rssfeed\.aspx\?[^"'>\s]+/gi,
        // iCalendar Feed endpoints that return downloadable content  
        /iCalendarFeed\.aspx\?[^"'>\s]+/g,
        /icalendarfeed\.aspx\?[^"'>\s]+/gi,
        // Generic feed endpoints with download parameters
        /(?:calendar|feed|rss|ical)\.aspx\?[^"'>\s]*(?:format|export|download|generate)[^"'>\s]*/gi,
        // API endpoints that generate downloadable feeds
        /href=["']([^"']*\/api\/[^"']*(?:generate_ical|export|calendar|events)[^"']*)["']/gi,
        // Feed URLs with ModID/CID parameters that return files
        /href=["']([^"']*(?:ModID|CID)=[^"']*(?:\.(?:xml|ics)|calendar|rss)[^"']*)["']/gi,
        // Thrillshare and similar CMS downloadable endpoints
        /href=["']([^"']*thrillshare[^"']*generate_ical[^"']*)["']/gi,
        // Download links for calendar files
        /href=["']([^"']*(?:download|export)[^"']*(?:calendar|events|ical|rss)[^"']*)["']/gi,
      ];

      for (const pattern of downloadableFeedPatterns) {
        const matches = html.match(pattern) || [];
        console.log(`Pattern ${pattern.source} found ${matches.length} matches`);

        for (const match of matches) {
          let feedPath = match;

          // Extract URL from href attribute if needed
          if (match.includes('href=')) {
            const hrefMatch = match.match(/href=["']([^"']*)["']/i);
            if (hrefMatch) {
              feedPath = hrefMatch[1];
            }
          }

          // Clean up the path
          feedPath = feedPath.replace(/^["']|["']$/g, '');

          // Only include if it's likely a downloadable feed
          if (this.isDownloadableFeedUrl(feedPath)) {
            // Convert to absolute URL
            let fullUrl: string;
            if (feedPath.startsWith('http')) {
              fullUrl = feedPath;
            } else if (feedPath.startsWith('/')) {
              fullUrl = `${baseUrl.protocol}//${baseUrl.host}${feedPath}`;
            } else {
              fullUrl = `${baseUrl.protocol}//${baseUrl.host}/${feedPath}`;
            }

            console.log(`✅ Found downloadable feed URL: ${fullUrl}`);
            feedUrls.push(fullUrl);
          }
        }
      }

      // Look for JavaScript variables that contain downloadable feed URLs
      const jsDownloadableFeedPatterns = [
        /(?:feedUrl|downloadUrl|exportUrl|calendarUrl|rssUrl|icalUrl)\s*[:=]\s*["']([^"']+\.(?:ics|rss|xml)[^"']*)["']/gi,
        /(?:feedUrl|downloadUrl|exportUrl|calendarUrl|rssUrl|icalUrl)\s*[:=]\s*["']([^"']*(?:generate_ical|export|RSSFeed\.aspx|iCalendarFeed\.aspx)[^"']*)["']/gi,
      ];

      for (const jsPattern of jsDownloadableFeedPatterns) {
        const matches = html.match(jsPattern) || [];
        for (const match of matches) {
          const urlMatch = match.match(/["']([^"']*)["']/);
          if (urlMatch) {
            const jsUrl = urlMatch[1];
            if (this.isDownloadableFeedUrl(jsUrl)) {
              const fullUrl = jsUrl.startsWith('http') ? jsUrl : `${baseUrl.protocol}//${baseUrl.host}${jsUrl.startsWith('/') ? '' : '/'}${jsUrl}`;
              console.log(`📜 Found downloadable feed in JavaScript: ${fullUrl}`);
              feedUrls.push(fullUrl);
            }
          }
        }
      }

      // Look for form actions that submit to downloadable feed endpoints
      const formActions = html.match(/<form[^>]*action=["']([^"']*)["'][^>]*>/gi) || [];
      for (const formAction of formActions) {
        const actionMatch = formAction.match(/action=["']([^"']*)["']/i);
        if (actionMatch) {
          const action = actionMatch[1];
          if (this.isDownloadableFeedUrl(action)) {
            const fullUrl = action.startsWith('http') ? action : `${baseUrl.protocol}//${baseUrl.host}${action.startsWith('/') ? '' : '/'}${action}`;
            console.log(`📋 Found downloadable feed in form action: ${fullUrl}`);
            feedUrls.push(fullUrl);
          }
        }
      }

      const uniqueFeedUrls = Array.from(new Set(feedUrls));
      console.log(`Found ${uniqueFeedUrls.length} downloadable feed URLs in subscription page:`, uniqueFeedUrls.slice(0, 3));
      return uniqueFeedUrls;
    } catch (error) {
      console.log(`Error parsing subscription page ${subscriptionUrl}:`, error);
      return [];
    }
  }

  private async validateDynamicCalendarAPI(feedUrl: string, location: LocationInfo & { organizationType: 'city' | 'school' | 'chamber' | 'library' | 'parks' }): Promise<DiscoveredFeed | null> {
    try {
      console.log(`🔗 Validating direct download API endpoint: ${feedUrl}`);
      // Try the URL as-is first
      let testUrl = feedUrl;

      // For Thrillshare CMS and similar systems, try common parameter variations
      if (feedUrl.includes('filter_ids&section_ids') || feedUrl.includes('filter_ids=&section_ids=')) {
        // Try without parameters first
        testUrl = feedUrl.split('?')[0];

        // Also try with common "all events" parameters
        const baseUrl = feedUrl.split('?')[0];
        const variations = [
          baseUrl,
          `${baseUrl}?filter_ids=all`,
          `${baseUrl}?section_ids=all`,
          `${baseUrl}?filter_ids=all&section_ids=all`,
          `${baseUrl}?filter_ids=&section_ids=`,
          `${baseUrl}?export_all=true`,
          `${baseUrl}?include_all=1`
        ];

        for (const variation of variations) {
          console.log(`🧪 Testing API parameter variation: ${variation}`);
          const result = await this.testCalendarAPIUrl(variation, location);
          if (result) {
            console.log(`✅ Direct download API working with URL: ${variation}`);
            return result;
          }
        }
      } else {
        // For other dynamic APIs, try the URL directly
        console.log(`🧪 Testing direct API endpoint: ${testUrl}`);
        const result = await this.testCalendarAPIUrl(testUrl, location);
        if (result) {
          console.log(`✅ Direct download API working: ${testUrl}`);
          return result;
        }
      }

      console.log(`❌ Dynamic calendar API not responsive: ${feedUrl}`);
      return null;
    } catch (error) {
      console.log(`Error validating dynamic calendar API ${feedUrl}:`, error);
      return null;
    }
  }

  private async testCalendarAPIUrl(testUrl: string, location: LocationInfo & { organizationType: 'city' | 'school' | 'chamber' | 'library' | 'parks' }): Promise<DiscoveredFeed | null> {
    try {
      const response = await axios.get(testUrl, {

        headers: { 
          'User-Agent': 'CityWide Events Calendar Bot 1.0',
          'Accept': 'text/calendar, application/calendar, text/plain, */*'
        },
        maxRedirects: 3,
        validateStatus: (status) => status < 500
      });

      // Check if we got actual calendar data
      if (response.status === 200 && response.data) {
        const content = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

        // Look for iCalendar format
        if (content.includes('BEGIN:VCALENDAR') || response.headers['content-type']?.includes('text/calendar')) {
          console.log(`✅ Found valid iCalendar content from dynamic API: ${testUrl}`);

          return {
            source: {
              id: `discovered-${location.city.toLowerCase().replace(/\s+/g, '-')}-${location.organizationType}-dynamic-ical-${Date.now()}`,
              name: `${this.generateSourceName(location)} (Dynamic iCal)`,
              city: location.city,
              state: location.state,
              type: location.organizationType as any,
              feedUrl: testUrl,
              websiteUrl: new URL(testUrl).origin,
              isActive: true,
              feedType: 'ical' as const
            },
            confidence: 0.95,
            lastChecked: new Date()
          };
        }

        // Check if it's a downloadable file (some APIs return binary data)
        if (response.headers['content-disposition']?.includes('attachment') || 
            response.headers['content-type']?.includes('application/octet-stream') ||
            testUrl.endsWith('.ics')) {
          console.log(`✅ Found downloadable calendar file from dynamic API: ${testUrl}`);

          return {
            source: {
              id: `discovered-${location.city.toLowerCase().replace(/\s+/g, '-')}-${location.organizationType}-download-ical-${Date.now()}`,
              name: `${this.generateSourceName(location)} (Download iCal)`,
              city: location.city,
              state: location.state,
              type: location.organizationType as any,
              feedUrl: testUrl,
              websiteUrl: new URL(testUrl).origin,
              isActive: true,
              feedType: 'ical' as const
            },
            confidence: 0.9,
            lastChecked: new Date()
          };
        }

        console.log(`⚠️ Dynamic API returned content but not valid calendar format: ${testUrl}`);
        console.log(`Content preview: ${content.substring(0, 200)}`);
      } else {
        console.log(`⚠️ Dynamic API returned status ${response.status}: ${testUrl}`);
      }

      return null;
    } catch (error) {
      console.log(`❌ Error testing dynamic calendar API ${testUrl}:`, (error as Error).message);
      return null;
    }
  }

  private async validateAndCreateFeed(feedUrl: string, location: LocationInfo & { organizationType: 'city' | 'school' | 'chamber' | 'library' | 'parks' }): Promise<DiscoveredFeed | null> {
    try {
      const response = await axios.get(feedUrl, {

        headers: { 
          'User-Agent': 'CityWide Events Calendar Bot 1.0',
          'Accept': 'text/calendar, application/calendar, application/rss+xml, application/xml, text/xml, */*'
        },
        maxRedirects: 3
      });

      // Check if this is actual feed content
      const isValidFeed = response.data.includes('BEGIN:VCALENDAR') || 
                         response.data.includes('<rss') || 
                         response.data.includes('<feed') ||
                         response.headers['content-type']?.includes('text/calendar') ||
                         response.headers['content-type']?.includes('xml');

      if (!isValidFeed) {
        return null;
      }

      // Determine feed type
      let feedType: 'rss' | 'ical' | 'html' = 'html';
      if (response.data.includes('BEGIN:VCALENDAR') || response.headers['content-type']?.includes('text/calendar')) {
        feedType = 'ical';
      } else if (response.data.includes('<rss') || response.data.includes('<feed') || response.headers['content-type']?.includes('xml')) {
        feedType = 'rss';
      }

      return {
        source: {
          id: `discovered-${location.city.toLowerCase().replace(/\s+/g, '-')}-${location.organizationType}-${feedType}-${Date.now()}`,
          name: `${this.generateSourceName(location)} (${feedType.toUpperCase()})`,
          city: location.city,
          state: location.state,
          type: location.organizationType as any,
          feedUrl: feedUrl,
          websiteUrl: new URL(feedUrl).origin,
          isActive: true,
          feedType: feedType
        },
        confidence: 0.95, // High confidence since we validated the content
        lastChecked: new Date()
      };
    } catch (error) {
      return null;
    }
  }

  private async findSubscriptionFeedsOnCalendarPage(calendarPageUrl: string, location: LocationInfo & { organizationType: 'city' | 'school' | 'chamber' | 'library' | 'parks' }): Promise<DiscoveredFeed[]> {
    console.log(`🔍 Analyzing calendar page for subscription buttons: ${calendarPageUrl}`);

    try {
      // First verify the website exists
      const calendarDomain = new URL(calendarPageUrl).origin;
      try {
        const domainCheck = await axios.get(calendarDomain, {

          headers: { 'User-Agent': 'CityWide Events Calendar Bot 1.0' },
          validateStatus: (status) => status < 500
        });

        if (domainCheck.status >= 400) {
          console.log(`❌ Domain ${calendarDomain} not accessible - skipping calendar page analysis`);
          return [];
        }
      } catch (error) {
        console.log(`❌ Domain ${calendarDomain} not accessible - skipping calendar page analysis`);
        return [];
      }

      const response = await axios.get(calendarPageUrl, {

        headers: { 'User-Agent': 'CityWide Events Calendar Bot 1.0' }
      });

      const html = response.data;
      const baseUrl = new URL(calendarPageUrl);

      // Look specifically for calendar and events feeds, not just "All" buttons
      const calendarFeedPatterns = [
        // Look for calendar-specific feed links
        /<a[^>]+href=["']([^"']*\/rss\.aspx[^"']*calendar[^"']*)["'][^>]*>[^<]*(?:calendar|subscribe|rss)[^<]*<\/a>/gi,
        /<a[^>]+href=["']([^"']*\/iCalendarFeed\.aspx[^"']*calendar[^"']*)["'][^>]*>[^<]*(?:calendar|subscribe|ical)[^<]*<\/a>/gi,
        // Look for events-specific feed links
        /<a[^>]+href=["']([^"']*\/rss\.aspx[^"']*events[^"']*)["'][^>]*>[^<]*(?:events|subscribe|rss)[^<]*<\/a>/gi,
        /<a[^>]+href=["']([^"']*\/iCalendarFeed\.aspx[^"']*events[^"']*)["'][^>]*>[^<]*(?:events|subscribe|ical)[^<]*<\/a>/gi,
        // Look for "All Calendar" or "All Events" specifically
        /<a[^>]+href=["']([^"']*(?:RSS|iCal)[^"']*(?:All.*calendar|calendar.*All|All.*events|events.*All)[^"']*)["'][^>]*>[^<]*<\/a>/gi,
        // Look for main calendar feeds with CID parameters
        /<a[^>]+href=["']([^"']*?(?:RSS|iCalendar)Feed\.aspx\?[^"']*?CID=[^"']*?)["'][^>]*>[^<]*(?:main|primary|city|government|official|master).*(?:calendar|events)[^<]*<\/a>/gi,
        // Look for department calendar feeds
        /<a[^>]+href=["']([^"']*?(?:RSS|iCalendar)Feed\.aspx\?[^"']*?)["'][^>]*>[^<]*(?:department|council|planning|public works|fire|police|library|parks).*(?:calendar|events)[^<]*<\/a>/gi,
        // Look for comprehensive calendar feeds with broader text patterns
        /<a[^>]+href=["']([^"']*?(?:RSS|iCalendar)Feed\.aspx\?[^"']*?)["'][^>]*>[^<]*(?:view all|complete|full|comprehensive|master|entire).*(?:calendar|events)[^<]*<\/a>/gi,
        // Look for download/export calendar links
        /<a[^>]+href=["']([^"']*?(?:RSS|iCalendar)Feed\.aspx[^"']*?)["'][^>]*>[^<]*(?:download|export|subscribe to).*(?:calendar|events)[^<]*<\/a>/gi
      ];

      const feedUrls: string[] = [];

      for (const pattern of calendarFeedPatterns) {
        const matches = html.match(pattern) || [];
        for (const match of matches) {
          const urlMatch = match.match(/href=["']([^"']*)["']/i);
          if (urlMatch) {
            let subscriptionUrl = urlMatch[1];

            // Convert to absolute URL
            if (!subscriptionUrl.startsWith('http')) {
              if (subscriptionUrl.startsWith('/')) {
                subscriptionUrl = `${baseUrl.protocol}//${baseUrl.host}${subscriptionUrl}`;
              } else {
                subscriptionUrl = `${baseUrl.protocol}//${baseUrl.host}/${subscriptionUrl}`;
              }
            }

            console.log(`📋 Found subscription URL: ${subscriptionUrl}`);
            feedUrls.push(subscriptionUrl);
          }
        }
      }

      console.log(`📋 Found ${feedUrls.length} subscription URLs on calendar page`);

      // Now follow each subscription URL to find "All" or "All Events" buttons
      const workingFeeds: DiscoveredFeed[] = [];

      for (const subscriptionUrl of Array.from(feedUrls)) {
        console.log(`🔎 Checking subscription page: ${subscriptionUrl}`);

        // Check if the subscription URL itself is a downloadable feed (like Thrillshare CMS)
        if (this.isDownloadableFeedUrl(subscriptionUrl)) {
          console.log(`🎯 Subscription URL is itself a downloadable feed: ${subscriptionUrl}`);
          const directFeed = await this.validateAndCreateFeed(subscriptionUrl, location);
          if (directFeed) {
            console.log(`✅ Direct subscription feed validated: ${subscriptionUrl}`);
            workingFeeds.push(directFeed);
            continue; // Skip further analysis for this URL
          }
        }

        try {
          const allEventsFeeds = await this.findAllEventsButtonsOnSubscriptionPage(subscriptionUrl, location);
          workingFeeds.push(...allEventsFeeds);

          if (workingFeeds.length >= 2) break; // Limit to prevent too many requests
        } catch (error) {
          console.log(`⚠️ Failed to analyze subscription page ${subscriptionUrl}:`, (error as Error).message);
        }
      }

      return workingFeeds;
    } catch (error) {
      console.log(`❌ Error analyzing calendar page ${calendarPageUrl}:`, (error as Error).message);
      return [];
    }
  }

  /**
   * Check if a URL points to a downloadable feed
   */
  private isDownloadableFeedUrl(url: string): boolean {
    if (!url) return false;

    // Decode HTML entities first
    const decodedUrl = url.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
    const lowerUrl = decodedUrl.toLowerCase();

    console.log(`🔍 Checking if downloadable feed: ${decodedUrl}`);

    // Direct feed file extensions
    if (lowerUrl.endsWith('.ics') || lowerUrl.endsWith('.rss') || lowerUrl.endsWith('.xml')) {
      console.log(`✅ Direct feed file extension detected: ${decodedUrl}`);
      return true;
    }

    // Feed generation endpoints (including Thrillshare CMS and similar)
    if (lowerUrl.includes('generate_ical') || lowerUrl.includes('generate_calendar') || lowerUrl.includes('export_ical')) {
      console.log(`✅ Feed generation endpoint detected: ${decodedUrl}`);
      return true;
    }

    // CMS API endpoints that generate calendar data
    if (lowerUrl.includes('/api/') && lowerUrl.includes('/cms/') && 
        (lowerUrl.includes('events') || lowerUrl.includes('calendar')) &&
        (lowerUrl.includes('generate_ical') || lowerUrl.includes('ical') || lowerUrl.includes('export'))) {
      console.log(`✅ CMS API calendar endpoint detected: ${decodedUrl}`);
      return true;
    }

    // Thrillshare-specific patterns
    if (lowerUrl.includes('thrillshare') && 
        (lowerUrl.includes('generate_ical') || lowerUrl.includes('events') || lowerUrl.includes('calendar'))) {
      console.log(`✅ Thrillshare CMS endpoint detected: ${decodedUrl}`);
      return true;
    }

    // Feed endpoints with parameters that return downloadable content
    if (lowerUrl.includes('rssfeed.aspx') || lowerUrl.includes('icalendarfeed.aspx') || lowerUrl.includes('feed.aspx')) {
      console.log(`✅ ASP.NET feed endpoint detected: ${decodedUrl}`);
      return true;
    }

    // Download/export endpoints with calendar keywords
    if ((lowerUrl.includes('download') || lowerUrl.includes('export')) && 
        (lowerUrl.includes('calendar') || lowerUrl.includes('events') || lowerUrl.includes('ical') || lowerUrl.includes('rss'))) {
      console.log(`✅ Download/export calendar endpoint detected: ${decodedUrl}`);
      return true;
    }

    // API endpoints that return calendar data
    if (lowerUrl.includes('/api/') && (lowerUrl.includes('calendar') || lowerUrl.includes('events') || lowerUrl.includes('ical') || lowerUrl.includes('rss'))) {
      console.log(`✅ API calendar endpoint detected: ${decodedUrl}`);
      return true;
    }

    // Feed URLs with specific parameters indicating downloadable content
    if ((lowerUrl.includes('modid=') || lowerUrl.includes('cid=')) && (lowerUrl.includes('calendar') || lowerUrl.includes('rss') || lowerUrl.includes('ical'))) {
      console.log(`✅ Parameterized feed endpoint detected: ${decodedUrl}`);
      return true;
    }

    console.log(`❌ Not recognized as downloadable feed: ${decodedUrl}`);
    return false;
  }

  private async findAllEventsButtonsOnSubscriptionPage(subscriptionUrl: string, location: LocationInfo & { organizationType: 'city' | 'school' | 'chamber' | 'library' | 'parks' }): Promise<DiscoveredFeed[]> {
    try {
      const response = await axios.get(subscriptionUrl, {

        headers: { 'User-Agent': 'CityWide Events Calendar Bot 1.0' }
      });

      const html = response.data;
      const baseUrl = new URL(subscriptionUrl);

      // Look specifically for calendar and events feeds, not just "All" buttons
      const calendarFeedPatterns = [
        // Look for calendar-specific feed links
        /<a[^>]+href=["']([^"']*\/rss\.aspx[^"']*calendar[^"']*)["'][^>]*>[^<]*(?:calendar|subscribe|rss)[^<]*<\/a>/gi,
        /<a[^>]+href=["']([^"']*\/iCalendarFeed\.aspx[^"']*calendar[^"']*)["'][^>]*>[^<]*(?:calendar|subscribe|ical)[^<]*<\/a>/gi,
        // Look for events-specific feed links
        /<a[^>]+href=["']([^"']*\/rss\.aspx[^"']*events[^"']*)["'][^>]*>[^<]*(?:events|subscribe|rss)[^<]*<\/a>/gi,
        /<a[^>]+href=["']([^"']*\/iCalendarFeed\.aspx[^"']*events[^"']*)["'][^>]*>[^<]*(?:events|subscribe|ical)[^<]*<\/a>/gi,
        // Look for "All Calendar" or "All Events" specifically
        /<a[^>]+href=["']([^"']*(?:RSS|iCal)[^"']*(?:All.*calendar|calendar.*All|All.*events|events.*All)[^"']*)["'][^>]*>[^<]*<\/a>/gi,
        // Look for main calendar feeds with CID parameters
        /<a[^>]+href=["']([^"']*?(?:RSS|iCalendar)Feed\.aspx\?[^"']*?CID=[^"']*?)["'][^>]*>[^<]*(?:main|primary|city|government|official|master).*(?:calendar|events)[^<]*<\/a>/gi,
        // Look for department calendar feeds
        /<a[^>]+href=["']([^"']*?(?:RSS|iCalendar)Feed\.aspx\?[^"']*?)["'][^>]*>[^<]*(?:department|council|planning|public works|fire|police|library|parks).*(?:calendar|events)[^<]*<\/a>/gi,
        // Look for comprehensive calendar feeds with broader text patterns
        /<a[^>]+href=["']([^"']*?(?:RSS|iCalendar)Feed\.aspx\?[^"']*?)["'][^>]*>[^<]*(?:view all|complete|full|comprehensive|master|entire).*(?:calendar|events)[^<]*<\/a>/gi,
        // Look for download/export calendar links
        /<a[^>]+href=["']([^"']*?(?:RSS|iCalendar)Feed\.aspx[^"']*?)["'][^>]*>[^<]*(?:download|export|subscribe to).*(?:calendar|events)[^<]*<\/a>/gi
      ];

      const feedUrls: string[] = [];

      for (const pattern of calendarFeedPatterns) {
        const matches = html.match(pattern) || [];
        for (const match of matches) {
          const urlMatch = match.match(/href=["']([^"']*)["']/i);
          if (urlMatch) {
            let subscriptionUrl = urlMatch[1];

            // Convert to absolute URL
            if (!subscriptionUrl.startsWith('http')) {
              if (subscriptionUrl.startsWith('/')) {
                subscriptionUrl = `${baseUrl.protocol}//${baseUrl.host}${subscriptionUrl}`;
              } else {
                subscriptionUrl = `${baseUrl.protocol}//${baseUrl.host}/${subscriptionUrl}`;
              }
            }

            console.log(`📋 Found subscription URL: ${subscriptionUrl}`);
            feedUrls.push(subscriptionUrl);
          }
        }
      }

      console.log(`🎯 Found ${feedUrls.length} calendar-specific feed URLs: ${feedUrls.slice(0, 3).join(', ')}`);

      // Test each discovered feed URL to see if it returns actual feed content
      const workingFeeds: DiscoveredFeed[] = [];

      // Sort feeds to prioritize "All-calendar" feeds over category-specific ones
      const sortedFeedUrls = feedUrls.sort((a, b) => {
        const aHasAllCalendar = a.includes('All-calendar') || a.includes('all-calendar') || a.includes('CID=All');
        const bHasAllCalendar = b.includes('All-calendar') || b.includes('all-calendar') || b.includes('CID=All');

        if (aHasAllCalendar && !bHasAllCalendar) return -1;
        if (!aHasAllCalendar && bHasAllCalendar) return 1;
        return 0;
      });

      for (const feedUrl of sortedFeedUrls.slice(0, 5)) { // Increased limit for calendar-specific feeds
        const workingFeed = await this.validateAndCreateFeed(feedUrl, location);
        if (workingFeed) {
          console.log(`✅ Validated working feed: ${feedUrl}`);

          // Boost confidence for "All-calendar" feeds
          if (feedUrl.includes('All-calendar') || feedUrl.includes('all-calendar') || feedUrl.includes('CID=All')) {
            workingFeed.confidence = Math.min(workingFeed.confidence + 0.3, 1.0);
            console.log(`🎯 Boosted confidence for All-calendar feed: ${feedUrl} (confidence: ${workingFeed.confidence})`);
          }

          workingFeeds.push(workingFeed);
        } else {
          console.log(`❌ Invalid feed: ${feedUrl}`);
        }
      }

      return workingFeeds;
    } catch (error) {
      console.log(`❌ Error analyzing calendar page ${subscriptionUrl}:`, (error as Error).message);
      return [];
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

  private createCityInitials(city: string): string {
    return city
      .toLowerCase()
      .split(/\s+/)
      .map(word => word.charAt(0))
      .join('')
      .replace(/[^a-z0-9]/g, '');
  }

  private async getCityWebsiteFromDatabase(cityName: string, state: string): Promise<string | null> {
    try {
      // Import the city data loader and check the CSV database
      const { CityDataLoader } = await import('./city-data-loader');
      const cities = await CityDataLoader.loadCities();

      // Search through cities to find matching name and state
      for (const city of cities.values()) {
        if (city.municipality.toLowerCase() === cityName.toLowerCase() && 
            city.state.toLowerCase() === state.toLowerCase() && 
            city.websiteUrl) {
          console.log(`Found city website in database: ${city.municipality}, ${city.state} -> ${city.websiteUrl}`);
          return city.websiteUrl;
        }
      }

      return null;
    } catch (error) {
      console.log(`Error looking up city website in database for ${cityName}, ${state}:`, (error as Error).message);
      return null;
    }
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

  // Discover feeds for multiple regions
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

  // Discover feeds for cities by population
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