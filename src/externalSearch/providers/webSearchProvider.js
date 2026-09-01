// ==========================================================
// Image Audit
// src/externalSearch/providers/webSearchProvider.js
// ==========================================================
//
// Бесплатный поиск внешних источников изображения.
//
// Использует DuckDuckGo HTML.
//
// ВАЖНО:
//
// Это НЕ полноценный reverse image search.
// Provider ищет:
// - имя файла;
// - имя файла без расширения;
// - URL изображения;
//
// Затем проверяет найденные страницы.
//
// ==========================================================

import axios from 'axios';
import * as cheerio from 'cheerio';


// ==========================================================
// НАСТРОЙКИ
// ==========================================================

// Максимальное количество результатов,
// которые берём из одного поискового запроса.

const MAX_RESULTS_PER_QUERY = 5;


// Таймаут самого поиска.

const SEARCH_TIMEOUT = 8000;


// Таймаут проверки найденной страницы.

const PAGE_TIMEOUT = 5000;


// Максимальное количество страниц,
// которые реально проверяем.

const MAX_PAGES_TO_INSPECT = 5;


// Количество повторных попыток.

const MAX_RETRIES = 1;


// User-Agent.

const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/139.0.0.0 Safari/537.36';


// ==========================================================
// СТАТИСТИКА
// ==========================================================
//
// Храним статистику внутри provider.
//
// Это позволяет не засорять консоль,
// но в конце получить краткую информацию.
//

let searchStatistics = {

    imagesChecked: 0,

    searchRequests: 0,

    timeouts: 0,

    errors: 0,

    pagesInspected: 0,

    matchesFound: 0
};


// ==========================================================
// СБРОС СТАТИСТИКИ
// ==========================================================

function resetStatistics() {

    searchStatistics = {

        imagesChecked: 0,

        searchRequests: 0,

        timeouts: 0,

        errors: 0,

        pagesInspected: 0,

        matchesFound: 0
    };
}


// ==========================================================
// ПОЛУЧЕНИЕ СТАТИСТИКИ
// ==========================================================

function getStatistics() {

    return {
        ...searchStatistics
    };
}


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

        return (
            parts[
                parts.length - 1
            ] || ''
        );

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
// ПРОВЕРКА TIMEOUT
// ==========================================================

function isTimeoutError(error) {

    return (
        error?.code === 'ECONNABORTED' ||
        error?.code === 'ETIMEDOUT' ||
        error?.message?.toLowerCase().includes(
            'timeout'
        )
    );
}


// ==========================================================
// ЗАПРОС С ПОВТОРОМ
// ==========================================================

async function requestWithRetry(
    url,
    config,
    retries = MAX_RETRIES
) {

    let lastError = null;


    for (
        let attempt = 0;
        attempt <= retries;
        attempt++
    ) {

        try {

            return await axios.get(
                url,
                config
            );

        } catch (error) {

            lastError = error;


            if (
                isTimeoutError(error)
            ) {

                searchStatistics.timeouts++;

            } else {

                searchStatistics.errors++;
            }


            // Если это была последняя попытка —
            // дальше не повторяем.

            if (
                attempt >= retries
            ) {

                break;
            }


            // Небольшая задержка перед повтором.

            await new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        500
                    )
            );
        }
    }


    throw lastError;
}


// ==========================================================
// ПОИСК ЧЕРЕЗ DUCKDUCKGO
// ==========================================================

