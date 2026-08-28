// ==========================================================
// Image Audit
// src/risk/riskEngine.js
// ==========================================================
//
// Рассчитывает условный Risk Score
// для каждого изображения.
//
// Risk Engine НЕ определяет,
// произошло ли нарушение авторских прав.
//
// Он только оценивает наличие признаков,
// требующих дополнительной проверки.
//
// ==========================================================

import {
    RISK_POINTS,
    MAX_RISK_SCORE,
    RISK_LEVELS
} from './riskConfig.js';


// ==========================================================
// СТАНДАРТНЫЕ СТОКОВЫЕ ДОМЕНЫ
// ==========================================================
//
// Используются для определения,
// что изображение связано с известным фотостоком.
//
// Проверяем не только URL,
// но и поля метаданных:
//
// - Web Statement
// - Licensor URL
// - Credit
// - Copyright
// - Rights
// - Description
// - Author
// - Creator
//
// ==========================================================

const STOCK_DOMAINS = [

    'istockphoto.com',
    'gettyimages.com',
    'shutterstock.com',
    'adobe.com',
    'stock.adobe.com',
    'depositphotos.com',
    'alamy.com',
    'dreamstime.com'

];


// ==========================================================
// ОПРЕДЕЛЕНИЕ УРОВНЯ РИСКА
// ==========================================================

function getRiskLevel(score) {

    if (
        score >= RISK_LEVELS.CRITICAL.min &&
        score <= RISK_LEVELS.CRITICAL.max
    ) {

        return 'CRITICAL';
    }


    if (
        score >= RISK_LEVELS.HIGH.min &&
        score <= RISK_LEVELS.HIGH.max
    ) {

        return 'HIGH';
    }


    if (
        score >= RISK_LEVELS.MEDIUM.min &&
        score <= RISK_LEVELS.MEDIUM.max
    ) {

        return 'MEDIUM';
    }


    return 'LOW';
}


// ==========================================================
// ВНЕШНИЕ СОВПАДЕНИЯ
// ==========================================================

function getExternalMatches(image) {

    if (!Array.isArray(image.externalMatches)) {

        return [];
    }


    return image.externalMatches;
}


// ==========================================================
// EXACT MATCH
// ==========================================================
//
// similarity >= 90
// считается точным совпадением.
//
// ==========================================================

function hasExactMatch(matches) {

    return matches.some(
        match =>
            typeof match.similarity === 'number' &&
            match.similarity >= 90
    );
}


// ==========================================================
// VISUAL MATCH
// ==========================================================
//
// similarity 70–89
// считается визуальным совпадением.
//
// ==========================================================

function hasVisualMatch(matches) {

    return matches.some(
        match =>
            typeof match.similarity === 'number' &&
            match.similarity >= 70 &&
            match.similarity < 90
    );
}


// ==========================================================
// SOURCE FOUND
// ==========================================================

function hasSource(matches) {

    return matches.some(
        match =>
            typeof match.sourceUrl === 'string' &&
            match.sourceUrl.trim() !== ''
    );
}


// ==========================================================
// ПОЛУЧЕНИЕ ВСЕХ ТЕКСТОВЫХ ДАННЫХ МЕТАДАННЫХ
// ==========================================================
//
// Собираем основные поля ExifTool в одну строку.
//
// Это позволяет искать:
// - istockphoto.com
// - Getty Images
// - Shutterstock
// - Asset ID
// и т.д.
//
// ==========================================================

function getMetadataText(image) {

    const fields = [

        image.author,
        image.creator,
        image.copyright,
        image.rights,
        image.webStatement,
        image.licensorURL,
        image.copyrightNotice,
        image.credit,
        image.byLine,
        image.assetID,
        image.imageDescription,
        image.description,
        image.dateTimeOriginal

    ];


    return fields
        .filter(
            value =>
                value !== null &&
                value !== undefined &&
                value !== ''
        )
        .map(value => String(value).toLowerCase())
        .join(' ');
}


// ==========================================================
// ОПРЕДЕЛЕНИЕ ФОТОСТОКА
// ==========================================================
//
// Проверяем:
//
// 1. URL внешнего совпадения
// 2. pageUrl внешнего совпадения
// 3. метаданные изображения
//
// ==========================================================

