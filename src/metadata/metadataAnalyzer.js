// ==========================================
// Metadata Analyzer
// ==========================================
//
// Задача этого модуля:
//
// 1. Получить файл изображения по URL.
// 2. Передать файл ExifTool.
// 3. Извлечь метаданные, которые могут содержать
//    информацию об авторе, правообладателе,
//    лицензии и условиях использования.
//
// ВАЖНО:
//
// Наличие метаданных НЕ является доказательством
// нарушения авторских прав.
//
// Например:
//
// Copyright = xubingruo
//
// означает только то, что в файле записано
// такое значение Copyright.
// Сам по себе этот факт не доказывает,
// что изображение используется незаконно.
// ==========================================


import axios from 'axios';
import { exiftool } from 'exiftool-vendored';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';


// ==========================================
// Основная функция
// ==========================================

export async function analyzeMetadata(images) {

    // Здесь будем хранить результаты анализа
    // всех изображений.
    const results = [];


    // Общее количество изображений.
    const total = images.length;


    // Счётчик текущего изображения.
    let current = 0;


    // ==========================================
    // Перебираем все изображения
    // ==========================================

    for (const image of images) {

        current++;


        // Показываем пользователю,
        // что процесс продолжается.
        //
        // Например:
        //
        // Metadata: [5/25] 20%
        //
        console.log(
            `Metadata: [${current}/${total}] ${Math.round(current / total * 100)}%`
        );


        // ------------------------------------------
        // Если изображение недоступно
        // ------------------------------------------
        //
        // Нет смысла запускать ExifTool,
        // если Validator уже определил,
        // что файл недоступен.

        if (image.available !== true) {

            results.push({
                ...image,

                author: '',
                creator: '',
                copyright: '',
                rights: '',
                webStatement: '',
                licensorURL: '',
                copyrightNotice: '',
                credit: '',
                byLine: '',
                assetID: '',
                imageDescription: '',
                description: '',
                dateTimeOriginal: '',

                exif: {},
                iptc: {},
                xmp: {},

                metadataAnalyzed: false
            });

            continue;
        }


        // Временный файл,
        // в который будет сохранено изображение.
        let tempFile = null;


        try {

            // ==========================================
            // 1. Скачиваем изображение
            // ==========================================

            const response = await axios.get(
                image.imageUrl,
                {
                    responseType: 'arraybuffer',
                    timeout: 15000,
                    headers: {
                        'User-Agent': 'Image-Audit/1.0'
                    }
                }
            );


            // ==========================================
            // 2. Создаём временный файл
            // ==========================================

            //
            // ExifTool удобнее всего работает
            // непосредственно с файлом.
            //

            tempFile = path.join(
                os.tmpdir(),
                `image-audit-${Date.now()}-${Math.random()
                    .toString(36)
                    .substring(2)}`
            );


            // Записываем скачанное изображение
            // во временный файл.
            await fs.writeFile(
                tempFile,
                Buffer.from(response.data)
            );


            // ==========================================
            // 3. Получаем ВСЕ метаданные через ExifTool
            // ==========================================

            //
            // Мы специально используем read(),
            // а не ограничиваем ExifTool только
            // несколькими тегами.
            //
            // Это позволяет корректно работать
            // с разными форматами и группами
            // метаданных:
            //
            // EXIF
            // IPTC
            // XMP
            // Photoshop
            // JPEG
            // PNG
            // WebP и т. д.
            //

            const metadata = await exiftool.read(tempFile);


            // ==========================================
            // 4. Вспомогательная функция
            // ==========================================

            //
            // ExifTool может вернуть:
            //
            // строку
            // число
            // объект
            // массив
            // undefined
            //
            // Поэтому приводим значение
            // к безопасной строке.
            //

            function getString(...names) {

                for (const name of names) {

                    const value = metadata[name];

                    if (
                        value !== undefined &&
                        value !== null &&
                        value !== ''
                    ) {

                        // Если ExifTool вернул массив,
                        // объединяем его в одну строку.

                        if (Array.isArray(value)) {
                            return value.join(', ');
                        }


                        // Если значение является объектом,
                        // пытаемся получить его строковое
                        // представление.

                        if (typeof value === 'object') {
                            return String(value);
                        }


                        return String(value);
                    }
                }


                // Если нужного тега нет,
                // возвращаем пустую строку.

                return '';
            }


            // ==========================================
            // 5. Извлекаем авторские метаданные
            // ==========================================

            //
            // Здесь используются несколько вариантов
            // названий тегов.
            //
            // Это важно, потому что один и тот же
            // смысловой параметр может находиться
            // в разных группах метаданных.
            //


            // Автор изображения.

            const author = getString(
                'Author',
                'Creator',
                'By-line',
                'Artist',
                'XMP:Creator',
                'IPTC:By-line'
            );


            // Creator.
            //
            // Обычно это автор или создатель контента.

            const creator = getString(
                'Creator',
                'XMP:Creator',
                'Author'
            );


            // Copyright.
            //
            // Информация о правообладателе.

            const copyright = getString(
                'Copyright',
                'XMP:Rights',
                'IPTC:CopyrightNotice'
            );


            // Rights.
            //
            // Может содержать информацию
            // о правах и условиях использования.

            const rights = getString(
                'Rights',
                'XMP:Rights'
            );


            // Web Statement.
            //
            // Часто содержит ссылку
            // на страницу с условиями лицензии
            // или информацией о правах.

            const webStatement = getString(
                'WebStatement',
                'Web Statement',
                'XMP:WebStatement'
            );


            // URL лицензиара.

            const licensorURL = getString(
                'LicensorURL',
                'LicensorUrl',
                'Licensor URL',
                'XMP:LicensorURL'
            );


            // Copyright Notice.
            //
            // Часто находится в IPTC.

            const copyrightNotice = getString(
                'CopyrightNotice',
                'IPTC:CopyrightNotice',
                'XMP:Copyright'
            );


            // Credit.
            //
            // Например:
            //
            // Getty Images

            const credit = getString(
                'Credit',
                'IPTC:Credit'
            );


            // By-line.
            //
            // Часто содержит имя фотографа.

            const byLine = getString(
                'By-line',
                'IPTC:By-line'
            );


            // Asset ID.
            //
            // Идентификатор изображения
            // в фотобанке или системе управления
            // контентом.

            const assetID = getString(
                'AssetID',
                'Asset Id',
                'XMP:AssetID'
            );


            // Описание изображения.

            const imageDescription = getString(
                'ImageDescription',
                'Image Description'
            );


            // Description.

            const description = getString(
                'Description',
                'XMP:Description',
                'IPTC:Caption-Abstract'
            );


            // Дата создания оригинала.

            const dateTimeOriginal = getString(
                'DateTimeOriginal',
                'Date/Time Original',
                'XMP:DateTimeOriginal'
            );


            // ==========================================
            // 6. Формируем EXIF
            // ==========================================

            //
            // Здесь сохраняем EXIF-данные,
            // которые ExifTool смог получить.
            //
            // При этом исключаем служебные поля,
            // чтобы результат не был перегружен.
            //

            const exif = {};


            for (const [key, value] of Object.entries(metadata)) {

                if (
                    key.startsWith('EXIF:') ||
                    key.startsWith('ExifIFD:')
                ) {

                    exif[key] = value;
                }
            }


            // ==========================================
            // 7. Формируем IPTC
            // ==========================================

            const iptc = {};


            for (const [key, value] of Object.entries(metadata)) {

                if (
                    key.startsWith('IPTC:') ||
                    key === 'CopyrightNotice' ||
                    key === 'By-line' ||
                    key === 'Credit' ||
                    key === 'Caption-Abstract' ||
                    key === 'CodedCharacterSet'
                ) {

                    // Убираем префикс IPTC:
                    //
                    // IPTC:Credit
                    //
                    // превращается в:
                    //
                    // Credit

                    const cleanKey = key.startsWith('IPTC:')
                        ? key.substring(5)
                        : key;


                    iptc[cleanKey] = value;
                }
            }


            // ==========================================
            // 8. Формируем XMP
            // ==========================================

            const xmp = {};


            for (const [key, value] of Object.entries(metadata)) {

                if (key.startsWith('XMP:')) {

                    const cleanKey = key.substring(4);

                    xmp[cleanKey] = value;
                }
            }


            // ==========================================
            // 9. Добавляем результат
            // ==========================================

            results.push({

                // Сохраняем всю исходную информацию
                // об изображении.

                ...image,


                // Авторские метаданные.

                author,
                creator,
                copyright,
                rights,
                webStatement,
                licensorURL,
                copyrightNotice,

                // Дополнительные поля,
                // которые могут помочь при анализе.

                credit,
                byLine,
                assetID,
                imageDescription,
                description,
                dateTimeOriginal,

                // Полные группы метаданных.

                exif,
                iptc,
                xmp,


                // Показываем,
                // что анализ завершился успешно.

                metadataAnalyzed: true
            });


        } catch (error) {

            // ==========================================
            // Ошибка обработки
            // ==========================================

            //
            // Ошибка одного изображения
            // не должна останавливать
            // весь аудит сайта.
            //

            console.error(
                `Metadata failed: ${image.imageUrl}`
            );

            console.error(error.message);


            // Даже при ошибке сохраняем
            // информацию об изображении.

            results.push({

                ...image,

                author: '',
                creator: '',
                copyright: '',
                rights: '',
                webStatement: '',
                licensorURL: '',
                copyrightNotice: '',
                credit: '',
                byLine: '',
                assetID: '',
                imageDescription: '',
                description: '',
                dateTimeOriginal: '',

                exif: {},
                iptc: {},
                xmp: {},

                metadataAnalyzed: false
            });


        } finally {

            // ==========================================
            // Удаляем временный файл
            // ==========================================

            //
            // Очень важно удалять временные файлы,
            // иначе после большого количества
            // проверок они будут накапливаться
            // на компьютере.
            //

            if (tempFile) {

                try {

                    await fs.unlink(tempFile);

                } catch {

                    // Если файл уже отсутствует,
                    // ничего делать не нужно.

                }
            }
        }
    }


    // ==========================================
    // Возвращаем результаты
    // ==========================================

    return results;
}

