// ==========================================================
// Image Audit
// src/externalSearch/reverseSearch.js
// ==========================================================
//
// Универсальный слой внешнего поиска.
//
// Provider отвечает за сам поиск.
// Этот модуль отвечает за единый формат результата.
//
// Особенно важно разделять:
//
// - text       — найдено текстовым поиском;
// - visual     — подтверждено визуальным сравнением;
// - exact      — подтверждено точное визуальное совпадение.
//
// Нельзя считать обычный текстовый поиск визуальным match.
//
// ==========================================================

function normalizeMatch(match, provider) {
    const normalized = {
        ...match
    };

    normalized.provider =
        normalized.provider || provider?.name || 'unknown';

    // Если provider явно указал тип — сохраняем его.
    if (normalized.evidenceType) {
        return normalized;
    }

    // Поддерживаем явные типы от будущих visual providers.
    if (
        normalized.matchType === 'exact' ||
        normalized.matchType === 'exact_visual'
    ) {
        normalized.evidenceType = 'exact';
        return normalized;
    }

    if (
        normalized.matchType === 'visual' ||
        normalized.matchType === 'visual_similarity'
    ) {
        normalized.evidenceType = 'visual';
        return normalized;
    }

    // По умолчанию отсутствие подтверждённого визуального
    // сравнения означает текстовое evidence.
    normalized.evidenceType = 'text';

    return normalized;
}

export async function reverseSearch(images, providers = []) {
    if (!Array.isArray(images)) {
        throw new TypeError(
            'reverseSearch: images должен быть массивом'
        );
    }

    if (!Array.isArray(providers)) {
        throw new TypeError(
            'reverseSearch: providers должен быть массивом'
        );
    }

    const results = images.map(image => ({
        ...image,
        externalMatches: []
    }));

    if (providers.length === 0) {
        return results;
    }

    for (const image of results) {
        for (const provider of providers) {
            if (!provider || typeof provider.search !== 'function') {
                console.log(
                    'External Search: provider имеет неправильный формат'
                );
                continue;
            }

            try {
                const matches = await provider.search(image);

                if (!Array.isArray(matches)) {
                    continue;
                }

                image.externalMatches.push(
                    ...matches.map(match =>
                        normalizeMatch(match, provider)
                    )
                );
            } catch (error) {
                // Ошибка одного provider не должна останавливать аудит.
                console.log(
                    `External Search error [${provider.name || 'unknown'}]: ${error.message}`
                );
            }
        }

        const uniqueMatches = [];
        const seen = new Set();

        for (const match of image.externalMatches) {
            const key = [
                match.pageUrl,
                match.sourceUrl,
                match.provider,
                match.evidenceType
            ].join('|');

            if (seen.has(key)) {
                continue;
            }

            seen.add(key);
            uniqueMatches.push(match);
        }

        image.externalMatches = uniqueMatches;
    }

    return results;
}
