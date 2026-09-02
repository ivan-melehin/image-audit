// ==========================================================
// Image Audit
// src/risk/riskEngine.js
// ==========================================================
//
// Рассчитывает условный Risk Score
// на основе метаданных изображения.
//
// В текущей версии используются:
//
// - признаки фотостоков;
// - Author / Creator / By-line;
// - Copyright / Rights;
// - Asset ID;
// - License / Rights information;
// - отсутствие информации об источнике.
//
// Duplicate Matcher работает отдельно
// и выводится в отчёт.
//
// Reverse Search временно не используется.
//
// Risk Engine НЕ определяет нарушение
// авторских прав.
//
// Он только определяет признаки,
// требующие дополнительной проверки.
// ==========================================================

import {
    RISK_POINTS,
    MAX_RISK_SCORE,
    RISK_LEVELS
} from './riskConfig.js';


// ==========================================================
// СТОКОВЫЕ ДОМЕНЫ
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
// СОБИРАЕМ ВСЕ ТЕКСТОВЫЕ METADATA
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

        .map(
            value =>
                String(value).toLowerCase()
        )

        .join(' ');
}


// ==========================================================
// ОПРЕДЕЛЕНИЕ ФОТОСТОКА
// ==========================================================

function isStockSource(image) {

    const metadataText =
        getMetadataText(image);


    return STOCK_DOMAINS.some(
        domain =>
            metadataText.includes(domain)
    );
}


// ==========================================================
// ОПРЕДЕЛЕНИЕ НАЗВАНИЯ ФОТОСТОКА
// ==========================================================

function getStockNames(image) {

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


    const metadataText =
        getMetadataText(image);


    for (const stock of stockMap) {

        const found =
            stock.domains.some(
                domain =>
                    metadataText.includes(domain)
            );


        if (found) {

            stockNames.push(
                stock.name
            );
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

function hasAssetId(image) {

    return Boolean(
        image.assetID
    );
}


// ==========================================================
// LICENSE / RIGHTS
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

export function calculateRisk(image) {

    let score = 0;


    const factors = [];


    // ======================================================
    // 1. STOCK SOURCE
    // ======================================================

    const stockSource =
        isStockSource(image);


    const stockNames =
        getStockNames(image);


    if (stockSource) {

        score +=
            RISK_POINTS.stockSource;


        const stockDescription =

            stockNames.length > 0

                ? `Обнаружен признак фотостока: ${stockNames.join(', ')}`

                : 'Обнаружен признак стокового источника';


        factors.push({

            code:
                'stockSource',

            points:
                RISK_POINTS.stockSource,

            description:
                stockDescription
        });
    }


    // ======================================================
    // 2. AUTHOR METADATA
    // ======================================================

    const authorMetadata =
        hasAuthorMetadata(image);


    if (authorMetadata) {

        score +=
            RISK_POINTS.authorMetadata;


        factors.push({

            code:
                'authorMetadata',

            points:
                RISK_POINTS.authorMetadata,

            description:
                'Автор указан в метаданных'
        });
    }


    // ======================================================
    // 3. COPYRIGHT METADATA
    // ======================================================

    const copyrightMetadata =
        hasCopyrightMetadata(image);


    if (copyrightMetadata) {

        score +=
            RISK_POINTS.copyrightMetadata;


        factors.push({

            code:
                'copyrightMetadata',

            points:
                RISK_POINTS.copyrightMetadata,

            description:
                'В метаданных указана информация об авторских правах'
        });
    }


    // ======================================================
    // 4. ASSET ID
    // ======================================================

    const assetId =
        hasAssetId(image);


    if (
        assetId &&
        RISK_POINTS.assetId !== undefined
    ) {

        score +=
            RISK_POINTS.assetId;


        factors.push({

            code:
                'assetId',

            points:
                RISK_POINTS.assetId,

            description:
                'В метаданных указан Asset ID'
        });
    }


    // ======================================================
    // 5. LICENSE / RIGHTS
    // ======================================================

    const licenseMetadata =
        hasLicenseMetadata(image);


    if (
        licenseMetadata &&
        RISK_POINTS.licenseMetadata !== undefined
    ) {

        score +=
            RISK_POINTS.licenseMetadata;


        factors.push({

            code:
                'licenseMetadata',

            points:
                RISK_POINTS.licenseMetadata,

            description:
                'В метаданных указана информация о лицензии или правах'
        });
    }


    // ======================================================
    // 6. SOURCE UNKNOWN
    // ======================================================
    //
    // Нет никаких признаков происхождения.
    // ======================================================

    const sourceUnknown =

        !authorMetadata &&

        !copyrightMetadata &&

        !stockSource &&

        !assetId &&

        !licenseMetadata;


    if (sourceUnknown) {

        score +=
            RISK_POINTS.sourceUnknown;


        factors.push({

            code:
                'sourceUnknown',

            points:
                RISK_POINTS.sourceUnknown,

            description:
                'В метаданных не найдено информации об источнике или правах'
        });
    }


    // ======================================================
    // ОГРАНИЧИВАЕМ SCORE
    // ======================================================

    score = Math.min(
        score,
        MAX_RISK_SCORE
    );


    // ======================================================
    // УРОВЕНЬ РИСКА
    // ======================================================

    const riskLevel =
        getRiskLevel(score);


    // ======================================================
    // РЕЗУЛЬТАТ
    // ======================================================

    return {

        riskScore:
            score,

        riskLevel,

        riskFactors:
            factors,

        indicators: {

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
// РАСЧЁТ ДЛЯ ВСЕХ ИЗОБРАЖЕНИЙ
// ==========================================================

export function calculateRisks(images) {

    return images.map(image => {

        const risk =
            calculateRisk(image);


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