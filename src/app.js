// ==========================================================
// Image Audit
// src/app.js
// ==========================================================
//
// Главный файл проекта.
//
// Порядок работы:
//
// 1. Crawler
//      ↓
// 2. Image Collector
//      ↓
// 3. Image Validator
//      ↓
// 4. Hash Engine
//      ↓
// 5. Metadata Analyzer
//      ↓
// 6. Duplicate Matcher
//      ↓
// 7. Обогащение Duplicate Groups метаданными
//      ↓
// 8. SQLite
//      ↓
// 9. Reverse Search
//      ↓
// 10. Risk Engine
//      ↓
// 11. Итоговый Excel-отчёт
//
// ==========================================================


// ==========================================================
// ИМПОРТЫ
// ==========================================================


// ----------------------------------------------------------
// Crawler
// ----------------------------------------------------------
//
// Обходит сайт и находит страницы.

import { crawl } from './crawler/crawler.js';


// ----------------------------------------------------------
// Image Collector
// ----------------------------------------------------------
//
// Находит изображения на найденных страницах.

import { collectImages } from './collector/imageCollector.js';


// ----------------------------------------------------------
// Image Validator
// ----------------------------------------------------------
//
// Проверяет:
//
// - HTTP status
// - Content-Type
// - размер
// - доступность
// - технические изображения

import { validateImages } from './analyzer/imageValidator.js';


// ----------------------------------------------------------
// Hash Engine
// ----------------------------------------------------------
//
// Рассчитывает:
//
// - SHA-256
// - perceptual hash

import { hashImages } from './hash/hashEngine.js';


// ----------------------------------------------------------
// Metadata Analyzer
// ----------------------------------------------------------
//
// Анализирует метаданные изображения
// через ExifTool.

import { analyzeMetadata } from './metadata/metadataAnalyzer.js';


// ----------------------------------------------------------
// getUniqueImages
// ----------------------------------------------------------
//
// Убирает повторяющиеся изображения
// по SHA-256 перед Metadata Analyzer.
//
// Это позволяет не запускать ExifTool
// несколько раз для одного и того же файла.

import { getUniqueImages } from './utils/getUniqueImages.js';


// ----------------------------------------------------------
// Duplicate Matcher
// ----------------------------------------------------------
//
// Ищет:
//
// - exact duplicates по SHA-256
// - similar images по pHash
//
// Также импортируем функцию,
// которая связывает найденные группы
// с результатами Metadata Analyzer.

import {
    findDuplicates,
    enrichDuplicateGroupsWithMetadata
} from './matcher/duplicateMatcher.js';


// ----------------------------------------------------------
// SQLite
// ----------------------------------------------------------
//
// Сохраняет найденные группы дубликатов
// в базу данных.

import { saveDuplicateGroups } from './database/database.js';


// ----------------------------------------------------------
// Reverse Search
// ----------------------------------------------------------
//
// Поиск изображения во внешних источниках.

import { reverseSearch } from './externalSearch/reverseSearch.js';


// ----------------------------------------------------------
// Reverse Search Provider
// ----------------------------------------------------------
//
// Текущий провайдер внешнего поиска.

import { WebSearchProvider } from './externalSearch/providers/webSearchProvider.js';


// ----------------------------------------------------------
// Risk Engine
// ----------------------------------------------------------
//
// Рассчитывает условный Risk Score.

import { calculateRisks } from './risk/riskEngine.js';


// ----------------------------------------------------------
// Excel Report
// ----------------------------------------------------------
//
// Создаёт единый Excel-отчёт.

import { createAuditReport } from './reports/auditReport.js';


// ==========================================================
// НАСТРОЙКИ
// ==========================================================


// ----------------------------------------------------------
// Similarity Threshold
// ----------------------------------------------------------
//
// Максимальное расстояние между двумя pHash,
// при котором изображения считаются похожими.
//
// 5  → очень строго
// 10 → стандартный вариант
// 15 → более мягкое сравнение
// 20 → ещё более мягкое

const SIMILARITY_THRESHOLD = 10;


// ----------------------------------------------------------
// Сайт для проверки
// ----------------------------------------------------------