function isStockSource(
    image,
    matches
) {

    // ------------------------------------------------------
    // Проверяем внешние совпадения.
    // ------------------------------------------------------

    const externalStockMatch =
        matches.some(match => {

            const urls = [

                match.sourceUrl,
                match.pageUrl

            ];


            return urls.some(url => {

                if (typeof url !== 'string') {

                    return false;
                }


                const lowerUrl =
                    url.toLowerCase();


                return STOCK_DOMAINS.some(
                    domain =>
                        lowerUrl.includes(domain)
                );
            });
        });


    if (externalStockMatch) {

        return true;
    }


    // ------------------------------------------------------
    // Проверяем метаданные.
    // ------------------------------------------------------

    const metadataText =
        getMetadataText(image);


    return STOCK_DOMAINS.some(
        domain =>
            metadataText.includes(domain)
    );
}


// ==========================================================
// ОПРЕДЕЛЕНИЕ КОНКРЕТНОГО СТОКА
// ==========================================================
//
// Нужно для более информативной причины:
//
// "Обнаружен стоковый источник: iStock / Getty Images"
//
// ==========================================================

function getStockNames(
    image,
    matches
) {

    const stockNames = [];


    const stockMap = [

        {
            domains: [
                'istockphoto.com'
            ],
            name: 'iStock'
        },

        {
            domains: [
                'gettyimages.com'
            ],
            name: 'Getty Images'
        },

        {
            domains: [
                'shutterstock.com'
            ],
            name: 'Shutterstock'
        },

        {
            domains: [
                'adobe.com',
                'stock.adobe.com'
            ],
            name: 'Adobe Stock'
        },

        {
            domains: [
                'depositphotos.com'
            ],
            name: 'Depositphotos'
        },

        {
            domains: [
                'alamy.com'
            ],
            name: 'Alamy'
        },

        {
            domains: [
                'dreamstime.com'
            ],
            name: 'Dreamstime'
        }

    ];


    // ------------------------------------------------------
    // Внешние URL
    // ------------------------------------------------------

    const externalText =
        matches
            .flatMap(match => [
                match.sourceUrl,
                match.pageUrl
            ])
            .filter(
                value =>
                    typeof value === 'string'
            )
            .join(' ')
            .toLowerCase();


    // ------------------------------------------------------
    // Метаданные
    // ------------------------------------------------------

    const metadataText =
        getMetadataText(image);


    const allText =
        `${externalText} ${metadataText}`;


    // ------------------------------------------------------
    // Определяем найденные стоки.
    // ------------------------------------------------------

    for (const stock of stockMap) {

        const found =
            stock.domains.some(
                domain =>
                    allText.includes(domain)
            );


        if (found) {

            stockNames.push(stock.name);
        }
    }


    return stockNames;
}


// ==========================================================
// AUTHOR METADATA
// ==========================================================

function hasAuthorMetadata(image) {

    return Boolean(

        image.author ||
        image.creator ||
        image.byLine

    );
}


// ==========================================================
// COPYRIGHT METADATA
// ==========================================================

function hasCopyrightMetadata(image) {

    return Boolean(

        image.copyright ||
        image.rights ||
        image.copyrightNotice

    );
}


// ==========================================================
// ASSET ID
// ==========================================================
//
// Наличие Asset ID является сильным признаком
// происхождения изображения из фотостока
// или другой системы управления цифровыми активами.
//
// ==========================================================

function hasAssetId(image) {

    return Boolean(
        image.assetID
    );
}


// ==========================================================
// LICENSE / RIGHTS INFORMATION
// ==========================================================

function hasLicenseMetadata(image) {

    return Boolean(

        image.webStatement ||
        image.licensorURL ||
        image.rights

    );
}


// ==========================================================
// РАСЧЁТ РИСКА ДЛЯ ОДНОГО ИЗОБРАЖЕНИЯ
// ==========================================================

