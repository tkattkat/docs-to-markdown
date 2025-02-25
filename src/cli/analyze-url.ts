#!/usr/bin/env node

import { analyzeUrl } from '../DocsToMarkdown.js';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printUsage();
    process.exit(0);
  }

  const url = args[0];

  const options: {
    libraryName?: string;
    maxPages?: number;
    skipCache?: boolean;
    singleLanguageVersion?: boolean;
    outputDir?: string;
  } = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--name=')) {
      options.libraryName = arg.substring('--name='.length);
    } else if (arg.startsWith('--pages=')) {
      options.maxPages = parseInt(arg.substring('--pages='.length), 10);
    } else if (arg === '--skip-cache') {
      options.skipCache = true;
    } else if (arg === '--multi-version') {
      options.singleLanguageVersion = false;
    } else if (arg.startsWith('--output=')) {
      options.outputDir = arg.substring('--output='.length);
    }
  }
  
  console.log(`Starting analysis of ${url}`);
  console.log('Options:', options);
  
  try {
    
    const result = await analyzeUrl(url, options);
    
    if (result.success) {
      console.log('✅ Analysis completed successfully!');
      console.log(`📊 Analyzed ${result.pagesAnalyzed} pages`);
      console.log(`🔤 Used ${result.tokenUsage?.total} tokens`);
      console.log(`📁 Reference saved to: ${result.outputs?.referencePath}`);
    } else {
      console.error('❌ Analysis failed:', result.error);
    }
  } catch (error) {
    console.error('Error during analysis:', error);
    process.exit(1);
  }
}

function printUsage() {
  console.log(`
Usage: analyze-url <url> [options]

Analyze library documentation from a URL and generate a coding reference.

Arguments:
  <url>                     URL to the library documentation

Options:
  --name=<name>             Library name (detected automatically if not provided)
  --pages=<number>          Maximum number of pages to analyze (default: 50)
  --skip-cache              Skip using cached content
  --multi-version           Allow crawling multiple language/version variants
  --output=<dir>            Output directory for results
  --help, -h                Show this help message

Examples:
  analyze-url https:
  analyze-url https:
  `);
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
}); 