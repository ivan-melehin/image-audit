// ==========================================================
// Image Audit
// src/app.js
// ==========================================================
//
// Основной pipeline:
//
// 1. Crawler
// 2. Image Collector
// 3. HTTP Validator
// 4. Hash Engine
// 5. Duplicate Matcher
// 6. Metadata Analyzer
// 7. Risk Engine
// 8. Excel Report
//
// Reverse Search:
// временно НЕ используется.
//
// SQLite:
// временно НЕ используется.
//
// ==========================================================


// ==========================================================
// ИМПОРТЫ
// ==========================================================

// 1. Crawler
import { crawl } from './crawler/crawler.js';

// 2. Image Collector
import { collectImages } from './collector/imageCollector.js';

// 3. HTTP Validator
import { validateImages } from './analyzer/imageValidator.js';

// 4. Hash Engine
import { hashImages } from './hash/hashEngine.js';

// 5. Duplicate Matcher
import {
    findDuplicates,
    enrichDuplicateGroupsWithMetadata
} from './matcher/duplicateMatcher.js';

// Убираем повторяющиеся физические файлы
// перед запуском ExifTool.
import { getUniqueImages } from './utils/getUniqueImages.js';

// 6. Metadata Analyzer
import { analyzeMetadata } from './metadata/metadataAnalyzer.js';

// 7. Risk Engine
import { calculateRisks } from './risk/riskEngine.js';

// 8. Excel Report
import { createAuditReport } from './reports/auditReport.js';


// ==========================================================
// НАСТРОЙКИ
// ==========================================================

// Адрес сайта для аудита.

const startUrl =
    'http://localhost:3000/';

// Другие варианты:
// https://ivanmelekhin.ru/
// https://parentslike.ru/
// https://loginom.ru/


// Максимальная дистанция pHash.
//
// Чем меньше значение,
// тем строже поиск похожих изображений.

const SIMILARITY_THRESHOLD = 10;


// Изображение больше этого размера
// считается большим.
//
// 1 MB.

const largeImageLimit =
    1024 * 1024;


// ==========================================================
// НАЧАЛО АУДИТА
// ==========================================================

const startTime =
    Date.now();


console.log('\n==========================================');
console.log('           IMAGE AUDIT STARTED');
console.log('==========================================');


// ==========================================================
// 1. CRAWLER
// ==========================================================

console.log('\n[1/8] Сканирование сайта...');


const pages =
    await crawl(startUrl);


console.log(
    `Найдено страниц: ${pages.length}`
);


// ==========================================================
// 2. IMAGE COLLECTOR
// ==========================================================

console.log('\n[2/8] Поиск изображений...');


const images =
    await collectImages(pages);


console.log(
    `Найдено изображений: ${images.length}`
);


// ==========================================================
// 3. HTTP VALIDATOR
// ==========================================================
//
// Проверяем:
//
// - доступность изображения;
// - HTTP-статус;
// - Content-Type;
// - размер файла;
// - технические изображения.
//
// ==========================================================

console.log(
    '\n[3/8] HTTP-проверка изображений...'
);


const validatedImages =
    await validateImages(images);


console.log(
    `Проверено изображений: ${validatedImages.length}`
);


// ==========================================================
// 4. HASH ENGINE
// ==========================================================
//
// Рассчитываем:
//
// - SHA-256 — точное совпадение файлов;
// - pHash — визуально похожие изображения.
//
// ==========================================================

console.log(
    '\n[4/8] Расчёт SHA-256 и perceptual hash...'
);


const hashedImages =
    await hashImages(validatedImages);


// Считаем количество изображений,
// для которых действительно рассчитан SHA-256.

const sha256Count =
    hashedImages.filter(
        image => Boolean(image.sha256)
    ).length;


console.log(
    `SHA-256 рассчитан для ${sha256Count} изображений`
);


// ==========================================================
// 5. DUPLICATE MATCHER
// ==========================================================
//
// Matcher получает ВСЕ hashedImages.
//
// Это важно:
//
// одно и то же изображение может встретиться
// на нескольких страницах.
//
// Exact:
// одинаковый SHA-256.
//
// Similar:
// близкий pHash.
//
// ==========================================================

console.log(
    '\n[5/8] Поиск дубликатов и похожих изображений...'
);


