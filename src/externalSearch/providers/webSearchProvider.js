// ==========================================================
// Image Audit
// src/externalSearch/providers/webSearchProvider.js
// ==========================================================
//
// Бесплатный поиск внешних источников изображения.
//
// ВАЖНО:
// Этот provider не использует TinEye и платные API.
//
// Алгоритм:
//
// 1. Берём URL изображения.
// 2. Формируем поисковые запросы:
//      - имя файла
//      - URL изображения
//      - имя файла без расширения
// 3. Выполняем обычный веб-поиск через DuckDuckGo HTML.
// 4. Получаем найденные страницы.
// 5. Возвращаем найденные URL.
//
// Это не полноценный reverse image search уровня TinEye.
// Это бесплатный поиск внешних упоминаний/страниц.
//
// ==========================================================

import axios from 'axios';
import * as cheerio from 'cheerio';


// ==========================================================
// НАСТРОЙКИ
// ==========================================================

// Максимальное количество результатов
// для одного поискового запроса.

const MAX_RESULTS_PER_QUERY = 10;


// Таймаут HTTP-запроса.

const REQUEST_TIMEOUT = 15000;


// User-Agent.

const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/139.0.0.0 Safari/537.36';


// ==========================================================
// ПОЛУЧЕНИЕ ИМЕНИ ФАЙЛА
// ==========================================================

function getFileName(imageUrl) {

    try {

        const url =
            new URL(imageUrl);

        const pathname =
            decodeURIComponent(
                url.pathname
            );

        const parts =
            pathname.split('/');

        return parts[
            parts.length - 1
        ] || '';

    } catch {

        return '';
    }
}


// ==========================================================
// УДАЛЕНИЕ РАСШИРЕНИЯ
// ==========================================================

function removeExtension(fileName) {

    return fileName.replace(
        /\.[^.]+$/,
        ''
    );
}


// ==========================================================
// НОРМАЛИЗАЦИЯ ТЕКСТА
// ==========================================================

function normalizeText(text) {

    return String(text || '')
        .replace(/\s+/g, ' ')
        .trim();
}


// ==========================================================
// ПОИСК ЧЕРЕЗ DUCKDUCKGO HTML
// ==========================================================

async function searchDuckDuckGo(query) {

    const searchUrl =
        'https://html.duckduckgo.com/html/';


    try {

        const response =
            await axios.get(
                searchUrl,
                {
                    params: {
                        q: query
                    },

                    timeout:
                        REQUEST_TIMEOUT,

                    headers: {
                        'User-Agent':
                            USER_AGENT,

                        'Accept':
                            'text/html,application/xhtml+xml'
                    }
                }
            );


        const $ =
            cheerio.load(
                response.data
            );


        const results = [];


        $('div.result').each(
            (index, element) => {

                if (
                    index >=
                    MAX_RESULTS_PER_QUERY
                ) {

                    return false;
                }


                const result =
                    $(element);


                const link =
                    result.find(
                        'a.result__a'
                    );


                const href =
                    link.attr('href');


                if (!href) {

                    return;
                }


                const title =
                    normalizeText(
                        link.text()
                    );


                const snippet =
                    normalizeText(
                        result.find(
                            '.result__snippet'
                        ).text()
                    );


                let resultUrl =
                    href;


                // DuckDuckGo может возвращать
                // redirect URL.
                //
                // Пытаемся получить настоящий URL.

                try {

                    const parsed =
                        new URL(
                            href,
                            searchUrl
                        );


                    const uddg =
                        parsed.searchParams.get(
                            'uddg'
                        );


                    if (uddg) {

                        resultUrl =
                            decodeURIComponent(
                                uddg
                            );
                    }

                } catch {

                    // Оставляем исходный URL.
                }


                results.push({

                    url: resultUrl,

                    title,

                    snippet
                });
            }
        );


        return results;

    } catch (error) {

        console.log(
            `Web Search error: ${error.message}`
        );


        return [];
    }
}


// ==========================================================
// ПРОВЕРКА СТРАНИЦЫ
// ==========================================================
//
// После поиска страницы открываем найденную страницу
// и проверяем, встречается ли там URL нашего изображения.
//
// Это позволяет отфильтровать часть ложных результатов.
//
// ==========================================================

