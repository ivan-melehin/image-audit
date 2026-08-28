// Импортируем функцию crawl из файла crawler.js.
// crawl отвечает за обход сайта и поиск страниц.
import { crawl } from './crawler/crawler.js';

// Импортируем функцию collectImages из imageCollector.js.
// collectImages получает найденные страницы и ищет на них изображения.
import { collectImages } from './collector/imageCollector.js';

// Импортируем функцию validateImages из imageValidator.js.
// validateImages проверяет доступность найденных изображений,
// HTTP-статус, Content-Type, размер файла
// и определяет небольшие технические изображения.
import { validateImages } from './analyzer/imageValidator.js';

// Импортируем функцию создания Excel-отчёта
// о больших изображениях.
import { createLargeImagesReport } from './reports/largeImagesReport.js';

// Импортируем функцию hashImages из Hash Engine.
// Она рассчитывает SHA-256 для найденных изображений.
import { hashImages } from './hash/hashEngine.js';

// Импортируем Duplicate Matcher.
//
// Он группирует изображения:
// - по одинаковому SHA-256;
// - по похожему pHash.
import { findDuplicates } from './matcher/duplicateMatcher.js';

// Импортируем функцию сохранения групп
// в SQLite.
import { saveDuplicateGroups } from './database/database.js';

// Импортируем Metadata Analyzer.
//
// Он получает проверенные изображения
// и извлекает из них EXIF, IPTC и другие
// доступные метаданные с помощью ExifTool.
import { analyzeMetadata } from './metadata/metadataAnalyzer.js';

// Максимальное расстояние между двумя pHash,
// при котором изображения считаются похожими.
//
// Чем меньше значение,
// тем строже поиск похожих изображений.
const SIMILARITY_THRESHOLD = 10;


// Адрес сайта, с которого начнётся обход.
// Именно эту страницу первой откроет crawler.
const startUrl = 'http://localhost:3000';

// https://parentslike.ru/ - сайт для тестов
// http://localhost:3000  - сайт для тестов
// https://loginom.ru/
// https://ivanmelekhin.ru/ - сайт для тестов


// Запоминаем время начала всего аудита.
// Эта строка должна находиться ДО запуска crawler,
// чтобы в итоговое время вошёл весь процесс проверки.
const startTime = Date.now();


// Запускаем crawler и передаём ему начальный URL.
// await означает: дождаться, пока crawl закончит работу,
// прежде чем выполнять следующую строку.
// В результате pages будет содержать массив найденных страниц.
const pages = await crawl(startUrl);


// Выводим в консоль заголовок перед списком страниц.
// console.log('\nFound pages:');


// // Перебираем все найденные страницы.
// // page — это одна страница из массива pages.
// // На каждой итерации цикла она выводится в консоль.
// for (const page of pages) {
//     console.log(page);
// }


// Передаём найденные страницы в Image Collector.
// collectImages открывает каждую страницу,
// находит изображения и возвращает их в виде массива.
// Результат сохраняем в переменную images.
const images = await collectImages(pages);


// Выводим в консоль заголовок перед списком изображений.
//console.log('\nFound images:');


// Перебираем все найденные изображения.
// image — один объект с информацией об изображении.
// Например, он может содержать:
// pageUrl — на какой странице найдено изображение;
// imageUrl — адрес самого изображения;
// alt — значение атрибута alt;
// title — значение атрибута title.
// for (const image of images) {
//     console.log(image);
// }


// Передаём найденные изображения в Image Validator.
// Validator проверяет:
// - доступность изображения;
// - HTTP-статус;
// - Content-Type;
// - размер файла;
// - является ли изображение небольшим техническим.
// Результат сохраняем в переменную validatedImages.
const validatedImages = await validateImages(images);


// Передаём проверенные изображения
// в Metadata Analyzer.
//
// Analyzer скачивает изображения,
// передаёт их ExifTool и извлекает:
// - Author
// - Creator
// - Copyright
// - Rights
// - Web Statement
// - Licensor URL
// - Copyright Notice
// - EXIF
// - IPTC
//
// Результат сохраняем в metadataImages.
const metadataImages = await analyzeMetadata(validatedImages);

console.log('\nDEBUG Metadata Analyzer:');
console.log(metadataImages);

// Передаём проверенные изображения в Hash Engine.
//
// Hash Engine скачивает содержимое каждого изображения
// и рассчитывает для него SHA-256.
//
// Результат сохраняем в переменную hashedImages.
const hashedImages = await hashImages(validatedImages);

// Передаём изображения в Duplicate Matcher.
//
// Matcher:
// 1. ищет полные дубликаты по SHA-256;
// 2. ищет визуально похожие изображения по pHash.
const duplicateGroups = findDuplicates(
    hashedImages,
    SIMILARITY_THRESHOLD
);

// Сохраняем найденные группы
// в базу данных SQLite.
saveDuplicateGroups(duplicateGroups);

