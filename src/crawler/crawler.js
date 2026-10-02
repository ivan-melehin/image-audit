import axios from 'axios';
import * as cheerio from 'cheerio';

// Обходит сайт и возвращает только уникальные HTML-страницы.
export async function crawl(startUrl) {
    const visited = new Set();
    const pages = [];
    const start = new URL(startUrl);
    const baseHost = start.host;

    // Приводит разные варианты одной страницы к одному URL.
    function normalizeUrl(value) {
        const url = new URL(value);
        url.hash = '';

        // /index.html и / считаем одной страницей.
        if (url.pathname.endsWith('/index.html')) {
            url.pathname = url.pathname.replace(/index\.html$/, '');
        }

        // Для пустого пути сохраняем /.
        if (!url.pathname) {
            url.pathname = '/';
        }

        return url.href;
    }

    // Проверяет, является ли ответ HTML-страницей.
    function isHtmlResponse(response) {
        const contentType = response.headers['content-type'] || '';
        return contentType.toLowerCase().includes('text/html');
    }

    async function visit(url) {
        const normalizedUrl = normalizeUrl(url);

        // Не обрабатываем одну страницу повторно.
        if (visited.has(normalizedUrl)) {
            return;
        }

        visited.add(normalizedUrl);

        try {
            const response = await axios.get(normalizedUrl, {
                maxRedirects: 5,
                timeout: 15000,
                validateStatus: status => status >= 200 && status < 400
            });

            // Игнорируем всё, что не является HTML.
            if (!isHtmlResponse(response)) {
                return;
            }

            // Добавляем только уникальную HTML-страницу.
            if (!pages.includes(normalizedUrl)) {
                pages.push(normalizedUrl);
            }

            const $ = cheerio.load(response.data);
            const links = new Set();

            $('a[href]').each((index, element) => {
                const href = $(element).attr('href');

                if (!href) {
                    return;
                }

                try {
                    // Строим URL относительно текущей страницы.
                    const link = new URL(href, normalizedUrl);
                    link.hash = '';

                    // Игнорируем внешние сайты.
                    if (link.host !== baseHost) {
                        return;
                    }

                    // Оставляем только HTTP и HTTPS.
                    if (
                        link.protocol !== 'http:' &&
                        link.protocol !== 'https:'
                    ) {
                        return;
                    }

                    // Нормализуем ссылку перед добавлением.
                    const normalizedLink = normalizeUrl(link.href);

                    // Не добавляем уже посещённые страницы.
                    if (!visited.has(normalizedLink)) {
                        links.add(normalizedLink);
                    }
                } catch {
                    console.log(`Invalid URL: ${href}`);
                }
            });

            // Переходим по найденным внутренним ссылкам.
            for (const link of links) {
                await visit(link);
            }
        } catch (error) {
            console.error(`Failed: ${normalizedUrl}`);
            console.error(error.message);
        }
    }

    await visit(startUrl);

    console.log(`Всего найдено HTML-страниц: ${pages.length}`);

    return pages;
}