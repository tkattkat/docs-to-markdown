import { analyzeUrl } from '../DocsToMarkdown.js';
import dotenv from 'dotenv';

dotenv.config();

async function runExample() {
  try {
    console.log('Starting library documentation analysis...');

    const result = await analyzeUrl('https://docs.stagehand.dev/get_started/introduction', {
      maxPages: 20,  
      skipCache: true,
    });
    
    if (result.success) {
      console.log('Analysis completed successfully!');
      console.log(`Analyzed ${result.pagesAnalyzed} pages`);
      console.log(`Used ${result.tokenUsage?.total} tokens`);
      console.log(`Reference saved to: ${result.outputs?.referencePath}`);

      if (result.reference) {
        console.log('\nPreview of the generated reference:');
        console.log('-'.repeat(50));
        console.log(result.reference.substring(0, 500) + '...');
        console.log('-'.repeat(50));
      }
    } else {
      console.error('Analysis failed:', result.error);
    }
  } catch (error) {
    console.error('Error during example execution:', error);
  }
}

console.log('FastLibraryDocAnalyzer Example');
console.log('==============================');

runExample().then(() => {
  console.log('Example completed.');
}).catch(err => {
  console.error('Unhandled error:', err);
}); 