export const config = {
    port: 3000,

    crawler: {
        maxPages: 100,
        maxDepth: 2
    },

    images: {
        maxFileSize: 10 * 1024 * 1024
    },

    reports: {
        directory: './reports'
    }
};