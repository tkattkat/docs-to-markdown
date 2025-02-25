

import TurndownService from 'turndown';

export class MarkdownConverter {
  private turndownService: TurndownService;

  constructor() {
    
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced'
    });

    this.turndownService.addRule('codeBlocks', {
      filter: ['pre', 'code'],
      replacement: function(content, node) {
        
        let language = '';
        if ((node as any).className) {
          const classMatch = (node as any).className.match(/(language|lang|syntax)-(\w+)/i);
          if (classMatch) {
            language = classMatch[2];
          }
        }
        return `\n\`\`\`${language}\n${content}\n\`\`\`\n`;
      }
    });
  }

  htmlToMarkdown(html: string): string {
    try {
      if (!html) return '';

      const markdown = this.turndownService.turndown(html);

      return markdown
        .replace(/\n{3,}/g, '\n\n')  
        .replace(/\s+$/gm, '')       
        .trim();
    } catch (error) {
      console.warn(`Failed to convert HTML to Markdown: ${error}`);
      
      return html.replace(/<[^>]*>/g, '').trim();
    }
  }
}

export const markdownConverter = new MarkdownConverter();

export default markdownConverter; 