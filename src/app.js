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
// 10. Итоговый отчёт
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


// Excel-отчёт о больших изображениях.
import { createLargeImagesReport } from './reports/largeImagesReport.js';


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
// Например:
//
// page1 → test2.jpg
// page2 → test2.jpg
// page3 → test2.jpg
//
// Metadata Analyzer должен обработать его один раз.
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
// на реальный provider внешнего поиска.
//
// ==========================================================

import { reverseSearch } from './externalSearch/reverseSearch.js';

import { MockProvider } from './externalSearch/providers/mockProvider.js';


// Подключённые providers.
//
// Сейчас используется тестовый MockProvider.
//
// В дальнейшем здесь можно будет добавить:
//
// new GoogleProvider()
// new BingProvider()
// new AnotherProvider()
//
// без изменения основной логики app.js.
const reverseSearchProviders = [
    new MockProvider()
];


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


// Сайт для тестирования.
const startUrl = 'http://localhost:3000/';

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


// ==========================================================
// ЭТАП 1. CRAWLER
// ==========================================================

console.log('\n==========================================');
console.log('           IMAGE AUDIT STARTED');
console.log('==========================================');

console.log('\n[1/8] Сканирование сайта...');


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

console.log('\n[2/8] Поиск изображений...');


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

console.log('\n[3/8] Проверка изображений...');


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

console.log('\n[4/8] Расчёт SHA-256 и perceptual hash...');


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
// Очень важный момент.
//
// Одно изображение может встречаться
// на нескольких страницах.
//
// Например:
//
// http://localhost:3000/
//       ↓
// test2.jpg
//
// http://localhost:3000/page2.html
//       ↓
// test2.jpg
//
// http://localhost:3000/page3.html
//       ↓
// test2.jpg
//
// В массиве hashedImages тогда будет:
//
// test2.jpg
// test2.jpg
// test2.jpg
//
// Но физический файл один.
//
// Нам нет необходимости запускать ExifTool
// три раза.
//
// Поэтому создаём uniqueImages.
//
// Metadata Analyzer и External Search
// получат именно этот массив.
const uniqueImages = getUniqueImages(hashedImages);


// Показываем статистику.
console.log(
    `Уникальных изображений для Metadata Analyzer: ${uniqueImages.length}`
);


// ==========================================================
// ЭТАП 6. METADATA ANALYZER
// ==========================================================

console.log('\n[5/8] Анализ метаданных через ExifTool...');


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

console.log('\n[6/8] Поиск внешних совпадений...');


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
            total + (
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

console.log('\n[7/8] Поиск дубликатов и похожих изображений...');


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
// СОХРАНЕНИЕ В SQLITE
// ==========================================================

console.log('\n[8/8] Сохранение групп в базу данных...');


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

    console.log('Дубликатов и похожих изображений не найдено.');

} else {

    for (const group of duplicateGroups) {

        console.log(`\nGroup #${group.id}`);

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
// ФУНКЦИЯ ФОРМАТИРОВАНИЯ РАЗМЕРА
// ==========================================================

function formatFileSize(bytes) {

    // Размер неизвестен.
    if (typeof bytes !== 'number') {

        return 'неизвестно';
    }


    // До 1 KB.
    if (bytes < 1024) {

        return `${bytes} B`;
    }


    // До 1 MB.
    if (bytes < 1024 * 1024) {

        return `${(bytes / 1024).toFixed(2)} KB`;
    }


    // Больше 1 MB.
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}


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


console.log('\nВремя выполнения:');


console.log(
    `${hours} ч. ${minutes} мин. ${seconds} сек.`
);


// ==========================================================
// EXCEL-ОТЧЁТ
// ==========================================================


// Создаём Excel-отчёт
// о больших изображениях.
const largeImagesReportPath =
    createLargeImagesReport(
        largeImages,
        startUrl
    );


console.log(
    '\nExcel-отчёт о больших изображениях:'
);


console.log(
    largeImagesReportPath
);


// ==========================================================
// ЗАВЕРШЕНИЕ
// ==========================================================

console.log('\n==========================================');
console.log('             АУДИТ ЗАВЕРШЁН');
console.log('==========================================');