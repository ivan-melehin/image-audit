import { ReverseSearchProvider } from '../reverseSearchProvider.js';


// Тестовый provider.
// В дальнейшем вместо него можно подключить
// реальный reverse image search API.
export class MockProvider extends ReverseSearchProvider {

    constructor() {
        super('mock');
    }


    async search(image) {

        // Небольшая искусственная задержка,
        // имитирующая обращение к внешнему API.
        await new Promise(resolve =>
            setTimeout(resolve, 100)
        );


        // Для технических изображений
        // внешний поиск не выполняем.
        if (image.isSmallTechnical) {
            return [];
        }


        // Для тестирования создаём
        // искусственное совпадение только
        // для изображений, содержащих "test2".
        //
        // Это позволит легко проверить,
        // что результат действительно дошёл
        // до следующего этапа.
        if (!image.imageUrl.toLowerCase().includes('test2')) {
            return [];
        }


        return [
            {
                sourceUrl:
                    'https://example.com/images/test2.jpg',

                pageUrl:
                    'https://example.com/example-page',

                title:
                    'Тестовое внешнее совпадение',

                similarity: 95,

                provider: this.name,

                foundAt: new Date().toISOString()
            }
        ];
    }
}