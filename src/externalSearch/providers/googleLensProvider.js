// ==========================================================
// Image Audit
// src/externalSearch/providers/googleLensProvider.js
// ==========================================================
//
// Google Lens Provider.
//
// Основной режим:
//
// image.imageUrl
//      ↓
// Playwright
//      ↓
// Google Lens uploadbyurl
//      ↓
// страница результатов
//      ↓
// извлечение внешних страниц
//      ↓
// externalMatches
//
// Резервный режим:
//
// image.imageUrl
//      ↓
// скачивание изображения
//      ↓
// Playwright file upload
//      ↓
// Google Lens
//
// ==========================================================

import axios from 'axios';
import * as cheerio from 'cheerio';
import { chromium } from 'playwright';

import { ReverseSearchProvider } from '../reverseSearchProvider.js';


// ==========================================================
// НАСТРОЙКИ
// ==========================================================

const IMAGE_DOWNLOAD_TIMEOUT = 15000;

const BROWSER_TIMEOUT = 45000;

const MAX_FILE_SIZE =
    20 * 1024 * 1024;

const MAX_RESULTS = 20;

const REQUEST_DELAY = 1500;

const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/139.0.0.0 Safari/537.36';


// ==========================================================
// СТАТИСТИКА
// ==========================================================

const statistics = {

    imagesChecked: 0,

    imagesDownloaded: 0,

    browserSessions: 0,

    browserPages: 0,

    uploadRequests: 0,

    successfulRequests: 0,

    resultsPages: 0,

    candidatesFound: 0,

    candidatesRejected: 0,

    matchesFound: 0,

    errors: 0,

    timeouts: 0

};


// ==========================================================
// SLEEP
// ==========================================================

function sleep(ms) {

    return new Promise(
        resolve =>
            setTimeout(resolve, ms)
    );
}


// ==========================================================
// MIME TYPE
// ==========================================================

function getMimeType(fileName) {

    const name =
        String(fileName || '')
            .toLowerCase();

    if (
        name.endsWith('.jpg') ||
        name.endsWith('.jpeg')
    ) {

        return 'image/jpeg';
    }

    if (
        name.endsWith('.png')
    ) {

        return 'image/png';
    }

    if (
        name.endsWith('.webp')
    ) {

        return 'image/webp';
    }

    if (
        name.endsWith('.gif')
    ) {

        return 'image/gif';
    }

    if (
        name.endsWith('.bmp')
    ) {

        return 'image/bmp';
    }

    return 'application/octet-stream';
}


// ==========================================================
// FILE NAME
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
            parts[parts.length - 1] ||
            'image.jpg'
        );

    } catch {

        return 'image.jpg';
    }
}


// ==========================================================
// DOWNLOAD IMAGE
// ==========================================================
//
// Используется только резервным способом.
// ==========================================================

async function downloadImage(imageUrl) {

    console.log(
        `    ↓ Скачивание изображения: ${imageUrl}`
    );

    const response =
        await axios.get(

            imageUrl,

            {

                responseType:
                    'arraybuffer',

                timeout:
                    IMAGE_DOWNLOAD_TIMEOUT,

                maxRedirects:
                    5,

                headers: {

                    'User-Agent':
                        USER_AGENT,

                    'Accept':
                        'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',

                    'Accept-Language':
                        'ru-RU,ru;q=0.9,en;q=0.8'

                }

            }
        );


    const buffer =
        Buffer.from(
            response.data
        );


    if (
        buffer.length === 0
    ) {

        throw new Error(
            'Изображение пустое'
        );
    }


    if (
        buffer.length >
        MAX_FILE_SIZE
    ) {

        throw new Error(
            `Изображение слишком большое: ${buffer.length} bytes`
        );
    }


    const fileName =
        getFileName(
            imageUrl
        );


    const contentType =
        response.headers?.[
            'content-type'
        ];


    const mimeType =
        contentType &&
        contentType.includes('/')
            ? contentType.split(';')[0]
            : getMimeType(fileName);


    statistics.imagesDownloaded++;


    console.log(
        `    ✓ Изображение скачано: ${buffer.length} bytes`
    );


    return {

        buffer,

        fileName,

        mimeType

    };
}


