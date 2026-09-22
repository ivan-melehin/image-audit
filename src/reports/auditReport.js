// ==========================================================
// Image Audit
// src/reports/auditReport.js
// ==========================================================
//
// Создаёт Excel-отчёт.
//
// В отчёте:
//
// - Summary;
// - все изображения;
// - HTTP-результаты;
// - метаданные;
// - Risk Score;
// - причины риска;
// - информация о дубликатах.
// ==========================================================

import fs from 'node:fs';
import path from 'node:path';

import * as XLSX from 'xlsx';


// ==========================================================
// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ
// ==========================================================
//
// Если значения нет — показываем прочерк.
// ==========================================================

function valueOrDash(value) {

    return (
        value !== null &&
        value !== undefined &&
        value !== ''
    )

        ? value

        : '—';
}


// ==========================================================
// ФОРМАТИРОВАНИЕ РАЗМЕРА ФАЙЛА
// ==========================================================

function formatBytes(bytes) {

    if (typeof bytes !== 'number') {

        return '—';
    }


    if (bytes < 1024) {

        return `${bytes} B`;
    }


    if (bytes < 1024 * 1024) {

        return `${(bytes / 1024).toFixed(2)} KB`;
    }


    return `${(
        bytes / 1024 / 1024
    ).toFixed(2)} MB`;
}


// ==========================================================
// ПРИЧИНЫ РИСКА
// ==========================================================
//
// Risk Engine возвращает:
//
// riskFactors: [
//     {
//         code,
//         points,
//         description
//     }
// ]
//
// Превращаем их в понятную строку.
// ==========================================================

function getRiskReasons(image) {

    if (
        !Array.isArray(image.riskFactors) ||
        image.riskFactors.length === 0
    ) {

        return '—';
    }


    return image.riskFactors

        .map(
            factor =>
                `${factor.description} (+${factor.points})`
        )

        .join('; ');
}


// ==========================================================
// ПОИСК ГРУППЫ ДУБЛИКАТОВ
// ==========================================================

function getDuplicateInfo(
    image,
    duplicateGroups
) {

    if (
        !Array.isArray(duplicateGroups)
    ) {

        return {
            type: '—',
            count: 0
        };
    }


    const group =
        duplicateGroups.find(group =>

            Array.isArray(group.images) &&

            group.images.some(
                groupImage =>
                    groupImage.imageUrl === image.imageUrl
            )
        );


    if (!group) {

        return {
            type: 'Нет',
            count: 0
        };
    }


    return {

        type:
            group.type === 'exact'

                ? 'Точный дубликат'

                : 'Похожее изображение',

        count:
            group.images.length
    };
}


// ==========================================================
// СТАТИСТИКА УРОВНЕЙ РИСКА
// ==========================================================

function countRiskLevels(images) {

    const result = {

        LOW: 0,

        MEDIUM: 0,

        HIGH: 0,

        CRITICAL: 0
    };


    for (const image of images) {

        if (
            result[image.riskLevel] !== undefined
        ) {

            result[image.riskLevel]++;
        }
    }


    return result;
}


// ==========================================================
// СТАТИСТИКА HTTP-СТАТУСОВ
// ==========================================================

function countStatuses(images) {

    const result = {};


    for (const image of images) {

        const status =
            image.status ?? 'NO_STATUS';


        result[status] =
            (result[status] || 0) + 1;
    }


    return result;
}


// ==========================================================
// ОСНОВНАЯ ФУНКЦИЯ
// ==========================================================

