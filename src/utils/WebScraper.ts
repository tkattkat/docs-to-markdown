

import { gotScraping } from 'got-scraping';

export class WebScraper {
  private timeout: number;
  private retries: number;

  constructor(timeout = 30000, retries = 2) {
    this.timeout = timeout;
    this.retries = retries;
  }

  async fetchHtml(url: string): Promise<string> {
    try {
      const options = {
        url,
        timeout: {
          request: this.timeout
        },
        retry: {
          limit: this.retries,
          methods: ['GET'],
          statusCodes: [408, 413, 429, 500, 502, 503, 504]
        },
        
        headerGeneratorOptions: {
          browsers: [{ name: 'chrome', minVersion: 87 }],
          devices: ['desktop'],
          operatingSystems: ['windows', 'macos']
        },
        throwHttpErrors: false
      };
      
      const response = await gotScraping(options);
      
      if (response.statusCode !== 200) {
        throw new Error(`HTTP ${response.statusCode}`);
      }
      
      return response.body;
    } catch (error) {
      throw new Error(`Failed to fetch ${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  setTimeout(timeout: number): void {
    this.timeout = timeout;
  }

  setRetries(retries: number): void {
    this.retries = retries;
  }
}

export const webScraper = new WebScraper();

export default webScraper; 