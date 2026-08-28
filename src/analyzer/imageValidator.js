import axios from 'axios';

// Максимальный размер файла для определения
// небольшого технического изображения.
// 10 KB = 10 * 1024 байт.
const SMALL_IMAGE_LIMIT = 10 * 1024;

// Слова, которые часто встречаются в названиях
// небольших технических изображений:
// иконок, стрелок, кнопок и т. д.
const TECHNICAL_IMAGE_WORDS = [
    'icon',
    'arrow',
    'chevron',
    'close',
    'menu',
    'search',
    'loader',
    'spinner',
    'bullet',
    'favicon',
    'sprite',
    'emoji'
];


// Проверяем, является ли изображение
// небольшим техническим изображением.
function isSmallTechnicalImage(imageUrl, fileSize) {

    // Получаем имя файла из URL.
    const pathname = new URL(imageUrl).pathname;

    // Переводим имя файла в нижний регистр,
    // чтобы Icon.svg и icon.svg обрабатывались одинаково.
    const fileName = pathname.toLowerCase();

    // Проверяем, содержит ли имя файла
    // одно из технических ключевых слов.
    const hasTechnicalName = TECHNICAL_IMAGE_WORDS.some(word =>
        fileName.includes(word)
    );

    // Проверяем размер файла.
    const isSmallFile =
        typeof fileSize === 'number' &&
        fileSize <= SMALL_IMAGE_LIMIT;

    // Изображение считаем техническим,
    // если оно одновременно небольшое
    // и имеет характерное техническое имя.
    return isSmallFile && hasTechnicalName;
}


// Выполняем GET-запрос,
// если сервер не разрешает HEAD.
async function validateWithGet(imageUrl) {

    const response = await axios.get(imageUrl, {
        timeout: 10000,

        headers: {
            'User-Agent': 'Image-Audit/1.0'
        },

        // Разрешаем Axios получить любой HTTP-статус,
        // чтобы самостоятельно обработать 404, 403, 500 и т. д.
        validateStatus: () => true,

        // Не загружаем содержимое изображения
        // целиком в память.
        responseType: 'stream'
    });

    const status = response.status;

    const contentType =
        response.headers['content-type'] || '';

    const contentLength =
        response.headers['content-length'];

    const fileSize = contentLength
        ? Number(contentLength)
        : null;

    // Закрываем поток,
    // так как содержимое изображения нам сейчас не нужно.
    if (response.data && typeof response.data.destroy === 'function') {
        response.data.destroy();
    }

    return {
        status,
        contentType,
        fileSize
    };
}


// Проверяем все найденные изображения.
export async function validateImages(images) {

    // Здесь будем хранить результаты проверки.
    const validatedImages = [];

    // Перебираем все изображения,
    // найденные Image Collector.
    for (const image of images) {

        try {

            // Сначала пробуем HEAD-запрос.
            // Он позволяет получить информацию о файле
            // без загрузки изображения.
            let response = await axios.head(image.imageUrl, {
                timeout: 10000,

                headers: {
                    'User-Agent': 'Image-Audit/1.0'
                },

                // Разрешаем Axios считать успешными
                // любые HTTP-статусы.
                validateStatus: () => true
            });

            let status = response.status;

            let contentType =
                response.headers['content-type'] || '';

            let contentLength =
                response.headers['content-length'];

            let fileSize = contentLength
                ? Number(contentLength)
                : null;


            // Если сервер запрещает HEAD,
            // повторяем проверку через GET.
            if (status === 405) {

                console.log(
                    `HEAD 405 → GET: ${image.imageUrl}`
                );

                const getResult =
                    await validateWithGet(image.imageUrl);

                status = getResult.status;
                contentType = getResult.contentType;
                fileSize = getResult.fileSize;
            }


            // Считаем изображение доступным,
            // если сервер ответил успешным статусом.
            const available =
                status >= 200 && status < 300;


            // Проверяем, является ли изображение
            // небольшим техническим элементом.
            const isSmallTechnical =
                isSmallTechnicalImage(
                    image.imageUrl,
                    fileSize
                );


            // Пока фактическую проверку повреждения
            // изображения не выполняем.
            // Для неё потребуется скачать файл.
            const broken = null;


            // Добавляем к исходной информации
            // результаты нашего анализа.
            validatedImages.push({
                ...image,
                status,
                contentType,
                fileSize,
                available,
                isSmallTechnical,
                broken
            });

        } catch (error) {

            // Если произошла сетевая ошибка,
            // сохраняем информацию об ошибке,
            // но не останавливаем весь аудит.
            console.error(
                `Failed to validate image: ${image.imageUrl}`
            );

            console.error(error.message);

            validatedImages.push({
                ...image,
                status: null,
                contentType: '',
                fileSize: null,
                available: false,
                isSmallTechnical: false,
                broken: null
            });
        }
    }


    return validatedImages;
}