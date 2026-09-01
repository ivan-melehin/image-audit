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
// 5. Удаление повторных URL для Metadata Analyzer
//      ↓
// 6. Metadata Analyzer (ExifTool)
//      ↓
// 7. External Search
//      ↓
// 8. Duplicate Matcher
//      ↓
// 9. SQLite
//      ↓
// 10. Risk Engine
//      ↓
// 11. Итоговый отчёт
//
// ==========================================================


// ==========================================================
// ИМПОРТЫ
// ==========================================================

// Crawler.
// Обходит сайт и находит страницы.
import { crawl } from './crawler/crawler.js';


// Image Collector.
// Находит изображения на найденных страницах.
import { collectImages } from './collector/imageCollector.js';


// Image Validator.
// Проверяет доступность изображений,
// HTTP-статус, Content-Type, размер и т.д.
import { validateImages } from './analyzer/imageValidator.js';


// Hash Engine.
//
// Рассчитывает:
// - SHA-256
// - perceptual hash
import { hashImages } from './hash/hashEngine.js';


// Duplicate Matcher.
//
// Ищет:
// - exact duplicates по SHA-256
// - similar images по pHash
import { findDuplicates } from './matcher/duplicateMatcher.js';


// SQLite.
//
// Сохраняет найденные группы дубликатов.
import { saveDuplicateGroups } from './database/database.js';


// Metadata Analyzer.
//
// Использует ExifTool.
//
// Получает:
// - Author
// - Creator
// - Copyright
// - Rights
// - Web Statement
// - Licensor URL
// - Copyright Notice
// - Credit
// - By-line
// - Asset ID
// - Image Description
// - Description
// - DateTimeOriginal
// - EXIF
// - IPTC
// - XMP
import { analyzeMetadata } from './metadata/metadataAnalyzer.js';


// Функция удаления повторных изображений.
//
// Одно и то же изображение может быть найдено
// на нескольких страницах.
//
// Metadata Analyzer и External Search
// получают только уникальные изображения.
import { getUniqueImages } from './utils/getUniqueImages.js';


// ==========================================================
// EXTERNAL SEARCH
// ==========================================================
//
// Reverse Image Search.
//
// reverseSearch не зависит от конкретного API.
//
// Сейчас подключён MockProvider,
// чтобы протестировать архитектуру.
//
// В дальнейшем MockProvider можно заменить
// на реальные providers внешнего поиска.
//
// ==========================================================


import { reverseSearch } from './externalSearch/reverseSearch.js';

import { WebSearchProvider } from './externalSearch/providers/webSearchProvider.js';


// ==========================================================
// EXTERNAL SEARCH PROVIDERS
// ==========================================================
//
// Используем бесплатный WebSearchProvider.
//
// TinEye и платные API не используются.
//
// ==========================================================

const reverseSearchProviders = [
    new WebSearchProvider({
        name: 'web-search',
        maxResults: 10
    })
];



// ==========================================================
// RISK ENGINE
// ==========================================================
//
// Рассчитывает условный Risk Score.
//
// Risk Engine не определяет нарушение авторских прав.
//
// Он только оценивает наличие признаков,
// требующих дополнительной проверки.
//
// ==========================================================

import { calculateRisks } from './risk/riskEngine.js';


// ==========================================================
// EXCEL AUDIT REPORT
// ==========================================================
//
// Единый Excel-отчёт по результатам всего аудита.
//
// Содержит:
//
// 1. Summary
// 2. Images
// 3. Risk
// 4. External Matches
// 5. Metadata
// 6. Duplicates
// 7. Large Images
//
// ==========================================================

import { createAuditReport } from './reports/auditReport.js';


// ==========================================================
// НАСТРОЙКИ
// ==========================================================


// Максимальное расстояние между двумя pHash.
//
// Чем меньше число:
//
// 5  → очень строго
// 10 → стандартный вариант
// 15 → более мягкое сравнение
// 20 → ещё более мягкое
//
// Если distance <= threshold,
// изображения считаются похожими.