async function searchDuckDuckGo(query) {

    const searchUrl =
        'https://html.duckduckgo.com/html/';


    searchStatistics.searchRequests++;


    try {

        const response =
            await requestWithRetry(

                searchUrl,

                {

                    params: {
                        q: query
                    },

                    timeout:
                        SEARCH_TIMEOUT,

                    maxRedirects: 3,

                    headers: {

                        'User-Agent':
                            USER_AGENT,

                        'Accept':
                            'text/html,application/xhtml+xml',

                        'Accept-Language':
                            'ru-RU,ru;q=0.9,en;q=0.8'
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


                // --------------------------------------------------
                // Получаем настоящий URL из redirect DuckDuckGo.
                // --------------------------------------------------

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


                if (
                    !resultUrl.startsWith(
                        'http://'
                    ) &&
                    !resultUrl.startsWith(
                        'https://'
                    )
                ) {

                    return;
                }


                results.push({

                    url:
                        resultUrl,

                    title,

                    snippet
                });
            }
        );


        return results;

    } catch {

        // Не выводим ошибку каждого timeout
        // в консоль.
        //
        // Статистика всё равно сохраняется.

        return [];
    }
}


// ==========================================================
// ПРОВЕРКА СТРАНИЦЫ
// ==========================================================
//
// Проверяем:
// - полный URL изображения;
// - URL без протокола;
// - имя файла.
//
// ==========================================================

async function inspectPage(
    pageUrl,
    imageUrl
) {

    searchStatistics.pagesInspected++;


    try {

        const response =
            await requestWithRetry(

                pageUrl,

                {

                    timeout:
                        PAGE_TIMEOUT,

                    maxRedirects: 3,

                    headers: {

                        'User-Agent':
                            USER_AGENT,

                        'Accept':
                            'text/html,application/xhtml+xml',

                        'Accept-Language':
                            'ru-RU,ru;q=0.9,en;q=0.8'
                    }
                }
            );


        const contentType =
            response.headers[
                'content-type'
            ] || '';


        // Нас интересуют только HTML-страницы.

        if (
            !contentType
                .toLowerCase()
                .includes(
                    'text/html'
                )
        ) {

            return false;
        }


        const html =
            String(
                response.data
            ).toLowerCase();


        // --------------------------------------------------
        // 1. Полный URL изображения.
        // --------------------------------------------------

        if (
            html.includes(
                imageUrl.toLowerCase()
            )
        ) {

            return true;
        }


        // --------------------------------------------------
        // 2. URL без protocol.
        // --------------------------------------------------

        try {

            const parsedImageUrl =
                new URL(imageUrl);


            const withoutProtocol =
                `${parsedImageUrl.host}${parsedImageUrl.pathname}`
                    .toLowerCase();


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
        // 3. Имя файла.
        // --------------------------------------------------

        const fileName =
            getFileName(
                imageUrl
            );


        if (
            fileName &&
            html.includes(
                fileName.toLowerCase()
            )
        ) {

            return true;
        }


        return false;

    } catch {

        // Ошибки отдельных страниц
        // не должны останавливать аудит.

        return false;
    }
}


// ==========================================================
// ПОЛУЧЕНИЕ HOSTNAME
// ==========================================================

function getHostname(url) {

    try {

        return new URL(url).hostname;

    } catch {

        return '';
    }
}


// ==========================================================
// УДАЛЕНИЕ WWW
// ==========================================================

function normalizeHostname(hostname) {

    return hostname
        .toLowerCase()
        .replace(
            /^www\./,
            ''
        );
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
            image?.imageUrl;


        if (!imageUrl) {

            return [];
        }


        searchStatistics.imagesChecked++;


        // --------------------------------------------------
        // Получаем имя файла.
        // --------------------------------------------------

        const fileName =
            getFileName(
                imageUrl
            );


        const fileNameWithoutExtension =
            removeExtension(
                fileName
            );


        // --------------------------------------------------
        // Формируем запросы.
        // --------------------------------------------------

        const queries = [];


        if (fileName) {

            queries.push(
                `"${fileName}"`
            );
        }


        if (
            fileNameWithoutExtension &&
            fileNameWithoutExtension !==
                fileName
        ) {

            queries.push(
                `"${fileNameWithoutExtension}"`
            );
        }


        // URL изображения используем
        // только если он достаточно информативный.
        //
        // Для localhost такой запрос почти бесполезен.

        let hostname =
            getHostname(
                imageUrl
            );


        hostname =
            normalizeHostname(
                hostname
            );


        if (
            hostname &&
            hostname !== 'localhost' &&
            hostname !== '127.0.0.1'
        ) {

            queries.push(
                `"${imageUrl}"`
            );
        }


        // --------------------------------------------------
        // Удаляем дубликаты.
        // --------------------------------------------------

        const uniqueQueries =
            [
                ...new Set(
                    queries
                )
            ];


        if (
            uniqueQueries.length === 0
        ) {

            return [];
        }


        // --------------------------------------------------
        // Выполняем поиск.
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

        const seenUrls =
            new Set();


        const uniqueResults =
            allResults.filter(
                result => {

                    if (
                        !result.url
                    ) {

                        return false;
                    }


                    const normalizedUrl =
                        result.url
                            .trim()
                            .toLowerCase();


                    if (
                        seenUrls.has(
                            normalizedUrl
                        )
                    ) {

                        return false;
                    }


                    seenUrls.add(
                        normalizedUrl
                    );


                    return true;
                }
            );


        // --------------------------------------------------
        // Исключаем собственный сайт.
        // --------------------------------------------------

        const sourceHost =
            normalizeHostname(
                getHostname(
                    imageUrl
                )
            );


        const externalResults =
            uniqueResults.filter(
                result => {

                    const resultHost =
                        normalizeHostname(
                            getHostname(
                                result.url
                            )
                        );


                    if (
                        !resultHost
                    ) {

                        return false;
                    }


                    return (
                        resultHost !==
                        sourceHost
                    );
                }
            );


        // --------------------------------------------------
        // Проверяем найденные страницы.
        // --------------------------------------------------

        const matches = [];


        const pagesToInspect =
            externalResults.slice(
                0,
                Math.min(
                    this.maxResults,
                    MAX_PAGES_TO_INSPECT
                )
            );


        for (
            const result
            of pagesToInspect
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


        searchStatistics.matchesFound +=
            matches.length;


        return matches;
    }


    // ======================================================
    // GET STATISTICS
    // ======================================================

    getStatistics() {

        return getStatistics();
    }


    // ======================================================
    // RESET STATISTICS
    // ======================================================

    resetStatistics() {

        resetStatistics();
    }
}