const startUrl = 'http://localhost:3000/';


// Другие варианты:
// http://localhost:3000/
// https://ivanmelekhin.ru/
// https://parentslike.ru/
// https://loginom.ru/


// ----------------------------------------------------------
// Ограничение размера изображения
// ----------------------------------------------------------
//
// Изображения больше 1 MB
// попадают в категорию больших.

const largeImageLimit =
    1024 * 1024;


// ==========================================================
// REVERSE SEARCH PROVIDERS
// ==========================================================
//
// Используем бесплатный WebSearchProvider.
//
// В дальнейшем сюда можно добавить
// другие providers.
//
// ==========================================================

const reverseSearchProviders = [

    new WebSearchProvider({

        name: 'web-search',

        maxResults: 10
    })
];


// ==========================================================
// НАЧАЛО АУДИТА
// ==========================================================

const startTime =
    Date.now();


console.log('\n==========================================');
console.log('           IMAGE AUDIT STARTED');
console.log('==========================================');


// ==========================================================
// ЭТАП 1. CRAWLER
// ==========================================================

console.log(
    '\n[1/11] Сканирование сайта...'
);


// Запускаем crawler.

const pages =
    await crawl(startUrl);


// Показываем количество страниц.

console.log(
    `Найдено страниц: ${pages.length}`
);


// ==========================================================
// ЭТАП 2. IMAGE COLLECTOR
// ==========================================================

console.log(
    '\n[2/11] Поиск изображений...'
);


// Находим изображения
// на найденных страницах.

const images =
    await collectImages(pages);


console.log(
    `Найдено изображений: ${images.length}`
);


// ==========================================================
// ЭТАП 3. IMAGE VALIDATOR
// ==========================================================

console.log(
    '\n[3/11] Проверка изображений...'
);


// Проверяем доступность изображений.

const validatedImages =
    await validateImages(images);


console.log(
    `Проверено изображений: ${validatedImages.length}`
);


// ==========================================================
// ЭТАП 4. HASH ENGINE
// ==========================================================

console.log(
    '\n[4/11] Расчёт SHA-256 и perceptual hash...'
);


// Рассчитываем SHA-256 и pHash.

const hashedImages =
    await hashImages(validatedImages);


// Считаем количество изображений,
// для которых получен SHA-256.

const sha256Count =
    hashedImages.filter(
        image => image.sha256 !== null
    ).length;


console.log(
    `SHA-256 рассчитан для ${sha256Count} изображений`
);


// ==========================================================
// ЭТАП 5. UNIQUE IMAGES
// ==========================================================
//
// Перед Metadata Analyzer оставляем
// только один экземпляр каждого SHA-256.
//
// Например:
//
// page1 → test.jpg → SHA ABC
// page2 → test.jpg → SHA ABC
// page3 → test.jpg → SHA ABC
//
// Для ExifTool:
//
// test.jpg → один раз
//
// При этом hashedImages продолжает содержать
// ВСЕ экземпляры.
//
// ==========================================================

console.log(
    '\n[5/11] Подготовка уникальных изображений для Metadata...'
);


const uniqueImages =
    getUniqueImages(hashedImages);


console.log(
    `Уникальных изображений для Metadata Analyzer: ${uniqueImages.length}`
);


// ==========================================================
// ЭТАП 6. METADATA ANALYZER
// ==========================================================

console.log(
    '\n[6/11] Анализ метаданных через ExifTool...'
);


// Запускаем Metadata Analyzer.
//
// Важно:
//
// Здесь используется uniqueImages,
// а не hashedImages.
//
// Поэтому один и тот же файл
// не анализируется несколько раз.

const metadataImages =
    await analyzeMetadata(uniqueImages);


// ==========================================================
// СТАТИСТИКА METADATA
// ==========================================================

const imagesWithMetadata =
    metadataImages.filter(

        image =>
            image.author ||
            image.creator ||
            image.copyright ||
            image.rights ||
            image.webStatement ||
            image.licensorURL ||
            image.copyrightNotice ||
            image.credit ||
            image.byLine ||
            image.assetID ||
            image.imageDescription ||
            image.description ||
            image.dateTimeOriginal

    );


