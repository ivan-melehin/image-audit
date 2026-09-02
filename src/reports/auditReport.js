// ==========================================================
// Image Audit
// src/reports/auditReport.js
// ==========================================================
//
// Создаёт итоговый Excel-отчёт аудита.
//
// Отчёт intentionally не содержит бизнес-логику аудита.
// Он только получает готовые результаты от app.js
// и преобразует их в удобные таблицы.
//
// ==========================================================

import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';

function safe(value) {
    if (value === null || value === undefined) {
        return '';
    }

    if (Array.isArray(value)) {
        return value.join(', ');
    }

    if (typeof value === 'object') {
        return JSON.stringify(value);
    }

    return value;
}

function createSummary(data) {
    const {
        startUrl,
        pages = [],
        images = [],
        validatedImages = [],
        uniqueImages = [],
        metadataImages = [],
        duplicateGroups = [],
        imagesWithExternalMatches = [],
        riskImages = [],
        largeImages = [],
        elapsedTime
    } = data;

    const riskCounts = {
        LOW: 0,
        MEDIUM: 0,
        HIGH: 0,
        CRITICAL: 0
    };

    for (const image of riskImages) {
        if (riskCounts[image.riskLevel] !== undefined) {
            riskCounts[image.riskLevel]++;
        }
    }

    const externalMatches = imagesWithExternalMatches.reduce(
        (total, image) => total + (
            Array.isArray(image.externalMatches)
                ? image.externalMatches.length
                : 0
        ),
        0
    );

    return [
        ['Показатель', 'Значение'],
        ['Дата отчёта', new Date().toISOString()],
        ['URL сайта', safe(startUrl)],
        ['Страниц найдено', pages.length],
        ['Изображений найдено', images.length],
        ['Изображений проверено', validatedImages.length],
        ['Уникальных изображений', uniqueImages.length],
        ['Изображений с metadata', metadataImages.filter(hasMetadata).length],
        ['Exact groups', duplicateGroups.filter(g => g.type === 'exact').length],
        ['Similar groups', duplicateGroups.filter(g => g.type === 'similar').length],
        ['Всего duplicate groups', duplicateGroups.length],
        ['Изображений во внешнем поиске', imagesWithExternalMatches.length],
        ['Внешних совпадений', externalMatches],
        ['Больших изображений', largeImages.length],
        ['Risk LOW', riskCounts.LOW],
        ['Risk MEDIUM', riskCounts.MEDIUM],
        ['Risk HIGH', riskCounts.HIGH],
        ['Risk CRITICAL', riskCounts.CRITICAL],
        ['Время выполнения', safe(elapsedTime)]
    ];
}

function hasMetadata(image) {
    return Boolean(
        image.author ||
        image.creator ||
        image.copyright ||
        image.rights ||
        image.webStatement ||
        image.licensorURL ||
        image.copyrightNotice ||
        image.credit ||
        image.byLine ||
        image.assetID ||
        image.imageDescription ||
        image.description ||
        image.dateTimeOriginal
    );
}

function createImagesSheet(data) {
    const rows = [];

    const riskByUrl = new Map(
        (data.riskImages || []).map(image => [image.imageUrl, image])
    );

    for (const image of data.validatedImages || []) {
        const risk = riskByUrl.get(image.imageUrl) || {};

        rows.push({
            pageUrl: safe(image.pageUrl),
            imageUrl: safe(image.imageUrl),
            status: safe(image.status),
            contentType: safe(image.contentType),
            fileSize: safe(image.fileSize),
            available: safe(image.available),
            broken: safe(image.broken),
            isSmallTechnical: safe(image.isSmallTechnical),
            sha256: safe(image.sha256),
            perceptualHash: safe(image.perceptualHash),
            riskScore: safe(risk.riskScore),
            riskLevel: safe(risk.riskLevel),
            riskFactors: safe(
                (risk.riskFactors || []).map(factor => factor.code)
            )
        });
    }

    return rows;
}

