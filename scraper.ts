import * as jsonfile from 'jsonfile';
import * as Nightmare from 'nightmare';
import * as xray from 'x-ray';
const x = xray();
const nightmare = new Nightmare({ show: false });

interface IWordDefinition {
    meaning: string;
    english?: string;
    example?: string;
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
        for (let i = 0; i < this.macedonianLetters.length; i++) {
            const letter = this.macedonianLetters[i];
            await this.getWordRangeURIsByLetter(letter);
        }
        for (let i = 0; i < this.allWordRangeURIs.length; i++) {
            const rangeURI = this.allWordRangeURIs[i];
            await this.getWordURIsByRange(rangeURI);
        }
        //this.allWordURIs = ['а/сврз', 'а/чест'];
        for (let i = 0; i < this.allWordURIs.length; i++) {
            const wordURI = encodeURI(this.allWordURIs[i]);
            await this.getWordData(wordURI);
        }
        const wordsFilePath = './words.json';
        return this.createJSONFile(this.allWords, wordsFilePath);
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
                    }
                    const flexionDiv = document.querySelector('.flexion i');
                    if (flexionDiv) wordData.flexion = flexionDiv.innerHTML;
                    const meaningsSelector = '.meaning';
                    const meaningDivs = document.querySelectorAll(meaningsSelector);
                    const engTranslationsSelector = '.translation.eng a';
                    const engTranslationDivs: any = document.querySelectorAll(engTranslationsSelector);
                    const examplesSelector = '.example';
                    const exampleDivs: any = document.querySelectorAll(examplesSelector);
                    meaningDivs.forEach((meaningDiv: HTMLDivElement, index: number) => {
                        const definition: IWordDefinition = {
                            meaning: meaningDiv.innerText,
                            english: engTranslationDivs[index].innerText,
                            example: exampleDivs[index].innerText
                        };
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

    private createJSONFile(data, filePath: string): Promise<any> {
        return new Promise((resolve, reject) => {
            jsonfile.writeFile(filePath, data, (err: Error) => {
                if (err) {
                    console.log(`Error: ${err}`);
                    return reject(err);
                }
                console.log('Added data to JSON file');
                resolve(data);
            })
        });
    }
}

const scraper = new DictScraper();
scraper.scrape()
    .then(allWords => console.log(allWords))
    .catch(err => console.log(err));