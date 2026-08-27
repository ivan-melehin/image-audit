// Импортируем встроенный модуль crypto из Node.js.
//
// Он используется для расчёта SHA-256.
import crypto from 'crypto';

// Импортируем axios.
//
// Он используется для загрузки изображения
// по его URL.
import axios from 'axios';

// Импортируем sharp.
//
// Sharp позволяет преобразовать изображение
// в удобный для анализа формат.
import sharp from 'sharp';


// Размер изображения,
// который будем использовать для pHash.
//
// Мы приводим любое изображение
// к размеру 32 × 32 пикселя.
const PHASH_SIZE = 32;


// Размер итогового pHash.
//
// После DCT будем использовать
// первые 8 × 8 значений.
const PHASH_BLOCK_SIZE = 8;


// ======================================================
// Расчёт pHash
// ======================================================

// Эта функция получает содержимое изображения
// и возвращает его perceptual hash.
async function calculatePHash(buffer) {

    // Преобразуем изображение в:
    //
    // 32 × 32 пикселя
    // оттенки серого
    // необработанные значения пикселей
    //
    // raw означает, что sharp вернёт
    // обычный массив чисел.
    const { data } = await sharp(buffer)
        .resize(PHASH_SIZE, PHASH_SIZE, {
            fit: 'fill'
        })
        .grayscale()
        .raw()
        .toBuffer({
            resolveWithObject: true
        });


    // Создаём массив,
    // в котором будут храниться
    // значения DCT.
    const dctValues = [];


    // Выполняем двумерное DCT.
    //
    // DCT используется в perceptual hash
    // для получения характеристики
    // визуального содержимого изображения.
    for (let u = 0; u < PHASH_BLOCK_SIZE; u++) {

        for (let v = 0; v < PHASH_BLOCK_SIZE; v++) {

            let sum = 0;


            // Перебираем все пиксели изображения.
            for (let x = 0; x < PHASH_SIZE; x++) {

                for (let y = 0; y < PHASH_SIZE; y++) {

                    const pixel =
                        data[x * PHASH_SIZE + y];


                    const cosX =
                        Math.cos(
                            ((2 * x + 1) * u * Math.PI) /
                            (2 * PHASH_SIZE)
                        );


                    const cosY =
                        Math.cos(
                            ((2 * y + 1) * v * Math.PI) /
                            (2 * PHASH_SIZE)
                        );


                    sum += pixel * cosX * cosY;
                }
            }


            // Коэффициенты нормализации DCT.
            const alphaU =
                u === 0
                    ? 1 / Math.sqrt(PHASH_SIZE)
                    : Math.sqrt(2 / PHASH_SIZE);


            const alphaV =
                v === 0
                    ? 1 / Math.sqrt(PHASH_SIZE)
                    : Math.sqrt(2 / PHASH_SIZE);


            dctValues.push(
                sum * alphaU * alphaV
            );
        }
    }


    // Первый коэффициент DCT — DC-компонента.
    //
    // Его не используем при сравнении.
    const valuesWithoutFirst = dctValues.slice(1);


    // Вычисляем среднее значение остальных
    // коэффициентов.
    const average =
        valuesWithoutFirst.reduce(
            (sum, value) => sum + value,
            0
        ) / valuesWithoutFirst.length;


    // Превращаем коэффициенты в бинарную строку.
    //
    // Если значение больше среднего:
    //
    // 1
    //
    // иначе:
    //
    // 0
    //
    // Получаем 63-битный pHash.
    return valuesWithoutFirst
        .map(value => value > average ? '1' : '0')
        .join('');
}


// ======================================================
// Расстояние Хэмминга
// ======================================================

// Эта функция сравнивает два pHash.
//
// Чем меньше результат,
// тем больше изображения похожи.
export function hammingDistance(hashA, hashB) {

    // Если один из hash отсутствует,
    // сравнение невозможно.
    if (!hashA || !hashB) {
        return null;
    }


    // Если длина hash различается,
    // это некорректные данные.
    if (hashA.length !== hashB.length) {
        return null;
    }


    let distance = 0;


    // Сравниваем каждый бит.
    for (let i = 0; i < hashA.length; i++) {

        if (hashA[i] !== hashB[i]) {
            distance++;
        }
    }


    return distance;
}


// ======================================================
// Основная функция Hash Engine
// ======================================================

export async function hashImages(images) {

    // Создаём массив результатов.
    const hashedImages = [];


    // Перебираем все изображения.
    for (const image of images) {

        // Временно выводим только прогресс.
        //
        // Если позже понадобится убрать
        // и этот вывод — его можно закомментировать.
        // console.log(`Hashing: ${image.imageUrl}`);


        try {

            // Загружаем изображение.
            const response = await axios.get(
                image.imageUrl,
                {
                    responseType: 'arraybuffer',
                    timeout: 10000,
                    headers: {
                        'User-Agent': 'Image-Audit/1.0'
                    }
                }
            );


            // Получаем содержимое изображения.
            const buffer = Buffer.from(
                response.data
            );


            // ==================================================
            // SHA-256
            // ==================================================

            const sha256Hash =
                crypto.createHash('sha256');


            sha256Hash.update(buffer);


            const sha256 =
                sha256Hash.digest('hex');


            // ==================================================
            // pHash
            // ==================================================

            const perceptualHash =
                await calculatePHash(buffer);


//             console.log(
//     `pHash: ${image.imageUrl} → ${perceptualHash}`
// );

//              console.log(
//     `Hashing: ${i + 1}/${images.length}`
// );

            // Сохраняем исходные данные изображения
            // и добавляем два hash.
            hashedImages.push({

                ...image,

                // Полная идентичность файла.
                sha256,

                // Визуальная характеристика изображения.
                perceptualHash
            });


        } catch (error) {

            // Ошибка одного изображения
            // не должна останавливать весь аудит.
            console.error(
                `Failed to calculate hash for ${image.imageUrl}: ${error.message}`
            );


            // Сохраняем изображение,
            // но указываем, что hash определить не удалось.
            hashedImages.push({

                ...image,

                sha256: null,

                perceptualHash: null
            });
        }
    }

    // Возвращаем результат.
    return hashedImages;
}