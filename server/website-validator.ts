
import axios from 'axios';

export interface WebsiteValidation {
  isValid: boolean;
  status: 'valid' | 'parked' | 'expired' | 'redirect' | 'error' | 'timeout' | 'maintenance';
  actualUrl?: string;
  title?: string;
  error?: string;
  contentLength?: number;
  hasValidContent?: boolean;
}

export class WebsiteValidator {
  private static readonly PARKED_INDICATORS = [
    // Domain parking services
    'domain for sale',
    'buy this domain',
    'domain parking',
    'parked domain',
    'expired domain',
    'domain expired',
    'this domain may be for sale',
    'domain name is for sale',
    'purchase this domain',
    'premium domain',
    
    // Hosting providers
    'godaddy',
    'namecheap',
    'sedo',
    'afternic',
    'dan.com',
    'underdevelopment',
    'under development',
    'underconstruction',
    'under construction',
    'coming soon',
    'website coming soon',
    'site coming soon',
    
    // Error pages
    'site not found',
    'page not found',
    'website not found',
    'temporarily unavailable',
    'service unavailable',
    'account suspended',
    'domain suspended',
    'hosting suspended',
    
    // Placeholder content
    'default web site page',
    'default website',
    'placeholder page',
    'test page',
    'it works!',
    'apache2 ubuntu default page',
    'nginx welcome page',
    'iis windows server',
    'welcome to nginx',
    'apache http server test page'
  ];

  private static readonly GOVERNMENT_INDICATORS = [
    'city of',
    'town of',
    'village of',
    'county of',
    'municipal',
    'government',
    'official website',
    'city hall',
    'mayor',
    'council',
    'department',
    'services',
    'permits',
    'zoning',
    'public works'
  ];

