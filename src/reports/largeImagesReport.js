import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';


// Папка, в которую будут сохраняться Excel-отчёты.
const REPORT_DIR =
    'Y:\\Melehin\\Обучение\\vs\\ImageAudit\\Отчёты Большие изображения';


// Создаём Excel-отчёт о больших изображениях.
export function createLargeImagesReport(
    largeImages,
    startUrl
) {

    // Получаем домен сайта.
    //
    // Например:
    // https://loginom.ru/
    //
    // превратится в:
    // loginom.ru
    const siteName = new URL(startUrl).hostname;


    // Получаем текущую дату.
    const now = new Date();


    // Формируем дату в формате:
    // 2026-08-25
    const date =
        `${now.getFullYear()}-` +
        `${String(now.getMonth() + 1).padStart(2, '0')}-` +
        `${String(now.getDate()).padStart(2, '0')}`;


    // Формируем имя Excel-файла.
    //
    // Например:
    // loginom.ru_2026-08-25_37-big-images.xlsx
    const fileName =
        `${siteName}_${date}_${largeImages.length}-big-images.xlsx`;


    // Полный путь к будущему Excel-файлу.
    const filePath = path.join(
        REPORT_DIR,
        fileName
    );


    // Если папки для отчётов ещё нет,
    // создаём её автоматически.
    fs.mkdirSync(
        REPORT_DIR,
        { recursive: true }
    );


    // Подготавливаем данные для Excel.
    const rows = largeImages.map(
        (image, index) => ({

            // Порядковый номер.
            '№': index + 1,

            // Страница, на которой найдено изображение.
            'Страница': image.pageUrl,

            // URL изображения.
            'Изображение': image.imageUrl,

            // Размер файла в MB.
            'Размер, MB':
                typeof image.fileSize === 'number'
                    ? Number(
                        (
                            image.fileSize /
                            (1024 * 1024)
                        ).toFixed(2)
                    )
                    : null
        })
    );


    // Создаём таблицу Excel из массива данных.
    const worksheet =
        XLSX.utils.json_to_sheet(rows);


    // Немного увеличиваем ширину столбцов,
    // чтобы URL было удобнее читать.
    worksheet['!cols'] = [
        { wch: 6 },
        { wch: 60 },
        { wch: 80 },
        { wch: 15 }
    ];


    // Создаём новую Excel-книгу.
    const workbook =
        XLSX.utils.book_new();


    // Добавляем созданную таблицу в книгу.
    XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        'Большие изображения'
    );


    // Сохраняем Excel-файл.
    XLSX.writeFile(
        workbook,
        filePath
    );


    // Возвращаем путь к созданному файлу.
    return filePath;
}