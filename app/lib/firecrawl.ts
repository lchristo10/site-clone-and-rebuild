import FirecrawlApp from '@mendable/firecrawl-js';

let client: FirecrawlApp | null = null;

function getClient(): FirecrawlApp {
  if (!client) {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey || apiKey === 'your_firecrawl_api_key_here') {
      throw new Error('FIRECRAWL_API_KEY is not configured in .env.local');
    }
    client = new FirecrawlApp({ apiKey });
  }
  return client;
}

export interface ExtractResult {
  markdown: string;
  html: string;
  screenshotUrl: string;
  meta: {
    title?: string;
    description?: string;
    ogImage?: string;
    language?: string;
  };
}

export async function extractPage(url: string): Promise<ExtractResult> {
  const fc = getClient();

  const doc = await fc.scrape(url, {
    formats: ['markdown', 'html', 'screenshot'],
    waitFor: 2000,
  });

  if (!doc) {
    throw new Error(`Firecrawl scrape returned empty result for ${url}`);
  }

  return {
    markdown: doc.markdown || '',
    html: doc.html || '',
    screenshotUrl: doc.screenshot || '',
    meta: {
      title: doc.metadata?.title,
      description: doc.metadata?.description,
      ogImage: doc.metadata?.ogImage,
      language: doc.metadata?.language || 'en',
    },
  };
}