  static async validateWebsite(url: string): Promise<WebsiteValidation> {
    try {
      // Ensure URL has protocol
      const fullUrl = url.startsWith('http') ? url : `https://${url}`;
      
      const response = await axios.get(fullUrl, {
        timeout: 20000, // Extended timeout for government sites
        maxRedirects: 10, // Allow more redirects for complex gov sites
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        validateStatus: (status) => status < 500 // Accept redirects and client errors
      });

      // Check for HTTP errors that indicate non-existent websites
      if (response.status === 404) {
        return {
          isValid: false,
          status: 'error',
          actualUrl: fullUrl,
          error: 'Website not found (404)'
        };
      }

      if (response.status >= 400 && response.status < 500) {
        return {
          isValid: false,
          status: 'error',
          actualUrl: fullUrl,
          error: `HTTP error: ${response.status} ${response.statusText}`
        };
      }

      // Check if we got meaningful content
      const html = response.data;
      if (!html || typeof html !== 'string' || html.length < 200) {
        return {
          isValid: false,
          status: 'error',
          actualUrl: fullUrl,
          error: 'Insufficient content received',
          contentLength: html?.length || 0
        };
      }

      const htmlLower = html.toLowerCase();
      const title = this.extractTitle(html);
      const contentLength = html.length;
      
      // Check for maintenance pages
      if (this.isMaintenancePage(htmlLower, title)) {
        return {
          isValid: false,
          status: 'maintenance',
          actualUrl: response.request.res?.responseUrl || fullUrl,
          title,
          error: 'Website is under maintenance',
          contentLength
        };
      }

      // Enhanced parked domain detection
      const isParked = this.isParkedDomain(htmlLower, title);
      if (isParked) {
        return {
          isValid: false,
          status: 'parked',
          actualUrl: response.request.res?.responseUrl || fullUrl,
          title,
          error: 'Domain appears to be parked or for sale',
          contentLength
        };
      }

      // Check if it's a redirect to a different domain
      const finalUrl = response.request.res?.responseUrl || fullUrl;
      const redirectCheck = this.checkRedirect(fullUrl, finalUrl);
      if (!redirectCheck.isValid) {
        return {
          isValid: false,
          status: 'redirect',
          actualUrl: finalUrl,
          title,
          error: redirectCheck.error,
          contentLength
        };
      }

      // Check content quality
      const hasValidContent = this.hasValidContent(htmlLower, title, contentLength);
      
      // For government sites, be more lenient if basic indicators are present
      const isGovernmentSite = this.isGovernmentSite(htmlLower, title, fullUrl);
      
      if (!hasValidContent && !isGovernmentSite) {
        return {
          isValid: false,
          status: 'error',
          actualUrl: finalUrl,
          title,
          error: 'Website appears to lack meaningful content',
          contentLength,
          hasValidContent: false
        };
      }

      return {
        isValid: true,
        status: 'valid',
        actualUrl: finalUrl,
        title,
        contentLength,
        hasValidContent
      };

    } catch (error: any) {
      if (error.code === 'ENOTFOUND') {
        return {
          isValid: false,
          status: 'error',
          error: 'Domain not found (DNS resolution failed)'
        };
      }
      
      if (error.code === 'ECONNREFUSED') {
        return {
          isValid: false,
          status: 'error',
          error: 'Connection refused (server not responding)'
        };
      }
      
      if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
        return {
          isValid: false,
          status: 'timeout',
          error: 'Request timed out (server too slow)'
        };
      }

      if (error.response?.status >= 500) {
        return {
          isValid: false,
          status: 'error',
          error: `Server error: ${error.response.status} ${error.response.statusText}`
        };
      }

      return {
        isValid: false,
        status: 'error',
        error: error.message || 'Unknown error occurred'
      };
    }
  }

  private static isParkedDomain(html: string, title?: string): boolean {
    // Check HTML content
    const hasParkedIndicator = this.PARKED_INDICATORS.some(indicator => 
      html.includes(indicator)
    );
    
    // Check title
    const titleParked = title && this.PARKED_INDICATORS.some(indicator => 
      title.toLowerCase().includes(indicator)
    );
    
    // Check for domain broker patterns
    const brokerPatterns = [
      /buy.*domain/i,
      /premium.*domain/i,
      /domain.*for.*sale/i,
      /register.*domain/i,
      /domain.*marketplace/i
    ];
    
    const hasBrokerPattern = brokerPatterns.some(pattern => 
      pattern.test(html) || (title && pattern.test(title))
    );
    
    return hasParkedIndicator || titleParked || hasBrokerPattern;
  }

  private static isMaintenancePage(html: string, title?: string): boolean {
    const maintenanceIndicators = [
      'under maintenance',
      'maintenance mode',
      'temporarily down',
      'scheduled maintenance',
      'site maintenance',
      'system maintenance',
      'server maintenance',
      'website maintenance'
    ];
    
    return maintenanceIndicators.some(indicator => 
      html.includes(indicator) || (title && title.toLowerCase().includes(indicator))
    );
  }

  private static checkRedirect(originalUrl: string, finalUrl: string): { isValid: boolean; error?: string } {
    try {
      const originalDomain = new URL(originalUrl).hostname.toLowerCase();
      const finalDomain = new URL(finalUrl).hostname.toLowerCase();
      
      // Remove www prefix for comparison
      const normalizedOriginal = originalDomain.replace(/^www\./, '');
      const normalizedFinal = finalDomain.replace(/^www\./, '');
      
      // Allow same domain redirects (www, https, subdomain changes)
      if (normalizedOriginal === normalizedFinal) {
        return { isValid: true };
      }
      
      // Allow subdomain variations
      if (normalizedFinal.endsWith('.' + normalizedOriginal) || 
          normalizedOriginal.endsWith('.' + normalizedFinal)) {
        return { isValid: true };
      }
      
      // Check for domain parking redirects
      const parkingDomains = [
        'godaddy.com',
        'namecheap.com',
        'sedo.com',
        'afternic.com',
        'dan.com',
        'parkingcrew.net',
        'sedoparking.com',
        'parklogic.com'
      ];
      
      if (parkingDomains.some(domain => finalDomain.includes(domain))) {
        return { 
          isValid: false, 
          error: `Redirects to domain parking service: ${finalDomain}` 
        };
      }
      
      // Reject redirects to completely different domains
      return { 
        isValid: false, 
        error: `Redirects to different domain: ${finalDomain}` 
      };
      
    } catch (error) {
      return { 
        isValid: false, 
        error: 'Invalid URL structure in redirect check' 
      };
    }
  }

  private static hasValidContent(html: string, title?: string, contentLength?: number): boolean {
    // Minimum content length
    if (!contentLength || contentLength < 500) {
      return false;
    }
    
    // Check for meaningful HTML structure
    const hasStructure = html.includes('<body') && 
                        html.includes('</body>') && 
                        (html.includes('<div') || html.includes('<section') || html.includes('<main'));
    
    if (!hasStructure) {
      return false;
    }
    
    // Check for navigation or menu elements
    const hasNavigation = /(<nav|<menu|<ul.*nav|navigation|menu)/i.test(html);
    
    // Check for actual content
    const hasContent = /(<p|<article|<section|<div.*content|<main)/i.test(html);
    
    // Check for forms or interactive elements
    const hasInteractivity = /(<form|<input|<button|<select)/i.test(html);
    
    // Title should be meaningful
    const hasMeaningfulTitle = title && 
                              title.length > 3 && 
                              !this.PARKED_INDICATORS.some(indicator => 
                                title.toLowerCase().includes(indicator));
    
    // Need at least 2 of these indicators for valid content
    const validityScore = [hasNavigation, hasContent, hasInteractivity, hasMeaningfulTitle]
                         .filter(Boolean).length;
    
    return validityScore >= 2;
  }

  private static isGovernmentSite(html: string, title?: string, url?: string): boolean {
    // Check URL for government indicators
    if (url) {
      const isGovDomain = url.includes('.gov') || url.includes('.us');
      if (isGovDomain) return true;
    }
    
    // Check content for government indicators
    const hasGovContent = this.GOVERNMENT_INDICATORS.some(indicator => 
      html.includes(indicator) || (title && title.toLowerCase().includes(indicator))
    );
    
    return hasGovContent;
  }

  private static extractTitle(html: string): string | undefined {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return titleMatch ? titleMatch[1].trim() : undefined;
  }

  static async validateMultiple(urls: string[]): Promise<Map<string, WebsiteValidation>> {
    const results = new Map<string, WebsiteValidation>();
    
    // Process in smaller batches to avoid overwhelming servers
    const batchSize = 3;
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      const promises = batch.map(async (url) => {
        const result = await this.validateWebsite(url);
        return { url, result };
      });
      
      const batchResults = await Promise.all(promises);
      batchResults.forEach(({ url, result }) => {
        results.set(url, result);
      });
      
      // Longer delay between batches for government sites
      if (i + batchSize < urls.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }
}
