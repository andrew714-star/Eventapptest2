import axios from 'axios';

export interface WebsiteValidation {
  isValid: boolean;
  status: 'valid' | 'parked' | 'expired' | 'redirect' | 'error' | 'timeout';
  actualUrl?: string;
  title?: string;
  error?: string;
}

export class WebsiteValidator {
  private static readonly PARKED_INDICATORS = [
    'domain for sale',
    'buy this domain',
    'domain parking',
    'parked domain',
    'expired domain',
    'domain expired',
    'godaddy',
    'namecheap',
    'sedo',
    'underconstruction',
    'coming soon',
    'site not found',
    'page not found',
    'temporarily unavailable'
  ];

  static async validateWebsite(url: string): Promise<WebsiteValidation> {
    try {
      // Ensure URL has protocol
      const fullUrl = url.startsWith('http') ? url : `https://${url}`;
      
      const response = await axios.get(fullUrl, {
        timeout: 10000,
        maxRedirects: 5,
        headers: {
          'User-Agent': 'CityWide Events Website Validator 1.0',
        },
        validateStatus: (status) => status < 500 // Accept redirects and client errors
      });

      const html = response.data.toLowerCase();
      const title = this.extractTitle(response.data);
      
      // Check for parked domain indicators
      const isParked = this.PARKED_INDICATORS.some(indicator => 
        html.includes(indicator) || (title && title.toLowerCase().includes(indicator))
      );

      if (isParked) {
        return {
          isValid: false,
          status: 'parked',
          actualUrl: response.request.res?.responseUrl || fullUrl,
          title,
          error: 'Domain appears to be parked or for sale'
        };
      }

      // Check if it's a redirect to a different domain
      const finalUrl = response.request.res?.responseUrl || fullUrl;
      const originalDomain = new URL(fullUrl).hostname;
      const finalDomain = new URL(finalUrl).hostname;
      
      if (originalDomain !== finalDomain && !finalDomain.includes(originalDomain.replace('www.', ''))) {
        return {
          isValid: false,
          status: 'redirect',
          actualUrl: finalUrl,
          title,
          error: `Redirects to different domain: ${finalDomain}`
        };
      }

      return {
        isValid: true,
        status: 'valid',
        actualUrl: finalUrl,
        title
      };

    } catch (error: any) {
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        return {
          isValid: false,
          status: 'error',
          error: 'Domain not found or connection refused'
        };
      }
      
      if (error.code === 'ETIMEDOUT') {
        return {
          isValid: false,
          status: 'timeout',
          error: 'Request timed out'
        };
      }

      return {
        isValid: false,
        status: 'error',
        error: error.message
      };
    }
  }

  private static extractTitle(html: string): string | undefined {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return titleMatch ? titleMatch[1].trim() : undefined;
  }

  static async validateMultiple(urls: string[]): Promise<Map<string, WebsiteValidation>> {
    const results = new Map<string, WebsiteValidation>();
    
    // Process in batches to avoid overwhelming servers
    const batchSize = 5;
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
      
      // Small delay between batches
      if (i + batchSize < urls.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    return results;
  }
}