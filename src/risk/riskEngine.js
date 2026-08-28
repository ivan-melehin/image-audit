// ==========================================================
// Risk Engine
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
// ПРОВЕРКА НАЛИЧИЯ ВНЕШНИХ СОВПАДЕНИЙ
// ==========================================================

function getExternalMatches(image) {

    if (!Array.isArray(image.externalMatches)) {
        return [];
    }


    return image.externalMatches;
}


// ==========================================================
// ПРОВЕРКА ТОЧНОГО СОВПАДЕНИЯ
// ==========================================================
//
// Пока MockProvider не сообщает отдельно,
// является ли совпадение exact или visual.
//
// Поэтому для текущего этапа:
//
// similarity >= 90
//      ↓
// считаем точным совпадением.
//
// similarity < 90
//      ↓
// считаем визуальным совпадением.
//
// Позже реальный provider сможет
// передавать отдельный тип совпадения.
//

function hasExactMatch(matches) {

    return matches.some(
        match =>
            typeof match.similarity === 'number' &&
            match.similarity >= 90
    );
}


// ==========================================================
// ПРОВЕРКА ВИЗУАЛЬНОГО СОВПАДЕНИЯ
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
// ПРОВЕРКА НАЙДЕННОГО ИСТОЧНИКА
// ==========================================================

function hasSource(matches) {

    return matches.some(
        match =>
            typeof match.sourceUrl === 'string' &&
            match.sourceUrl.trim() !== ''
    );
}


// ==========================================================
// ОПРЕДЕЛЕНИЕ ФОТОСТОКА
// ==========================================================
//
// Пока используем простой анализ URL.
//
// В дальнейшем это можно заменить
// на отдельный Source Classifier.
//

function isStockSource(matches) {

    const stockDomains = [
        'istockphoto.com',
        'gettyimages.com',
        'shutterstock.com',
        'adobe.com',
        'stock.adobe.com',
        'depositphotos.com',
        'alamy.com',
        'dreamstime.com'
    ];


    return matches.some(match => {

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


            return stockDomains.some(
                domain =>
                    lowerUrl.includes(domain)
            );
        });
    });
}


// ==========================================================
// ПРОВЕРКА МЕТАДАННЫХ АВТОРА
// ==========================================================

function hasAuthorMetadata(image) {

    return Boolean(
        image.author ||
        image.creator ||
        image.byLine
    );
}


// ==========================================================
// ПРОВЕРКА COPYRIGHT
// ==========================================================

function hasCopyrightMetadata(image) {

    return Boolean(
        image.copyright ||
        image.rights ||
        image.copyrightNotice
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


    // ------------------------------------------------------
    // 1. EXACT MATCH
    // ------------------------------------------------------

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


    // ------------------------------------------------------
    // 2. VISUAL MATCH
    // ------------------------------------------------------

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


    // ------------------------------------------------------
    // 3. SOURCE FOUND
    // ------------------------------------------------------

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


    // ------------------------------------------------------
    // 4. STOCK SOURCE
    // ------------------------------------------------------

    const stockSource =
        isStockSource(matches);


    if (stockSource) {

        score += RISK_POINTS.stockSource;

        factors.push({
            code: 'stockSource',
            points: RISK_POINTS.stockSource,
            description:
                'Найден источник на фотостоке'
        });
    }


    // ------------------------------------------------------
    // 5. AUTHOR METADATA
    // ------------------------------------------------------

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


    // ------------------------------------------------------
    // 6. COPYRIGHT METADATA
    // ------------------------------------------------------

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


    // ------------------------------------------------------
    // 7. SOURCE UNKNOWN
    // ------------------------------------------------------

    //
    // Добавляем этот признак только тогда,
    // когда внешних совпадений нет
    // и источник изображения не определён
    // по имеющимся данным.
    //

    const sourceUnknown =
        matches.length === 0 &&
        !hasAuthorMetadata(image) &&
        !hasCopyrightMetadata(image);


    if (sourceUnknown) {

        score += RISK_POINTS.sourceUnknown;

        factors.push({
            code: 'sourceUnknown',
            points: RISK_POINTS.sourceUnknown,
            description:
                'Источник изображения не установлен'
        });
    }


    // ------------------------------------------------------
    // ОГРАНИЧЕНИЕ SCORE
    // ------------------------------------------------------

    //
    // Risk Score не может быть больше 100.
    //

    score = Math.min(
        score,
        MAX_RISK_SCORE
    );


    // ------------------------------------------------------
    // УРОВЕНЬ РИСКА
    // ------------------------------------------------------

    const level =
        getRiskLevel(score);


    // ------------------------------------------------------
    // РЕЗУЛЬТАТ
    // ------------------------------------------------------

    return {

        riskScore: score,

        riskLevel: level,

        riskFactors: factors,

        // Сохраняем технические признаки.
        indicators: {

            exactMatch,

            visualMatch,

            sourceFound,

            stockSource,

            authorMetadata,

            copyrightMetadata,

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

            riskScore: risk.riskScore,

            riskLevel: risk.riskLevel,

            riskFactors: risk.riskFactors,

            riskIndicators: risk.indicators
        };
    });
}