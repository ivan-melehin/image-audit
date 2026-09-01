// ==========================================================
// GOOGLE LENS PROVIDER — ТЕСТ
// testGoogleLens.js
// ==========================================================

import { GoogleLensProvider } from './src/externalSearch/providers/googleLensProvider.js';


// ==========================================================
// ТЕСТОВЫЕ ИЗОБРАЖЕНИЯ
// ==========================================================

const testImages = [

    {
        imageUrl:
            'http://localhost:3000/img/test2.jpg'
    },

    {
        imageUrl:
            'http://localhost:3000/img/test3.jpg'
    }

];


// ==========================================================
// HEADER
// ==========================================================

console.log('');

console.log(
    '=========================================================='
);

console.log(
    ' GOOGLE LENS PROVIDER — ТЕСТ'
);

console.log(
    '=========================================================='
);

console.log('');

console.log(
    `Изображений для теста: ${testImages.length}`
);

console.log('');


// ==========================================================
// PROVIDER
// ==========================================================

const provider =
    new GoogleLensProvider({

        maxResults: 10,

        requestDelay: 2000

    });


// ==========================================================
// РЕЗУЛЬТАТЫ ВСЕХ ИЗОБРАЖЕНИЙ
// ==========================================================

const allMatches = [];


// ==========================================================
// ПОСЛЕДОВАТЕЛЬНЫЙ ТЕСТ
// ==========================================================

for (
    const image
    of testImages
) {

    console.log(
        '----------------------------------------------------------'
    );

    console.log(
        `Изображение: ${image.imageUrl}`
    );

    console.log(
        '----------------------------------------------------------'
    );

    console.log('');


    try {

        const matches =
            await provider.search(
                image
            );


        // --------------------------------------------------
        // Вывод результата
        // --------------------------------------------------

        console.log('');

        console.log(
            'Результат provider.search():'
        );

        console.log(
            `Тип результата: ${Array.isArray(matches) ? 'Array' : typeof matches}`
        );

        console.log(
            `Количество совпадений: ${matches.length}`
        );


        // --------------------------------------------------
        // Сохраняем результаты
        // --------------------------------------------------

        allMatches.push(
            ...matches
        );


        // --------------------------------------------------
        // Вывод совпадений
        // --------------------------------------------------

        console.log('');

        console.log(
            'НАЙДЕННЫЕ ВНЕШНИЕ СОВПАДЕНИЯ:'
        );


        if (
            matches.length === 0
        ) {

            console.log(
                '  Совпадений нет.'
            );

        } else {

            matches.forEach(
                (match, index) => {

                    console.log('');

                    console.log(
                        `Match #${index + 1}`
                    );

                    console.log(
                        `  Provider: ${match.provider}`
                    );

                    console.log(
                        `  Source URL: ${match.sourceUrl}`
                    );

                    console.log(
                        `  Page URL: ${match.pageUrl}`
                    );

                    console.log(
                        `  Title: ${match.title}`
                    );

                    console.log(
                        `  Similarity: ${
                            match.similarity ?? '—'
                        }`
                    );

                    console.log(
                        `  Found At: ${match.foundAt}`
                    );

                }
            );

        }


    } catch (error) {

        console.error('');

        console.error(
            `✗ Ошибка обработки ${image.imageUrl}`
        );

        console.error(
            error.message
        );

    }


    console.log('');

}


// ==========================================================
// ОБЩИЙ RAW RESULT
// ==========================================================

console.log(
    '=========================================================='
);

console.log(
    ' ОБЩИЕ externalMatches'
);

console.log(
    '=========================================================='
);

console.log('');

console.log(
    JSON.stringify(
        allMatches,
        null,
        2
    )
);

console.log('');


// ==========================================================
// СТАТИСТИКА
// ==========================================================

const statistics =
    provider.getStatistics();


console.log(
    '=========================================================='
);

console.log(
    ' СТАТИСТИКА GOOGLE LENS'
);

console.log(
    '=========================================================='
);

console.log(
    `Изображений проверено: ${statistics.imagesChecked}`
);

console.log(
    `Изображений скачано: ${statistics.imagesDownloaded}`
);

console.log(
    `Browser sessions: ${statistics.browserSessions}`
);

console.log(
    `Browser pages: ${statistics.browserPages}`
);

console.log(
    `Upload/Search requests: ${statistics.searchRequests}`
);

console.log(
    `Успешных запросов: ${statistics.successfulRequests}`
);

console.log(
    `Страниц результатов: ${statistics.resultsPages}`
);

console.log(
    `Кандидатов найдено: ${statistics.candidatesFound}`
);

console.log(
    `Кандидатов отброшено: ${statistics.candidatesRejected}`
);

console.log(
    `Найдено совпадений: ${statistics.matchesFound}`
);

console.log(
    `Ошибок: ${statistics.errors}`
);

console.log(
    `Timeout: ${statistics.timeouts}`
);

console.log('');

console.log(
    '=========================================================='
);

console.log(
    ' ТЕСТ ЗАВЕРШЁН'
);

console.log(
    '=========================================================='
);