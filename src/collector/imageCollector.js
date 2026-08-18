import axios from 'axios';
import * as cheerio from 'cheerio';

export async function collectImages(pages) {
    const images = [];

    for (const pageUrl of pages) {
        console.log(`Collecting images: ${pageUrl}`);

        try {
            const response = await axios.get(pageUrl, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Image-Audit/1.0'
                }
            });

            const $ = cheerio.load(response.data);

            $('img').each((index, element) => {
                const src = $(element).attr('src');

                if (!src) {
                    return;
                }

                try {
                    const imageUrl = new URL(src, pageUrl).href;

                    images.push({
                        pageUrl,
                        imageUrl,
                        alt: $(element).attr('alt') || '',
                        title: $(element).attr('title') || '',
                        source: 'img'
                    });

                } catch {
                    console.log(`Invalid image URL: ${src}`);
                }
            });

        } catch (error) {
            console.error(
                `Failed to collect images from ${pageUrl}: ${error.message}`
            );
        }
    }

    return images;
}