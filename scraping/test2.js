const monthsDict = {
  janvier: ["jan", "janv"],
  fevrier: ["fev"],
  mars: ["mar"],
  avril: ["avr"],
  mai: ["mai"],
  juin: ["juin"],
  juillet: ["juil", "juill"],
  aout: ["aout"],
  septembre: ["sep", "sept"],
  octobre: ["oct"],
  novembre: ["nov"],
  décembre: ["dec"]
};

const shortMonths = Object.values(monthsDict).flat();
const longMonths = Object.keys(monthsDict);
const rangeDeLimiters = [["du","au"],["a partir du","jusqu'au"]];
const rangeSeparators = ["->", "→","-"];

const timeRangeDelimiters = [["de","a"],["de","jusqu'a"]];
const timeRangeSeparators = ["-"];



const dayDict = {long: ["lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche"],
                 short: ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"]
                };

const ignoreList = ["&","et"]; // those keywords are not mandatory to understand the structure
const startTimeKeywords = ["a", "a partir de"];


const moisRegex = Object.values(monthsDict).flat().map(m => m.replace('.', '\\.')).join('|');
const currentYear = new Date().getFullYear();
const shortCurrentYear = currentYear - Math.floor(currentYear / 100) * 100;
nextYears = [shortCurrentYear, shortCurrentYear+1, shortCurrentYear+2];

// il reste les . et / et - entre les nombres
function cleanDate(s){

    // Fix caracters encoding errors
    s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
         .replace(/[^\x00-\x7F]/g,'') //remove non standard caracters => to be improved
         .toLowerCase()
         .replace(/(?<=\p{L})\./gu, '') //replace(/(?<=[a-zÀ-ÖØ-öø-ÿ])\./g, '') // remove all dots directly following a letter
         .replace(/–|—/g, "-") // normalize dashes
         .replace(/le|,|;/g, " ") // remove unprocessed separators
         .replace(/\s+/g, " ")
         .trim();

    // normalize time
    const hourPattern = /\b(\d{1,2})([:hH]?)(\d{1,2})?(\s*AM|\s*PM)?\b/gi;

    s = s.replace(hourPattern, (match, h, sep, m, ampm) => {
   
        // If no separator nor AM/PM, then it is not a time
        if (!sep && !ampm) return match;


        let hour = parseInt(h, 10);
        let minute = m ? parseInt(m, 10) : 0;

        if (ampm) {
            ampm = ampm.toUpperCase();
            if (ampm === 'PM' && hour < 12) hour += 12;
            if (ampm === 'AM' && hour === 12) hour = 0;
        }

        const hh = hour.toString().padStart(2, '0');
        const mm = minute.toString().padStart(2, '0');

        return `${hh}:${mm}`;
    });

    // make all numbers two digits at least
    // replace xx-yy-zz par xx.yy.zz
    s = s.replace(/\b(\d)\b/g, '0$1')
         .replace(/\b(\d{2})-(\d{2})-(\d{2})\b/g, "$1.$2.$3");

    // regex to ensure separators are surrounded by spaces
    const sepRegex = new RegExp(
        "\\s*(" + rangeSeparators.map(s => s.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")).join("|") + ")\\s*",
        "g"
    );

    s = s.replace(sepRegex, " $1 ");
    return s;
}
 