console.log(
    `Изображений с метаданными: ${imagesWithMetadata.length}`
);


// ==========================================================
// ЭТАП 7. DUPLICATE MATCHER
// ==========================================================
//
// Здесь впервые используем ВСЕ hashedImages.
//
// Это важно.
//
// Metadata Analyzer работал только
// с уникальными файлами.
//
// Duplicate Matcher должен видеть
// все вхождения.
//
// Например:
//
// page1 → test.jpg
// page2 → test.jpg
// page3 → test.jpg
//
// Все три записи должны попасть
// в одну Duplicate Group.
//
// ==========================================================

console.log(
    '\n[7/11] Поиск дубликатов и похожих изображений...'
);


const duplicateGroups =
    findDuplicates(
        hashedImages,
        SIMILARITY_THRESHOLD
    );


// ==========================================================
// ОБОГАЩЕНИЕ DUPLICATE GROUPS METADATA
// ==========================================================
//
// Теперь объединяем:
//
// duplicateGroups
// +
// metadataImages
//
// Например:
//
// Group #1:
//
// image A → metadata нет
// image B → metadata есть
// image C → metadata нет
//
// Результат:
//
// representative → image B
// metadata       → image B
//
// При этом:
//
// image A
// image B
// image C
//
// остаются внутри group.images.
//
// ==========================================================

console.log(
    '\nСвязывание дубликатов с метаданными...'
);


const enrichedDuplicateGroups =
    enrichDuplicateGroupsWithMetadata(
        duplicateGroups,
        metadataImages
    );


// ==========================================================
// СТАТИСТИКА DUPLICATE GROUPS
// ==========================================================

const exactGroups =
    enrichedDuplicateGroups.filter(
        group => group.type === 'exact'
    );


const similarGroups =
    enrichedDuplicateGroups.filter(
        group => group.type === 'similar'
    );


const groupsWithMetadata =
    enrichedDuplicateGroups.filter(
        group => group.metadata !== null
    );


console.log(
    `Exact groups: ${exactGroups.length}`
);


console.log(
    `Similar groups: ${similarGroups.length}`
);


console.log(
    `Групп с найденными метаданными: ${groupsWithMetadata.length}`
);


// ==========================================================
// DUPLICATE GROUPS
// ==========================================================

console.log(
    '\nDuplicate groups:'
);


if (enrichedDuplicateGroups.length === 0) {

    console.log(
        'Дубликатов и похожих изображений не найдено.'
    );

} else {

    for (
        const group
        of enrichedDuplicateGroups
    ) {

        console.log(
            `\nGroup #${group.id}`
        );


        console.log(
            `Type: ${group.type}`
        );


        if (
            group.type === 'exact'
        ) {

            console.log(
                `SHA-256: ${group.sha256}`
            );
        }


        if (
            group.type === 'similar'
        ) {

            console.log(
                `Threshold: ${group.threshold}`
            );
        }


        // --------------------------------------------------
        // Representative
        // --------------------------------------------------

        if (group.representative) {

            console.log(
                `Representative: ${group.representative.imageUrl}`
            );

        } else {

            console.log(
                'Representative: —'
            );
        }


        // --------------------------------------------------
        // Metadata
        // --------------------------------------------------

        if (group.metadata) {

            console.log(
                `Metadata Author: ${group.metadata.author || '—'}`
            );


            console.log(
                `Metadata Copyright: ${group.metadata.copyright || '—'}`
            );

        } else {

            console.log(
                'Metadata: —'
            );
        }


        // --------------------------------------------------
        // Все изображения группы
        // --------------------------------------------------

        console.log(
            'Images:'
        );


        for (
            const image
            of group.images
        ) {

            console.log(
                `  ${image.imageUrl}`
            );


            console.log(
                `  Page: ${image.pageUrl || '—'}`
            );
        }
    }
}


// ==========================================================
// ЭТАП 8. SQLITE
// ==========================================================
//
// В SQLite теперь передаём уже обогащённые группы.
//
// То есть база получает:
//
// - все изображения группы
// - metadata
// - representative
// - SHA-256
// - тип группы
// - threshold
//
// ==========================================================

