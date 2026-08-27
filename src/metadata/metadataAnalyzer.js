// ============================================================
// Metadata Analyzer
// ============================================================
//
// Этот модуль отвечает за чтение метаданных изображений.
//
// Для этого используется ExifTool.
//
// Мы только читаем информацию, которая уже находится
// внутри файла изображения.
//
// Например:
//
// Author = John Smith
// Copyright = Example Company
// Software = Adobe Photoshop
//
// Это просто данные из файла.
// Они НЕ являются доказательством нарушения авторских прав.
// ============================================================


// Импортируем встроенный модуль Node.js child_process.
//
// Он позволяет запускать внешние программы
// из нашего JavaScript-кода.
//
// В нашем случае это будет:
//
// exiftool.exe
//
import { execFile } from 'child_process';


// Импортируем promisify.
//
// Благодаря этому мы сможем использовать:
//
// await execFileAsync(...)
//
// вместо сложной работы с callback-функциями.
import { promisify } from 'util';


// Превращаем execFile в Promise-версию.
const execFileAsync = promisify(execFile);


// ============================================================
// НАСТРОЙКА EXIFTOOL
// ============================================================


// Если ExifTool добавлен в PATH Windows,
// достаточно написать:
//
// exiftool
//
// Если PATH не настроен,
// можно указать полный путь:
//
// C:\\ExifTool\\exiftool.exe
//
const EXIFTOOL_PATH = 'exiftool';


// ============================================================
// ФУНКЦИЯ ЧТЕНИЯ МЕТАДАННЫХ
// ============================================================
//
// Эта функция получает URL изображения,
// скачивает его через ExifTool
// и возвращает метаданные в формате JSON.
//


async function readMetadata(imageUrl) {

    // Запускаем ExifTool.

    const { stdout } = await execFileAsync(

        // Какая программа должна быть запущена.
        EXIFTOOL_PATH,

        [

            // Просим ExifTool вернуть JSON.
            '-json',

            // Сохраняем числовые значения
            // как числа там, где это возможно.
            '-n',

            // EXIF.
            '-EXIF:All',

            // IPTC.
            '-IPTC:All',

            // XMP.
            '-XMP:All',

            // Основные поля автора.
            '-Author',

            '-Creator',

            '-Copyright',

            '-Rights',

            '-Software',

            '-DateTimeOriginal',

            // Сам URL изображения.
            imageUrl
        ],

        {
            // Максимальное время ожидания.
            timeout: 30000,

            // Кодировка.
            encoding: 'utf8'
        }
    );


    // ExifTool возвращает JSON-массив.

    const data = JSON.parse(stdout);


    // Если массив пустой,
    // возвращаем пустой объект.
    if (!Array.isArray(data) || data.length === 0) {
        return {};
    }


    // Нам нужен первый объект.
    return data[0];
}


// ============================================================
// ОСНОВНАЯ ФУНКЦИЯ
// ============================================================


export async function analyzeMetadata(images) {

    // Здесь будем хранить результаты.
    const results = [];


    // Перебираем все изображения.
    for (let i = 0; i < images.length; i++) {

        // Получаем текущее изображение.
        const image = images[i];


        // ----------------------------------------------------
        // ИНДИКАТОР ПРОЦЕССА
        // ----------------------------------------------------
        //
        // Например:
        //
        // Metadata: 25/100
        //
        // Пользователь понимает,
        // что программа продолжает работать.
        //

        console.log(
            `Metadata: ${i + 1}/${images.length}`
        );


        try {

            // Получаем метаданные изображения.
            const metadata =
                await readMetadata(image.imageUrl);


            // ------------------------------------------------
            // Сохраняем результат.
            // ------------------------------------------------

            results.push({

                // Сохраняем URL страницы.
                pageUrl: image.pageUrl,

                // Сохраняем URL изображения.
                imageUrl: image.imageUrl,

                // Сохраняем alt.
                alt: image.alt,

                // Сохраняем title.
                title: image.title,


                // ------------------------------------------------
                // Основные метаданные
                // ------------------------------------------------

                author:
                    metadata.Author ??
                    null,

                creator:
                    metadata.Creator ??
                    null,

                copyright:
                    metadata.Copyright ??
                    null,

                rights:
                    metadata.Rights ??
                    null,

                software:
                    metadata.Software ??
                    null,

                dateTimeOriginal:
                    metadata.DateTimeOriginal ??
                    null,


                // ------------------------------------------------
                // Полные группы метаданных
                // ------------------------------------------------

                exif:
                    metadata.EXIF ??
                    null,

                iptc:
                    metadata.IPTC ??
                    null,

                xmp:
                    metadata.XMP ??
                    null,


                // Ошибок нет.
                metadataError: null
            });


        } catch (error) {

            // ------------------------------------------------
            // ОШИБКА
            // ------------------------------------------------
            //
            // Очень важно:
            //
            // ошибка одного изображения
            // НЕ должна останавливать весь аудит.
            //
            // Например, если один файл повреждён,
            // мы переходим к следующему.
            //

            results.push({

                // Сохраняем исходную информацию.
                ...image,


                // Метаданные получить не удалось.
                author: null,
                creator: null,
                copyright: null,
                rights: null,
                software: null,
                dateTimeOriginal: null,

                exif: null,
                iptc: null,
                xmp: null,


                // Запоминаем ошибку.
                metadataError: error.message
            });
        }
    }


    // --------------------------------------------------------
    // ЭТАП ЗАВЕРШЁН
    // --------------------------------------------------------

    console.log(
        `✓ Metadata Analyzer completed: ${results.length}/${images.length}`
    );


    // Возвращаем результаты.
    return results;
}