import { crawl } from './crawler/crawler.js';
import { collectImages } from './collector/imageCollector.js';

const startUrl = 'https://parentslike.ru/';

const pages = await crawl(startUrl);

console.log('\nFound pages:');

for (const page of pages) {
    console.log(page);
}

const images = await collectImages(pages);

console.log('\nFound images:');

for (const image of images) {
    console.log(image);
}