// ==========================================================
// NORMALIZE URL
// ==========================================================

function normalizeUrl(
    url,
    baseUrl = 'https://www.google.com/'
) {

    if (!url) {

        return null;
    }


    try {

        const parsed =
            new URL(
                url,
                baseUrl
            );


        if (
            parsed.protocol !== 'http:' &&
            parsed.protocol !== 'https:'
        ) {

            return null;
        }


        return parsed.toString();

    } catch {

        return null;
    }
}


// ==========================================================
// HOSTNAME
// ==========================================================

function getHostname(url) {

    try {

        return new URL(url).hostname
            .toLowerCase()
            .replace(/^www\./, '');

    } catch {

        return '';
    }
}


// ==========================================================
// GOOGLE HOST CHECK
// ==========================================================

function isGoogleHost(hostname) {

    if (!hostname) {

        return true;
    }


    return (

        hostname === 'google.com' ||

        hostname.endsWith('.google.com') ||

        hostname === 'googleusercontent.com' ||

        hostname.endsWith('.googleusercontent.com') ||

        hostname === 'gstatic.com' ||

        hostname.endsWith('.gstatic.com') ||

        hostname === 'googleapis.com' ||

        hostname.endsWith('.googleapis.com')

    );
}


// ==========================================================
// GOOGLE SERVICE URL
// ==========================================================

function isGoogleServiceUrl(url) {

    const hostname =
        getHostname(url);


    if (
        !hostname
    ) {

        return true;
    }


    return isGoogleHost(
        hostname
    );
}


// ==========================================================
// EXTRACT TITLE
// ==========================================================

function extractTitle(
    $,
    element
) {

    const candidates = [

        $(element)
            .find('h3')
            .first()
            .text(),

        $(element)
            .find('[role="heading"]')
            .first()
            .text(),

        $(element)
            .find('div')
            .first()
            .text()

    ];


    for (
        const candidate
        of candidates
    ) {

        const title =
            String(candidate || '')
                .replace(/\s+/g, ' ')
                .trim();


        if (
            title.length >= 3 &&
            title.length <= 300
        ) {

            return title;
        }
    }


    return 'Google Lens result';
}


// ==========================================================
// EXTRACT EXTERNAL LINKS
// ==========================================================
//
// Google Lens меняет DOM.
// Поэтому используем несколько стратегий:
//
// 1. обычные <a href>
// 2. ссылки с текстом
// 3. data-* атрибуты
// 4. URL в HTML
//
// ==========================================================