function createMetadataSheet(data) {
    return (data.metadataImages || []).map(image => ({
        imageUrl: safe(image.imageUrl),
        sha256: safe(image.sha256),
        author: safe(image.author),
        creator: safe(image.creator),
        copyright: safe(image.copyright),
        rights: safe(image.rights),
        webStatement: safe(image.webStatement),
        licensorURL: safe(image.licensorURL),
        copyrightNotice: safe(image.copyrightNotice),
        credit: safe(image.credit),
        byLine: safe(image.byLine),
        assetID: safe(image.assetID),
        imageDescription: safe(image.imageDescription),
        description: safe(image.description),
        dateTimeOriginal: safe(image.dateTimeOriginal)
    }));
}

function createDuplicatesSheet(data) {
    const rows = [];

    for (const group of data.duplicateGroups || []) {
        for (const image of group.images || []) {
            rows.push({
                groupId: safe(group.id),
                type: safe(group.type),
                threshold: safe(group.threshold),
                groupSha256: safe(group.sha256),
                pageUrl: safe(image.pageUrl),
                imageUrl: safe(image.imageUrl),
                sha256: safe(image.sha256),
                perceptualHash: safe(image.perceptualHash),
                representative: group.representative?.imageUrl === image.imageUrl
            });
        }
    }

    return rows;
}

function createExternalSheet(data) {
    const rows = [];

    for (const image of data.imagesWithExternalMatches || []) {
        for (const match of image.externalMatches || []) {
            rows.push({
                imageUrl: safe(image.imageUrl),
                sourceUrl: safe(match.sourceUrl),
                pageUrl: safe(match.pageUrl),
                title: safe(match.title),
                similarity: safe(match.similarity),
                evidenceType: safe(match.evidenceType),
                matchType: safe(match.matchType),
                provider: safe(match.provider),
                foundAt: safe(match.foundAt)
            });
        }
    }

    return rows;
}

function createRiskSheet(data) {
    return (data.riskImages || []).map(image => ({
        imageUrl: safe(image.imageUrl),
        pageUrl: safe(image.pageUrl),
        riskScore: safe(image.riskScore),
        riskLevel: safe(image.riskLevel),
        factors: safe(
            (image.riskFactors || []).map(factor =>
                `${factor.code}: ${factor.points}`
            )
        ),
        exactMatch: safe(image.riskIndicators?.exactMatch),
        visualMatch: safe(image.riskIndicators?.visualMatch),
        sourceFound: safe(image.riskIndicators?.sourceFound),
        stockSource: safe(image.riskIndicators?.stockSource),
        authorMetadata: safe(image.riskIndicators?.authorMetadata),
        copyrightMetadata: safe(image.riskIndicators?.copyrightMetadata),
        assetId: safe(image.riskIndicators?.assetId),
        licenseMetadata: safe(image.riskIndicators?.licenseMetadata),
        sourceUnknown: safe(image.riskIndicators?.sourceUnknown)
    }));
}

function addSheet(workbook, name, rows) {
    const sheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, name);
}

export function createAuditReport(data = {}) {
    const workbook = XLSX.utils.book_new();

    // Summary строим как обычную таблицу из двух колонок.
    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet(createSummary(data)),
        'Summary'
    );

    addSheet(workbook, 'Images', createImagesSheet(data));
    addSheet(workbook, 'Metadata', createMetadataSheet(data));
    addSheet(workbook, 'Duplicates', createDuplicatesSheet(data));
    addSheet(workbook, 'External Search', createExternalSheet(data));
    addSheet(workbook, 'Risk', createRiskSheet(data));

    // Отчёт сохраняется в отдельную папку проекта.
    const reportsDirectory = path.resolve('reports');
    fs.mkdirSync(reportsDirectory, { recursive: true });

    const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-');

    const reportPath = path.join(
        reportsDirectory,
        `image-audit-${timestamp}.xlsx`
    );

    XLSX.writeFile(workbook, reportPath);

    return reportPath;
}
