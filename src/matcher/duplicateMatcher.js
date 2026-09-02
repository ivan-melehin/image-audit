// ==========================================================
// Image Audit
// src/matcher/duplicateMatcher.js
// ==========================================================
//
// Ищет:
// 1. точные дубликаты по SHA-256;
// 2. похожие изображения по pHash.
//
// Для похожих изображений используется граф:
// если A похож на B, а B похож на C, все три изображения
// относятся к одной connected component.
// Это корректнее, чем алгоритм "первое изображение + похожие".
//
// ==========================================================

import { hammingDistance } from '../hash/hashEngine.js';

function createUnionFind(size) {
    const parent = Array.from({ length: size }, (_, index) => index);
    const rank = new Array(size).fill(0);

    function find(index) {
        while (parent[index] !== index) {
            parent[index] = parent[parent[index]];
            index = parent[index];
        }

        return index;
    }

    function union(a, b) {
        const rootA = find(a);
        const rootB = find(b);

        if (rootA === rootB) {
            return;
        }

        if (rank[rootA] < rank[rootB]) {
            parent[rootA] = rootB;
        } else if (rank[rootA] > rank[rootB]) {
            parent[rootB] = rootA;
        } else {
            parent[rootB] = rootA;
            rank[rootA]++;
        }
    }

    return { find, union };
}

function buildSimilarGroups(images, threshold, excluded) {
    const candidates = images
        .map((image, index) => ({ image, index }))
        .filter(({ image }) =>
            !excluded.has(image) &&
            Boolean(image.perceptualHash)
        );

    if (candidates.length < 2) {
        return [];
    }

    const unionFind = createUnionFind(candidates.length);

    // Сравниваем каждую пару кандидатов.
    // Это всё ещё O(n²), но теперь результатом является
    // полноценное объединение связанных похожих изображений.
    for (let i = 0; i < candidates.length; i++) {
        for (let j = i + 1; j < candidates.length; j++) {
            const distance = hammingDistance(
                candidates[i].image.perceptualHash,
                candidates[j].image.perceptualHash
            );

            if (
                distance !== null &&
                distance <= threshold
            ) {
                unionFind.union(i, j);
            }
        }
    }

    const components = new Map();

    for (let i = 0; i < candidates.length; i++) {
        const root = unionFind.find(i);

        if (!components.has(root)) {
            components.set(root, []);
        }

        components.get(root).push(candidates[i].image);
    }

    return Array.from(components.values())
        .filter(group => group.length >= 2);
}

export function findDuplicates(images, similarityThreshold = 10) {
    if (!Array.isArray(images)) {
        throw new TypeError(
            'findDuplicates: images должен быть массивом'
        );
    }

    const groups = [];
    const exactGroups = new Map();

    // ------------------------------------------------------
    // 1. EXACT DUPLICATES
    // ------------------------------------------------------

    for (const image of images) {
        if (!image.sha256) {
            continue;
        }

        if (!exactGroups.has(image.sha256)) {
            exactGroups.set(image.sha256, []);
        }

        exactGroups.get(image.sha256).push(image);
    }

    const groupedImages = new Set();

    for (const [sha256, groupImages] of exactGroups) {
        if (groupImages.length < 2) {
            continue;
        }

        for (const image of groupImages) {
            groupedImages.add(image);
        }

        groups.push({
            id: groups.length + 1,
            type: 'exact',
            sha256,
            images: groupImages
        });
    }

    // ------------------------------------------------------
    // 2. SIMILAR IMAGES
    // ------------------------------------------------------

    const similarGroups = buildSimilarGroups(
        images,
        similarityThreshold,
        groupedImages
    );

    for (const groupImages of similarGroups) {
        groups.push({
            id: groups.length + 1,
            type: 'similar',
            threshold: similarityThreshold,
            images: groupImages
        });
    }

    return groups;
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

// После Metadata Analyzer выбираем representative.
// Для exact-группы SHA общий.
// Для similar-группы ищем любой экземпляр с metadata.
export function enrichDuplicateGroupsWithMetadata(
    duplicateGroups,
    metadataImages = []
) {
    const metadataBySha256 = new Map();

    for (const image of metadataImages) {
        if (!image.sha256 || !hasMetadata(image)) {
            continue;
        }

        if (!metadataBySha256.has(image.sha256)) {
            metadataBySha256.set(image.sha256, image);
        }
    }

    return duplicateGroups.map(group => {
        let metadataImage = null;

        if (group.sha256) {
            metadataImage = metadataBySha256.get(group.sha256) || null;
        }

        if (!metadataImage && Array.isArray(group.images)) {
            for (const image of group.images) {
                if (!image.sha256) {
                    continue;
                }

                const candidate = metadataBySha256.get(image.sha256);

                if (candidate) {
                    metadataImage = candidate;
                    break;
                }
            }
        }

        return {
            ...group,
            metadata: metadataImage,
            representative: metadataImage
        };
    });
}
