import Anthropic from '@anthropic-ai/sdk';
import { ProcessedPage, APISignature, CodeExample } from '../types.js';

export class SummaryGenerator {
  private anthropic: Anthropic;
  private model: string;

  constructor(apiKey: string, model = 'claude-3-5-haiku-latest') {
    if (!apiKey) {
      throw new Error('Anthropic API key is required');
    }
    
    this.anthropic = new Anthropic({
      apiKey: apiKey,
    });
    
    this.model = model;
  }

  async generatePageSummary(page: ProcessedPage): Promise<string> {
    try {
      const prompt = `Please create a concise summary of this library documentation page. 
Focus only on the API details, function signatures, and key examples.
Preserve code blocks and important technical details.
Remove any redundant explanations or introductory material.
Format your response in Markdown.

# ${page.title}

${page.markdownContent}`;

      const response = await this.anthropic.messages.create({
        max_tokens: 8192,
        messages: [{ role: 'user', content: prompt }],
        model: this.model,
      });
      
      const summary = response.content[0].text;
      
      return `> Note: This is an AI-generated summary of the original documentation page.\n\n${summary}`;
    } catch (error) {
      throw new Error(`Failed to generate page summary: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async generateCodingReference(
    pages: ProcessedPage[],
    libraryName: string,
    includeExamples = true
  ): Promise<string> {
    try {
      const allSignatures: APISignature[] = [];
      pages.forEach(page => {
        if (page.apiSignatures && page.apiSignatures.length > 0) {
          allSignatures.push(...page.apiSignatures);
        }
      });
      
      const allExamples: CodeExample[] = [];
      if (includeExamples) {
        pages.forEach(page => {
          if (page.codeExamples && page.codeExamples.length > 0) {
            allExamples.push(...page.codeExamples);
          }
        });
      }
      
      const pagesList = pages.map(page => `${page.title} (${page.url})`).join('\n');
      
      const prompt = `Please create a comprehensive coding reference for the ${libraryName} library. This reference will be used with an LLM like Claude to assist with coding tasks.

The reference should:
1. Focus on practical usage for developers
2. Include clear API signatures with parameter descriptions
3. Highlight important patterns and best practices
4. Include concise, helpful code examples
5. Be well-structured and easy to navigate
6. Focus on the most commonly used functionality

Format the reference in Markdown with appropriate sections and code blocks.

The following data was extracted from the library's documentation:

## Pages Analyzed
${pagesList}

## API Signatures
${JSON.stringify(allSignatures, null, 2)}

${includeExamples ? `## Code Examples
${JSON.stringify(allExamples, null, 2)}` : ''}

Please synthesize this information into a comprehensive, well-organized coding reference.`;

      const response = await this.anthropic.messages.create({
        max_tokens: 8192,
        messages: [{ role: 'user', content: prompt }],
        model: this.model,
      });
      
      const reference = response.content[0].text;
      
      return `# ${libraryName} Library Reference
> Generated by DocsToMarkdown
> Last updated: ${new Date().toISOString()}
> Pages analyzed: ${pages.length}

${reference}`;
    } catch (error) {
      throw new Error(`Failed to generate coding reference: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  setModel(model: string): void {
    this.model = model;
  }
}

export default SummaryGenerator;