export function createAuditReport({

    startUrl,

    pages,

    images,

    auditedImages,

    uniqueImages,

    metadataImages,

    duplicateGroups,

    largeImages,

    elapsedTime
}) {

    // ======================================================
    // СОЗДАЁМ EXCEL
    // ======================================================

    const workbook =
        XLSX.utils.book_new();


    const riskCounts =
        countRiskLevels(auditedImages);


    const statusCounts =
        countStatuses(auditedImages);


    const smallImages =
        auditedImages.filter(
            image =>
                image.isSmallTechnical === true
        );


    const unavailableImages =
        auditedImages.filter(
            image =>
                image.available === false
        );


    // ======================================================
    // КОЛИЧЕСТВО ИЗОБРАЖЕНИЙ С МЕТАДАННЫМИ
    // ======================================================

    const metadataCount =
        metadataImages.filter(image =>

            image.author ||
            image.creator ||
            image.copyright ||
            image.rights ||
            image.webStatement ||
            image.licensorURL ||
            image.copyrightNotice ||
            image.credit ||
            image.byLine ||
            image.assetID

        ).length;


    // ======================================================
    // ЛИСТ 1 — SUMMARY
    // ======================================================

    const summaryRows = [

        ['Параметр', 'Значение'],

        ['Сайт', startUrl],

        ['Время выполнения', elapsedTime],

        [],

        ['Найдено страниц', pages.length],

        ['Найдено изображений', images.length],

        ['Проверено изображений', auditedImages.length],

        ['Уникальных изображений', uniqueImages.length],

        ['Изображений с метаданными', metadataCount],

        ['Маленьких изображений', smallImages.length],

        ['Больших изображений', largeImages.length],

        ['Недоступных изображений', unavailableImages.length],

        [],

        ['Точных групп дубликатов',

            duplicateGroups.filter(
                group => group.type === 'exact'
            ).length
        ],

        ['Групп похожих изображений',

            duplicateGroups.filter(
                group => group.type === 'similar'
            ).length
        ],

        [],

        ['Risk LOW', riskCounts.LOW],

        ['Risk MEDIUM', riskCounts.MEDIUM],

        ['Risk HIGH', riskCounts.HIGH],

        ['Risk CRITICAL', riskCounts.CRITICAL],

        [],

        ['HTTP-статусы', 'Количество']
    ];


    // Добавляем статистику HTTP.

    for (
        const [status, count]
        of Object.entries(statusCounts)
    ) {

        summaryRows.push([

            `HTTP ${status}`,

            count
        ]);
    }


    const summarySheet =
        XLSX.utils.aoa_to_sheet(
            summaryRows
        );


    summarySheet['!cols'] = [

        { wch: 35 },

        { wch: 50 }
    ];


    XLSX.utils.book_append_sheet(

        workbook,

        summarySheet,

        'Summary'
    );


    // ======================================================
    // ЛИСТ 2 — IMAGES
    // ======================================================

    const imageRows =
        auditedImages.map(image => {


            const duplicateInfo =
                getDuplicateInfo(
                    image,
                    duplicateGroups
                );


            return {

                // ------------------------------------------
                // ОСНОВНАЯ ИНФОРМАЦИЯ
                // ------------------------------------------

                'Страница':

                    valueOrDash(
                        image.pageUrl
                    ),


                'Изображение':

                    valueOrDash(
                        image.imageUrl
                    ),


                // ------------------------------------------
                // HTTP
                // ------------------------------------------

                'HTTP':

                    valueOrDash(
                        image.status
                    ),


                'Доступно':

                    image.available === true

                        ? 'Да'

                        : 'Нет',


                'Content-Type':

                    valueOrDash(
                        image.contentType
                    ),


                'Размер, bytes':

                    valueOrDash(
                        image.fileSize
                    ),


                'Размер':

                    formatBytes(
                        image.fileSize
                    ),


                'Технически маленькое':

                    image.isSmallTechnical === true

                        ? 'Да'

                        : 'Нет',


                // ------------------------------------------
                // HASH
                // ------------------------------------------

                'SHA-256':

                    valueOrDash(
                        image.sha256
                    ),


                // ------------------------------------------
                // ДУБЛИКАТЫ
                // ------------------------------------------

                'Дубликат':

                    duplicateInfo.type,


                'Количество в группе':

                    duplicateInfo.count,


                // ------------------------------------------
                // METADATA
                // ------------------------------------------

                'Author':

                    valueOrDash(
                        image.author
                    ),


                'Creator':

                    valueOrDash(
                        image.creator
                    ),


                'By-line':

                    valueOrDash(
                        image.byLine
                    ),


                'Copyright':

                    valueOrDash(
                        image.copyright
                    ),


                'Copyright Notice':

                    valueOrDash(
                        image.copyrightNotice
                    ),


                'Rights':

                    valueOrDash(
                        image.rights
                    ),


                'Credit':

                    valueOrDash(
                        image.credit
                    ),


                'Asset ID':

                    valueOrDash(
                        image.assetID
                    ),


                'Web Statement':

                    valueOrDash(
                        image.webStatement
                    ),


                'Licensor URL':

                    valueOrDash(
                        image.licensorURL
                    ),


                'Description':

                    valueOrDash(

                        image.imageDescription ||

                        image.description
                    ),


                'Date Time Original':

                    valueOrDash(
                        image.dateTimeOriginal
                    ),


                // ------------------------------------------
                // RISK
                // ------------------------------------------

                'Risk Score':

                    valueOrDash(
                        image.riskScore
                    ),


                'Risk Level':

                    valueOrDash(
                        image.riskLevel
                    ),


                'Причины риска':

                    getRiskReasons(
                        image
                    )
            };
        });


    const imagesSheet =
        XLSX.utils.json_to_sheet(
            imageRows
        );


    // Ширина колонок.

    imagesSheet['!cols'] = [

        { wch: 45 },

        { wch: 55 },

        { wch: 10 },

        { wch: 12 },

        { wch: 22 },

        { wch: 15 },

        { wch: 14 },

        { wch: 20 },

        { wch: 66 },

        { wch: 22 },

        { wch: 20 },

        { wch: 25 },

        { wch: 25 },

        { wch: 25 },

        { wch: 32 },

        { wch: 32 },

        { wch: 32 },

        { wch: 25 },

        { wch: 24 },

        { wch: 45 },

        { wch: 45 },

        { wch: 45 },

        { wch: 22 },

        { wch: 12 },

        { wch: 14 },

        { wch: 70 }
    ];


    XLSX.utils.book_append_sheet(

        workbook,

        imagesSheet,

        'Images'
    );


    // ======================================================
    // СОЗДАЁМ ПАПКУ ДЛЯ ОТЧЁТОВ
    // ======================================================

    const reportsDir =
        path.resolve('Отчёты');


    fs.mkdirSync(
        reportsDir,
        {
            recursive: true
        }
    );


    // ======================================================
    // ИМЯ ФАЙЛА
    // ======================================================

    const host =
        new URL(startUrl)

            .hostname

            .replace(
                /[^a-z0-9.-]/gi,
                '_'
            );


    const date =
        new Date()

            .toISOString()

            .slice(0, 10);


    const reportPath =
        path.join(

            reportsDir,

            `${host}_${date}_image-audit.xlsx`
        );


    // ======================================================
    // СОХРАНЯЕМ EXCEL
    // ======================================================

    XLSX.writeFile(

        workbook,

        reportPath
    );


    return reportPath;
}