const duplicateGroups =
    findDuplicates(
        hashedImages,
        SIMILARITY_THRESHOLD
    );


// Разделяем группы для статистики.

const exactGroups =
    duplicateGroups.filter(
        group => group.type === 'exact'
    );


const similarGroups =
    duplicateGroups.filter(
        group => group.type === 'similar'
    );


console.log(
    `Точных групп дубликатов: ${exactGroups.length}`
);


console.log(
    `Групп похожих изображений: ${similarGroups.length}`
);


// ==========================================================
// 6. METADATA ANALYZER
// ==========================================================
//
// Metadata Analyzer получает только уникальные
// физические изображения.
//
// Это позволяет не запускать ExifTool
// несколько раз для одного файла.
//
// ==========================================================

console.log(
    '\n[6/8] Подготовка уникальных изображений...'
);


const uniqueImages =
    getUniqueImages(hashedImages);


console.log(
    `Уникальных изображений: ${uniqueImages.length}`
);


console.log(
    '\nАнализ метаданных через ExifTool...'
);


const metadataImages =
    await analyzeMetadata(uniqueImages);


// ==========================================================
// ОБОГАЩЕНИЕ ВСЕХ ИЗОБРАЖЕНИЙ METADATA
// ==========================================================
//
// Metadata Analyzer работает только с uniqueImages.
//
// Но итоговый отчёт должен содержать metadata
// для всех найденных экземпляров.
//
// Поэтому создаём индекс:
//
// SHA-256 → metadata
//
// ==========================================================

const metadataBySha =
    new Map(
        metadataImages
            .filter(
                image => Boolean(image.sha256)
            )
            .map(
                image => [
                    image.sha256,
                    image
                ]
            )
    );


// ==========================================================
// ДОБАВЛЯЕМ METADATA КО ВСЕМ ИЗОБРАЖЕНИЯМ
// ==========================================================

const imagesWithMetadata =
    hashedImages.map(image => {

        // Если SHA-256 есть,
        // пытаемся найти metadata.

        const metadata =
            image.sha256
                ? metadataBySha.get(image.sha256)
                : null;


        // Metadata для этого файла
        // не найдены.

        if (!metadata) {

            return {
                ...image
            };
        }


        // Metadata найдены.
        //
        // Добавляем только используемые
        // информационные поля.

        return {

            ...image,


            // --------------------------------------------------
            // Автор и права
            // --------------------------------------------------

            author:
                metadata.author,

            creator:
                metadata.creator,

            copyright:
                metadata.copyright,

            rights:
                metadata.rights,


            // --------------------------------------------------
            // Информация об источнике / лицензии
            // --------------------------------------------------

            webStatement:
                metadata.webStatement,

            licensorURL:
                metadata.licensorURL,

            copyrightNotice:
                metadata.copyrightNotice,

            credit:
                metadata.credit,


            // --------------------------------------------------
            // Дополнительные идентификаторы
            // --------------------------------------------------

            byLine:
                metadata.byLine,

            assetID:
                metadata.assetID,


            // --------------------------------------------------
            // Описание
            // --------------------------------------------------

            imageDescription:
                metadata.imageDescription,

            description:
                metadata.description,


            // --------------------------------------------------
            // Дата
            // --------------------------------------------------

            dateTimeOriginal:
                metadata.dateTimeOriginal,


            // --------------------------------------------------
            // Полные группы metadata
            // --------------------------------------------------

            exif:
                metadata.exif,

            iptc:
                metadata.iptc,

            xmp:
                metadata.xmp,


            // --------------------------------------------------
            // Флаг обработки
            // --------------------------------------------------

            metadataAnalyzed:
                metadata.metadataAnalyzed
        };
    });


// ==========================================================
// СТАТИСТИКА METADATA
// ==========================================================
//
// Используются те же признаки,
// которые применяются в Duplicate Matcher
// для определения наличия metadata.
//
// ==========================================================

const imagesWithActualMetadata =
    imagesWithMetadata.filter(
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
    `Изображений с найденными метаданными: ${imagesWithActualMetadata.length}`
);


// ==========================================================
// ОБОГАЩАЕМ ГРУППЫ ДУБЛИКАТОВ METADATA
// ==========================================================
//
// Здесь группа получает:
//
// metadata
// representative
//
// Representative нужен для последующих этапов,
// например Reverse Search.
//
// Reverse Search пока отключён.
//
// ==========================================================

