import { crawl } from './crawler/crawler.js';

const startUrl = 'https://ivan-melehin.github.io/image-audit-test-site/';

const pages = await crawl(startUrl);

console.log('\nFound pages:');

for (const page of pages) {
    console.log(page);
}