function makeToken(str, dateFormat){
    if (/\p{L}/u.test(str) || /^[^0-9]*$/.test(str)){
        // contains letters
        let possibilities = [];
        if (dateFormat.month === 'long' && longMonths.includes(str)){
            possibilities.push('month');
        }
        if (dateFormat.month === 'short' && shortMonths.includes(str)){
            possibilities.push('month');
        }
        if ('weekDay' in dateFormat){
            if (dateFormat.weekDay === 'short' && dayDict.short.includes(str)){
                possibilities.push('weekDay');
            }
            if (dateFormat.weekDay === 'long' && dayDict.long.includes(str)){
                possibilities.push('weekDay');
            }
        }
        // text is not date text, maybe keyword
        if (possibilities.length === 0){
            return {type: 'text', rawText: str};
        }
        if (possibilities.length === 1){
            possibilities = possibilities[0];
        }
        return {type: possibilities, rawText: str};
    }else{
        // only digits
        if (str.includes(':')){
            return {type: 'time', rawText: str};
        }
        if (/\D/.test(str)){
            const numList = str.match(/\d{1,2}/g);
            // the number of elements should be lower than the number of elements of dateFormat
            if (numList.length > dateFormat.order.length){
                console.log("\x1b[31mError: text \x1b[0m"
                    +str
                    +"\x1b[31m has too many elements to construct a date.\x1b[0m");
            }
            // the sequence of elements follow the order of date format. We now list the possible
            // combinations
            let possibilities = [];
            for (let i = 0;i<2;i++){
                if (dateFormat.order.slice(i,i+numList.length).every((el, ind) => canBe(el,numList[ind]))){
                    possibilities.push(dateFormat.order.slice(i,i+numList.length));
                }
            }
            // if only one possibility, generate the corresponding unique tokens
            if (possibilities.length === 1){
                let res = [];
                for(let i = 0;i<numList.length;i++){
                    res.push({type: possibilities[0][i], rawText: numList[i]});
                    res[possibilities[0][i]] = numList[i];
                }
                return res;
            }
            // else return a  list of possibegroup of tokens
            // return {type: 'group', choices: possibilities, rawText: str};
            return {type: possibilities, numList: numList, rawText: str};
            
        }
        // length = 4 => it's a year
        if (str.length === 4){
            return {type: 'year', rawText: str};
        }
        // the field as length 2
        let possibilities = ['day'];
        if ('year' in dateFormat && dateFormat.year === 'short' && canBe('year',str)){
            possibilities.push('year');
        }
        if (dateFormat.month === 'numeric' && canBe('month',str)){
            possibilities.push('month');
        }
        if (possibilities.length === 1){
            possibilities = possibilities[0];
        }
        
        return {type: possibilities, rawText: str};  
    }
}

// test if a str consisting of two digits can be of type element (month, year)
function canBe(element, str){
    if (element === 'month'){
        return parseInt(str) <= 12;
    }
    if (element === 'year'){
        return nextYears.includes(parseInt(str));
    }
    if (element === 'day'){
        return parseInt(str) <= 31;
    }
}

// prepare time tokens and regroup sequence of text tokens.
// If a text token is just before a time token, remove this token and 
// add a field 'previousText' to the time token.
// identify range markers, remove others.
// Developpers function: try to see if removed tokens are in ignore list. If not, 
// verify that it is not a common syntax that has not been implemented

function preprocessTokens(list){
  const result = [];
  let buffer = null; // will accumulate successive text tokens

  for (const token of list) {

    if (token.type === "text") {
      if (buffer) {
        buffer.rawText += " " + token.rawText;
      } else {
        buffer = { ...token };
      }

    } else {
      // if a 'time' token is found
      if (token.type === "time") {
        if (buffer) {
          // buffer txt is added to the previousText field
          result.push({
            ...token,
            previousText: buffer.rawText
          });
          buffer = null;
          continue;
        }
      }

      // if the type is neither text nor time, buffer is released
      if (buffer) {
        result.push(buffer);
        buffer = null;
      }

      result.push(token);
    }
  }

  // S'il reste du texte à la fin
  if (buffer) {
    result.push(buffer);
  }

  return result.map(token => processTextToken(token))
               .filter(token => token.type !== 'unknown text');
}

// process text token: if it is a keyword, change the type to the corresponding situation.
// Remove others and send a warning to developpers if verbose 
// non text tokens are unchanged
function processTextToken(token, verbose = false){
    // don't process non text tokens
    if (token.type !== 'text'){
        return token;
    }    // if it is a starting delimiter
    if (rangeDeLimiters.map(el => el[0]).flat().includes(token.rawText)){
         token.type = 'rangeDelimiterStart';
        return token;
    }
    // if it is a end delimiter
    if (rangeDeLimiters.map(el => el[1]).flat().includes(token.rawText)){
        token.type = 'rangeDelimiterEnd';
        return token;
    }
    // if it is a range separator
    if (rangeSeparators.includes(token.rawText)){
        token.type = 'rangeSeparator';
        return token;
    }
    // by default, the type has not been recognized. Flag as unknown text
    token.type = 'unknown text';
    verbose = true;
    if (verbose && !ignoreList.includes(token.rawText)){
        console.log("\x1b[38;5;226mWarning: text \x1b[0m"
                    +token.rawText
                    +"\x1b[38;5;226m not found in ignore list. Check if it is a missing keyword.\x1b[0m");
    }
    return token;
}

// for each list of tokens, produce a list of (list of tokens) by resolving
// possibilities (each token has only one type). Each element of the list will be processed
// and discarded later if there are inconsistencies

