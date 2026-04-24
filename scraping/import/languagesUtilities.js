/**********************************************************/
/*    utilities to deal with languages and conversions    */
/*                                                        */
/**********************************************************/

const path = require('path');
const fs = require('fs');
const {removeAccents, removeDoubles, simplify} = require('./stringUtilities.js');
const {getCountriesInfo} = require('./jsonUtilities.js');
const { get } = require('http');
const { all } = require('axios');

const rootDirectory = path.resolve('.').match(/.*scraping/)[0]+'/';
const dictionaryFile = rootDirectory+'languages/dictionary.json';
// const CountriesAndCitiesFile = rootDirectory+'countriesAndCities.json';


module.exports = {getStyleList, fromLanguages, checkLanguages, 
    getAvailableLanguages, getDictionary, saveDicts, getStyles, getDicts};

// returns the content of the dictionary file, which contains the different styles and date formats for each language
function getDicts(){
    try{
        return JSON.parse(fs.readFileSync(dictionaryFile, 'utf8'));
    }catch(err){
        console.log('\x1b[36mError: cannot open dictionary file:  \'%s\'.\x1b[0m%s\n',dictionaryFile,err);
    }
}


// return the list of styles for each language. Loads dictionary file and extract styles for each language. If a language does not have styles defined, it is assigned an empty list.
function getStyles(){
    const dicts = getDicts();
    const styles = Object.fromEntries(
        Object.entries(dicts).map(([langue, data]) => [langue, Object.keys(data.styles ?? [])])
    );
    return styles;
}

function saveDicts(dict){
    try{
        fs.writeFileSync(dictionaryFile, JSON.stringify(dict));
    }catch(err){
        console.log('\x1b[36mError: cannot save dictionary file:  \'%s\'.\x1b[0m%s\n',dictionaryFile,err);
    }
}

// return the dictionary for a given language
function getDictionary(language){
    try{
        const dict = getDicts();
        return dict[language.toLowerCase()];
    }catch(err){
        console.log('\x1b[36mError: cannot open dictionary file:  \'%s\'.\x1b[0m%s\n',dictionaryFile,err);
    }
}



// return the list of styles for each country in the input list, based on the languages spoken in this country and the styles defined for these languages in the dictionary file. If a language does not have styles defined, it is assigned an empty list.
function getStyleList(countries){
    const allCountries = getCountriesInfo();
    const dicts = getDicts();
    const styles = Object.fromEntries(
        countries.map(country => {
            const languages = allCountries[country].languages;
            const countryStyles = languages.flatMap(language => {
                const dict = dicts[language.toLowerCase()];
                return dict ? Object.keys(dict.styles) : [];
            });
            return [country, [...new Set(countryStyles)]];
        })
    );
    return styles;
}



// function getStyleList(dict = null){

//     try{
//         const res = JSON.parse(fs.readFileSync(styleConversionFile, 'utf8'));
//         const language = Object.keys(res)[0];
//         return Object.keys(res[language]);
//     }catch(err){
//         console.log('\x1b[36mWarning: cannot open style conversion file JSON file:  \'%s\'.\x1b[0m%s\n',styleConversionFile,err);
//     }
// }



function fromLanguages(jsonObject, languages){
    const res = {};
    Object.keys(jsonObject).filter(language => languages.includes(language))
    .forEach(language => {
        Object.keys(jsonObject[language]).forEach(key =>{
            res[key] = res.hasOwnProperty(key)?res[key].concat(jsonObject[language][key]):jsonObject[language][key];
        });
    }); 
    return res;
}

