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
      // First check if domain exists with shorter timeout
      const baseUrl = `https://${domain}`;
      const response = await axios.get(baseUrl, {
        timeout: 3000, // Reduced from 5000ms
        headers: { 'User-Agent': 'CityWide Events Calendar Discovery Bot 1.0' },
        validateStatus: (status) => status < 500, // Accept 404s but not server errors
        maxRedirects: 3 // Limit redirects
      });

      // Check if website actually exists and is accessible
      if (response.status === 404 || response.status >= 400) {
        console.log(`Website ${domain} returned status ${response.status} - skipping feed discovery`);
        return feeds; // Domain doesn't exist or is not accessible
      }

      // Verify we got actual website content, not just a redirect or error page
      if (!response.data || typeof response.data !== 'string' || response.data.length < 100) {
        console.log(`Website ${domain} returned insufficient content - skipping feed discovery`);
        return feeds;
      }

      console.log(`✓ Confirmed website ${domain} exists and is accessible - proceeding with feed discovery`);

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

      // Enhanced button detection for RSS/iCal feeds - more dynamic approach
      const buttonSelectors = [
        'button:contains("Download")', 'a:contains("Download")',
        'button:contains("Export")', 'a:contains("Export")', 
        'button:contains("Subscribe")', 'a:contains("Subscribe")',
        'button:contains("iCalendar")', 'a:contains("iCalendar")',
        'button:contains("RSS")', 'a:contains("RSS")',
        'button:contains("Feed")', 'a:contains("Feed")',
        'button:contains("Calendar")', 'a:contains("Calendar")',
        'button[title*="Download"]', 'a[title*="Download"]',
        'button[title*="Subscribe"]', 'a[title*="Subscribe"]',
        'button[title*="RSS"]', 'a[title*="RSS"]',
        'button[title*="iCal"]', 'a[title*="iCal"]',
        'button[aria-label*="Subscribe"]', 'a[aria-label*="Subscribe"]',
        'input[type="button"][value*="Download"]',
        'input[type="submit"][value*="Subscribe"]'
      ];

      $(buttonSelectors.join(', ')).each((_, element) => {
        const $el = $(element);
        const tagName = (element as any).tagName?.toLowerCase() || 'unknown';
        
        // Extract potential URLs from various attributes and handlers
        const onclick = $el.attr('onclick') || '';
        const dataUrl = $el.attr('data-url') || $el.attr('data-href') || $el.attr('data-link');
        const formAction = $el.closest('form').attr('action');
        const href = $el.attr('href');
        
        // Enhanced onclick handler parsing
        if (onclick) {
          const urlPatterns = [
            // Standard URL patterns
            /['"]([^'"]*\.(?:ics|rss|xml)[^'"]*)['"]/, 
            /['"]([^'"]*(?:calendar|feed|events)[^'"]*)['"]/, 
            // Function calls that might contain URLs
            /window\.open\(['"]([^'"]*)['"]/, 
            /location\.(?:href|replace)\s*=\s*['"]([^'"]*)['"]/, 
            /downloadFile\(['"]([^'"]*)['"]/, 
            /exportCalendar\(['"]([^'"]*)['"]/, 
            /subscribe\w*\(['"]([^'"]*)['"]/, 
            /getDownloadURL\(['"]([^'"]*)['"]/, 
            /redirectTo\(['"]([^'"]*)['"]/, 
            /openLink\(['"]([^'"]*)['"]/, 
            // AJAX or fetch calls
            /(?:fetch|ajax)\(['"]([^'"]*(?:calendar|feed|download)[^'"]*)['"]/, 
            // Generic URL extraction with common feed keywords
            /['"]([^'"]*(?:download|export|subscribe|icalendar)[^'"]*)['"]/, 
            // ModID/CID patterns common in government CMS
            /['"]([^'"]*(?:ModID|CID|calendarId)[^'"]*)['"]/, 
            // Form submission patterns
            /submit\(\s*['"]([^'"]*)['"]/, 
          ];

          for (const pattern of urlPatterns) {
            const match = onclick.match(pattern);
            if (match && match[1]) {
              let potentialUrl = match[1];
              
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
              } else if (potentialUrl.includes('calendar') || potentialUrl.includes('feed') || potentialUrl.includes('event')) {
                // Treat as relative path for calendar-related URLs
                discoveredPaths.add(`/${potentialUrl}`);
              }
            }
          }
        }
        
        // Check data attributes
        if (dataUrl) {
          const path = dataUrl.startsWith('/') ? dataUrl : dataUrl.startsWith('http') ? new URL(dataUrl).pathname : `/${dataUrl}`;
          discoveredPaths.add(path);
        }
        
        // Check href attribute
        if (href && (href.includes('calendar') || href.includes('feed') || href.includes('download') || href.includes('.ics') || href.includes('.rss'))) {
          const path = href.startsWith('/') ? href : href.startsWith('http') ? new URL(href, baseUrl).pathname : `/${href}`;
          discoveredPaths.add(path);
        }
        
        // Check form actions for subscription forms
        if (formAction && (formAction.includes('calendar') || formAction.includes('subscribe') || formAction.includes('download'))) {
          const path = formAction.startsWith('/') ? formAction : `/${formAction}`;
          discoveredPaths.add(path);
        }

        // Look for nearby hidden inputs or links that might contain the actual URL
        const nearbyInputs = $el.closest('form, div, span').find('input[type="hidden"], input[name*="url"], input[name*="feed"]');
        nearbyInputs.each((_, input) => {
          const value = $(input).attr('value');
          if (value && (value.includes('calendar') || value.includes('feed') || value.includes('.ics') || value.includes('.rss'))) {
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
        'span[class*="rss"] a', 'div[class*="feed"] a', 'li[class*="subscribe"] a', 'a.ImageLink'
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
        
        // For images, check if they're inside clickable elements with data attributes
        if (tagName === 'img') {
          const clickableParent = $el.closest('[onclick], [data-url], [data-href], a');
          if (clickableParent.length > 0) {
            const parentOnclick = clickableParent.attr('onclick');
            const parentDataUrl = clickableParent.attr('data-url') || clickableParent.attr('data-href');
            
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
            /(['"])(\/[^'"]*(?:calendar|events)\/[^'"]*\.(?:ics|rss|xml))\1/g,
            /url\s*:\s*(['"])([^'"]*\.(?:ics|rss|xml)[^'"]*)\1/g,
            /href\s*:\s*(['"])([^'"]*\.(?:ics|rss|xml)[^'"]*)\1/g,
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

    } catch (error) {
      // Domain doesn't exist or is not accessible
      console.log(`Domain ${domain} not accessible: ${error}`);
    }

    return feeds;
  }

  private async validateFeedUrl(feedUrl: string, location: LocationInfo & { organizationType: 'city' | 'school' | 'chamber' | 'library' | 'parks' }): Promise<DiscoveredFeed | null> {
    try {
      // Skip API endpoints that are likely to be client-side only
      if (feedUrl.includes('/api/v') || feedUrl.includes('/cms/') || feedUrl.includes('section_ids=')) {
        console.log(`Skipping client-side API endpoint: ${feedUrl}`);
        return null;
      }

      // First verify the domain/website exists before checking feed URLs
      const feedDomain = new URL(feedUrl).origin;
      try {
        const domainCheck = await axios.get(feedDomain, {
          timeout: 2000,
          headers: { 'User-Agent': 'CityWide Events Calendar Discovery Bot 1.0' },
          validateStatus: (status) => status < 500
        });
        
        if (domainCheck.status >= 400) {
          console.log(`Domain ${feedDomain} not accessible (${domainCheck.status}) - skipping feed: ${feedUrl}`);
          return null;
        }
      } catch (error) {
        console.log(`Domain ${feedDomain} not accessible - skipping feed: ${feedUrl}`);
        return null;
      }

      // Skip URLs that are clearly not feed files (but allow common subscription pages)
      const isSubscriptionPage = feedUrl.includes('iCalendar.aspx') || 
                                 feedUrl.includes('rss.aspx') || 
                                 feedUrl.includes('calendar.aspx') ||
                                 feedUrl.includes('subscribe');
      
      if (!feedUrl.includes('.ics') && !feedUrl.includes('.rss') && !feedUrl.includes('.xml') && 
          !feedUrl.includes('calendar') && !feedUrl.includes('events') && !feedUrl.includes('feed') && 
          !isSubscriptionPage) {
        return null;
      }

      // Handle subscription pages by parsing them to find actual feed URLs
      if (isSubscriptionPage) {
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
        timeout: 4000,
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

      // Reject feeds that returned errors
      if (response.status >= 400) {
        console.log(`Feed validation failed for ${feedUrl}: HTTP ${response.status}`);
        return null;
      }

      // If this is supposed to be a calendar/RSS feed but has HTML content, likely not a real feed
      if ((feedUrl.includes('.ics') || feedUrl.includes('.rss')) && 
          contentType.includes('text/html') && 
          !actualContent.includes('BEGIN:VCALENDAR') && 
          !actualContent.includes('<rss')) {
        console.log(`Feed validation failed for ${feedUrl}: Expected feed format but got HTML`);
        return null;
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
              timeout: 3000,
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
              timeout: 3000,
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
          timeout: 2000,
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
        timeout: 5000,
        headers: { 'User-Agent': 'CityWide Events Calendar Bot 1.0' }
      });
      
      const feedUrls: string[] = [];
      const html = response.data;
      const baseUrl = new URL(subscriptionUrl);
      
      // Look for any RSS/iCalendar feed URLs with parameters (flexible pattern)
      const patterns = [
        // RSS Feed patterns
        /RSSFeed\.aspx\?[^"'>\s]+/g,
        /rssfeed\.aspx\?[^"'>\s]+/gi,
        /rss\.aspx\?[^"'>\s]+/gi,
        // iCalendar patterns  
        /iCalendarFeed\.aspx\?[^"'>\s]+/g,
        /icalendarfeed\.aspx\?[^"'>\s]+/gi,
        /iCalendar\.aspx\?[^"'>\s]+/gi,
        /icalendar\.aspx\?[^"'>\s]+/gi,
        // Generic calendar feed patterns
        /calendar\.aspx\?[^"'>\s]*(?:format|export|rss|ical|xml)[^"'>\s]*/gi,
        // Direct file patterns in href attributes
        /href=["']([^"']*(?:ModID|CID)[^"']*\.(?:xml|ics))[^"']*/gi,
        /href=["']([^"']*(?:\.ics|\.xml|calendar\.xml|events\.xml|rss\.xml)[^"']*)["']/gi
      ];
      
      for (const pattern of patterns) {
        const matches = html.match(pattern) || [];
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
          
          // Convert to absolute URL
          let fullUrl: string;
          if (feedPath.startsWith('http')) {
            fullUrl = feedPath;
          } else if (feedPath.startsWith('/')) {
            fullUrl = `${baseUrl.protocol}//${baseUrl.host}${feedPath}`;
          } else {
            fullUrl = `${baseUrl.protocol}//${baseUrl.host}/${feedPath}`;
          }
          
          feedUrls.push(fullUrl);
        }
      }
      
      // Also look for JavaScript variables that might contain feed URLs
      const jsPatterns = [
        /feedUrl\s*[:=]\s*["']([^"']+)["']/gi,
        /rssUrl\s*[:=]\s*["']([^"']+)["']/gi,
        /calendarUrl\s*[:=]\s*["']([^"']+)["']/gi
      ];
      
      for (const jsPattern of jsPatterns) {
        const matches = html.match(jsPattern) || [];
        for (const match of matches) {
          const urlMatch = match.match(/["']([^"']+)["']/);
          if (urlMatch) {
            const jsUrl = urlMatch[1];
            if (jsUrl.includes('aspx') && (jsUrl.includes('ModID') || jsUrl.includes('CID'))) {
              const fullUrl = jsUrl.startsWith('http') ? jsUrl : `${baseUrl.protocol}//${baseUrl.host}${jsUrl.startsWith('/') ? '' : '/'}${jsUrl}`;
              feedUrls.push(fullUrl);
            }
          }
        }
      }
      
      console.log(`Found ${feedUrls.length} potential feed URLs in subscription page:`, feedUrls.slice(0, 3));
      return Array.from(new Set(feedUrls)); // Remove duplicates
    } catch (error) {
      console.log(`Error parsing subscription page ${subscriptionUrl}:`, error);
      return [];
    }
  }

  private async validateAndCreateFeed(feedUrl: string, location: LocationInfo & { organizationType: 'city' | 'school' | 'chamber' | 'library' | 'parks' }): Promise<DiscoveredFeed | null> {
    try {
      const response = await axios.get(feedUrl, {
        timeout: 4000,
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
          timeout: 2000,
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
        timeout: 5000,
        headers: { 'User-Agent': 'CityWide Events Calendar Bot 1.0' }
      });
      
      const html = response.data;
      const baseUrl = new URL(calendarPageUrl);
      
      // Enhanced patterns to find subscription URLs with better extraction
      const subscriptionPatterns = [
        // Direct feed file patterns
        /href=["']([^"']*\.ics[^"']*)["']/gi,
        /href=["']([^"']*\.rss[^"']*)["']/gi,
        /href=["']([^"']*\.xml[^"']*)["']/gi,
        // RSS subscription patterns
        /href=["']([^"']*\/rss\.aspx[^"']*)["']/gi,
        /href=["']([^"']*\/RSSFeed\.aspx[^"']*)["']/gi,
        /href=["']([^"']*rss[^"']*)["']/gi,
        // iCalendar subscription patterns  
        /href=["']([^"']*\/iCalendar\.aspx[^"']*)["']/gi,
        /href=["']([^"']*\/iCalendarFeed\.aspx[^"']*)["']/gi,
        /href=["']([^"']*ical[^"']*)["']/gi,
        // Generic calendar feed patterns
        /href=["']([^"']*\/generate_ical[^"']*)["']/gi,
        /href=["']([^"']*\/calendar[^"']*feed[^"']*)["']/gi,
        /href=["']([^"']*\/events[^"']*feed[^"']*)["']/gi,
        /href=["']([^"']*feed[^"']*calendar[^"']*)["']/gi,
        /href=["']([^"']*feed[^"']*events[^"']*)["']/gi,
        // Subscription page patterns
        /href=["']([^"']*subscribe[^"']*)["']/gi,
        /href=["']([^"']*download[^"']*calendar[^"']*)["']/gi,
        /href=["']([^"']*export[^"']*calendar[^"']*)["']/gi,
        // Button onclick patterns for dynamic URLs
        /onclick=["'][^"']*(?:window\.open|location\.href|downloadFile)\(['"]([^'"]*(?:rss|ical|calendar|feed)[^'"]*)['"][^"']*["']/gi,
        /onclick=["'][^"']*['"]([^'"]*(?:RSSFeed|iCalendarFeed|calendar)\.aspx[^'"]*)['"][^"']*["']/gi
      ];
      
      const subscriptionUrls = new Set<string>();
      
      // Extract subscription URLs from HTML
      for (const pattern of subscriptionPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
          let subscriptionUrl = match[1];
          
          // Convert to absolute URL
          if (!subscriptionUrl.startsWith('http')) {
            if (subscriptionUrl.startsWith('/')) {
              subscriptionUrl = `${baseUrl.protocol}//${baseUrl.host}${subscriptionUrl}`;
            } else {
              subscriptionUrl = `${baseUrl.protocol}//${baseUrl.host}/${subscriptionUrl}`;
            }
          }
          
          subscriptionUrls.add(subscriptionUrl);
        }
      }

      // Also look for JavaScript variables that might contain feed URLs
      const jsVariablePatterns = [
        /(?:feedUrl|rssUrl|calendarUrl|downloadUrl|exportUrl)\s*[:=]\s*['"]([^'"]+)['"]|/gi,
        /var\s+(?:feedUrl|rssUrl|calendarUrl)\s*=\s*['"]([^'"]+)['"]|/gi
      ];

      for (const pattern of jsVariablePatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
          if (match[1]) {
            let jsUrl = match[1];
            if (jsUrl.includes('rss') || jsUrl.includes('ical') || jsUrl.includes('calendar') || jsUrl.includes('feed')) {
              if (!jsUrl.startsWith('http')) {
                if (jsUrl.startsWith('/')) {
                  jsUrl = `${baseUrl.protocol}//${baseUrl.host}${jsUrl}`;
                } else {
                  jsUrl = `${baseUrl.protocol}//${baseUrl.host}/${jsUrl}`;
                }
              }
              subscriptionUrls.add(jsUrl);
            }
          }
        }
      }
      
      console.log(`📋 Found ${subscriptionUrls.size} subscription URLs on calendar page`);
      if (subscriptionUrls.size > 0) {
        console.log(`🔗 Subscription URLs found: ${Array.from(subscriptionUrls).slice(0, 3).join(', ')}`);
      }
      
      // Process subscription URLs - some might be direct feeds, others subscription pages
      const workingFeeds: DiscoveredFeed[] = [];
      
      for (const subscriptionUrl of Array.from(subscriptionUrls)) {
        console.log(`🔎 Checking subscription URL: ${subscriptionUrl}`);
        
        try {
          // First check if this is already a direct feed
          if (subscriptionUrl.includes('.ics') || subscriptionUrl.includes('.rss') || subscriptionUrl.includes('.xml') ||
              subscriptionUrl.includes('RSSFeed.aspx') || subscriptionUrl.includes('iCalendarFeed.aspx')) {
            console.log(`🎯 Direct feed URL detected: ${subscriptionUrl}`);
            const directFeed = await this.validateAndCreateFeed(subscriptionUrl, location);
            if (directFeed) {
              console.log(`✅ Validated direct feed: ${subscriptionUrl}`);
              workingFeeds.push(directFeed);
              continue;
            }
          }

          // If not a direct feed, treat as subscription page
          const pageFeeds = await this.findAllEventsButtonsOnSubscriptionPage(subscriptionUrl, location);
          workingFeeds.push(...pageFeeds);
          
          if (workingFeeds.length >= 3) break; // Limit to prevent too many requests
        } catch (error) {
          console.log(`⚠️ Failed to analyze subscription URL ${subscriptionUrl}:`, (error as Error).message);
        }
      }
      
      return workingFeeds;
    } catch (error) {
      console.log(`❌ Error analyzing calendar page ${calendarPageUrl}:`, (error as Error).message);
      return [];
    }
  }

  private async findAllEventsButtonsOnSubscriptionPage(subscriptionUrl: string, location: LocationInfo & { organizationType: 'city' | 'school' | 'chamber' | 'library' | 'parks' }): Promise<DiscoveredFeed[]> {
    try {
      const response = await axios.get(subscriptionUrl, {
        timeout: 5000,
        headers: { 'User-Agent': 'CityWide Events Calendar Bot 1.0' }
      });
      
      const html = response.data;
      const baseUrl = new URL(subscriptionUrl);
      
      // Enhanced patterns to extract ANY feed URLs from subscription pages
      const feedUrlPatterns = [
        // Direct feed file patterns in href attributes
        /href=["']([^"']*\.ics[^"']*)["']/gi,
        /href=["']([^"']*\.rss[^"']*)["']/gi,
        /href=["']([^"']*\.xml[^"']*)["']/gi,
        
        // RSS feed patterns
        /href=["']([^"']*RSSFeed\.aspx[^"']*)["']/gi,
        /href=["']([^"']*rss\.aspx[^"']*)["']/gi,
        /href=["']([^"']*\/rss[^"']*)["']/gi,
        
        // iCalendar feed patterns
        /href=["']([^"']*iCalendarFeed\.aspx[^"']*)["']/gi,
        /href=["']([^"']*iCalendar\.aspx[^"']*)["']/gi,
        /href=["']([^"']*\/ical[^"']*)["']/gi,
        
        // Generic feed patterns with parameters
        /href=["']([^"']*Feed\.aspx\?[^"']*)["']/gi,
        /href=["']([^"']*calendar[^"']*feed[^"']*)["']/gi,
        /href=["']([^"']*events[^"']*feed[^"']*)["']/gi,
        /href=["']([^"']*feed[^"']*calendar[^"']*)["']/gi,
        /href=["']([^"']*feed[^"']*events[^"']*)["']/gi,
        
        // Feed URLs in onclick handlers
        /onclick=["'][^"']*(?:window\.open|location\.href|downloadFile)\(['"]([^'"]*(?:Feed\.aspx|\.ics|\.rss|\.xml)[^'"]*)['"][^"']*["']/gi,
        /onclick=["'][^"']*['"]([^'"]*(?:RSSFeed|iCalendarFeed|feed)\.aspx[^'"]*)['"][^"']*["']/gi,
        
        // Feed URLs in data attributes
        /data-(?:url|href|feed)=["']([^"']*(?:Feed\.aspx|\.ics|\.rss|\.xml|feed)[^"']*)["']/gi,
        
        // JavaScript variable assignments
        /(?:var\s+)?(?:feedUrl|rssUrl|calendarUrl|downloadUrl)\s*[:=]\s*['"]([^'"]*(?:Feed\.aspx|\.ics|\.rss|\.xml|feed)[^'"]*)['"];?/gi,
        
        // Form action attributes for feed generation
        /action=["']([^"']*(?:Feed\.aspx|generate|export|download)[^"']*)["']/gi
      ];
      
      const feedUrls = new Set<string>();
      
      // Extract feed URLs using all patterns
      for (const pattern of feedUrlPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
          if (match[1]) {
            let feedUrl = match[1];
            
            // Convert to absolute URL
            if (!feedUrl.startsWith('http')) {
              if (feedUrl.startsWith('/')) {
                feedUrl = `${baseUrl.protocol}//${baseUrl.host}${feedUrl}`;
              } else {
                feedUrl = `${baseUrl.protocol}//${baseUrl.host}/${feedUrl}`;
              }
            }
            
            // Only add URLs that look like feeds
            if (feedUrl.includes('Feed.aspx') || feedUrl.includes('.ics') || feedUrl.includes('.rss') || 
                feedUrl.includes('.xml') || feedUrl.includes('feed') || feedUrl.includes('calendar') ||
                feedUrl.includes('events') || feedUrl.includes('generate') || feedUrl.includes('export')) {
              feedUrls.add(feedUrl);
            }
          }
        }
      }

      // Also look for forms with hidden inputs that might contain feed parameters
      const formMatches = html.match(/<form[^>]*>[\s\S]*?<\/form>/gi) || [];
      for (const formMatch of formMatches) {
        if (formMatch.includes('calendar') || formMatch.includes('feed') || formMatch.includes('rss') || formMatch.includes('ical')) {
          // Extract action URL
          const actionMatch = formMatch.match(/action=["']([^"']*)["']/i);
          if (actionMatch) {
            let actionUrl = actionMatch[1];
            if (!actionUrl.startsWith('http')) {
              if (actionUrl.startsWith('/')) {
                actionUrl = `${baseUrl.protocol}//${baseUrl.host}${actionUrl}`;
              } else {
                actionUrl = `${baseUrl.protocol}//${baseUrl.host}/${actionUrl}`;
              }
            }
            
            // Look for hidden inputs with feed parameters
            const hiddenInputs = formMatch.match(/<input[^>]+type=["']hidden["'][^>]*>/gi) || [];
            const parameters: string[] = [];
            
            for (const input of hiddenInputs) {
              const nameMatch = input.match(/name=["']([^"']*)["']/i);
              const valueMatch = input.match(/value=["']([^"']*)["']/i);
              if (nameMatch && valueMatch) {
                parameters.push(`${nameMatch[1]}=${encodeURIComponent(valueMatch[1])}`);
              }
            }
            
            if (parameters.length > 0) {
              const fullUrl = `${actionUrl}?${parameters.join('&')}`;
              feedUrls.add(fullUrl);
            }
          }
        }
      }
      
      console.log(`🎯 Found ${feedUrls.size} potential feed URLs on subscription page`);
      if (feedUrls.size > 0) {
        console.log(`🔗 Feed URLs: ${Array.from(feedUrls).slice(0, 3).join(', ')}`);
      }
      
      // Test each discovered feed URL
      const workingFeeds: DiscoveredFeed[] = [];
      
      // Sort feeds to prioritize comprehensive feeds
      const sortedFeedUrls = Array.from(feedUrls).sort((a, b) => {
        const aScore = this.getFeedPriorityScore(a);
        const bScore = this.getFeedPriorityScore(b);
        return bScore - aScore;
      });
      
      for (const feedUrl of sortedFeedUrls.slice(0, 8)) { // Test more potential feeds
        console.log(`🧪 Testing feed URL: ${feedUrl}`);
        const workingFeed = await this.validateAndCreateFeed(feedUrl, location);
        if (workingFeed) {
          console.log(`✅ Validated working feed: ${feedUrl}`);
          
          // Boost confidence for comprehensive feeds
          const priorityScore = this.getFeedPriorityScore(feedUrl);
          if (priorityScore > 5) {
            workingFeed.confidence = Math.min(workingFeed.confidence + 0.2, 1.0);
            console.log(`🎯 Boosted confidence for comprehensive feed: ${feedUrl} (confidence: ${workingFeed.confidence})`);
          }
          
          workingFeeds.push(workingFeed);
        } else {
          console.log(`❌ Invalid feed: ${feedUrl}`);
        }
      }
      
      return workingFeeds;
    } catch (error) {
      console.log(`Error analyzing subscription page ${subscriptionUrl}:`, (error as Error).message);
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

  private getFeedPriorityScore(feedUrl: string): number {
    let score = 0;
    
    // Boost for comprehensive feed indicators
    if (feedUrl.includes('All-calendar') || feedUrl.includes('all-calendar')) score += 10;
    if (feedUrl.includes('CID=All') || feedUrl.includes('cid=all')) score += 10;
    if (feedUrl.includes('all-events') || feedUrl.includes('All-events')) score += 8;
    if (feedUrl.includes('main-calendar') || feedUrl.includes('master-calendar')) score += 6;
    
    // Boost for feed type
    if (feedUrl.includes('.ics')) score += 5;
    if (feedUrl.includes('iCalendarFeed.aspx') || feedUrl.includes('iCalendar.aspx')) score += 5;
    if (feedUrl.includes('.rss') || feedUrl.includes('RSSFeed.aspx')) score += 4;
    if (feedUrl.includes('.xml')) score += 3;
    
    // Boost for calendar-specific content
    if (feedUrl.includes('calendar')) score += 2;
    if (feedUrl.includes('events')) score += 2;
    
    // Boost for having parameters (indicates dynamic/configurable feed)
    if (feedUrl.includes('?') && feedUrl.includes('=')) score += 3;
    
    return score;
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