console.log(
    '\n[8/11] Сохранение групп в базу данных...'
);


saveDuplicateGroups(
    enrichedDuplicateGroups
);


console.log(
    `В базу данных сохранено групп: ${enrichedDuplicateGroups.length}`
);


// ==========================================================
// ЭТАП 9. REVERSE SEARCH
// ==========================================================
//
// Reverse Search запускается ПОСЛЕ Duplicate Matcher.
//
// Это важно.
//
// Мы НЕ отправляем во внешний поиск
// каждый экземпляр одного и того же изображения.
//
// Вместо этого:
//
// Duplicate Group
//        ↓
// representative
//        ↓
// Reverse Search
//
// ==========================================================


// ----------------------------------------------------------
// Подготавливаем изображения для Reverse Search
// ----------------------------------------------------------
//
// Нам нужны только representative.
//
// Если representative отсутствует,
// значит для группы нет подходящего
// экземпляра с metadata.
//
// Такие группы пока пропускаем.
//
// ----------------------------------------------------------

const representativeImages =
    enrichedDuplicateGroups

        .filter(
            group =>
                group.representative !== null &&
                group.representative !== undefined
        )

        .map(
            group =>
                group.representative
        );


// ----------------------------------------------------------
// Добавляем изображения, которые
// вообще не входят в Duplicate Group.
//
// ----------------------------------------------------------
//
// Это важно.
//
// Reverse Search должен проверять
// не только дубликаты.
//
// Например:
//
// image A → единственный экземпляр
// image B → единственный экземпляр
// image C → Duplicate Group
//
// A и B тоже должны попасть
// во внешний поиск.
//
// Поэтому сначала собираем SHA-256
// изображений, которые уже представлены
// representative.
//
// ----------------------------------------------------------

const representativeSha256 =
    new Set(

        representativeImages
            .map(
                image => image.sha256
            )
            .filter(Boolean)

    );


// ----------------------------------------------------------
// Находим уникальные изображения,
// которые не являются representative
// существующих групп.
//
// ----------------------------------------------------------

const standaloneImages =
    metadataImages.filter(

        image => {

            if (!image.sha256) {
                return true;
            }


            return !representativeSha256.has(
                image.sha256
            );
        }
    );


// ----------------------------------------------------------
// Финальный набор для Reverse Search.
//
// representative + standalone
// ----------------------------------------------------------

const reverseSearchImages = [

    ...representativeImages,

    ...standaloneImages

];


// ==========================================================
// Запускаем Reverse Search
// ==========================================================

console.log(
    '\n[9/11] Поиск внешних совпадений...'
);


const imagesWithExternalMatches =
    await reverseSearch(
        reverseSearchImages,
        reverseSearchProviders
    );


// ==========================================================
// СТАТИСТИКА EXTERNAL SEARCH
// ==========================================================

const externalMatchesCount =
    imagesWithExternalMatches.reduce(

        (total, image) =>

            total +

            (
                Array.isArray(
                    image.externalMatches
                )
                    ? image.externalMatches.length
                    : 0
            ),

        0
    );


console.log(
    `Проверено изображений во внешнем поиске: ${imagesWithExternalMatches.length}`
);


console.log(
    `Найдено внешних совпадений: ${externalMatchesCount}`
);


// ==========================================================
// ВНЕШНИЕ СОВПАДЕНИЯ
// ==========================================================

if (
    externalMatchesCount > 0
) {

    console.log(
        '\nВнешние совпадения:'
    );


    for (
        const image
        of imagesWithExternalMatches
    ) {

        if (
            !Array.isArray(
                image.externalMatches
            ) ||
            image.externalMatches.length === 0
        ) {

            continue;
        }


        console.log(
            `\nИзображение: ${image.imageUrl}`
        );


        for (
            const match
            of image.externalMatches
        ) {

            console.log(
                `  Source URL: ${match.sourceUrl || '—'}`
            );


            console.log(
                `  Page URL: ${match.pageUrl || '—'}`
            );


            console.log(
                `  Title: ${match.title || '—'}`
            );


            console.log(
                `  Similarity: ${
                    match.similarity !== null &&
                    match.similarity !== undefined
                        ? match.similarity
                        : '—'
                }`
            );


            console.log(
                `  Provider: ${match.provider || '—'}`
            );


            console.log(
                `  Found At: ${match.foundAt || '—'}`
            );
        }
    }

} else {

    console.log(
        'Внешних совпадений не найдено.'
    );
}


