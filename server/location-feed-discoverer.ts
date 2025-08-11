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
    
    // Skip Hemet Unified School District from auto-discovery
    if (citySlug === 'hemet' && stateSlug === 'ca') {
      console.log(`Skipping Hemet Unified School District from auto-discovery as requested`);
      return feeds;
    }
    
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

      // Look for buttons with common download/export text
      $('button:contains("Download"), a:contains("Download"), button:contains("Export"), a:contains("Export"), button:contains("Subscribe"), a:contains("Subscribe"), button:contains("iCalender"), a:contains("iCalendar")').each((_, element) => {
        const $el = $(element);
        // Check for onclick handlers or data attributes that might reveal feed URLs
        const onclick = $el.attr('onclick');
        const dataUrl = $el.attr('data-url') || $el.attr('data-href');
        
        if (onclick && (onclick.includes('.ics') || onclick.includes('.rss') || onclick.includes('calendar') || onclick.includes('feed'))) {
          // Extract URL from onclick handler
          const urlMatch = onclick.match(/['"]([^'"]*\.(?:ics|rss|xml)|[^'"]*(?:calendar|feed)[^'"]*)['"]/) || 
                           onclick.match(/window\.open\(['"]([^'"]*)['"]/) || 
                           onclick.match(/location\.href\s*=\s*['"]([^'"]*)['"]/) ||
                           onclick.match(/downloadFile\(['"]([^'"]*)['"]/) ||
                           onclick.match(/export\w*\(['"]([^'"]*)['"]/) ||
                           onclick.match(/subscribe\w*\(['"]([^'"]*)['"]/) ||
                           onclick.match(/['"]([^'"]*(?:api|download|export)[^'"]*)['"]/)
                           
          if (urlMatch && urlMatch[1]) {
            const path = urlMatch[1].startsWith('/') ? urlMatch[1] : new URL(urlMatch[1], baseUrl).pathname;
            discoveredPaths.add(path);
          }
        }
        
        if (dataUrl) {
          const path = dataUrl.startsWith('/') ? dataUrl : new URL(dataUrl, baseUrl).pathname;
          discoveredPaths.add(path);
        }
      });

      // Look for RSS feed icons and iCalendar subscribe links (like in the screenshots)
      $('a[href*="ical"], a[title*="iCalendar"], a[title*="Subscribe"], img[src*="rss"], img[alt*="RSS"], a[href*="rss"], a[href*=".xml"]').each((_, element) => {
        const $el = $(element);
        const href = $el.attr('href');
        const parentHref = $el.parent('a').attr('href');
        
        // Check the link itself
        if (href && (href.includes('.ics') || href.includes('.rss') || href.includes('.xml') || href.includes('feed') || href.includes('ical'))) {
          const path = href.startsWith('/') ? href : new URL(href, baseUrl).pathname;
          discoveredPaths.add(path);
        }
        
        // Check parent link (for images inside links)
        if (parentHref && (parentHref.includes('.ics') || parentHref.includes('.rss') || parentHref.includes('.xml') || parentHref.includes('feed') || parentHref.includes('ical'))) {
          const path = parentHref.startsWith('/') ? parentHref : new URL(parentHref, baseUrl).pathname;
          discoveredPaths.add(path);
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

      // Look for JavaScript-generated links in script tags (only for actual feed files)
      $('script').each((_, element) => {
        const scriptContent = $(element).html() || '';
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
      return [...new Set(feedUrls)]; // Remove duplicates
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
      
      // Look for subscription buttons/links on the calendar page
      const subscriptionPatterns = [
        // Look for RSS subscription buttons
        /href=["']([^"']*\/rss\.aspx[^"']*)["']/gi,
        /href=["']([^"']*\/RSSFeed\.aspx[^"']*)["']/gi,
        // Look for iCalendar subscription buttons
        /href=["']([^"']*\/iCalendar\.aspx[^"']*)["']/gi,
        /href=["']([^"']*\/iCalendarFeed\.aspx[^"']*)["']/gi,
        // Look for generic subscription/download buttons
        /href=["']([^"']*subscribe[^"']*)["']/gi,
        /href=["']([^"']*download[^"']*calendar[^"']*)["']/gi,
        /href=["']([^"']*export[^"']*calendar[^"']*)["']/gi
      ];
      
      const subscriptionUrls = new Set<string>();
      
      for (const pattern of subscriptionPatterns) {
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
            
            subscriptionUrls.add(subscriptionUrl);
          }
        }
      }
      
      console.log(`📋 Found ${subscriptionUrls.size} subscription URLs on calendar page`);
      
      // Now follow each subscription URL to find "All" or "All Events" buttons
      const workingFeeds: DiscoveredFeed[] = [];
      
      for (const subscriptionUrl of subscriptionUrls) {
        console.log(`🔎 Checking subscription page: ${subscriptionUrl}`);
        
        try {
          const allEventsFeeds = await this.findAllEventsButtonsOnSubscriptionPage(subscriptionUrl, location);
          workingFeeds.push(...allEventsFeeds);
          
          if (workingFeeds.length >= 2) break; // Limit to prevent too many requests
        } catch (error) {
          console.log(`⚠️ Failed to analyze subscription page ${subscriptionUrl}:`, error.message);
        }
      }
      
      return workingFeeds;
    } catch (error) {
      console.log(`❌ Error analyzing calendar page ${calendarPageUrl}:`, error.message);
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
      
      // Look specifically for calendar and events feeds, not just "All" buttons
      const calendarFeedPatterns = [
        // Look for calendar-specific feed links
        /<a[^>]+href=["']([^"']*RSSFeed\.aspx[^"']*calendar[^"']*)["'][^>]*>[^<]*(?:calendar|subscribe|rss)[^<]*<\/a>/gi,
        /<a[^>]+href=["']([^"']*iCalendarFeed\.aspx[^"']*calendar[^"']*)["'][^>]*>[^<]*(?:calendar|subscribe|ical)[^<]*<\/a>/gi,
        // Look for events-specific feed links
        /<a[^>]+href=["']([^"']*RSSFeed\.aspx[^"']*events[^"']*)["'][^>]*>[^<]*(?:events|subscribe|rss)[^<]*<\/a>/gi,
        /<a[^>]+href=["']([^"']*iCalendarFeed\.aspx[^"']*events[^"']*)["'][^>]*>[^<]*(?:events|subscribe|ical)[^<]*<\/a>/gi,
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
            let feedUrl = urlMatch[1];
            
            // Convert to absolute URL
            if (!feedUrl.startsWith('http')) {
              if (feedUrl.startsWith('/')) {
                feedUrl = `${baseUrl.protocol}//${baseUrl.host}${feedUrl}`;
              } else {
                feedUrl = `${baseUrl.protocol}//${baseUrl.host}/${feedUrl}`;
              }
            }
            
            feedUrls.push(feedUrl);
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
      console.log(`Error analyzing subscription page ${subscriptionUrl}:`, error.message);
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