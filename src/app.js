// Импортируем функцию crawl из файла crawler.js.
// crawl отвечает за обход сайта и поиск страниц.
import { crawl } from './crawler/crawler.js';

// Импортируем функцию collectImages из imageCollector.js.
// collectImages получает найденные страницы и ищет на них изображения.
import { collectImages } from './collector/imageCollector.js';


// Адрес сайта, с которого начнётся обход.
// Именно эту страницу первой откроет crawler.
const startUrl = 'http://localhost:3000';


// Запускаем crawler и передаём ему начальный URL.
//
// await означает: дождаться, пока crawl закончит работу,
// прежде чем выполнять следующую строку.
//
// В результате pages будет содержать массив найденных страниц.
const pages = await crawl(startUrl);


// Выводим в консоль заголовок перед списком страниц.
console.log('\nFound pages:');


// Перебираем все найденные страницы.
//
// page — это одна страница из массива pages.
// На каждой итерации цикла она выводится в консоль.
for (const page of pages) {
    console.log(page);
}


// Передаём найденные страницы в Image Collector.
//
// collectImages открывает каждую страницу,
// находит изображения и возвращает их в виде массива.
//
// Результат сохраняем в переменную images.
const images = await collectImages(pages);


// Выводим в консоль заголовок перед списком изображений.
console.log('\nFound images:');


// Перебираем все найденные изображения.
//
// image — один объект с информацией об изображении.
// Например, он может содержать:
// pageUrl — на какой странице найдено изображение;
// imageUrl — адрес самого изображения;
// alt — значение атрибута alt;
// title — значение атрибута title.
for (const image of images) {
    console.log(image);
}