export function calculateRisk(
    image,
    duplicateGroups = []
) {

    let score = 0;


    const factors = [];


    const matches =
        getExternalMatches(image);


    // ======================================================
    // 1. EXACT MATCH
    // ======================================================

    const exactMatch =
        hasExactMatch(matches);


    if (exactMatch) {

        score += RISK_POINTS.exactMatch;


        factors.push({

            code: 'exactMatch',

            points: RISK_POINTS.exactMatch,

            description:
                'Найдено точное внешнее совпадение'

        });
    }


    // ======================================================
    // 2. VISUAL MATCH
    // ======================================================

    const visualMatch =
        hasVisualMatch(matches);


    if (visualMatch) {

        score += RISK_POINTS.visualMatch;


        factors.push({

            code: 'visualMatch',

            points: RISK_POINTS.visualMatch,

            description:
                'Найдено визуальное совпадение'

        });
    }


    // ======================================================
    // 3. SOURCE FOUND
    // ======================================================

    const sourceFound =
        hasSource(matches);


    if (sourceFound) {

        score += RISK_POINTS.sourceFound;


        factors.push({

            code: 'sourceFound',

            points: RISK_POINTS.sourceFound,

            description:
                'Найден предполагаемый источник изображения'

        });
    }


    // ======================================================
    // 4. STOCK SOURCE
    // ======================================================
    //
    // Проверяем как внешние результаты,
    // так и метаданные.
    //
    // Это ключевое изменение.
    //
    // Например:
    //
    // Web Statement:
    // https://www.istockphoto.com/...
    //
    // Credit:
    // Getty Images
    //
    // → будет определён стоковый источник.
    //
    // ======================================================

    const stockSource =
        isStockSource(
            image,
            matches
        );


    const stockNames =
        getStockNames(
            image,
            matches
        );


    if (stockSource) {

        score += RISK_POINTS.stockSource;


        const stockDescription =
            stockNames.length > 0

                ? `Обнаружен источник изображения на фотостоке: ${stockNames.join(', ')}`

                : 'Обнаружен источник изображения на стоковом сайте';


        factors.push({

            code: 'stockSource',

            points: RISK_POINTS.stockSource,

            description:
                stockDescription

        });
    }


    // ======================================================
    // 5. AUTHOR METADATA
    // ======================================================

    const authorMetadata =
        hasAuthorMetadata(image);


    if (authorMetadata) {

        score += RISK_POINTS.authorMetadata;


        factors.push({

            code: 'authorMetadata',

            points: RISK_POINTS.authorMetadata,

            description:
                'Автор указан в метаданных'

        });
    }


    // ======================================================
    // 6. COPYRIGHT METADATA
    // ======================================================

    const copyrightMetadata =
        hasCopyrightMetadata(image);


    if (copyrightMetadata) {

        score += RISK_POINTS.copyrightMetadata;


        factors.push({

            code: 'copyrightMetadata',

            points: RISK_POINTS.copyrightMetadata,

            description:
                'Информация о Copyright указана в метаданных'

        });
    }


    // ======================================================
    // 7. ASSET ID
    // ======================================================

    const assetId =
        hasAssetId(image);


    if (
        assetId &&
        RISK_POINTS.assetId !== undefined
    ) {

        score += RISK_POINTS.assetId;


        factors.push({

            code: 'assetId',

            points: RISK_POINTS.assetId,

            description:
                'В метаданных указан Asset ID изображения'

        });
    }


    // ======================================================
    // 8. LICENSE / RIGHTS
    // ======================================================

    const licenseMetadata =
        hasLicenseMetadata(image);


    if (
        licenseMetadata &&
        RISK_POINTS.licenseMetadata !== undefined
    ) {

        score += RISK_POINTS.licenseMetadata;


        factors.push({

            code: 'licenseMetadata',

            points: RISK_POINTS.licenseMetadata,

            description:
                'В метаданных указана информация о лицензии или правах'

        });
    }


    // ======================================================
    // 9. SOURCE UNKNOWN
    // ======================================================
    //
    // Если вообще нет признаков происхождения,
    // добавляем небольшой риск.
    //
    // ======================================================

    const sourceUnknown =
        matches.length === 0 &&
        !hasAuthorMetadata(image) &&
        !hasCopyrightMetadata(image) &&
        !stockSource &&
        !assetId &&
        !licenseMetadata;


    if (sourceUnknown) {

        score += RISK_POINTS.sourceUnknown;


        factors.push({

            code: 'sourceUnknown',

            points: RISK_POINTS.sourceUnknown,

            description:
                'Источник изображения не установлен'

        });
    }


    // ======================================================
    // ОГРАНИЧЕНИЕ SCORE
    // ======================================================

    score = Math.min(
        score,
        MAX_RISK_SCORE
    );


    // ======================================================
    // УРОВЕНЬ РИСКА
    // ======================================================

    const level =
        getRiskLevel(score);


    // ======================================================
    // РЕЗУЛЬТАТ
    // ======================================================

    return {

        riskScore: score,

        riskLevel: level,

        riskFactors: factors,

        indicators: {

            exactMatch,

            visualMatch,

            sourceFound,

            stockSource,

            authorMetadata,

            copyrightMetadata,

            assetId,

            licenseMetadata,

            sourceUnknown

        }

    };
}


// ==========================================================
// РАСЧЁТ RISK SCORE ДЛЯ ВСЕХ ИЗОБРАЖЕНИЙ
// ==========================================================

export function calculateRisks(
    images,
    duplicateGroups = []
) {

    return images.map(image => {

        const risk =
            calculateRisk(
                image,
                duplicateGroups
            );


        return {

            ...image,

            riskScore:
                risk.riskScore,

            riskLevel:
                risk.riskLevel,

            riskFactors:
                risk.riskFactors,

            riskIndicators:
                risk.indicators

        };
    });
}