// ==========================================================
// ЭТАП 10. RISK ENGINE
// ==========================================================
//
// Risk Engine получает:
//
// - результаты Reverse Search
// - Duplicate Groups
//
// ==========================================================

console.log(
    '\n[10/11] Расчёт Risk Score...'
);


const riskImages =
    calculateRisks(
        imagesWithExternalMatches,
        enrichedDuplicateGroups
    );


console.log(
    `Risk Score рассчитан для ${riskImages.length} изображений`
);


// ==========================================================
// СТАТИСТИКА RISK ENGINE
// ==========================================================

const riskCounts = {

    LOW: 0,

    MEDIUM: 0,

    HIGH: 0,

    CRITICAL: 0
};


for (
    const image
    of riskImages
) {

    if (
        riskCounts[image.riskLevel] !== undefined
    ) {

        riskCounts[
            image.riskLevel
        ]++;
    }
}


console.log(
    '\nRisk Score:'
);


console.log(
    `LOW: ${riskCounts.LOW}`
);


console.log(
    `MEDIUM: ${riskCounts.MEDIUM}`
);


console.log(
    `HIGH: ${riskCounts.HIGH}`
);


console.log(
    `CRITICAL: ${riskCounts.CRITICAL}`
);


// ==========================================================
// СТАТИСТИКА HTTP
// ==========================================================

const statusCounts = {};


for (
    const image
    of validatedImages
) {

    const status =
        image.status;


    if (
        !statusCounts[status]
    ) {

        statusCounts[status] = 0;
    }


    statusCounts[status]++;
}


// ==========================================================
// МАЛЕНЬКИЕ ИЗОБРАЖЕНИЯ
// ==========================================================

const smallImages =
    validatedImages.filter(
        image =>
            image.isSmallTechnical === true
    );


// ==========================================================
// БОЛЬШИЕ ИЗОБРАЖЕНИЯ
// ==========================================================

const largeImages =
    validatedImages.filter(

        image =>

            typeof image.fileSize === 'number' &&

            image.fileSize > largeImageLimit

    );


// ==========================================================
// НЕДОСТУПНЫЕ ИЗОБРАЖЕНИЯ
// ==========================================================

const unavailableImages =
    validatedImages.filter(
        image =>
            image.available === false
    );


// ==========================================================
// ВРЕМЯ ВЫПОЛНЕНИЯ
// ==========================================================

const endTime =
    Date.now();


const elapsedTime =
    endTime - startTime;


const hours =
    Math.floor(
        elapsedTime / 3600000
    );


const minutes =
    Math.floor(
        (elapsedTime % 3600000) / 60000
    );


const seconds =
    Math.floor(
        (elapsedTime % 60000) / 1000
    );


const elapsedTimeFormatted =
    `${hours} ч. ${minutes} мин. ${seconds} сек.`;


// ==========================================================
// ИТОГОВАЯ СТАТИСТИКА
// ==========================================================

console.log('\n');
console.log('==========================================');
console.log('              ИТОГОВЫЙ ОТЧЁТ');
console.log('==========================================');


console.log(
    '\nОбщая статистика:'
);


console.log(
    `Всего найдено страниц: ${pages.length}`
);


console.log(
    `Всего найдено изображений: ${images.length}`
);


console.log(
    `Всего проверено изображений: ${validatedImages.length}`
);


console.log(
    `Уникальных изображений: ${uniqueImages.length}`
);


// ==========================================================
// HTTP
// ==========================================================

console.log(
    '\nHTTP-статусы:'
);


const statuses =
    Object.keys(statusCounts)
        .sort(
            (a, b) =>
                Number(a) - Number(b)
        );


for (
    const status
    of statuses
) {

    console.log(
        `Статус ${status} — ${statusCounts[status]}`
    );
}


