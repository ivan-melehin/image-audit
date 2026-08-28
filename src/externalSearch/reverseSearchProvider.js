// Базовый интерфейс для reverse image search provider.
//
// Любой внешний provider должен реализовать
// метод search(image).

export class ReverseSearchProvider {

    constructor(name) {
        this.name = name;
    }

    // Поиск внешних совпадений.
    //
    // Метод должен быть переопределён
    // в конкретном provider.
    async search(image) {
        throw new Error(
            `Method search() is not implemented in provider: ${this.name}`
        );
    }
}