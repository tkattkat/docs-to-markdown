

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { URL } from 'url';

import { 
  DocsToMarkdownOptions, 
  AnalyzeLibraryDocsParams,
  AnalyzeUrlOptions,
  AnalysisResult,
  ProcessedPage,
  TokenCount,
} from './types.js';

import { htmlCompressor } from './HtmlCompressor.js';
import markdownConverter from './utils/MarkdownConverter.js';
import CacheManager from './utils/CacheManager.js';
import TokenEstimator from './utils/TokenEstimator.js';
import contentExtractor from './utils/ContentExtractor.js';
import webScraper from './utils/WebScraper.js';
import SummaryGenerator from './utils/SummaryGenerator.js';

dotenv.config();

export class DocsToMarkdown {
  private options: DocsToMarkdownOptions;
  private cacheManager: CacheManager;
  private summaryGenerator: SummaryGenerator | null = null;
  private tokenCount: TokenCount;

  constructor(options: DocsToMarkdownOptions = {}) {
    this.options = {
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: 'claude-3-5-haiku-latest',
      outputDir: path.join(process.cwd(), 'library-docs-fast'),
      summaryDir: path.join(process.cwd(), 'library-summaries-fast'),
      cacheDir: path.join(process.cwd(), 'doc-analyzer-cache'),
      timeout: 30000,
      retries: 2,
      concurrency: 3, 
      maxTokensPerPage: 50000, 
      maxTotalTokens: 200000, 
      ...options
    };

    for (const dir of [this.options.outputDir, this.options.summaryDir, this.options.cacheDir]) {
      if (!fs.existsSync(dir!)) {
        fs.mkdirSync(dir!, { recursive: true });
      }
    }

    this.cacheManager = new CacheManager(this.options.cacheDir!);

    this.tokenCount = {
      current: 0,
      total: 0,
      pages: new Map()
    };

    webScraper.setTimeout(this.options.timeout!);
    webScraper.setRetries(this.options.retries!);
  }

  private initSummaryGenerator(): void {
    if (!this.summaryGenerator) {
      if (!this.options.apiKey) {
        throw new Error('Anthropic API key is required. Set it in the .env file or pass it as an option.');
      }

      this.summaryGenerator = new SummaryGenerator(this.options.apiKey, this.options.model);
    }
  }

