import fs from 'fs';
import path from 'path';
import { AnalyzerCache, ProcessedPage } from '../types.js';

export class CacheManager {
  private cacheDir: string;
  private cache: AnalyzerCache;

  constructor(cacheDir: string) {
    this.cacheDir = cacheDir;
    this.cache = {
      pages: new Map<string, ProcessedPage>(),
      summaries: new Map<string, string>()
    };

    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }

    this.loadCache();
  }

  loadCache(): void {
    try {
      const cacheFile = path.join(this.cacheDir, 'cache.json');
      if (fs.existsSync(cacheFile)) {
        const cacheData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        
        if (cacheData.pages) {
          this.cache.pages = new Map(Object.entries(cacheData.pages));
        }
        
        if (cacheData.summaries) {
          this.cache.summaries = new Map(Object.entries(cacheData.summaries));
        }
        
        console.log(`Loaded cache with ${this.cache.pages.size} pages and ${this.cache.summaries.size} summaries`);
      }
    } catch (error) {
      console.warn(`Failed to load cache: ${error}`);
    }
  }

  saveCache(): void {
    try {
      const cacheFile = path.join(this.cacheDir, 'cache.json');
      
      const cacheData = {
        pages: Object.fromEntries(this.cache.pages),
        summaries: Object.fromEntries(this.cache.summaries)
      };
      
      fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2));
    } catch (error) {
      console.warn(`Failed to save cache: ${error}`);
    }
  }

  getCacheKey(url: string): string {
    return Buffer.from(url).toString('base64').replace(/[\/\+\=]/g, '');
  }

  getPage(url: string): ProcessedPage | null {
    const key = this.getCacheKey(url);
    return this.cache.pages.has(key) ? this.cache.pages.get(key) || null : null;
  }

  setPage(url: string, page: ProcessedPage): void {
    const key = this.getCacheKey(url);
    this.cache.pages.set(key, page);
  }

  getSummary(key: string): string | null {
    return this.cache.summaries.has(key) ? this.cache.summaries.get(key) || null : null;
  }

  setSummary(key: string, summary: string): void {
    this.cache.summaries.set(key, summary);
  }

  hasPage(url: string): boolean {
    const key = this.getCacheKey(url);
    return this.cache.pages.has(key);
  }

  hasSummary(key: string): boolean {
    return this.cache.summaries.has(key);
  }
}

export default CacheManager;