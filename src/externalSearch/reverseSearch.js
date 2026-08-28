// Основной модуль внешнего поиска.
//
// Он не зависит от конкретного API.
// Provider передаётся снаружи.

export async function reverseSearch(images, providers = []) {

    const results = [];


    // Если provider не подключён,
    // просто возвращаем исходные изображения
    // с пустыми результатами поиска.
    if (!providers.length) {

        return images.map(image => ({
            ...image,
            externalMatches: []
        }));
    }


    // Перебираем изображения.
    for (const image of images) {

        const imageMatches = [];


        // Технические изображения
        // не отправляем во внешний поиск.
        if (image.isSmallTechnical) {

            results.push({
                ...image,
                externalMatches: []
            });

            continue;
        }


        // Используем все подключённые providers.
        for (const provider of providers) {

            try {

                console.log(
                    `External Search [${provider.name}]: ${image.imageUrl}`
                );


                const providerResults =
                    await provider.search(image);


                // Provider должен возвращать массив.
                if (!Array.isArray(providerResults)) {
                    continue;
                }


                imageMatches.push(
                    ...providerResults
                );


            } catch (error) {

                // Ошибка одного provider
                // не должна останавливать весь аудит.
                console.error(
                    `External Search failed [${provider.name}]: ${image.imageUrl}`
                );

                console.error(error.message);
            }
        }


        // Удаляем одинаковые результаты.
        const uniqueMatches =
            removeDuplicateResults(imageMatches);


        results.push({
            ...image,
            externalMatches: uniqueMatches
        });
    }


    return results;
}


// Удаляем дубликаты внешних результатов.
//
// Один и тот же sourceUrl + pageUrl
// считается одним результатом.
function removeDuplicateResults(matches) {

    const unique = new Map();


    for (const match of matches) {

        const key = [
            match.sourceUrl || '',
            match.pageUrl || ''
        ].join('|');


        // Если такого результата ещё нет,
        // сохраняем его.
        if (!unique.has(key)) {
            unique.set(key, match);
        }
    }


    return Array.from(unique.values());
}