  async analyzeLibraryDocs(params: AnalyzeLibraryDocsParams): Promise<AnalysisResult> {
    
    this.initSummaryGenerator();
    
    const {
      libraryName,
      docUrls = [],
      entryPoint = null,
      crawlLinks = true,
      maxPages = 10,
      outputFormat = 'markdown',
      focusOnAPI = true,
      includeExamples = true,
      skipCache = false,
      singleLanguageVersion = true,
      maxTokensPerPage = this.options.maxTokensPerPage, 
      maxTotalTokens = this.options.maxTotalTokens      
    } = params;

    if (!libraryName) {
      throw new Error('Library name is required');
    }

    if (docUrls.length === 0 && !entryPoint) {
      throw new Error('At least one documentation URL or entry point is required');
    }

    if (maxTokensPerPage !== this.options.maxTokensPerPage) {
      this.options.maxTokensPerPage = maxTokensPerPage;
    }
    
    if (maxTotalTokens !== this.options.maxTotalTokens) {
      this.options.maxTotalTokens = maxTotalTokens;
    }

    this.tokenCount = {
      current: 0,
      total: 0,
      pages: new Map()
    };

    try {
      console.log(`🚀 Fast analysis of ${libraryName} documentation...`);
      console.log(`🔍 Token limits: ${this.options.maxTokensPerPage} per page, ${this.options.maxTotalTokens} total`);
      console.log(`🔤 Single language/version: ${singleLanguageVersion ? 'Yes' : 'No'}`);

      const safeLibraryName = libraryName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const libraryDir = path.join(this.options.outputDir!, safeLibraryName);
      const librarySummaryDir = path.join(this.options.summaryDir!, safeLibraryName);
      
      for (const dir of [libraryDir, librarySummaryDir]) {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      }

      const allUrls = [...docUrls];
      if (entryPoint && !allUrls.includes(entryPoint)) {
        allUrls.unshift(entryPoint);
      }

      const scrapedPages: ProcessedPage[] = [];
      const visitedUrls = new Set<string>();
      let urlsToVisit = [...allUrls];
      let pagesVisited = 0;

      while (urlsToVisit.length > 0 && pagesVisited < maxPages) {
        
        const batch = urlsToVisit.splice(0, Math.min(this.options.concurrency!, urlsToVisit.length));
        const promises = batch.map(url => {
          if (visitedUrls.has(url)) return Promise.resolve(null);
          
          visitedUrls.add(url);
          pagesVisited++;
          
          console.log(`📄 Processing page ${pagesVisited}/${maxPages}: ${url}`);
          return this.fetchAndProcessPage(url, libraryName, skipCache, singleLanguageVersion);
        });
        
        const results = await Promise.all(promises);

        const validResults = results.filter(result => result !== null) as ProcessedPage[];
        scrapedPages.push(...validResults);

        if (crawlLinks && pagesVisited < maxPages && this.tokenCount.total < this.options.maxTotalTokens! * 0.9) {
          for (const page of validResults) {
            if (!page.links) continue;
            
            for (const link of page.links) {
              if (!visitedUrls.has(link) && !urlsToVisit.includes(link)) {
                urlsToVisit.push(link);
              }
            }
          }
        }

        if (this.tokenCount.total > this.options.maxTotalTokens! * 0.9) {
          console.log(`🛑 Approaching token limit (${this.tokenCount.total} / ${this.options.maxTotalTokens}). Stopping crawl.`);
          urlsToVisit = [];
        }
      }

      console.log(`📏 Checking page sizes and summarizing large content...`);
      const processedPages = await this.summarizeExcessivePages(scrapedPages);

      console.log(`📝 Generating coding reference for ${libraryName}...`);

      let pagesToSummarize = processedPages;
      if (focusOnAPI) {
        
        pagesToSummarize = contentExtractor.filterAPIPages(processedPages);

        if (pagesToSummarize.length < 2 && processedPages.length > 2) {
          pagesToSummarize = processedPages;
        }
      }
      
      const codingReference = await this.summaryGenerator!.generateCodingReference(
        pagesToSummarize, 
        libraryName, 
        includeExamples
      );

      const llmReferencePath = path.join(librarySummaryDir, `${safeLibraryName}-reference.md`);
      const rawDataPath = path.join(libraryDir, `${safeLibraryName}-data.json`);
      const tokenReportPath = path.join(libraryDir, `${safeLibraryName}-token-report.json`);

      fs.writeFileSync(llmReferencePath, codingReference);

      const minimalData = processedPages.map(page => ({
        url: page.url,
        title: page.title,
        wasSummarized: !!page.wasSummarized,
        wasReduced: !!page.wasReduced,
        tokenCount: page.tokenCount || 0
      }));
      
      fs.writeFileSync(rawDataPath, JSON.stringify(minimalData, null, 2));

      const tokenReport = {
        totalTokens: this.tokenCount.total,
        pagesProcessed: pagesVisited,
        averageTokensPerPage: Math.round(this.tokenCount.total / pagesVisited),
        largestPage: {
          title: '',
          url: '',
          tokens: 0
        },
        smallestPage: {
          title: '',
          url: '',
          tokens: Number.MAX_SAFE_INTEGER
        },
        pagesWithTokens: Array.from(this.tokenCount.pages.entries()).map(([url, tokens]) => {
          const page = processedPages.find(p => p.url === url);
          return {
            title: page ? page.title : 'Unknown',
            url,
            tokens,
            wasSummarized: page && page.wasSummarized,
            wasReduced: page && page.wasReduced
          };
        })
      };

      for (const pageInfo of tokenReport.pagesWithTokens) {
        if (pageInfo.tokens > tokenReport.largestPage.tokens) {
          tokenReport.largestPage = pageInfo;
        }
        if (pageInfo.tokens < tokenReport.smallestPage.tokens) {
          tokenReport.smallestPage = pageInfo;
        }
      }
      
      fs.writeFileSync(tokenReportPath, JSON.stringify(tokenReport, null, 2));

      this.cacheManager.saveCache();
      
      return {
        success: true,
        libraryName,
        pagesAnalyzed: pagesVisited,
        tokenUsage: {
          total: this.tokenCount.total,
          average: Math.round(this.tokenCount.total / pagesVisited)
        },
        outputs: {
          referencePath: llmReferencePath,
          dataPath: rawDataPath,
          tokenReportPath: tokenReportPath
        },
        reference: codingReference
      };
    } catch (error) {
      return {
        success: false,
        libraryName,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async fetchAndProcessPage(
    url: string, 
    libraryName: string, 
    skipCache = false, 
    singleLanguageVersion = true
  ): Promise<ProcessedPage | null> {
    try {
      
      if (!skipCache && this.cacheManager.hasPage(url)) {
        console.log(`Using cached version of ${url}`);
        const cachedPage = this.cacheManager.getPage(url);
        
        if (!cachedPage) return null;

        if (cachedPage.tokenCount) {
          this.tokenCount.total += cachedPage.tokenCount;
        } else {
          
          let tokenEstimate = 0;
          if (cachedPage.markdownContent) {
            tokenEstimate = TokenEstimator.estimateTokenCount(cachedPage.markdownContent);
          } else if (cachedPage.compressedHtml) {
            
            const markdown = markdownConverter.htmlToMarkdown(cachedPage.compressedHtml);
            tokenEstimate = TokenEstimator.estimateTokenCount(markdown);

            cachedPage.markdownContent = markdown;
            cachedPage.tokenCount = tokenEstimate;
            this.cacheManager.setPage(url, cachedPage);
          }
          
          this.tokenCount.total += tokenEstimate;
        }
        
        return cachedPage;
      }

      const html = await webScraper.fetchHtml(url);

      const title = contentExtractor.extractTitle(html);

      const compressedHtml = htmlCompressor.compress(html, {
        
        preserveElements: [
          'pre', 'code', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          'p', 'li', 'ul', 'ol', 'table', 'tr', 'td', 'th', 'thead', 'tbody'
        ],
        removeElements: [
          'script', 'style', 'noscript', 'iframe', 'canvas', 'svg',
          'footer', 'aside', 'nav', 'header', 'banner', 'advertisement'
        ],
        preserveAttributes: [
          'id', 'class', 'href', 'src', 'alt', 'title', 'data-language',
          'data-lang', 'language', 'lang'
        ],
        collapseWhitespace: true,
        removeComments: true
      });

      const markdownContent = markdownConverter.htmlToMarkdown(compressedHtml);

      const tokenCount = TokenEstimator.estimateTokenCount(markdownContent);

      if (TokenEstimator.wouldExceedLimit(this.tokenCount.total, tokenCount, this.options.maxTotalTokens!)) {
        console.warn(`Skipping ${url} as it would exceed token limits (${tokenCount} tokens)`);
        return null;
      }

      this.tokenCount.current = tokenCount;
      this.tokenCount.total += tokenCount;
      this.tokenCount.pages.set(url, tokenCount);

      const links = contentExtractor.extractRelevantLinks(html, url, libraryName, singleLanguageVersion);

      const codeExamples = contentExtractor.extractCodeExamples(html);
      const apiSignatures = contentExtractor.extractAPISignatures(html, libraryName);

      const result: ProcessedPage = {
        url,
        title,
        markdownContent,  
        links,
        codeExamples,
        apiSignatures,
        tokenCount,       
        timestamp: new Date().toISOString()
      };

      this.cacheManager.setPage(url, result);
      
      return result;
    } catch (error) {
      console.error(`Error processing ${url}: ${error}`);
      return null;
    }
  }

  async summarizeExcessivePages(pages: ProcessedPage[]): Promise<ProcessedPage[]> {
    
    this.initSummaryGenerator();

    const processedPages = [...pages];
    const pagesToSummarize = [];

    for (let i = 0; i < processedPages.length; i++) {
      const page = processedPages[i];

      if (!page.markdownContent) continue;

      const tokenCount = page.tokenCount || TokenEstimator.estimateTokenCount(page.markdownContent);

      if (tokenCount > this.options.maxTokensPerPage! * 0.5) { 
        pagesToSummarize.push({ index: i, page, tokenCount });
      }
    }
    
    console.log(`Found ${pagesToSummarize.length} pages that exceed token thresholds and need summarization.`);

    for (const { index, page, tokenCount } of pagesToSummarize) {
      console.log(`Summarizing page ${page.title} (${tokenCount} tokens) to reduce token usage...`);
      
      try {

        if (tokenCount > this.options.maxTokensPerPage! * 0.75) {
          
          processedPages[index] = contentExtractor.extractKeyContentSections(page);
        } else {
          
          const summary = await this.summaryGenerator!.generatePageSummary(page);

          processedPages[index] = {
            ...page,
            markdownContent: summary,
            tokenCount: TokenEstimator.estimateTokenCount(summary),
            wasSummarized: true
          };
        }
      } catch (error) {
        console.warn(`Failed to summarize page ${page.title}: ${error}`);
        
        processedPages[index] = contentExtractor.extractKeyContentSections(page);
      }
    }
    
    return processedPages;
  }

  async analyzeUrl(url: string, options: AnalyzeUrlOptions = {}): Promise<AnalysisResult> {
    
    try {
      new URL(url);
    } catch (error) {
      throw new Error(`Invalid URL: ${url}`);
    }

    const libraryName = options.libraryName || this.extractLibraryNameFromUrl(url);
    
    console.log(`🔍 Analyzing documentation from: ${url}`);
    console.log(`📚 Library name: ${libraryName}`);

    const config: AnalyzeLibraryDocsParams = {
      libraryName,
      docUrls: [url],
      entryPoint: url,
      crawlLinks: true,
      maxPages: options.maxPages || 50,
      outputFormat: 'markdown',
      focusOnAPI: true,
      includeExamples: true,
      skipCache: options.skipCache || false,
      singleLanguageVersion: options.singleLanguageVersion !== undefined ? options.singleLanguageVersion : true,
      maxTokensPerPage: options.maxTokensPerPage || this.options.maxTokensPerPage,
      maxTotalTokens: options.maxTotalTokens || this.options.maxTotalTokens
    };

    return this.analyzeLibraryDocs(config);
  }

  extractLibraryNameFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      let extractedName = '';

      const hostParts = urlObj.hostname.split('.');
      if (hostParts[0] === 'www' && hostParts.length > 2) {
        extractedName = hostParts[1];
      } else {
        extractedName = hostParts[0];
      }

      if (urlObj.pathname.length > 1) {
        const pathParts = urlObj.pathname.split('/').filter(p => p);
        if (pathParts.length > 0) {
          const lastPart = pathParts[pathParts.length - 1];
          const secondPart = pathParts.length > 1 ? pathParts[0] : null;

          if (lastPart && !lastPart.includes('.') && lastPart.length > 2) {
            extractedName = lastPart;
          } else if (secondPart && secondPart.length > 2) {
            extractedName = secondPart;
          }
        }
      }

      extractedName = extractedName
        .replace(/-/g, ' ')
        .replace(/docs|documentation|api|reference/i, '')
        .trim();

      if (extractedName) {
        
        return extractedName.charAt(0).toUpperCase() + extractedName.slice(1);
      } else {
        
        return urlObj.hostname.split('.')[0];
      }
    } catch (error) {
      console.log(`Warning: Could not extract library name from URL: ${error}`);
      return "Library";
    }
  }

  async generateCodingReference(pages: ProcessedPage[], libraryName: string, includeExamples = true): Promise<string> {
    
    this.initSummaryGenerator();
    
    return this.summaryGenerator!.generateCodingReference(pages, libraryName, includeExamples);
  }

  async generatePageSummary(page: ProcessedPage): Promise<string> {
    
    this.initSummaryGenerator();
    
    return this.summaryGenerator!.generatePageSummary(page);
  }
}

export const docsToMarkdown = new DocsToMarkdown();

export const analyzeUrl = (url: string, options: AnalyzeUrlOptions = {}) => 
  docsToMarkdown.analyzeUrl(url, options);

export default DocsToMarkdown; 