import * as jsonfile from 'jsonfile';
import * as Nightmare from 'nightmare';
const nightmare = new Nightmare({ show: false });

interface IWordDefinition {
    meaning: string;
    english?: string;
    example?: string;
    synonyms?: string[];
}

interface IWordData {
    word: string;
    flexion?: string;
    grammar: string;
    definitions: IWordDefinition[];
}

class DictScraper {
    private macedonianLetters: string[];
    private currentLetterIndex: number;
    public mainUrl: string;
    private allWordRangeURIs: string[];
    private allWordURIs: string[];
    public allWords: IWordData[];

    constructor() {
        this.macedonianLetters = ['а', 'б', 'в', 'г', 'д', 'ѓ', 'е', 'ж', 'з', 'ѕ', 'и', 'ј', 'к', 'л', 'љ', 'м', 'н', 'њ', 'о', 'п', 'р', 'с', 'т', 'ќ', 'у', 'ф', 'х', 'ц', 'ч', 'џ', 'ш'];
        this.currentLetterIndex = 0;
        this.mainUrl = 'http://makedonski.info';
        this.allWordRangeURIs = [];
        this.allWordURIs = [];
        this.allWords = [];
    }

    public async scrape(): Promise<any> {
        const wordRangeURIsFilePath = './wordRangeURIs.json';
        await this.readJSONFile(wordRangeURIsFilePath)
            .then(async (wordRangeURIs) => {
                if (wordRangeURIs.length)
                    return this.allWordRangeURIs = wordRangeURIs;
                for (let i = 0; i < this.macedonianLetters.length; i++) {
                    const letter = this.macedonianLetters[i];
                    await this.getWordRangeURIsByLetter(letter);
                }
                this.createJSONFile(this.allWordRangeURIs, wordRangeURIsFilePath);
            });
        const allWordURIsFilePath = './wordURIs.json';
        await this.readJSONFile(allWordURIsFilePath)
            .then(async (wordURIs) => {
                if (wordURIs.length)
                    return this.allWordURIs = wordURIs;
                for (let i = 0; i < this.allWordRangeURIs.length; i++) {
                    const rangeURI = this.allWordRangeURIs[i];
                    await this.getWordURIsByRange(rangeURI);
                }
                this.createJSONFile(this.allWordURIs, allWordURIsFilePath);
            });
        for (let i = 0; i < this.allWordURIs.length; i++) {
            const wordURI = encodeURI(this.allWordURIs[i]);
            await this.getWordData(wordURI);
        }
        const allWordsDataFilePath = './allWordsData.json';
        return this.createJSONFile(this.allWords, allWordsDataFilePath);
    }

    private getWordRangeURIsByLetter(letter: string): Promise<any> {
        return new Promise((resolve, reject) => {
            const letterURI = `${this.mainUrl}/letter/${letter}`;
            const rangesSelectElement = '#ranges';
            nightmare.goto(letterURI)
                .wait(rangesSelectElement)
                .evaluate(() => {
                    const rangeSelectOptionSelector = '#ranges option';
                    const rangeSelectOptions = document.querySelectorAll(rangeSelectOptionSelector);
                    const letterRangeURIs = [];
                    rangeSelectOptions.forEach((option: HTMLOptionElement) => letterRangeURIs.push(option.value));
                    return letterRangeURIs;
                })
                .then((letterRangeURIs: string[]) => {
                    console.log(`Parsed all range URIs for letter ${letter}`);
                    this.allWordRangeURIs.push(...letterRangeURIs);
                    resolve(letterRangeURIs);
                })
                .catch((err: Error) => reject(err));
        });
    }

    private getWordURIsByRange(wordRangeURI: string): Promise<any> {
        return new Promise((resolve, reject) => {
            const wordSelectElement = '#lexems';
            nightmare.goto(`${this.mainUrl}${wordRangeURI}`)
                .wait(wordSelectElement)
                .evaluate(() => {
                    const wordSelectOptionSelector = '#lexems option';
                    const wordSelectOptions = document.querySelectorAll(wordSelectOptionSelector);
                    const rangeWordURIs = [];
                    wordSelectOptions.forEach((option: HTMLOptionElement) => rangeWordURIs.push(option.value));
                    return rangeWordURIs;
                })
                .then((rangeWordURIs: string[]) => {
                    console.log(`Parsed all word URIs for range ${wordRangeURI}`);
                    this.allWordURIs.push(...rangeWordURIs);
                    resolve(rangeWordURIs);
                })
                .catch((err: Error) => reject(err));
        });
    }

    private getWordData(encodedWordURI: string): Promise<any> {
        return new Promise((resolve, reject) => {
            const mainContentDiv = '#main_content';
            nightmare.goto(`${this.mainUrl}/#${encodedWordURI}`)
                .wait(mainContentDiv)
                .evaluate(() => {
                    const wordSelector = '.lexem span:first-of-type';
                    const grammarSelector = '.grammar i';
                    const wordData: IWordData = {
                        word: document.querySelector(wordSelector).innerHTML,
                        grammar: document.querySelector(grammarSelector).innerHTML,
                        definitions: []
                    };
                    const flexionDiv = document.querySelector('.flexion i');
                    if (flexionDiv) wordData.flexion = flexionDiv.innerHTML;
                    const definitionDivs = document.querySelectorAll('.definition');
                    definitionDivs.forEach((definitionDiv: HTMLDivElement) => {
                        const meaningDiv: any = definitionDiv.querySelector('.meaning');
                        const definition: IWordDefinition = {
                            meaning: meaningDiv.innerText
                        };
                        const engTranslationDiv: any = definitionDiv.querySelector('.translation.eng a');
                        if (engTranslationDiv) definition.english = engTranslationDiv.innerText;
                        const exampleDiv: any = definitionDiv.querySelector('.example');
                        if (exampleDiv) definition.example = exampleDiv.innerText;
                        const synonymDivs: any = definitionDiv.querySelectorAll('.semem-links a');
                        if (synonymDivs.length) {
                            definition.synonyms = [];
                            synonymDivs.forEach((synonymDiv: HTMLDivElement) => definition.synonyms.push(synonymDiv.innerText));
                        }
                        wordData.definitions.push(definition);
                    });
                    return wordData;
                })
                .then((wordData: IWordData) => {
                    console.log(`Parsed all word data for word ${wordData.word}`);
                    this.allWords.push(wordData);
                    resolve(wordData);
                })
                .catch((err: Error) => reject(err));
        });
    }

    public readJSONFile(filePath: string): Promise<any> {
        return new Promise((resolve, reject) => {
            jsonfile.readFile(filePath, (err: Error, data: any) => {
                if (err) {
                    console.log(`Error: ${err}`);
                    return reject(err);
                }
                console.log(`Parsed data from JSON file: ${filePath}`);
                resolve(data);
            })
        });
    }

    private createJSONFile(data, filePath: string): Promise<any> {
        return new Promise((resolve, reject) => {
            jsonfile.writeFile(filePath, data, (err: Error) => {
                if (err) {
                    console.log(`Error: ${err}`);
                    return reject(err);
                }
                console.log(`Added data to JSON file: ${filePath}`);
                resolve(data);
            })
        });
    }
}

const scraper = new DictScraper();
scraper.scrape()
    .then(allWords => console.log(allWords))
    .catch(err => console.log(err));