const enrichedDuplicateGroups =
    enrichDuplicateGroupsWithMetadata(
        duplicateGroups,
        metadataImages
    );


// ==========================================================
// 7. RISK ENGINE
// ==========================================================
//
// Risk Engine оценивает наличие признаков,
// требующих дополнительной проверки.
//
// Он НЕ определяет факт нарушения авторских прав.
//
// Сейчас учитываются:
//
// - metadata;
// - copyright;
// - author;
// - rights;
// - asset ID;
// - stock source;
// - external matches, если они появятся;
// - отсутствие информации об источнике.
//
// Reverse Search пока не используется,
// поэтому externalMatches отсутствуют.
//
// ==========================================================

console.log(
    '\n[7/8] Расчёт Risk Score...'
);


const riskImages =
    calculateRisks(
        imagesWithMetadata,
        enrichedDuplicateGroups
    );


console.log(
    `Risk Score рассчитан для ${riskImages.length} изображений`
);


// ==========================================================
// СТАТИСТИКА RISK
// ==========================================================

const riskCounts = {

    LOW: 0,

    MEDIUM: 0,

    HIGH: 0,

    CRITICAL: 0
};


for (const image of riskImages) {

    const level =
        image.riskLevel;


    if (
        riskCounts[level] !== undefined
    ) {

        riskCounts[level]++;
    }
}


// ==========================================================
// HTTP-СТАТИСТИКА
// ==========================================================

const statusCounts = {};


for (const image of validatedImages) {

    const status =
        image.status ?? 'NO_STATUS';


    statusCounts[status] =
        (statusCounts[status] || 0) + 1;
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

const elapsedTime =
    Date.now() - startTime;


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
// ИТОГОВЫЙ ВЫВОД
// ==========================================================

console.log('\n==========================================');
console.log('              ИТОГОВЫЙ ОТЧЁТ');
console.log('==========================================');


console.log(
    `Страниц: ${pages.length}`
);


console.log(
    `Изображений: ${images.length}`
);


console.log(
    `Проверено изображений: ${validatedImages.length}`
);


console.log(
    `Уникальных файлов: ${uniqueImages.length}`
);


console.log(
    `SHA-256 рассчитан: ${sha256Count}`
);


console.log(
    `Точных групп дубликатов: ${exactGroups.length}`
);


console.log(
    `Групп похожих изображений: ${similarGroups.length}`
);


console.log(
    `Изображений с метаданными: ${imagesWithActualMetadata.length}`
);


console.log(
    `Маленьких изображений: ${smallImages.length}`
);


console.log(
    `Больших изображений: ${largeImages.length}`
);


console.log(
    `Недоступных изображений: ${unavailableImages.length}`
);


// ==========================================================
// HTTP-СТАТУСЫ
// ==========================================================

console.log('\nHTTP-статусы:');


for (
    const status
    of Object.keys(statusCounts).sort(
        (a, b) => {

            const numberA =
                Number(a);

            const numberB =
                Number(b);


            // Числовые HTTP-статусы
            // выводим по возрастанию.

            if (
                !Number.isNaN(numberA) &&
                !Number.isNaN(numberB)
            ) {

                return numberA - numberB;
            }


            return a.localeCompare(b);
        }
    )
) {

    console.log(
        `Статус ${status} — ${statusCounts[status]}`
    );
}


// ==========================================================
// RISK SCORE
// ==========================================================

console.log('\nRisk Score:');


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
// 8. EXCEL REPORT
// ==========================================================

console.log(
    '\n[8/8] Создание Excel-отчёта...'
);


const auditReportPath =
    createAuditReport({

        // Адрес сайта.
        startUrl,

        // Найденные страницы.
        pages,

        // Все найденные изображения.
        images,

        // Финальный результат аудита.
        auditedImages:
            riskImages,

        // Уникальные изображения,
        // обработанные Metadata Analyzer.
        uniqueImages,

        // Результаты Metadata Analyzer.
        metadataImages,

        // Группы дубликатов
        // с metadata и representative.
        duplicateGroups:
            enrichedDuplicateGroups,

        // Большие изображения.
        largeImages,

        // Время выполнения.
        elapsedTime:
            elapsedTimeFormatted
    });


console.log(
    '\nExcel-отчёт создан:'
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
