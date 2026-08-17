import { crawl } from './crawler/crawler.js';

const startUrl = 'http://localhost:3000';

const pages = await crawl(startUrl);

console.log('\nFound pages:');

for (const page of pages) {
    console.log(page);
}