const SIMILARITY_THRESHOLD = 10;


// Сайты для тестирования.

const startUrl = 'https://parentslike.ru/';

// http://localhost:3000/
// https://ivanmelekhin.ru/
// https://parentslike.ru/
// https://loginom.ru/


// ==========================================================
// НАЧАЛО АУДИТА
// ==========================================================


// Запоминаем время запуска.
//
// В конце посчитаем,
// сколько времени занял весь аудит.

const startTime = Date.now();


console.log('\n==========================================');
console.log('           IMAGE AUDIT STARTED');
console.log('==========================================');


// ==========================================================
// ЭТАП 1. CRAWLER
// ==========================================================

console.log('\n[1/10] Сканирование сайта...');


// Запускаем crawler.
//
// pages — массив найденных страниц.

const pages = await crawl(startUrl);


// Показываем количество найденных страниц.

console.log(
    `Найдено страниц: ${pages.length}`
);


// ==========================================================
// ЭТАП 2. IMAGE COLLECTOR
// ==========================================================

console.log('\n[2/10] Поиск изображений...');


// Передаём найденные страницы
// в Image Collector.
//
// images — массив найденных изображений.

const images = await collectImages(pages);


// Показываем количество найденных изображений.

console.log(
    `Найдено изображений: ${images.length}`
);


// ==========================================================
// ЭТАП 3. IMAGE VALIDATOR
// ==========================================================

console.log('\n[3/10] Проверка изображений...');


// Validator проверяет:
//
// - HTTP status
// - Content-Type
// - размер
// - доступность
// - технические изображения

const validatedImages = await validateImages(images);


// Показываем количество обработанных изображений.

console.log(
    `Проверено изображений: ${validatedImages.length}`
);


// ==========================================================
// ЭТАП 4. HASH ENGINE
// ==========================================================

console.log('\n[4/10] Расчёт SHA-256 и perceptual hash...');


// Hash Engine рассчитывает:
//
// SHA-256
// pHash
//
// Результат сохраняем в hashedImages.

const hashedImages = await hashImages(validatedImages);


// Показываем количество изображений,
// для которых рассчитан SHA-256.

const sha256Count = hashedImages.filter(
    image => image.sha256 !== null
).length;


console.log(
    `SHA-256 рассчитан для ${sha256Count} изображений`
);


// ==========================================================
// ЭТАП 5. УНИКАЛЬНЫЕ ИЗОБРАЖЕНИЯ
// ==========================================================
//
// Одно изображение может встречаться
// на нескольких страницах.
//
// Например:
//
// page1 → test2.jpg
// page2 → test2.jpg
// page3 → test2.jpg
//
// Поэтому создаём uniqueImages.
//
// Metadata Analyzer и External Search
// получают именно этот массив.
//

const uniqueImages = getUniqueImages(hashedImages);


// Показываем статистику.

console.log(
    `Уникальных изображений для Metadata Analyzer: ${uniqueImages.length}`
);


// ==========================================================
// ЭТАП 6. METADATA ANALYZER
// ==========================================================

console.log('\n[5/10] Анализ метаданных через ExifTool...');


// Передаём в Metadata Analyzer
// ТОЛЬКО уникальные изображения.
//
// Благодаря этому одно и то же изображение,
// найденное на нескольких страницах,
// анализируется ExifTool один раз.

const metadataImages = await analyzeMetadata(uniqueImages);


// ==========================================================
// ЭТАП 7. EXTERNAL SEARCH
// ==========================================================

console.log('\n[6/10] Поиск внешних совпадений...');


// Передаём в External Search
// уникальные изображения.
//
// Это важно:
//
// одно и то же изображение может находиться
// на нескольких страницах сайта.
//
// Поэтому нет смысла несколько раз
// отправлять один и тот же файл
// во внешний поиск.

const imagesWithExternalMatches =
    await reverseSearch(
        metadataImages,
        reverseSearchProviders
    );


// Считаем общее количество найденных
// внешних совпадений.