function resolvePossibilities(tokenList){

    // transform every element into a list

    function newToken(token, t){
        const nt = {...token}; // prevents modification of the original token
        nt.type = t;
        return nt;
    }

    const l = tokenList.map(token => Array.isArray(token.type) ? token.type.map(t => newToken(token, t)) : [token]);
    
    // now every element is a list, make the cartesian product
    
    const result = [[]];

    for (const possibleTokens of l) {
        const newResult = [];
        for (const partial of result) {
        for (const currentToken of possibleTokens) {
            if (Array.isArray(currentToken.type)){
                // unfold groups
                const newOption = [...partial];
                for (let i = 0; i < currentToken.type.length; i++){
                    newOption.push({type: currentToken.type[i], rawText: currentToken.numList[i]});
                }
                newResult.push(newOption);
                
            }else{
                newResult.push([...partial, currentToken]);
            } 
        }
        }
        // replace the old array
        result.splice(0, result.length, ...newResult);
    }
    return result;
}

function tokenizeString(s, dateFormat){
    return preprocessTokens(s.split(" ").map(e => makeToken(e, dateFormat)).flat());
    
}

function extractDates(s, dateFormat){
    const tokenList = tokenizeString(cleanDate(s), dateFormat);
    return resolvePossibilities(tokenList);
}





// // --- Exemple d’utilisation ---
const text1 = `
  mardi 23 septembre 2026 à 18h
`;
const dateFormat1 = {
    year: 'long',
    month: 'long',
    weekDay: 'long',
    order: ['day','month','year']
}

const text1b = `
  23.09.26 à partir de 18h
`;

const dateFormat1b = {
    year: 'short',
    month: 'numeric',
    order: ['day','month','year']
}

const text2 = `
  du 17.02.26 à 20h au 18.02.26 à 4h
`;

const dateFormat2 = {
    year: 'short',
    month: 'numeric',
    order: ['day','month','year']
}

const text3 = `
  mar. 24 Jan, 2026, 07:30 PM-08:00 PM
`;

const dateFormat3 = {
    year: 'long',
    month: 'short',
    weekDay: 'short',
    order: ['day','month','year']
}

const text4 = `
  14, 15 & 16 novembre 2025 à 20h15
`;

const dateFormat4 = {
    year: 'long',
    month: 'long',
    order: ['day','month','year']
}

const text5 = `
  05 déc. 2025 20:00, 06 déc. 2025 20:00, 07 déc. 2025 15:00
`;

const dateFormat5 = {
    year: 'long',
    month: 'short',
    order: ['day','month','year']
}

const text6= "5 janvier à 8am";

const dateFormat6 = {
    month: 'long',
    order: ['day','month']
}

const text7= "23 nov 26, 27 dec 26";

const dateFormat7 = {
    month: 'short',
    year: 'short',
    order: ['day','month','year']
}

const text8= "23 nov 25, 02 dec 25"; // ce cas n'est pas ambigu car 02 ne suit pas 25

const dateFormat8 = {
    month: 'short',
    year: 'short',
    order: ['day','month','year']
}

const text9= "09 07.25"; // ce cas n'est pas ambigu car 02 ne suit pas 25

const dateFormat9 = {
    month: 'numeric',
    year: 'short',
    order: ['month','day','year']
}

const text10= "23 09 25, 02 12 25"; // ce cas n'est pas ambigu car 02 ne suit pas 25

const dateFormat10 = {
    month: 'numeric',
    year: 'short',
    order: ['day','month','year']
}


const text11 = `11.05.26-14.06.26 à 17h`;

const dateFormat11 = {
    month: 'numeric',
    year: 'short',
    order: ['day','month','year']
}


console.log("\n\n\n");
// console.log("text1: ",extractDates(text1,dateFormat1));
// console.log("text1b: ",extractDates(text1b,dateFormat1b));
// console.log("text2: ",extractDates(text2,dateFormat2));
console.log("text3: ",extractDates(text3,dateFormat3));
// console.log("text4: ",extractDates(text4,dateFormat4));
// console.log("text5: ",extractDates(text5,dateFormat5));
// console.log("text6: ",extractDates(text6,dateFormat6));
// console.log("text7: ",extractDates(text7,dateFormat7));
// console.log("text8: ",extractDates(text8,dateFormat8));
// console.log("text9: ",extractDates(text9,dateFormat9));
// console.log("text10: ",extractDates(text10,dateFormat10));
console.log("text11: ",extractDates(text11,dateFormat11));