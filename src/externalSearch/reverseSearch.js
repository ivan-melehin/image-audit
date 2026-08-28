// ==========================================================
// Image Audit
// src/externalSearch/reverseSearch.js
// ==========================================================
//
// Универсальный слой внешнего поиска.
//
// Provider может быть:
//
// - MockProvider
// - WebSearchProvider
// - TinEyeProvider
// - любой другой provider
//
// reverseSearch не знает,
// как именно provider выполняет поиск.
//
// ==========================================================


export async function reverseSearch(
    images,
    providers = []
) {

    if (!Array.isArray(images)) {

        throw new TypeError(
            'reverseSearch: images должен быть массивом'
        );
    }


    if (!Array.isArray(providers)) {

        throw new TypeError(
            'reverseSearch: providers должен быть массивом'
        );
    }


    // ------------------------------------------------------
    // Результат.
    //
    // Копируем исходные объекты,
    // чтобы не потерять metadata.
    // ------------------------------------------------------

    const results =
        images.map(
            image => ({

                ...image,

                externalMatches: []
            })
        );


    // ------------------------------------------------------
    // Если providers нет,
    // просто возвращаем изображения.
    // ------------------------------------------------------

    if (providers.length === 0) {

        return results;
    }


    // ======================================================
    // ПРОВЕРЯЕМ КАЖДОЕ ИЗОБРАЖЕНИЕ
    // ======================================================

    for (
        const image
        of results
    ) {

        // --------------------------------------------------
        // Каждый provider получает изображение.
        // --------------------------------------------------

        for (
            const provider
            of providers
        ) {

            if (
                !provider ||
                typeof provider.search !==
                'function'
            ) {

                console.log(
                    'External Search: provider имеет неправильный формат'
                );

                continue;
            }


            try {

                const matches =
                    await provider.search(
                        image
                    );


                // ------------------------------------------------
                // Provider должен вернуть массив.
                // ------------------------------------------------

                if (
                    !Array.isArray(matches)
                ) {

                    continue;
                }


                // ------------------------------------------------
                // Добавляем результаты.
                // ------------------------------------------------

                image.externalMatches.push(
                    ...matches
                );

            } catch (error) {

                // ------------------------------------------------
                // Ошибка одного provider
                // не должна останавливать весь аудит.
                // ------------------------------------------------

                console.log(
                    `External Search error [${provider.name || 'unknown'}]: ${error.message}`
                );
            }
        }


        // --------------------------------------------------
        // Удаляем одинаковые совпадения.
        // --------------------------------------------------

        const uniqueMatches = [];


        const seen = new Set();


        for (
            const match
            of image.externalMatches
        ) {

            const key =
                [
                    match.pageUrl,
                    match.sourceUrl,
                    match.provider
                ]
                    .join('|');


            if (
                seen.has(key)
            ) {

                continue;
            }


            seen.add(key);


            uniqueMatches.push(
                match
            );
        }


        image.externalMatches =
            uniqueMatches;
    }


    return results;
}