function extractExternalLinks(
    html,
    pageUrl,
    sourceImageUrl
) {

    const $ =
        cheerio.load(
            html
        );


    const candidates = [];


    // ------------------------------------------------------
    // 1. обычные ссылки
    // ------------------------------------------------------

    $('a[href]').each(
        (index, element) => {

            const href =
                $(element)
                    .attr('href');


            if (!href) {

                return;
            }


            candidates.push({

                url:
                    href,

                title:
                    extractTitle(
                        $,
                        element
                    )

            });

        }
    );


    // ------------------------------------------------------
    // 2. data-href
    // ------------------------------------------------------

    $('[data-href]').each(
        (index, element) => {

            const href =
                $(element)
                    .attr('data-href');


            if (!href) {

                return;
            }


            candidates.push({

                url:
                    href,

                title:
                    extractTitle(
                        $,
                        element
                    )

            });

        }
    );


    // ------------------------------------------------------
    // 3. data-url
    // ------------------------------------------------------

    $('[data-url]').each(
        (index, element) => {

            const href =
                $(element)
                    .attr('data-url');


            if (!href) {

                return;
            }


            candidates.push({

                url:
                    href,

                title:
                    extractTitle(
                        $,
                        element
                    )

            });

        }
    );


    // ------------------------------------------------------
    // 4. URL внутри HTML
    // ------------------------------------------------------

    const urlMatches =
        html.match(
            /https?:\/\/[^\s"'<>\\]+/gi
        ) || [];


    for (
        const url
        of urlMatches
    ) {

        candidates.push({

            url,

            title:
                'Google Lens result'

        });

    }


    // ------------------------------------------------------
    // Нормализация
    // ------------------------------------------------------

    const results = [];

    const seen = new Set();


    for (
        const candidate
        of candidates
    ) {

        const url =
            normalizeUrl(
                candidate.url,
                pageUrl
            );


        if (!url) {

            statistics.candidatesRejected++;

            continue;
        }


        const hostname =
            getHostname(url);


        // Google / сервисные URL
        if (
            isGoogleServiceUrl(url)
        ) {

            statistics.candidatesRejected++;

            console.log(
                `      × Google/service: ${url}`
            );

            continue;
        }


        // --------------------------------------------------
        // Не возвращаем сам localhost.
        // --------------------------------------------------

        const sourceHost =
            getHostname(
                sourceImageUrl
            );


        if (
            sourceHost &&
            hostname === sourceHost
        ) {

            statistics.candidatesRejected++;

            console.log(
                `      × Source site: ${url}`
            );

            continue;
        }


        // --------------------------------------------------
        // Удаляем дубли.
        // --------------------------------------------------

        const key =
            url
                .split('#')[0]
                .trim()
                .toLowerCase();


        if (
            seen.has(key)
        ) {

            statistics.candidatesRejected++;

            continue;
        }


        seen.add(key);


        results.push({

            url:
                url.split('#')[0],

            title:
                candidate.title ||
                'Google Lens result'

        });


        if (
            results.length >=
            MAX_RESULTS
        ) {

            break;
        }
    }


    statistics.candidatesFound +=
        candidates.length;


    return results;
}


// ==========================================================
// WAIT FOR LENS RESULTS
// ==========================================================

async function waitForLensResults(
    page
) {

    console.log(
        '    ↓ Ожидание результатов Google Lens...'
    );


    try {

        await page.waitForLoadState(
            'domcontentloaded',
            {
                timeout:
                    BROWSER_TIMEOUT
            }
        );

    } catch {

        // Продолжаем.
    }


    // Даём Lens время построить динамический DOM.

    await page.waitForTimeout(
        5000
    );


    const selectors = [

        'a[href*="http"]',

        'a',

        '[data-href]',

        '[data-url]'

    ];


    for (
        const selector
        of selectors
    ) {

        try {

            const count =
                await page.locator(
                    selector
                ).count();


            if (
                count > 3
            ) {

                console.log(
                    `    ✓ DOM готов: ${selector}, элементов: ${count}`
                );

                return;

            }

        } catch {

            // Следующий selector.
        }
    }


    console.log(
        '    ⚠ Не удалось определить готовность DOM по селекторам'
    );
}


// ==========================================================
// SEARCH BY URL
// ==========================================================
//
// Google официально поддерживает поиск изображения
// по URL.
//
// https://lens.google.com/uploadbyurl?url=...
//
// ==========================================================

async function searchByUrl(
    page,
    imageUrl
) {

    const lensUrl =
        'https://lens.google.com/uploadbyurl' +
        '?url=' +
        encodeURIComponent(
            imageUrl
        ) +
        '&hl=ru';


    console.log(
        '    ↓ Google Lens: поиск по URL изображения'
    );


    console.log(
        `      ${lensUrl}`
    );


    statistics.uploadRequests++;


    await page.goto(
        lensUrl,
        {
            waitUntil:
                'domcontentloaded',

            timeout:
                BROWSER_TIMEOUT
        }
    );


    statistics.successfulRequests++;


    console.log(
        `    ✓ Browser URL: ${page.url()}`
    );


    await waitForLensResults(
        page
    );


    return page.content();
}


// ==========================================================
// UPLOAD FILE
// ==========================================================
//
// Резервный способ.
//
// Playwright напрямую устанавливает файл
// в input[type=file].
//
// ==========================================================

async function searchByFile(
    page,
    imageData
) {

    console.log(
        '    ↓ Google Lens: загрузка файла через Playwright'
    );


    await page.goto(
        'https://lens.google.com/',
        {
            waitUntil:
                'domcontentloaded',

            timeout:
                BROWSER_TIMEOUT
        }
    );


    statistics.uploadRequests++;


    const fileInput =
        page.locator(
            'input[type="file"]'
        ).first();


    await fileInput.waitFor(
        {
            state: 'attached',
            timeout: 15000
        }
    );


    await fileInput.setInputFiles({

        name:
            imageData.fileName,

        mimeType:
            imageData.mimeType,

        buffer:
            imageData.buffer

    });


    console.log(
        '    ✓ Файл передан в input[type=file]'
    );


    await page.waitForTimeout(
        1000
    );


    try {

        await page.waitForLoadState(
            'domcontentloaded',
            {
                timeout:
                    BROWSER_TIMEOUT
            }
        );

    } catch {

        // Продолжаем.
    }


    await waitForLensResults(
        page
    );


    statistics.successfulRequests++;


    console.log(
        `    ✓ Browser URL: ${page.url()}`
    );


    return page.content();
}


// ==========================================================
// MAIN PROVIDER
// ==========================================================

export class GoogleLensProvider
    extends ReverseSearchProvider {

    constructor(
        options = {}
    ) {

        super(
            options.name ||
            'google-lens'
        );


        this.maxResults =
            options.maxResults ||
            MAX_RESULTS;


        this.requestDelay =
            options.requestDelay ??
            REQUEST_DELAY;


        this.headless =
            options.headless ??
            true;


        this.mode =
            options.mode ||
            'url';


        this.fallbackToFile =
            options.fallbackToFile ??
            true;
    }


    // ======================================================
    // SEARCH
    // ======================================================

    async search(
        image
    ) {

        const imageUrl =
            image?.imageUrl;


        if (
            !imageUrl
        ) {

            return [];
        }


        if (
            image.isSmallTechnical
        ) {

            return [];
        }


        statistics.imagesChecked++;


        console.log('');
        console.log(
            `  Google Lens: ${imageUrl}`
        );


        let browser = null;
        let context = null;


        try {

            // ------------------------------------------------
            // Задержка между запросами.
            // ------------------------------------------------

            if (
                this.requestDelay > 0
            ) {

                await sleep(
                    this.requestDelay
                );
            }


            // ------------------------------------------------
            // Запускаем Chromium.
            // ------------------------------------------------

            console.log(
                '    ↓ Запуск Chromium через Playwright'
            );


            browser =
                await chromium.launch({

                    headless:
                        this.headless,

                    args: [

                        '--disable-blink-features=AutomationControlled',

                        '--no-sandbox',

                        '--disable-dev-shm-usage'

                    ]

                });


            statistics.browserSessions++;


            context =
                await browser.newContext({

                    userAgent:
                        USER_AGENT,

                    locale:
                        'ru-RU',

                    viewport: {

                        width:
                            1440,

                        height:
                            1000

                    }

                });


            const page =
                await context.newPage();


            statistics.browserPages++;


            page.setDefaultTimeout(
                BROWSER_TIMEOUT
            );


            console.log(
                '    ✓ Chromium запущен'
            );


            // ------------------------------------------------
            // Логируем переходы.
            // ------------------------------------------------

            page.on(
                'framenavigated',
                frame => {

                    if (
                        frame ===
                        page.mainFrame()
                    ) {

                        console.log(
                            `      → ${frame.url()}`
                        );
                    }

                }
            );


            // ------------------------------------------------
            // Основной режим: URL.
            // ------------------------------------------------

            let html = '';


            if (
                this.mode === 'url'
            ) {

                try {

                    html =
                        await searchByUrl(
                            page,
                            imageUrl
                        );

                } catch (error) {

                    console.log(
                        `    ⚠ Поиск по URL не сработал: ${error.message}`
                    );


                    if (
                        !this.fallbackToFile
                    ) {

                        throw error;
                    }


                    console.log(
                        '    ↓ Переходим к резервной загрузке файла'
                    );


                    const imageData =
                        await downloadImage(
                            imageUrl
                        );


                    html =
                        await searchByFile(
                            page,
                            imageData
                        );
                }

            } else {

                // ------------------------------------------------
                // Режим file.
                // ------------------------------------------------

                const imageData =
                    await downloadImage(
                        imageUrl
                    );


                html =
                    await searchByFile(
                        page,
                        imageData
                    );
            }


            // ------------------------------------------------
            // Проверяем результат.
            // ------------------------------------------------

            statistics.resultsPages++;


            console.log(
                `    ✓ Получена страница Lens: ${html.length} символов`
            );


            console.log(
                `    ✓ Финальный URL: ${page.url()}`
            );


            // ------------------------------------------------
            // Проверяем блокировку.
            // ------------------------------------------------

            const lowerHtml =
                html.toLowerCase();


            if (

                lowerHtml.includes(
                    'unusual traffic'
                ) ||

                lowerHtml.includes(
                    'captcha'
                ) ||

                (
                    lowerHtml.includes(
                        'automated'
                    ) &&
                    lowerHtml.includes(
                        'sorry'
                    )
                )

            ) {

                console.log(
                    '    ⚠ Google, вероятно, заблокировал автоматический запрос'
                );


                return [];
            }


            // ------------------------------------------------
            // Извлекаем внешние ссылки.
            // ------------------------------------------------

            const links =
                extractExternalLinks(

                    html,

                    page.url(),

                    imageUrl

                );


            console.log(
                `    ✓ Реальных внешних кандидатов: ${links.length}`
            );


            if (
                links.length === 0
            ) {

                console.log(
                    '    — Google Lens не вернул внешних URL'
                );


                return [];
            }


            // ------------------------------------------------
            // Формируем externalMatches.
            // ------------------------------------------------

            const matches =
                links
                    .slice(
                        0,
                        this.maxResults
                    )
                    .map(
                        result => ({

                            sourceUrl:
                                imageUrl,

                            pageUrl:
                                result.url,

                            title:
                                result.title ||
                                'Google Lens result',

                            similarity:
                                null,

                            provider:
                                this.name,

                            foundAt:
                                new Date()
                                    .toISOString()

                        })
                    );


            statistics.matchesFound +=
                matches.length;


            console.log(
                `    ✓ Внешних совпадений: ${matches.length}`
            );


            return matches;

        } catch (error) {

            statistics.errors++;


            if (
                error?.message
                    ?.toLowerCase()
                    .includes(
                        'timeout'
                    )
            ) {

                statistics.timeouts++;
            }


            console.log(
                `    ✗ Google Lens error: ${error.message}`
            );


            return [];

        } finally {

            // ------------------------------------------------
            // Закрываем browser.
            // ------------------------------------------------

            try {

                if (context) {

                    await context.close();
                }

            } catch {

                // Ничего.
            }


            try {

                if (browser) {

                    await browser.close();

                    console.log(
                        '    ✓ Chromium закрыт'
                    );
                }

            } catch {

                // Ничего.
            }

        }
    }


    // ======================================================
    // GET STATISTICS
    // ======================================================

    getStatistics() {

        return {
            ...statistics
        };
    }


    // ======================================================
    // RESET STATISTICS
    // ======================================================

    resetStatistics() {

        statistics.imagesChecked = 0;

        statistics.imagesDownloaded = 0;

        statistics.browserSessions = 0;

        statistics.browserPages = 0;

        statistics.uploadRequests = 0;

        statistics.successfulRequests = 0;

        statistics.resultsPages = 0;

        statistics.candidatesFound = 0;

        statistics.candidatesRejected = 0;

        statistics.matchesFound = 0;

        statistics.errors = 0;

        statistics.timeouts = 0;
    }
}