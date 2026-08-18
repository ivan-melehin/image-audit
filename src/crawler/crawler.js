import axios from 'axios';
import * as cheerio from 'cheerio';

export async function crawl(startUrl) {
    const visited = new Set();
    const pages = [];

    const start = new URL(startUrl);
    const baseHost = start.host;

    async function visit(url) {
        if (visited.has(url)) {
            return;
        }

        visited.add(url);

        console.log(`Crawling: ${url}`);

        try {
            const response = await axios.get(url);

            pages.push(url);

            const $ = cheerio.load(response.data);

            const links = [];

            $('a[href]').each((index, element) => {
                const href = $(element).attr('href');

                if (!href) {
                    return;
                }

                try {
                    const link = new URL(href, url);

                    link.hash = '';

                    if (link.host !== baseHost) {
                        return;
                    }

                    if (
                        link.protocol !== 'http:' &&
                        link.protocol !== 'https:'
                    ) {
                        return;
                    }

                    links.push(link.href);

                } catch {
                    console.log(`Invalid URL: ${href}`);
                }
            });

            for (const link of links) {
                await visit(link);
            }

        } catch (error) {
            console.error(`Failed: ${url}`);
            console.error(error.message);
        }
    }

    await visit(startUrl);

console.log(`\nВсего найдено страниц: ${pages.length}`);

return pages;
}