// Вывод в логи групп точных и похожих изображений
console.log('\nDuplicate groups:');

for (const group of duplicateGroups) {

    console.log(`\nGroup #${group.id}`);
    console.log(`Type: ${group.type}`);

    for (const image of group.images) {
        console.log(image.imageUrl);
    }
}

// Вывод лолов с hash
// console.log('\nSHA-256:');

// for (const image of hashedImages) {
//     console.log({
//         image: image.imageUrl,
//         sha256: image.sha256
//     });
// }

// Выводим заголовок перед результатами проверки изображений.
// console.log('\nValidated images:');


// Перебираем результаты проверки.
// validatedImage содержит исходную информацию об изображении
// и результаты работы Image Validator.
// for (const validatedImage of validatedImages) {
//     console.log(validatedImage);
// }

// // ==========================================
// // Статистика метаданных
// // ==========================================


// // Изображения, у которых найден EXIF.
// const imagesWithExif = metadataResults.filter(
//     image => image.exif !== null
// );


// // Изображения, у которых найден IPTC.
// const imagesWithIptc = metadataResults.filter(
//     image => image.iptc !== null
// );


// // Изображения, у которых найден автор.
// const imagesWithAuthor = metadataResults.filter(
//     image =>
//         image.author !== null &&
//         image.author !== ''
// );


// // Изображения, у которых найден Copyright.
// const imagesWithCopyright = metadataResults.filter(
//     image =>
//         image.copyright !== null &&
//         image.copyright !== ''
// );


// // Изображения, у которых найден Software.
// const imagesWithSoftware = metadataResults.filter(
//     image =>
//         image.software !== null &&
//         image.software !== ''
// );

// ==========================================
// Итоговый отчёт
// ==========================================


// Создаём объект для подсчёта HTTP-статусов.
//
// Например, после обработки изображений
// он может выглядеть так:
//
// {
//     200: 350,
//     404: 15,
//     403: 10
// }
//
// Ключ — HTTP-статус.
// Значение — количество изображений с этим статусом.
const statusCounts = {};


// Перебираем все проверенные изображения.
for (const image of validatedImages) {

    // Получаем HTTP-статус изображения.
    const status = image.status;

    // Если такой статус встретился впервые,
    // создаём для него счётчик со значением 0.
    if (!statusCounts[status]) {
        statusCounts[status] = 0;
    }

    // Увеличиваем количество изображений
    // с этим HTTP-статусом на единицу.
    statusCounts[status]++;
}


// Находим все маленькие изображения.
//
// isSmallTechnical === true означает,
// что Validator определил изображение
// как небольшое техническое изображение:
// например, иконку или стрелку.
const smallImages = validatedImages.filter(
    image => image.isSmallTechnical === true
);


// Устанавливаем максимальный размер обычного изображения.
//
// Всё, что больше 1 МБ,
// будем считать большевесным изображением.
//
// 1024 × 1024 = 1 МБ.
const largeImageLimit = 1024 * 1024;


// Находим все большие изображения.
//
// Для этого проверяем размер каждого файла.
const largeImages = validatedImages.filter(
    image =>
        typeof image.fileSize === 'number' &&
        image.fileSize > largeImageLimit
);


// Находим изображения,
// которые недоступны.
//
// Например, это могут быть изображения
// с HTTP-статусами 404, 403, 500 и т. д.
const unavailableImages = validatedImages.filter(
    image => image.available === false
);


