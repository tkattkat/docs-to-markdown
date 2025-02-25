

export interface IHtmlCompressor {
  compress(html: string, overrideConfig?: HtmlCompressorOptions): string;
  compressFile(filePath: string, overrideConfig?: HtmlCompressorOptions): string;
  compressAndSave(html: string, outputPath: string, overrideConfig?: HtmlCompressorOptions): boolean;
  compressFileAndSave(inputPath: string, outputPath: string, overrideConfig?: HtmlCompressorOptions): boolean;
  getCompressionStats(original: string, compressed: string): {
    originalSize: number;
    compressedSize: number;
    savings: number;
    savingsPercent: number;
  };
}

export interface DocsToMarkdownOptions {
  apiKey?: string;
  model?: string;
  outputDir?: string;
  summaryDir?: string;
  cacheDir?: string;
  timeout?: number;
  retries?: number;
  concurrency?: number;
  maxTokensPerPage?: number;
  maxTotalTokens?: number;
  htmlCompressor?: IHtmlCompressor; 
}

export interface AnalyzeLibraryDocsParams {
  libraryName: string;
  docUrls?: string[];
  entryPoint?: string | null;
  crawlLinks?: boolean;
  maxPages?: number;
  outputFormat?: 'markdown' | 'json';
  focusOnAPI?: boolean;
  includeExamples?: boolean;
  skipCache?: boolean;
  singleLanguageVersion?: boolean;
  maxTokensPerPage?: number;
  maxTotalTokens?: number;
}

export interface AnalyzeUrlOptions {
  libraryName?: string;
  maxPages?: number;
  skipCache?: boolean;
  singleLanguageVersion?: boolean;
  maxTokensPerPage?: number;
  maxTotalTokens?: number;
}

export interface AnalysisResult {
  success: boolean;
  libraryName: string;
  pagesAnalyzed?: number;
  tokenUsage?: {
    total: number;
    average: number;
  };
  outputs?: {
    referencePath: string;
    dataPath: string;
    tokenReportPath: string;
  };
  reference?: string;
  error?: string;
}

export interface ProcessedPage {
  url: string;
  title: string;
  markdownContent?: string;
  compressedHtml?: string;
  links?: string[];
  codeExamples?: CodeExample[];
  apiSignatures?: APISignature[];
  tokenCount?: number;
  wasSummarized?: boolean;
  wasReduced?: boolean;
  timestamp?: string;
}

export interface CodeExample {
  code: string;
  language: string;
  description: string;
}

export interface APISignature {
  name: string;
  signature: string;
  description?: string;
  parameters?: string[];
}

export interface TokenCount {
  current: number;
  total: number;
  pages: Map<string, number>;
}

export interface AnalyzerCache {
  pages: Map<string, ProcessedPage>;
  summaries: Map<string, string>;
}

export interface HtmlCompressorOptions {
  removeElements?: string[];
  preserveAttributes?: string[];
  preserveElements?: string[];
  removeEmptyElements?: boolean;
  collapseWhitespace?: boolean;
  removeComments?: boolean;
  maxDepth?: number;
  preserveTextContent?: boolean;
  removeRedundantAttributes?: boolean;
  shortenDataAttributes?: boolean;
  minifyUrls?: boolean;
  removeHiddenElements?: boolean;
  removeCustomElements?: boolean;
  shortenClassNames?: boolean;
  shortenIds?: boolean;
  ignoreElements?: string[];
  whitelistedClasses?: string[];
  whitelistedIds?: string[];
} 