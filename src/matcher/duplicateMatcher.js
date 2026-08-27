// Импортируем функцию,
// которая рассчитывает расстояние
// между двумя perceptual hash.
import { hammingDistance } from '../hash/hashEngine.js';


// ======================================================
// Duplicate Matcher
// ======================================================

// Основная функция поиска дубликатов.
//
// images — массив изображений,
// уже обработанных Hash Engine.
//
// similarityThreshold — максимально допустимое
// расстояние между pHash.
//
// Чем меньше значение,
// тем строже критерий похожести.
export function findDuplicates(
    images,
    similarityThreshold = 10
) {

    // Массив будущих групп.
    const groups = [];


    // ==================================================
    // Этап 1. Exact Duplicate
    // ==================================================

    // Создаём Map.
//
// Ключ:
// SHA-256
//
// Значение:
// массив изображений с этим SHA-256.
    const exactGroups = new Map();


    // Перебираем все изображения.
    for (const image of images) {

        // Если SHA-256 отсутствует,
        // определить точный дубликат невозможно.
        if (!image.sha256) {
            continue;
        }


        // Если такого SHA-256 ещё нет,
        // создаём новую группу.
        if (!exactGroups.has(image.sha256)) {
            exactGroups.set(
                image.sha256,
                []
            );
        }


        // Добавляем изображение
        // в соответствующую группу.
        exactGroups
            .get(image.sha256)
            .push(image);
    }


    // ==================================================
    // Создаём группы Exact Duplicate
    // ==================================================

    for (const [sha256, groupImages] of exactGroups) {

        // Если файл встретился только один раз,
        // это не дубликат.
        if (groupImages.length < 2) {
            continue;
        }


        // Создаём группу.
        groups.push({

            // Номер группы.
            id: groups.length + 1,

            // Тип группы.
            type: 'exact',

            // SHA-256 группы.
            sha256,

            // Изображения группы.
            images: groupImages
        });
    }


    // ==================================================
    // Этап 2. Similar Image
    // ==================================================

    // Создаём Set уже добавленных изображений.
    //
    // Это важно:
    // одно изображение не должно
    // случайно попасть сразу
    // в несколько групп.
    const groupedImages = new Set();


    // Добавляем изображения
    // из Exact Duplicate групп.
    for (const group of groups) {

        for (const image of group.images) {
            groupedImages.add(image);
        }
    }


    // Перебираем изображения.
    for (let i = 0; i < images.length; i++) {

        const imageA = images[i];


        // Если изображение уже входит
        // в Exact Duplicate группу,
        // пропускаем его.
        if (groupedImages.has(imageA)) {
            continue;
        }


        // Если pHash отсутствует,
        // сравнивать изображение невозможно.
        if (!imageA.perceptualHash) {
            continue;
        }


        // Создаём новую группу
        // потенциально похожих изображений.
        const similarImages = [
            imageA
        ];


        // Перебираем остальные изображения.
        for (let j = i + 1; j < images.length; j++) {

            const imageB = images[j];


            // Уже сгруппированные изображения
            // пропускаем.
            if (groupedImages.has(imageB)) {
                continue;
            }


            // Если pHash отсутствует,
            // сравнение невозможно.
            if (!imageB.perceptualHash) {
                continue;
            }


            // Рассчитываем расстояние
            // между двумя pHash.
            const distance =
                hammingDistance(
                    imageA.perceptualHash,
                    imageB.perceptualHash
                );
            
//                 console.log(
//     `Compare: ${imageA.imageUrl} ↔ ${imageB.imageUrl} = ${distance}`
// );

                // Проверка хешей
//             console.log(
//     `Compare:\n` +
//     `  A: ${imageA.imageUrl}\n` +
//     `  B: ${imageB.imageUrl}\n` +
//     `  pHash A: ${imageA.perceptualHash}\n` +
//     `  pHash B: ${imageB.perceptualHash}\n` +
//     `  distance: ${distance}\n` +
//     `  threshold: ${similarityThreshold}`
// );


            // Если расстояние меньше
            // или равно установленному порогу,
            // считаем изображения похожими.
            if (
                distance !== null &&
                distance <= similarityThreshold
            ) {

                similarImages.push(
                    imageB
                );

                groupedImages.add(
                    imageB
                );
            }
        }


        // Если похожих изображений
        // больше одного,
        // создаём группу.
        if (similarImages.length > 1) {

            // Добавляем первое изображение
            // в список сгруппированных.
            groupedImages.add(imageA);


            groups.push({

                id: groups.length + 1,

                type: 'similar',

                threshold:
                    similarityThreshold,

                images:
                    similarImages
            });
        }
    }


    // Возвращаем все найденные группы.
    return groups;
}