// Функция для перевода размера файла
// из байтов в удобный для человека формат.
//
// Например:
//
// 500 → 500 B
// 1024 → 1 KB
// 1048576 → 1 MB
function formatFileSize(bytes) {

    // Если размер неизвестен,
    // возвращаем сообщение.
    if (typeof bytes !== 'number') {
        return 'неизвестно';
    }


    // Если файл меньше 1 KB,
    // показываем размер в байтах.
    if (bytes < 1024) {
        return `${bytes} B`;
    }


    // Если файл меньше 1 MB,
    // показываем размер в KB.
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(2)} KB`;
    }


    // Если файл больше или равен 1 MB,
    // показываем размер в MB.
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}



// ==========================================
// Вывод итогового отчёта
// ==========================================


console.log('\n');
console.log('==========================================');
console.log('              ИТОГОВЫЙ ОТЧЁТ');
console.log('==========================================');


// ------------------------------------------
// Общая статистика
// ------------------------------------------

console.log('\nОбщая статистика:');


// Количество найденных страниц.
console.log(
    `Всего найдено страниц: ${pages.length}`
);


// Количество найденных изображений.
// console.log(
//     `Всего найдено изображений: ${images.length}`
// );


// Количество проверенных изображений.
console.log(
    `Всего проверено изображений: ${validatedImages.length}`
);


// ------------------------------------------
// HTTP-статусы
// ------------------------------------------

console.log('\nHTTP-статусы:');


// Получаем все найденные HTTP-статусы
// и сортируем их по числовому значению.
//
// Например:
//
// 200
// 301
// 403
// 404
const statuses = Object.keys(statusCounts)
    .sort((a, b) => Number(a) - Number(b));


// Выводим количество изображений
// для каждого HTTP-статуса.
for (const status of statuses) {

    console.log(
        `Статус ${status} — ${statusCounts[status]}`
    );
}


// ------------------------------------------
// Маленькие изображения
// ------------------------------------------

console.log('\nМаленькие изображения:');


// Выводим общее количество
// небольших технических изображений.
console.log(
    `Всего найдено маленьких изображений: ${smallImages.length}`
);


// ------------------------------------------
// Большие изображения
// ------------------------------------------

console.log('\nБольшие изображения:');


// Выводим количество изображений,
// размер которых превышает 1 МБ.
console.log(
    `Всего найдено больших изображений: ${largeImages.length}`
);


// Если большие изображения найдены,
// выводим подробную информацию о каждом.
// if (largeImages.length > 0) {

//     console.log('\nСписок больших изображений:');


//     // Перебираем все большие изображения.
//     largeImages.forEach((image, index) => {

//         console.log(`\n${index + 1}.`);

//         // URL изображения.
//         console.log(
//             `Изображение: ${image.imageUrl}`
//         );

//         // Страница, на которой найдено изображение.
//         console.log(
//             `Страница: ${image.pageUrl}`
//         );

//         // Размер файла.
//         console.log(
//             `Размер: ${formatFileSize(image.fileSize)}`
//         );
//     });
// }


// ------------------------------------------
// Недоступные изображения
// ------------------------------------------

console.log('\nНедоступные изображения:');


// Выводим количество недоступных изображений.
console.log(
    `Всего недоступных изображений: ${unavailableImages.length}`
);


// Если недоступные изображения найдены,
// выводим подробную информацию.
// if (unavailableImages.length > 0) {

//     // console.log('\nСписок недоступных изображений:');


//     unavailableImages.forEach((image, index) => {

//         console.log(`\n${index + 1}.`);

        // HTTP-статус.
        // console.log(
        //     `Статус: ${image.status ?? 'неизвестно'}`
        // );

        // // URL изображения.
        // console.log(
        //     `Изображение: ${image.imageUrl}`
        // );

        // // Страница, на которой оно найдено.
        // console.log(
        //     `Страница: ${image.pageUrl}`
        // );
//     });
// }

 // Выводим количество обработанных изображений.
    console.log(
        `\nSHA-256 рассчитан для ${hashedImages.filter(image => image.sha256 !== null).length} изображений`
    );


// ==========================================
// Проверка Metadata Analyzer
// ==========================================

// Находим изображения,
// в которых были обнаружены какие-либо
// интересующие нас авторские метаданные.
const imagesWithMetadata = metadataImages.filter(
    image =>
        image.author ||
        image.creator ||
        image.copyright ||
        image.rights ||
        image.webStatement ||
        image.licensorURL ||
        image.copyrightNotice
);


// Выводим количество изображений
// с найденными метаданными.
console.log('\nМетаданные:');

console.log(
    `Изображений с метаданными: ${imagesWithMetadata.length}`
);


// Если нашли изображения с метаданными,
// выводим их в консоль.
if (imagesWithMetadata.length > 0) {

    console.log('\nНайденные метаданные:');


    imagesWithMetadata.forEach((image, index) => {

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
    });
}



// ==========================================
// Время выполнения
// ==========================================


// Запоминаем время окончания аудита.
const endTime = Date.now();


// Вычисляем, сколько миллисекунд прошло
// с момента запуска аудита.
const elapsedTime = endTime - startTime;


// Переводим миллисекунды в часы.
const hours = Math.floor(
    elapsedTime / 3600000
);


// Получаем количество минут,
// оставшихся после выделения полных часов.
const minutes = Math.floor(
    (elapsedTime % 3600000) / 60000
);


// Получаем количество секунд,
// оставшихся после выделения полных минут.
const seconds = Math.floor(
    (elapsedTime % 60000) / 1000
);


// Выводим время выполнения.
console.log('\nВремя выполнения:');

console.log(
    `${hours} ч. ${minutes} мин. ${seconds} сек.`
);

// ==========================================
// Excel-отчёт о больших изображениях
// ==========================================


// Создаём Excel-отчёт.
//
// Отчёт формируется автоматически
// после завершения всех проверок.
const largeImagesReportPath =
    createLargeImagesReport(
        largeImages,
        startUrl
    );


// Выводим путь к созданному Excel-файлу.
console.log('\nExcel-отчёт о больших изображениях:');

console.log(
    largeImagesReportPath
);

console.log('\n==========================================');
console.log('             АУДИТ ЗАВЕРШЁН');
console.log('==========================================');