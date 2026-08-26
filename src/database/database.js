// Импортируем встроенный SQLite из Node.js.
import { DatabaseSync } from 'node:sqlite';


// Создаём или открываем базу данных.
//
// Файл image-audit.db появится
// в корне проекта.
const db = new DatabaseSync(
    './image-audit.db'
);


// ======================================================
// Создание таблиц
// ======================================================

// Таблица групп.
db.exec(`
    CREATE TABLE IF NOT EXISTS duplicate_groups (

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        type TEXT NOT NULL,

        sha256 TEXT,

        threshold INTEGER,

        created_at TEXT NOT NULL
    )
`);


// Таблица изображений,
//
// которые входят в группы.
db.exec(`
    CREATE TABLE IF NOT EXISTS duplicate_images (

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        group_id INTEGER NOT NULL,

        page_url TEXT NOT NULL,

        image_url TEXT NOT NULL,

        sha256 TEXT,

        perceptual_hash TEXT,

        FOREIGN KEY (group_id)
            REFERENCES duplicate_groups(id)
    )
`);


// ======================================================
// Сохранение групп
// ======================================================

export function saveDuplicateGroups(groups) {

    // Подготавливаем SQL-запрос
    // для добавления группы.
    const groupStatement = db.prepare(`
        INSERT INTO duplicate_groups
        (
            type,
            sha256,
            threshold,
            created_at
        )
        VALUES
        (
            ?,
            ?,
            ?,
            ?
        )
    `);


    // Подготавливаем запрос
    // для добавления изображения.
    const imageStatement = db.prepare(`
        INSERT INTO duplicate_images
        (
            group_id,
            page_url,
            image_url,
            sha256,
            perceptual_hash
        )
        VALUES
        (
            ?,
            ?,
            ?,
            ?,
            ?
        )
    `);


    // Перебираем группы.
    for (const group of groups) {

        // Сохраняем группу.
        groupStatement.run(
            group.type,
            group.sha256 ?? null,
            group.threshold ?? null,
            new Date().toISOString()
        );


        // Получаем ID только что созданной группы.
        const result = db.prepare(
            'SELECT last_insert_rowid() AS id'
        ).get();


        const groupId = result.id;


        // Сохраняем изображения группы.
        for (const image of group.images) {

            imageStatement.run(

                groupId,

                image.pageUrl,

                image.imageUrl,

                image.sha256 ?? null,

                image.perceptualHash ?? null
            );
        }
    }


    console.log(
        `\nВ базу данных сохранено групп: ${groups.length}`
    );
}