function checkLanguages(venues){
    let showMessage = false;
    // identify required languages from the list of venues, then check if they are defined in the different conversion files, and display a message for each missing language. 
    const venuesLanguages = [...new Set(venues.map(el => el.language))];
    let dicts = getDicts();
    if (dicts === undefined){
        console.log('\x1b[31mError: no dictionary found. Create a dictionary file at \'%s\' with the following structure: \n{\n  "language1": {\n    "styles": {\n      "style1": "style1 regex",\n      "style2": "style2 regex"\n    },\n    "datePatterns": {\n      "pattern1": "pattern1 regex",\n      "pattern2": "pattern2 regex"\n    },\n    "cancellationKeywords": ["keyword1", "keyword2"]\n  },\n  "language2": {\n    ...\n  }\n}\x1b[0m\n', dictionaryFile);
        return;
    }

    // check if all languages are defined in the dictionary file. If not, display a message for each missing language.
    venuesLanguages.filter(language => !Object.keys(dicts).includes(language))
    .forEach(language =>{
        console.log("\x1b[31mLanguage \x1b[0m%s\x1b[31m not defined in \x1b[0mdictionary\x1b[31m. Update '%s\'.\x1b[0m", language, dictionaryFile)
    });

    // for the languages that are defined in the dictionary file, check if all attributes are defined.
    venuesLanguages.filter(language => Object.keys(dicts).includes(language))
    .forEach(language =>{
        const dict = dicts[language];

        // check days dictionary
        if (!dict.dayDict){
            showMessage = true;
            console.log("\x1b[31mLanguage \x1b[0m%s\x1b[31m does not have day dictionary defined in \x1b[0mdictionary\x1b[31m. Update '%s\'.\x1b[0m", language, dictionaryFile)
        }else{
            ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].forEach(day =>{
                if (!dict.dayDict[day]){
                    showMessage = true;
                    console.log("\x1b[31mLanguage \x1b[0m%s\x1b[31m does not have %s defined in day dictionary in \x1b[0mdictionary\x1b[31m. Update '%s\'.\x1b[0m", language, day, dictionaryFile)
                }});
        }

        // check months dictionary
        if (!dict.monthsDict){
            showMessage = true; 
            console.log("\x1b[31mLanguage \x1b[0m%s\x1b[31m does not have month dictionary defined in \x1b[0mdictionary\x1b[31m. Update '%s\'.\x1b[0m", language, dictionaryFile)
        }else{
            // LANGUAGE TO BE SET TO ENGLISH FOR KEYWORDS
            // ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"].forEach(month =>{
            //     if (!dict.monthDict[month]){    
            //         showMessage = true;
            //         console.log("\x1b[31mLanguage \x1b[0m%s\x1b[31m does not have %s defined in month dictionary in \x1b[0mdictionary\x1b[31m. Update '%s\'.\x1b[0m", language, month, dictionaryFile)
            //     }});
        }

        ["rangeDelimiters", "rightRangeDelimiters", "rangeSeparators", "timeRangeDelimiters", "cancellationKeywords"]
        .forEach(attribute =>{
                if (!dict[attribute]){
                    showMessage = true;
                    console.log("\x1b[31mLanguage \x1b[0m%s\x1b[31m does not have %s defined in \x1b[0mdictionary\x1b[31m. Update '%s\'.\x1b[0m", language, attribute, dictionaryFile)
                }
            });

        // check special markers dictionary
        if (!dict.specialMarkers){
            showMessage = true;
            console.log("\x1b[31mLanguage \x1b[0m%s\x1b[31m does not have special markers defined in \x1b[0mdictionary\x1b[31m. Update '%s\'.\x1b[0m", language, dictionaryFile)
        }else{ 
            ["today", "tomorrow", "exception"].forEach(marker =>{
                if (!dict.specialMarkers[marker]){
                    showMessage = true;
                    console.log("\x1b[31mLanguage \x1b[0m%s\x1b[31m does not have %s defined in special markers dictionary in \x1b[0mdictionary\x1b[31m. Update '%s\'.\x1b[0m", language, marker, dictionaryFile)
                }   
            });
        }

        // // check styles dictionary
        // if (!dict.styles){
        //     showMessage = true;
        //     console.log("\x1b[31mLanguage \x1b[0m%s\x1b[31m does not have styles defined in \x1b[0mdictionary\x1b[31m. Update '%s\'.\x1b[0m", language, dictionaryFile)
        // }   

    });
    
    if (showMessage){
        console.log('Fix languages issues then run script again.\n');
    }
}

// languages are available if a dictionary exists for them
function getAvailableLanguages(){
    const dicts = getDicts();
    return Object.keys(dicts);
}

