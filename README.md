# Docs to Markdown

A TypeScript version of the DocsToMarkdown - a tool for automatically analyzing and summarizing library documentation for AI coding assistants.

This tool scrapes library documentation, extracts key information, and generates concise, LLM-friendly coding references that can be used by AI assistants like Claude to provide better coding help.

## Features

- 🔍 Automatically crawls and analyzes library documentation from any URL
- 📊 Extracts API signatures, code examples, and key information
- 📝 Generates concise, LLM-friendly summaries optimized for AI coding assistants
- 🚀 Optimized for processing speed and token efficiency
- 💾 Caches results to avoid redundant processing
- 🔄 Handles large documentation by intelligently summarizing or extracting key parts
- 🌐 Preserves code blocks and important formatting

## Installation

```bash
# Using pnpm (recommended)
pnpm install docs-to-markdown

# Using npm
npm install docs-to-markdown

# Using yarn
yarn add docs-to-markdown
```

## Requirements

- Node.js 18+
- Anthropic API key (for Claude AI model access)

## Quick Start

1. Set up your `.env` file with your Anthropic API key:

```
ANTHROPIC_API_KEY=your_api_key_here
```

2. Analyze a library from its documentation URL:

```typescript
import { analyzeUrl } from 'docs-to-markdown';

async function main() {
  const result = await analyzeUrl('https://reactjs.org/docs/getting-started.html', {
    maxPages: 10, // Limit number of pages to analyze
  });
  
  if (result.success) {
    console.log(`Analysis completed! Reference saved to: ${result.outputs.referencePath}`);
  } else {
    console.error('Analysis failed:', result.error);
  }
}

main();
```

## CLI Usage

The package includes a command-line interface for quick analysis:

```bash
# Install globally
pnpm install -g docs-to-markdown

# Run analysis on a library
analyze-url https://reactjs.org/docs/getting-started.html --pages=5
```

## Architecture

The module is organized into several components:

- **DocsToMarkdown**: Main class that orchestrates the analysis process
- **HtmlCompressor**: Optimizes HTML content for processing
- **Utilities**:
  - **CacheManager**: Manages caching of scraped pages and summaries
  - **ContentExtractor**: Extracts various types of content from HTML documents
  - **MarkdownConverter**: Converts HTML to Markdown for better token efficiency
  - **SummaryGenerator**: Generates AI summaries using Claude
  - **TokenEstimator**: Estimates token counts and manages limits
  - **WebScraper**: Handles fetching and processing web content

## Advanced Usage

For more control, you can use the `DocsToMarkdown` class directly:

```typescript
import { DocsToMarkdown } from 'docs-to-markdown';

// Create analyzer with custom options
const analyzer = new DocsToMarkdown({
  apiKey: 'your_anthropic_api_key',
  model: 'claude-3-7-sonnet-latest',
  outputDir: './custom-output-dir',
  maxTokensPerPage: 30000,
  maxTotalTokens: 100000,
  concurrency: 5 // Process 5 pages at a time
});

// Run analysis with detailed configuration
const result = await analyzer.analyzeLibraryDocs({
  libraryName: 'Express',
  docUrls: ['https://expressjs.com/en/4x/api.html'],
  entryPoint: 'https://expressjs.com/',
  crawlLinks: true,
  maxPages: 20,
  focusOnAPI: true,
  includeExamples: true,
  singleLanguageVersion: true
});

console.log(`Generated reference: ${result.outputs.referencePath}`);
```

## Output

The analyzer produces several outputs:

1. A concise, AI-friendly reference in Markdown format
2. JSON data containing extracted information from the documentation
3. A token usage report for tracking efficiency

## License

MIT 
