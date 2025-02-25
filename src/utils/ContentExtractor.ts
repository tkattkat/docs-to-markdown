

import * as cheerio from 'cheerio';
import { URL } from 'url';
import { CodeExample, APISignature } from '../types.js';
import type { Element } from 'domhandler';

export class ContentExtractor {
  
  extractTitle(html: string): string {
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    return titleMatch ? titleMatch[1].trim() : 'Untitled Page';
  }

  extractRelevantLinks(
    html: string, 
    baseUrl: string, 
    libraryName: string, 
    singleLanguageVersion = true
  ): string[] {
    const $ = cheerio.load(html);
    const links = new Set<string>();
    const baseUrlObj = new URL(baseUrl);
    const libraryNameLower = libraryName.toLowerCase();

    let baseLangCode: string | null = null;
    let baseVersion: string | null = null;
    
    if (singleLanguageVersion) {
      const basePathParts = baseUrlObj.pathname.split('/').filter(p => p);

      for (const part of basePathParts) {
        if (part.length === 2 && /^[a-z]{2}$/.test(part)) {
          baseLangCode = part;
          break;
        }
      }

      for (const part of basePathParts) {
        if (/^v?\d+\.?x?$|^v?\d+\.\d+$/.test(part)) {
          baseVersion = part;
          break;
        }
      }
      
      if (baseLangCode || baseVersion) {
        console.log(`Base URL language code: ${baseLangCode || 'none'}, version: ${baseVersion || 'none'}`);
      }
    }

    const apiKeywords = ['api', 'reference', 'doc', 'guide', 'example', 'tutorial'];
    
    $('a[href]').each((_, element) => {
      const href = $(element).attr('href');
      if (!href) return;
      
      try {
        
        const absoluteUrl = new URL(href, baseUrl).href;
        const urlObj = new URL(absoluteUrl);

        if (urlObj.hostname !== baseUrlObj.hostname) return;

        if (singleLanguageVersion) {
          const pathParts = urlObj.pathname.split('/').filter(p => p);

          if (baseLangCode) {
            for (const part of pathParts) {
              
              if (part.length === 2 && /^[a-z]{2}$/.test(part) && part !== baseLangCode) {
                return; 
              }
            }
          }

          if (baseVersion) {
            for (const part of pathParts) {
              
              if (/^v?\d+\.?x?$|^v?\d+\.\d+$/.test(part) && part !== baseVersion) {
                return; 
              }
            }
          }
        }

        const linkText = $(element).text().toLowerCase();
        const linkPath = urlObj.pathname.toLowerCase();

        const isRelevant = apiKeywords.some(keyword => 
          linkPath.includes(keyword) || linkText.includes(keyword)
        ) || linkPath.includes(libraryNameLower);
        
        if (isRelevant) {
          links.add(absoluteUrl);
        }
      } catch (error) {
        
      }
    });
    
    return Array.from(links);
  }

  extractCodeExamples(html: string): CodeExample[] {
    const $ = cheerio.load(html);
    const examples: CodeExample[] = [];

    $('pre code, pre, code, .highlight, .code-example, [class*="code"], [class*="example"]').each((_, element) => {
      const $elem = $(element);

      if ($elem.parents('pre, code').length > 0 && element.name !== 'pre' && element.name !== 'code') {
        return;
      }

      let code = $elem.text().trim();
      if (!code || code.length < 10) return; 

      let language = '';

      const className = $elem.attr('class') || '';
      const classMatch = className.match(/(language|lang|syntax)-(\w+)/i);
      if (classMatch) {
        language = classMatch[2];
      } else if (className.includes('js') || className.includes('javascript')) {
        language = 'javascript';
      } else if (className.includes('ts') || className.includes('typescript')) {
        language = 'typescript';
      }

      if (!language) {
        language = $elem.attr('data-language') || 
                  $elem.attr('data-lang') || 
                  $elem.attr('language') || 
                  $elem.attr('lang') || '';
      }

      let description = '';
      let $heading = $elem.prev('h1, h2, h3, h4, h5, h6, p');
      
      if ($heading.length > 0) {
        description = $heading.text().trim();
      } else {
        
        const $parent = $elem.parent();
        $heading = $parent.find('h1, h2, h3, h4, h5, h6').first();
        if ($heading.length > 0) {
          description = $heading.text().trim();
        }
      }
      
      examples.push({
        code,
        language: language.toLowerCase(),
        description
      });
    });
    
    return examples;
  }

