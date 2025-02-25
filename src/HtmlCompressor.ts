

import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import fs from 'fs';
import path from 'path';
import { HtmlCompressorOptions, IHtmlCompressor } from './types.js';

export class HtmlCompressor implements IHtmlCompressor {
  private config: HtmlCompressorOptions;

  constructor(config: HtmlCompressorOptions = {}) {
    
    this.config = {
      
      removeElements: [
        'script', 'style', 'noscript', 'iframe', 'svg', 'path',
        'canvas', 'video', 'audio', 'source', 'track', 'map', 'area',
        'footer', 'aside', 'nav', 'header'
      ],

      preserveAttributes: [
        'id', 'class', 'href', 'src', 'alt', 'title', 'name', 
        'value', 'type', 'placeholder', 'aria-label', 'for',
        'data-testid', 'data-id'
      ],

      preserveElements: [
        'a', 'button', 'input', 'select', 'option', 'textarea',
        'form', 'table', 'tr', 'td', 'th', 'thead', 'tbody',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'ul', 'ol',
        'label', 'img', 'main', 'article', 'section', 'div'
      ],

      removeEmptyElements: true,

      collapseWhitespace: true,

      removeComments: true,

      maxDepth: 0,

      preserveTextContent: true,

      removeRedundantAttributes: true,

      shortenDataAttributes: true,

      minifyUrls: false,

      removeHiddenElements: true,

      removeCustomElements: false,

      shortenClassNames: false,

      shortenIds: false,

      ignoreElements: [],

      whitelistedClasses: [],

      whitelistedIds: [],

      ...config
    };
  }

  compress(html: string, overrideConfig: HtmlCompressorOptions = {}): string {
    if (!html) {
      return '';
    }

    const config = { ...this.config, ...overrideConfig };
    
    try {
      
      const $ = cheerio.load(html, { xmlMode: false });

      if (config.removeComments) {
        $('*').contents().each((_, elem) => {
          if (elem.type === 'comment') {
            $(elem).remove();
          }
        });
      }

      if (config.removeElements && config.removeElements.length > 0) {
        const selector = config.removeElements.join(',');
        $(selector).remove();
      }

      if (config.removeHiddenElements) {
        $('[style*="display:none"], [style*="display: none"], [style*="visibility:hidden"], [style*="visibility: hidden"], [hidden], .hidden, .invisible').remove();
      }

      if (config.removeCustomElements) {
        $('*').each((_, elem) => {
          const el = elem as Element;
          const tagName = el.name;
          if (tagName && tagName.includes('-')) {
            $(elem).remove();
          }
        });
      }

      $('*').each((_, elem) => {
        const $elem = $(elem);
        const el = elem as Element;
        const tagName = el.name;

        if (config.ignoreElements?.includes(tagName)) {
          return;
        }

        const shouldPreserve = config.preserveElements?.includes(tagName);

        if (el.attribs) {
          for (const attrName of Object.keys(el.attribs)) {
            const attrValue = el.attribs[attrName];

            if (config.preserveAttributes?.includes(attrName)) {
              continue;
            }

            if (attrName === 'class' && config.whitelistedClasses && config.whitelistedClasses.length > 0) {
              const classes = attrValue.split(/\s+/);
              const hasWhitelistedClass = classes.some((c: string) => 
                config.whitelistedClasses?.includes(c)
              );
              if (hasWhitelistedClass) {
                continue;
              }
            }

            if (attrName === 'id' && config.whitelistedIds?.includes(attrValue)) {
              continue;
            }

            $elem.removeAttr(attrName);
          }
        }

        if (config.removeEmptyElements && !shouldPreserve) {
          const text = $elem.text().trim();
          const hasChildren = $elem.children().length > 0;
          
          if (!text && !hasChildren) {
            $elem.remove();
          }
        }
      });

      let result = $.html();

      if (config.collapseWhitespace) {
        
        result = result.replace(/>\s+</g, '><');
        result = result.replace(/\s{2,}/g, ' ');
      }
      
      return result;
    } catch (error) {
      console.error('Error compressing HTML:', error);
      return html; 
    }
  }

  compressFile(filePath: string, overrideConfig: HtmlCompressorOptions = {}): string {
    try {
      const html = fs.readFileSync(filePath, 'utf8');
      return this.compress(html, overrideConfig);
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      return '';
    }
  }

  compressAndSave(html: string, outputPath: string, overrideConfig: HtmlCompressorOptions = {}): boolean {
    try {
      const compressed = this.compress(html, overrideConfig);

      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(outputPath, compressed);
      return true;
    } catch (error) {
      console.error(`Error saving to ${outputPath}:`, error);
      return false;
    }
  }

  compressFileAndSave(inputPath: string, outputPath: string, overrideConfig: HtmlCompressorOptions = {}): boolean {
    try {
      const compressed = this.compressFile(inputPath, overrideConfig);
      if (!compressed) return false;
      
      return this.compressAndSave(compressed, outputPath, overrideConfig);
    } catch (error) {
      console.error(`Error compressing file ${inputPath}:`, error);
      return false;
    }
  }

  getCompressionStats(original: string, compressed: string): { 
    originalSize: number;
    compressedSize: number;
    savings: number;
    savingsPercent: number;
  } {
    const originalSize = original.length;
    const compressedSize = compressed.length;
    const savings = originalSize - compressedSize;
    const savingsPercent = (savings / originalSize) * 100;
    
    return {
      originalSize,
      compressedSize,
      savings,
      savingsPercent
    };
  }
}

export const htmlCompressor = new HtmlCompressor(); 