async function inspectPage(
    pageUrl,
    imageUrl
) {

    try {

        const response =
            await axios.get(
                pageUrl,
                {
                    timeout:
                        REQUEST_TIMEOUT,

                    maxRedirects: 5,

                    headers: {
                        'User-Agent':
                            USER_AGENT,

                        'Accept':
                            'text/html,application/xhtml+xml'
                    }
                }
            );


        const contentType =
            response.headers[
                'content-type'
            ] || '';


        // Нас интересуют HTML-страницы.

        if (
            !contentType.includes(
                'text/html'
            )
        ) {

            return false;
        }


        const html =
            String(
                response.data
            );


        // --------------------------------------------------
        // Проверяем прямое вхождение URL изображения.
        // --------------------------------------------------

        if (
            html.includes(imageUrl)
        ) {

            return true;
        }


        // --------------------------------------------------
        // Проверяем URL без protocol.
        //
        // Например:
        //
        // http://site.com/img/test.jpg
        //
        // превращается в:
        //
        // site.com/img/test.jpg
        // --------------------------------------------------

        try {

            const parsedImageUrl =
                new URL(imageUrl);


            const withoutProtocol =
                `${parsedImageUrl.host}${parsedImageUrl.pathname}`;


            if (
                html.includes(
                    withoutProtocol
                )
            ) {

                return true;
            }

        } catch {

            // Ничего не делаем.
        }


        // --------------------------------------------------
        // Проверяем имя файла.
        // --------------------------------------------------

        const fileName =
            getFileName(imageUrl);


        if (
            fileName &&
            html.includes(fileName)
        ) {

            return true;
        }


        return false;

    } catch {

        return false;
    }
}


// ==========================================================
// ПРОВЕРКА ДОМЕНА
// ==========================================================

function getHostname(url) {

    try {

        return new URL(url).hostname;

    } catch {

        return '';
    }
}


// ==========================================================
// ОСНОВНОЙ PROVIDER
// ==========================================================

export class WebSearchProvider {

    constructor(options = {}) {

        this.name =
            options.name ||
            'web-search';

        this.maxResults =
            options.maxResults ||
            MAX_RESULTS_PER_QUERY;
    }


    // ======================================================
    // SEARCH
    // ======================================================

    async search(image) {

        const imageUrl =
            image.imageUrl;


        if (!imageUrl) {

            return [];
        }


        console.log(
            `External Search [web]: ${imageUrl}`
        );


        // --------------------------------------------------
        // Получаем имя файла.
        // --------------------------------------------------

        const fileName =
            getFileName(imageUrl);


        const fileNameWithoutExtension =
            removeExtension(
                fileName
            );


        // --------------------------------------------------
        // Формируем поисковые запросы.
        // --------------------------------------------------

        const queries = [];


        if (fileName) {

            queries.push(
                `"${fileName}"`
            );
        }


        if (
            fileNameWithoutExtension &&
            fileNameWithoutExtension !== fileName
        ) {

            queries.push(
                `"${fileNameWithoutExtension}"`
            );
        }


        // URL изображения.

        queries.push(
            `"${imageUrl}"`
        );


        // --------------------------------------------------
        // Удаляем дубликаты запросов.
        // --------------------------------------------------

        const uniqueQueries =
            [...new Set(queries)];


        // --------------------------------------------------
        // Все результаты поиска.
        // --------------------------------------------------

        const allResults = [];


        for (
            const query
            of uniqueQueries
        ) {

            const results =
                await searchDuckDuckGo(
                    query
                );


            allResults.push(
                ...results
            );
        }


        // --------------------------------------------------
        // Удаляем одинаковые URL.
        // --------------------------------------------------

        const uniqueResults =
            [];


        const seenUrls =
            new Set();


        for (
            const result
            of allResults
        ) {

            if (
                !result.url ||
                seenUrls.has(result.url)
            ) {

                continue;
            }


            seenUrls.add(
                result.url
            );


            uniqueResults.push(
                result
            );
        }


        // --------------------------------------------------
        // Исключаем исходный сайт.
        // --------------------------------------------------

        const sourceHost =
            getHostname(
                imageUrl
            );


        const externalResults =
            uniqueResults.filter(
                result => {

                    const resultHost =
                        getHostname(
                            result.url
                        );


                    return (
                        resultHost &&
                        resultHost !==
                        sourceHost
                    );
                }
            );


        // --------------------------------------------------
        // Проверяем страницы.
        // --------------------------------------------------

        const matches = [];


        for (
            const result
            of externalResults.slice(
                0,
                this.maxResults
            )
        ) {

            const containsImage =
                await inspectPage(
                    result.url,
                    imageUrl
                );


            if (!containsImage) {

                continue;
            }


            matches.push({

                sourceUrl:
                    imageUrl,

                pageUrl:
                    result.url,

                title:
                    result.title ||
                    'Без названия',

                similarity:
                    null,

                provider:
                    this.name,

                foundAt:
                    new Date().toISOString()
            });
        }


        return matches;
    }
}