  extractAPISignatures(html: string, libraryName: string): APISignature[] {
    const $ = cheerio.load(html);
    const signatures: APISignature[] = [];

    const cleanText = (text: string): string => text.replace(/\s+/g, ' ').trim();

    $('h1, h2, h3, h4, h5, h6').each((_, heading) => {
      const $heading = $(heading);
      const headingText = cleanText($heading.text());

      if (headingText.length > 100 || 
          headingText.toLowerCase().includes('introduction') ||
          headingText.toLowerCase().includes('getting started')) {
        return;
      }

      let signature = '';
      let description = '';

      const $code = $heading.nextAll('pre, code, .signature, .function-signature').first();
      if ($code.length > 0) {
        signature = cleanText($code.text());
      }

      const $desc = $heading.nextAll('p').first();
      if ($desc.length > 0) {
        description = cleanText($desc.text());
      }

      if (!signature && (
          headingText.includes('(') && headingText.includes(')') ||
          headingText.match(/^[\w\.]+(:|=|\()/))) {
        signature = headingText;
      }

      if (!signature) return;

      const $params = $heading.nextAll('.params, .parameters, [class*="param"]').first();
      let parameters: string[] = [];
      
      if ($params.length > 0) {
        $params.find('li, tr').each((_, param) => {
          parameters.push(cleanText($(param).text()));
        });
      }
      
      signatures.push({
        name: headingText,
        signature,
        description,
        parameters: parameters.length > 0 ? parameters : undefined
      });
    });
    
    return signatures;
  }

  filterAPIPages<T extends { url: string; title: string; apiSignatures?: APISignature[] }>(
    pages: T[]
  ): T[] {
    
    const apiKeywords = ['api', 'reference', 'method', 'function', 'class', 'interface'];
    
    return pages.filter(page => {
      
      const url = page.url.toLowerCase();
      const hasApiKeyword = apiKeywords.some(keyword => url.includes(keyword));

      const title = (page.title || '').toLowerCase();
      const titleHasApiKeyword = apiKeywords.some(keyword => title.includes(keyword));

      const hasApiSignatures = page.apiSignatures && page.apiSignatures.length > 0;
      
      return hasApiKeyword || titleHasApiKeyword || hasApiSignatures;
    });
  }

  extractKeyContentSections<T extends { markdownContent?: string; title: string; wasReduced?: boolean; tokenCount?: number }>(
    page: T
  ): T {
    
    const processedPage = { ...page };

    if (!processedPage.markdownContent) return processedPage;

    const sections = processedPage.markdownContent.split(/(?=^#{1,3} )/m);

    const apiKeywords = ['api', 'method', 'function', 'class', 'interface', 'parameter', 'return', 'example', 'usage'];
    const importantSections = sections.filter(section => {
      const sectionLower = section.toLowerCase();
      return apiKeywords.some(keyword => sectionLower.includes(keyword));
    });

    if (importantSections.length < 3 && sections.length > 3) {
      importantSections.push(...sections.slice(0, 3).filter(s => !importantSections.includes(s)));
    }

    processedPage.markdownContent = importantSections.join('\n\n');

    processedPage.markdownContent = 
      `> Note: This page was automatically reduced to focus on key content.\n\n${processedPage.markdownContent}`;

    processedPage.wasReduced = true;
    
    console.log(`Reduced page ${page.title} from ${page.tokenCount || 'unknown'} tokens.`);
    
    return processedPage;
  }
}

export const contentExtractor = new ContentExtractor();

export default contentExtractor; 