// ==========================================================
// МАЛЕНЬКИЕ ИЗОБРАЖЕНИЯ
// ==========================================================

console.log(
    '\nМаленькие изображения:'
);


console.log(
    `Всего найдено маленьких изображений: ${smallImages.length}`
);


// ==========================================================
// БОЛЬШИЕ ИЗОБРАЖЕНИЯ
// ==========================================================

console.log(
    '\nБольшие изображения:'
);


console.log(
    `Всего найдено больших изображений: ${largeImages.length}`
);


// ==========================================================
// НЕДОСТУПНЫЕ
// ==========================================================

console.log(
    '\nНедоступные изображения:'
);


console.log(
    `Всего найдено недоступных изображений: ${unavailableImages.length}`
);


// ==========================================================
// HASH
// ==========================================================

console.log(
    '\nХеширование:'
);


console.log(
    `SHA-256 рассчитан для ${sha256Count} изображений`
);


// ==========================================================
// DUPLICATES
// ==========================================================

console.log(
    '\nДубликаты:'
);


console.log(
    `Exact groups: ${exactGroups.length}`
);


console.log(
    `Similar groups: ${similarGroups.length}`
);


console.log(
    `Всего групп: ${enrichedDuplicateGroups.length}`
);


console.log(
    `Групп с metadata: ${groupsWithMetadata.length}`
);


// ==========================================================
// METADATA
// ==========================================================

console.log(
    '\nМетаданные:'
);


console.log(
    `Уникальных изображений проверено ExifTool: ${metadataImages.length}`
);


console.log(
    `Изображений с метаданными: ${imagesWithMetadata.length}`
);


// ==========================================================
// EXTERNAL SEARCH
// ==========================================================

console.log(
    '\nВнешний поиск:'
);


console.log(
    `Изображений отправлено во внешний поиск: ${imagesWithExternalMatches.length}`
);


console.log(
    `Внешних совпадений найдено: ${externalMatchesCount}`
);


if (
    externalMatchesCount > 0
) {

    const imagesWithMatches =
        imagesWithExternalMatches.filter(

            image =>

                Array.isArray(
                    image.externalMatches
                ) &&

                image.externalMatches.length > 0

        );


    console.log(
        `Изображений с внешними совпадениями: ${imagesWithMatches.length}`
    );
}


// ==========================================================
// RISK
// ==========================================================

console.log(
    '\nОценка риска:'
);


console.log(
    `Изображений с Risk Score: ${riskImages.length}`
);


console.log(
    `LOW: ${riskCounts.LOW}`
);


console.log(
    `MEDIUM: ${riskCounts.MEDIUM}`
);


console.log(
    `HIGH: ${riskCounts.HIGH}`
);


console.log(
    `CRITICAL: ${riskCounts.CRITICAL}`
);


// ==========================================================
// ВРЕМЯ
// ==========================================================

console.log(
    '\nВремя выполнения:'
);


console.log(
    elapsedTimeFormatted
);


// ==========================================================
// ЭТАП 11. EXCEL
// ==========================================================
//
// Создаём единый Excel-отчёт.
//
// В отчёт передаём:
//
// - pages
// - images
// - validatedImages
// - uniqueImages
// - metadataImages
// - enrichedDuplicateGroups
// - imagesWithExternalMatches
// - riskImages
// - largeImages
// - elapsedTime
//
// ==========================================================

console.log(
    '\n[11/11] Создание единого Excel-отчёта...'
);


const auditReportPath =
    createAuditReport({

        startUrl,

        pages,

        images,

        validatedImages,

        uniqueImages,

        metadataImages,

        duplicateGroups:
            enrichedDuplicateGroups,

        imagesWithExternalMatches,

        riskImages,

        largeImages,

        elapsedTime:
            elapsedTimeFormatted
    });


console.log(
    '\nЕдиный Excel-отчёт создан:'
);


console.log(
    auditReportPath
);


// ==========================================================
// ЗАВЕРШЕНИЕ
// ==========================================================

console.log('\n==========================================');
console.log('             АУДИТ ЗАВЕРШЁН');
console.log('==========================================');