const externalMatchesCount =
    imagesWithExternalMatches.reduce(
        (total, image) =>
            total +
            (
                Array.isArray(image.externalMatches)
                    ? image.externalMatches.length
                    : 0
            ),
        0
    );


console.log(
    `Найдено внешних совпадений: ${externalMatchesCount}`
);


// Показываем информацию
// о найденных внешних совпадениях.

if (externalMatchesCount > 0) {

    console.log('\nВнешние совпадения:');


    for (const image of imagesWithExternalMatches) {

        if (
            !Array.isArray(image.externalMatches) ||
            image.externalMatches.length === 0
        ) {
            continue;
        }


        console.log(
            `\nИзображение: ${image.imageUrl}`
        );


        for (const match of image.externalMatches) {

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
// ЭТАП 8. DUPLICATE MATCHER
// ==========================================================

console.log(
    '\n[7/10] Поиск дубликатов и похожих изображений...'
);


// Здесь передаём ВСЕ hashedImages.
//
// Почему не uniqueImages?
//
// Потому что Duplicate Matcher должен видеть
// все найденные вхождения изображений.
//
// Exact Duplicate определяется по SHA-256.
//
// Например:
//
// test2.jpg
// test2.jpg
// test2.jpg
//
// Все три записи имеют одинаковый SHA-256.
//
// Это позволяет определить,
// что одно изображение используется
// несколько раз.

const duplicateGroups = findDuplicates(
    hashedImages,
    SIMILARITY_THRESHOLD
);


// ==========================================================
// ЭТАП 9. СОХРАНЕНИЕ В SQLITE
// ==========================================================

console.log('\n[8/10] Сохранение групп в базу данных...');


// Сохраняем найденные группы.

saveDuplicateGroups(duplicateGroups);


// Показываем количество групп.

console.log(
    `В базу данных сохранено групп: ${duplicateGroups.length}`
);


// ==========================================================
// DUPLICATE GROUPS
// ==========================================================

console.log('\nDuplicate groups:');


if (duplicateGroups.length === 0) {

    console.log(
        'Дубликатов и похожих изображений не найдено.'
    );

} else {

    for (const group of duplicateGroups) {

        console.log(
            `\nGroup #${group.id}`
        );


        console.log(
            `Type: ${group.type}`
        );


        // Если группа похожих изображений,
        // показываем установленный threshold.

        if (group.type === 'similar') {

            console.log(
                `Threshold: ${group.threshold}`
            );
        }


        // Показываем изображения группы.

        for (const image of group.images) {

            console.log(
                image.imageUrl
            );
        }
    }
}


// ==========================================================
// ЭТАП 10. RISK ENGINE
// ==========================================================
//
// Risk Engine получает результаты:
//
// - Metadata Analyzer
// - External Search
// - Duplicate Matcher
//
// И рассчитывает:
//
// - Risk Score
// - Risk Level
// - Risk Factors
//
// Важно:
//
// Risk Score не является утверждением
// о нарушении авторских прав.
//
// Это условная оценка риска,
// требующая дополнительной проверки.
//
// ==========================================================

console.log('\n[9/10] Расчёт Risk Score...');


const riskImages = calculateRisks(
    imagesWithExternalMatches,
    duplicateGroups
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


for (const image of riskImages) {

    if (
        riskCounts[image.riskLevel] !== undefined
    ) {

        riskCounts[image.riskLevel]++;
    }
}


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
// СТАТИСТИКА HTTP
// ==========================================================


// Создаём объект,
// в котором будем считать HTTP-статусы.
//
// Например:
//
// {
//     200: 25,
//     404: 2,
//     403: 1
// }

const statusCounts = {};


// Перебираем проверенные изображения.

for (const image of validatedImages) {

    const status = image.status;


    // Если такого статуса ещё нет,
    // создаём счётчик.

    if (!statusCounts[status]) {

        statusCounts[status] = 0;
    }


    // Увеличиваем счётчик.

    statusCounts[status]++;
}


// ==========================================================
// МАЛЕНЬКИЕ ИЗОБРАЖЕНИЯ
// ==========================================================

const smallImages = validatedImages.filter(
    image => image.isSmallTechnical === true
);


// ==========================================================
// БОЛЬШИЕ ИЗОБРАЖЕНИЯ
// ==========================================================


// Максимальный размер обычного изображения.
//
// 1 MB = 1024 × 1024 байт.

const largeImageLimit = 1024 * 1024;


// Находим изображения,
// размер которых больше 1 MB.

const largeImages = validatedImages.filter(
    image =>
        typeof image.fileSize === 'number' &&
        image.fileSize > largeImageLimit
);


// ==========================================================
// НЕДОСТУПНЫЕ ИЗОБРАЖЕНИЯ
// ==========================================================

const unavailableImages = validatedImages.filter(
    image => image.available === false
);


// ==========================================================
// МЕТАДАННЫЕ
// ==========================================================


// Находим изображения,
// у которых есть хотя бы одно
// интересующее нас поле.

const imagesWithMetadata = metadataImages.filter(
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


// ==========================================================
// ИТОГОВЫЙ ОТЧЁТ
// ==========================================================

console.log('\n');
console.log('==========================================');
console.log('              ИТОГОВЫЙ ОТЧЁТ');
console.log('==========================================');


// ----------------------------------------------------------
// Общая статистика
// ----------------------------------------------------------

console.log('\nОбщая статистика:');


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


// ----------------------------------------------------------
// HTTP
// ----------------------------------------------------------

console.log('\nHTTP-статусы:');


const statuses = Object.keys(statusCounts)
    .sort((a, b) => Number(a) - Number(b));


for (const status of statuses) {

    console.log(
        `Статус ${status} — ${statusCounts[status]}`
    );
}


// ----------------------------------------------------------
// Маленькие изображения
// ----------------------------------------------------------

console.log('\nМаленькие изображения:');


console.log(
    `Всего найдено маленьких изображений: ${smallImages.length}`
);


// ----------------------------------------------------------
// Большие изображения
// ----------------------------------------------------------

console.log('\nБольшие изображения:');


console.log(
    `Всего найдено больших изображений: ${largeImages.length}`
);


// ----------------------------------------------------------
// Недоступные изображения
// ----------------------------------------------------------

console.log('\nНедоступные изображения:');


console.log(
    `Всего недоступных изображений: ${unavailableImages.length}`
);


// ----------------------------------------------------------
// SHA-256
// ----------------------------------------------------------

console.log('\nХеширование:');


console.log(
    `SHA-256 рассчитан для ${sha256Count} изображений`
);


// ----------------------------------------------------------
// Duplicate Matcher
// ----------------------------------------------------------

console.log('\nДубликаты:');


const exactGroups = duplicateGroups.filter(
    group => group.type === 'exact'
);


const similarGroups = duplicateGroups.filter(
    group => group.type === 'similar'
);


console.log(
    `Exact groups: ${exactGroups.length}`
);


console.log(
    `Similar groups: ${similarGroups.length}`
);


// ----------------------------------------------------------
// Metadata Analyzer
// ----------------------------------------------------------

console.log('\nМетаданные:');


console.log(
    `Уникальных изображений проверено ExifTool: ${metadataImages.length}`
);


console.log(
    `Изображений с метаданными: ${imagesWithMetadata.length}`
);


// ----------------------------------------------------------
// External Search
// ----------------------------------------------------------

console.log('\nВнешний поиск:');


console.log(
    `Уникальных изображений проверено: ${imagesWithExternalMatches.length}`
);


console.log(
    `Внешних совпадений найдено: ${externalMatchesCount}`
);


// Если внешние совпадения найдены,
// показываем краткую информацию.

if (externalMatchesCount > 0) {

    const imagesWithMatches =
        imagesWithExternalMatches.filter(
            image =>
                Array.isArray(image.externalMatches) &&
                image.externalMatches.length > 0
        );


    console.log(
        `Изображений с внешними совпадениями: ${imagesWithMatches.length}`
    );
}


// ----------------------------------------------------------
// Risk Engine
// ----------------------------------------------------------

console.log('\nОценка риска:');


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
// ДЕТАЛИ RISK ENGINE
// ==========================================================

if (riskImages.length > 0) {

    console.log('\nДетали Risk Score:');


    for (const image of riskImages) {

        console.log(
            `\nИзображение: ${image.imageUrl}`
        );


        console.log(
            `Risk Score: ${image.riskScore}`
        );


        console.log(
            `Risk Level: ${image.riskLevel}`
        );


        if (
            Array.isArray(image.riskFactors) &&
            image.riskFactors.length > 0
        ) {

            console.log('Причины:');


            for (const factor of image.riskFactors) {

                console.log(
                    `  +${factor.points} — ${factor.description}`
                );
            }

        } else {

            console.log(
                'Причины: —'
            );
        }
    }
}


// ==========================================================
// НАЙДЕННЫЕ МЕТАДАННЫЕ
// ==========================================================


// Если метаданные найдены,
// показываем основные поля.

if (imagesWithMetadata.length > 0) {

    console.log('\nНайденные метаданные:');


    imagesWithMetadata.forEach(
        (image, index) => {

            console.log(`\n${index + 1}.`);


            console.log(
                `Изображение: ${image.imageUrl}`
            );


            console.log(
                `Author: ${image.author || '—'}`
            );


            console.log(
                `Creator: ${image.creator || '—'}`
            );


            console.log(
                `Copyright: ${image.copyright || '—'}`
            );


            console.log(
                `Rights: ${image.rights || '—'}`
            );


            console.log(
                `Web Statement: ${image.webStatement || '—'}`
            );


            console.log(
                `Licensor URL: ${image.licensorURL || '—'}`
            );


            console.log(
                `Copyright Notice: ${image.copyrightNotice || '—'}`
            );


            console.log(
                `Credit: ${image.credit || '—'}`
            );


            console.log(
                `By-line: ${image.byLine || '—'}`
            );


            console.log(
                `Asset ID: ${image.assetID || '—'}`
            );


            console.log(
                `Image Description: ${image.imageDescription || '—'}`
            );


            console.log(
                `Description: ${image.description || '—'}`
            );


            console.log(
                `DateTimeOriginal: ${image.dateTimeOriginal || '—'}`
            );
        }
    );
}


// ==========================================================
// ВРЕМЯ ВЫПОЛНЕНИЯ
// ==========================================================

const endTime = Date.now();


const elapsedTime =
    endTime - startTime;


// Часы.

const hours = Math.floor(
    elapsedTime / 3600000
);


// Минуты.

const minutes = Math.floor(
    (elapsedTime % 3600000) / 60000
);


// Секунды.

const seconds = Math.floor(
    (elapsedTime % 60000) / 1000
);


const elapsedTimeFormatted =
    `${hours} ч. ${minutes} мин. ${seconds} сек.`;


// Показываем время.

console.log('\nВремя выполнения:');


console.log(
    elapsedTimeFormatted
);


// ==========================================================
// ЭТАП 11. ЕДИНЫЙ EXCEL-ОТЧЁТ
// ==========================================================
//
// Создаём единый Excel-файл.
//
// В него передаём результаты
// всех этапов аудита:
//
// - страницы
// - изображения
// - Validator
// - Hash Engine
// - Metadata
// - External Search
// - Duplicate Matcher
// - Risk Engine
// - большие изображения
// - время выполнения
//
// В результате получаем один файл:
//
// Отчёты/
//     localhost_YYYY-MM-DD_image-audit.xlsx
//
// ==========================================================

console.log('\n[10/10] Создание единого Excel-отчёта...');


const auditReportPath =
    createAuditReport({

        startUrl,

        pages,

        images,

        validatedImages,

        uniqueImages,

        metadataImages,

        duplicateGroups,

        imagesWithExternalMatches,

        riskImages,

        largeImages,

        elapsedTime: elapsedTimeFormatted
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