// - false: (no verbose)
// - true: (to track why a date has been rejected)
// - 'full': full log for debug
verbose = false; 

// CHANGER const now !!!!!!!!!!!!

const dictionary = {
    monthsDict: {
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
        decembre: ["dec"]
    },
    rangeDeLimiters: [["du","au"],["a partir du","jusqu'au"],["de","a"]],
    rightRangeDelimiters: ["jusqu'au", "jusqu'a"],
    rangeSeparators: ["->", "→", "—","-"],
    timeRangeDelimiters: [["de","a"],["de","jusqu'a"]],
    timeMarkers: {"minuit": "24:00"},
    dayDict: {   
        monday: ["lun", "lundi", "lundis"],
        tuesday: ["mar", "mardi", "mardis",],
        wednesday: ["mer", "mercredi", "mercredis"],
        thursday: ["jeu", "jeudi", "jeudis"],
        friday: ["ven", "vendredi", "vendredis"],
            saturday: ["sam", "samedi", "samedis"],
        sunday: ["dim", "dimanche", "dimanches"]
    },
    specialMarkers: {  
        "today": ["aujourd'hui", "ce soir"],
        "tomorrow": ["demain"],
        "exception": ["sauf"]
    }
}

// const monthsDict = {
//   janvier: ["jan", "janv"],
//   fevrier: ["fev"],
//   mars: ["mar"],
//   avril: ["avr"],
//   mai: ["mai"],
//   juin: ["juin"],
//   juillet: ["juil", "juill"],
//   aout: ["aout"],
//   septembre: ["sep", "sept"],
//   octobre: ["oct"],
//   novembre: ["nov"],
//   decembre: ["dec"]
// };

// const rangeDeLimiters = [["du","au"],["a partir du","jusqu'au"],["de","a"]];
// const rightRangeDelimiters = ["jusqu'au", "jusqu'a"];
// const rangeSeparators = ["->", "→", "—","-"]; // classic dash will be processed by default

// const timeRangeDelimiters = [["de","a"],["de","jusqu'a"]];

// // keys: keyword, values: time for the time token
// const timeMarkers = {"minuit": "24:00"};


// const specialMarkers = {  "today": ["aujourd'hui", "ce soir"],
//                     "tomorrow": ["demain"],
//                     "exception": ["sauf"]
// }


// const dayDict = {   monday: ["lun", "lundi", "lundis"],
//                     tuesday: ["mar", "mardi", "mardis",],
//                     wednesday: ["mer", "mercredi", "mercredis"],
//                     thursday: ["jeu", "jeudi", "jeudis"],
//                     friday: ["ven", "vendredi", "vendredis"],
//                     saturday: ["sam", "samedi", "samedis"],
//                     sunday: ["dim", "dimanche", "dimanches"]
//                 };





// const dayList = [...Object.keys(dayDict), ...Object.values(dayDict).flat()];

const currentYear = new Date().getFullYear();
// const now = new Date();
const now = new Date(2025, 11, 1);
const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
const shortCurrentYear = currentYear - Math.floor(currentYear / 100) * 100;
nextYears = [shortCurrentYear, shortCurrentYear+1, shortCurrentYear+2];


//***************************************//
// preprocess the date string            //
//***************************************//

function cleanDate(s, rangeSeparators){

    // regex to identify range separators. "-" strictly surrounded by letters are ignored (it is not a
    // separator in "après-midi")
    const rangeSeparatorRegex = new RegExp("-(?![A-Za-zÀ-ÖØ-öø-ÿ])|(?<![A-Za-zÀ-ÖØ-öø-ÿ])-"+rangeSeparators.join("|"), "g");

    // regex to remove 
    // const escaped = ignoreList.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    // const ignoreRegex = new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");

    // Fix caracters encoding errors
    s = s.replace(/→/g,"—").normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
         .replace(/–/g, "-") // normalize dashes
         .replace(/[^\x00-\x7F—]/g,'') //remove non standard caracters => to be improved
         .toLowerCase()
         .replace(/,|;|\||\. |\.$/g, " ") // remove unprocessed separators. Separators like | without semantic meanings 
                    //  have been found in texts, so it is discarded also.
         .replace(rangeSeparatorRegex, ' — ') // replace rangeSeparators by long dash. Add spaces around to ensure token capture
         .replace(/(?<=\p{L})\./gu, '') //replace(/(?<=[a-zÀ-ÖØ-öø-ÿ])\./g, '') // remove all dots directly following a letter
        //  .replace(ignoreRegex, "") // remove elements from the ignore list
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
            ampm = ampm.trim().toUpperCase();
            if (ampm === 'PM' && hour < 12) hour += 12;
            if (ampm === 'AM' && hour === 12) hour = 0;
        }

        const hh = hour.toString().padStart(2, '0');
        const mm = minute.toString().padStart(2, '0');
        return `${hh}:${mm}`;
    });

    // replace (': ') and (' :') to avoid confusion with time patterns
    // to be updated if some cases like 10: 00 is a time, but it's weird
    s = s.replace(/: /g,' ').replace(/ :/,' '); 

    // make all numbers two digits at least
    // replace xx-yy-zz par xx.yy.zz
    s = s.replace(/\b(\d)\b/g, '0$1')
         .replace(/\b(\d{2})-(\d{2})-(\d{2})\b/g, "$1.$2.$3");

    // // regex to ensure separators are surrounded by spaces
    // const sepRegex = new RegExp(
    //     "\\s*(" + rangeSeparators.map(s => s.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")).join("|") + ")\\s*",
    //     "g"
    // );
    // s = s.replace(sepRegex, " $1 ");
    return s;
}
 

//*******************************************//
// tokenizer: make a list of tokens          //
//*******************************************//

// create basic tokens: time, weekday, separators, and text. Does not identify keywords
// which has to be done after text merge.

function makeBasicToken(str, dateFormat, dict){
    const shortMonths = Object.values(dict.monthsDict);
    const longMonths = Object.keys(dict.monthsDict);
    const dayList = [...Object.keys(dict.dayDict), ...Object.values(dict.dayDict).flat()];
    const timeMarkers = dict.timeMarkers;
    
    
    // range separator token
    if (str === '—'){
        return {type: 'rangeSeparator'};
    }
    if (/\p{L}/u.test(str) || /^[^0-9]*$/.test(str)){
        // contains letters
        // if it is a time marker
        if (Object.keys(timeMarkers).includes(str)){
            return {type: 'time', val: timeMarkers[str], rawText: timeMarkers[str]};
        }
        let possibilities = [];
        if (dateFormat.month === 'long' && longMonths.includes(str)){
            possibilities.push('month');
        }
        if (dateFormat.month === 'short' && shortMonths.flat().includes(str)){
            possibilities.push('month');
        }
        if (dayList.includes(str)){
            possibilities.push('weekDay');
        }
        
        // text is not date text, maybe processed as a keyword later
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
            return {type: 'time', val: str, rawText: str};
        }
        // if contains non digits caracters (such as '.' as in '10.12.25' )
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
            for (let i = 0; i+numList.length-1 < dateFormat.order.length; i++){
                if (dateFormat.order.slice(i,i+numList.length).every((el, ind) => canBe(el,numList[ind]))){
                    possibilities.push(dateFormat.order.slice(i,i+numList.length));
                }
            }
            // if only one possibility, generate the corresponding unique tokens
            if (possibilities.length === 1){
                let res = [];
                for(let i = 0; i<numList.length; i++){
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

// prepare text tokens: sequence of text tokens are regrouped. Their texts are merged and
// passed to the following (non-text) token in attribute previousText 

function preprocessTokens(list, dateFormat, dict){

    // if two consecutive separators are found, stop the process and send an error message
    for (let i = 0; i < list.length - 1; i++) {
        if (list[i].type === 'rangeSeparator' && list[i+1].type === 'rangeSeparator') {
            console.log("\x1b[38;5;226mError: two consecutive separators found.\x1b[0m");
            return null;
        }
    }

    const result = [];
    let buffer = ""; // will accumulate successive text tokens

    for (const token of list) {

        // if the type is text, store it in a buffer
        // if the type is time, the token is pushed with a previousText field
        // otherwise it is pushed as a text token
        if (token.type === "text") {
            buffer += " " + token.rawText;
        // } else if (token.type === "time"){
            
        //     if (buffer.length > 0){
        //         token.textBefore = buffer.trim();
        //     }
        //     buffer = "";
        //     result.push(token);
        }else{
            if (buffer.length > 0){
                result.push({type: 'text', rawText: buffer.trim()});
                buffer = "";
            }
            result.push(token);
        }
    }

    // if there is some text remaining at the end
    if (buffer.length > 0){
        // result.at(-1).textAfter = buffer;
        result.push({type: 'text', rawText: buffer.trim()});
    }

    // parse time now so it does not have to be done for every tree possibility, and make a first
    // round of tokenization

    // build a list of keywords and subtypes
    let keywordsDict = [];
    for (const type in dict.specialMarkers) {
        for (const kw of dict.specialMarkers[type]) {
            keywordsDict.push({ kw, type });
        }
    }

    const tmp = timeParser(result, dict.timeRangeDelimiters).map(token => preprocessTextTokens(token, keywordsDict)).flat();

    // remove text tokens before time tokens. They may contain ambiguous keywords (delimiters such
    // à partir de) but all the time information does not need to be processed anymore
    return tmp.filter((token,i) => token.type !== 'text' || i === tmp.length - 1 || tmp[i+1].type !== 'time')
        .map(token => processRemainingTextTokens(token, dateFormat, dict)).flat()
        .filter(el => el.type !== 'unknown text');
    // return timeParser(result);
}

// function to regroupe time and text: make time ranges, assemble lists of time tokens

function timeParser(tokens, timeRangeDelimiters) {
    const result = [];
    let buffer = []; // tokens time/text/weekDay buffer

    const flushBuffer = () => {
        // empty buffer returns nothing
        if (buffer.length === 0) return;

        // buffer should contain a time token, otherwise it is not a time buffer (it should be a single separator). 
        if (!buffer.some(t => t.type === 'time')){
            for (const t of buffer){
                result.push(t);
            }
            buffer = [];
            return;
        }


        // if the first token is a separator, push it. This should not happen !
        if (buffer[0].type === 'rangeSeparator'){
            result.push(buffer.shift());
        }

        // if the last token is a separator, capture it and push it at the end
        let lastToken;
        if (buffer[buffer.length-1].type === 'rangeSeparator'){
            lastToken = buffer.pop();
        }

        // search for pattern time | rangeSeparator | time and replace them by a time range
        // e.g. : 18h-20h, etc... this range has priority over everyhtin

        let i = 0;
        while(i < buffer.length - 2){ 
            // if pattern found, make time range
            if (buffer[i].type === "time" &&
                buffer[i+1].type === "rangeSeparator" &&
                buffer[i+2].type === "time") {

                buffer.splice(i, 3,  
                    {
                        type: "time",
                        val: [buffer[i].val, buffer[i+2].val],
                        rawText: buffer[i].rawText+" — "+buffer[i].rawText,
                        delimiter: "separator"
                    }
                );
            }
            i++;
        }

        // test range patterns: time | time pattern with delimiters 
        i = 0;
        while(i < buffer.length - 3){
            if (buffer[i].type === 'text' && buffer[i+1].type === 'time'
                && buffer[i+2].type === 'text' && buffer[i+3].type === 'time'){
                const t1 = buffer[i].rawText;
                const t2 = buffer[i+2].rawText;
                for (const pair of timeRangeDelimiters) {
                    if (t1.endsWith(pair[0]) && t2.endsWith(pair[1])) {
                        buffer.splice(i+1, 3, 
                        {
                            type: "time",
                            val: [buffer[i+1].val, buffer[i+3].val],
                            rawText: buffer[i].rawText + " " +buffer[i+1].rawText + " " 
                                + buffer[i+2].rawText + " " +buffer[i+3].rawText,
                            delimiter: pair
                        });
                        buffer[i].rawText = removeEnding(t1, pair[0]);
                        if (buffer[i].rawText.length === 0) buffer.splice(i,1);
                        break;
                    }
                }
            }
            i++;
        }
            
        // push the buffer as a time list
        buffer.forEach(t => result.push(t));

        buffer = [];
        if (lastToken) {result.push(lastToken)};

        // mark text tokens preceding a time token to exclude from rangedelimiter possibility
        // for(let i = result.length - 1; i > 0; i--){
        //     if (result[i].type === 'time' && result[i-1].type === 'text'){
        //         result[i-1].beforeTimeToken = true;
        //     }
        // }
        return; 
    };

    for (const token of tokens) {
        // not a separator between two time tokens. 
        if (token.type === "rangeSeparator" && buffer.length === 0){
            result.push(token);
            continue;
        }
        if (token.type === "time" || token.type === "text" || token.type === "rangeSeparator") {
            buffer.push(token);
        } else {
            flushBuffer();
            result.push(token);
        }
    }
    
    flushBuffer();
    return result;
}

// deal with keywords. There should no be any collision problem, at least in French.
// Here we provide a light version of a tokenizer by processing in two steps: keywords without collision
// problem, and leave the collision-prone tokens for later


function preprocessTextTokens(t, entries) {
    if (t.type !== 'text'){
        return t;
    }
    const str = t.rawText;
    const tokens = [];

    // sort by increasing size to avoid collisions
    entries.sort((a, b) => b.kw.length - a.kw.length);

    let i = 0;

    while (i < str.length) {
        let match = null;
        let matchPos = Infinity;

        // find the closest keyword in the text
        for (const { kw, type } of entries) {
            const pos = str.indexOf(kw, i);
            if (pos !== -1 && pos < matchPos) {
                match = { kw, type, pos };
                matchPos = pos;
            }
        }

        // no keyword found: the rest is just a text token
        if (!match) {
            tokens.push({ type: "text", rawText: str.slice(i).trim() });
            break;
        }

        // non tokenized part before keyword
        const before = str.slice(i, match.pos).trim();
        if (before.length > 0) {
            tokens.push({ type: "text", rawText: before });
        }

        // add token type
        tokens.push({ type: match.type, val: match.kw });

        // move forward after keywor
        i = match.pos + match.kw.length;
    }

    return tokens;
}


// process text token: if it is a keyword, change the type to the corresponding situation.
// Remove others and send a warning to developpers if verbose 
// non text tokens are unchanged
function processRemainingTextTokens(token, dateFormat, dict){
    const rangeDeLimiters = dict.rangeDeLimiters;
    const rightRangeDelimiters = dict.rightRangeDelimiters;
    const monthsDict = dict.monthsDict;

    // function to generate tokens for keywords like "today" and "tomorrow"
    function getTxt(date, str, dateFormat){
        if (str === 'day'){
            return String(date.getDate());
        }
        if (str === 'month'){
            if (dateFormat.month === 'long') return Object.keys(monthsDict)[date.getMonth()];
            if (dateFormat.month === 'short') return monthsDict[Object.keys(monthsDict)[date.getMonth()]][0];
            return String(date.getMonth() + 1).padStart(2, '0');
        }
        if (str === 'year'){
            if (dateFormat.year === 'long') return String(date.getFullYear());
            return String(date.getFullYear()).slice(2,4);
        }
    }

    // first deal with keywords to replace them by the right token/ token list
    if (token.type === 'today'){
        return dateFormat.order.map(str => {return {type: str, rawText: getTxt(now, str, dateFormat)}});
    }

    if (token.type === 'tomorrow'){
        return dateFormat.order.map(str => {return {type: str, rawText: getTxt(tomorrow, str, dateFormat)}});
    }

    // don't process non text tokens

    if (token.type !== 'text'){
        return token;
    }    
    
    const possibilities = [];

    // if it is a starting delimiter
    if (!token.beforeTimeToken && rangeDeLimiters.some(el => token.rawText.endsWith(el[0]))){
        possibilities.push('rangeDelimiterStart');
    }
    // if it is a end delimiter
    if (!token.beforeTimeToken && rangeDeLimiters.some(el => token.rawText.endsWith(el[1]))){
        possibilities.push('rangeDelimiterEnd');
    }
    // if it is a range separator
    if (token.rawText === '—'){
        possibilities.push('rangeSeparator');
    }
    // if it is in the left delimiter
    if (!token.beforeTimeToken && rightRangeDelimiters.some(el => token.rawText.endsWith(el))){
        possibilities.push('rangeDelimiterUnbalanceEnd');
    }

    if (possibilities.length === 1){
        token.type = possibilities[0];
        return token;
    }

    if (possibilities.length > 0){
        token.type = possibilities;
        return token;
    }

    // by default, the type has not been recognized. Flag as unknown text
    token.type = 'unknown text';
    if (verbose){
        console.log("\x1b[38;5;226mWarning: text \x1b[0m"
                    +token.rawText
                    +"\x1b[38;5;226m not found in ignore list. Check if it is a missing keyword.\x1b[0m");
    }
    return token;
}


// main tokenizer function

function tokenize(s, dateFormat){
    const basicTokenList = s.split(" ").map(e => makeBasicToken(e, dateFormat, dictionary)).flat();
    const tokenList = preprocessTokens(basicTokenList, dateFormat, dictionary);
    if (verbose === 'full'){
        console.log("\n*** tokens after time parser ***\n",tokenList);
    }
    return tokenList;
}

//**********************************************//
// produce a list of possible token sequences   //
//**********************************************//


// for each list of tokens, produce a list of (list of tokens) by resolving
// possibilities (each token has only one type). Each element of the list will be processed
// and discarded later if there are inconsistencies

function resolvePossibilities(tokenList, hasYears, dict){

    // transform every element into a list

    function newToken(token, t){
        const nt = {...token}; // prevents modification of the original token
        nt.type = t;
        return nt;
    }

    const l = tokenList.map(token => Array.isArray(token.type) ? token.type.map(t => newToken(token, t)) : [token]);
    
   
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

    if (verbose){
        console.log("\n"+result.length+" token combinations will be tested.\n");
    }

    // now every element is a list, make the cartesian product

    const filteredResults = result.map(list => {
                return list.map(token => ({ ...token })); // hard copy of the tokens to prevent side effects
        })
        .map(list => simplifyTokens(list, dict))
        .filter(list => {
        // the lists must have at least one occurrence of 'day' and 'month', as well as 'year' if hasYear is true
        const types = new Set(list.map(el => el.type));
        if (!types.has('month')){
            if (verbose){
                console.log("\x1b[38;5;226mNo month token found, discarding combination.\x1b[0m", list);
            }    
            return false;
        }
        if (!types.has('day')){
            if (verbose){
                console.log("\x1b[38;5;226mNo day token found, discarding combination.\x1b[0m", list);
            }    
            return false;
        }
        if (hasYears && !types.has('year')){
            if (verbose){
                console.log("\x1b[38;5;226mNo year token found, contrary to the provided date format, discarding combination.\x1b[0m", list);
            }    
            return false;
        }

        // tests if the rangeDelimiters look well balanced
        return testRangeBalance(list);
    });
    const finalResults = filteredResults.map(list => propagateRangesDelimiters(list));

    if (verbose === 'full'){
        console.log("\n*** number of remaining possibilities: "+finalResults.length+" ***");
        console.log(finalResults);
        console.log();
    }
    
    return finalResults;
}

// aux function to test if range are well balanced: 
// - end tokens follow start tokens
// - token after opening and closing have the same type
// - at most one "rangeDelimiterUnbalancedEnd" token
// - exactly one day token should be found between a start and end delimiter

function testRangeBalance(list){
    // list must have at most one "rangeDelimiterUnbalancedEnd"
    if (list.filter(el => el.type === "rangeDelimiterUnbalancedEnd").length > 1){
        return false;
    }
    let balance = 0;
    let tokenTypeAfterOpening;
    let countDayTokens = 0;
    for (let i=0; i < list.length; i++){
        const token = list[i];
        if (token.type === "rangeDelimiterStart"){
            countDayTokens = 0;
            balance++;
            if (i+1 > list.length - 1){
                if (verbose){
                    console.log("\x1b[38;5;226mRange delimiters opens on nothing, discarding combination.\x1b[0m", list);
                }
                return false;
            }
            tokenTypeAfterOpening = list[i+1].type;
        }
        if (token.type === "rangeDelimiterEnd"){
            balance--;
            if (countDayTokens !== 1){
                if (verbose){
                    console.log("\x1b[38;5;226mRange delimiters error: "+ countDayTokens+" day tokens found "
                        +" between start and end delimiters, discarding combination.\x1b[0m", list);
                }
                return false;
            }
            if (i+1 > list.length - 1){
                if (verbose){
                    console.log("\x1b[38;5;226mRange delimiters have no end information, discarding combination.\x1b[0m", list);
                }
                return false;
            }
            if (list[i+1].type !== tokenTypeAfterOpening){
                if (verbose){
                    console.log("\x1b[38;5;226mToken types after opening and closing delimiters "
                        +"do not match, discarding combination.\x1b[0m", list);
                }
                return false;
            }
            tokenTypeAfterOpening = null;
        } 
        if (balance < 0 || balance > 1){
            if (verbose){
                console.log("\x1b[38;5;226mUnbalanced range delimiters \x1b[0m", list);
            }
            return false;
        }
        if (token.type === 'day'){
            countDayTokens++;
        }
    }
    if (balance > 0){
            if (verbose){
                console.log("\x1b[38;5;226m Unbalanced range delimiters \x1b[0m", list);
            }
            return false;
    }
    return true;
}

// preprocess weekDays tokens before making the tree: 
// first filter weekdays, convert to day keys, then process weekdays range delimiters

function simplifyTokens(list, dict){
    const dayDict = dict.dayDict;

    // // filter weekdays and convert to normalized day format (english spelling)
    // tokenList = filterWeekDays(tokenList).map(token => convertToDayKeys(token));

     // convert to normalized day format (english spelling)
    const tokenList = list.map(token => convertToDayKeys(token));

    function convertToDayKeys(t){
        if (t.type !== 'weekDay'){
            return t;
        }
        for (const dayKey of Object.keys(dayDict)){
            if (dayDict[dayKey].includes(t.rawText)) {
                t.val = dayKey;
                return t;
            }
        }
    }

    // look for patterns: weekDay | separator | weekDay
    let i = 0;
    while(i < tokenList.length - 2){ 
        // if pattern found, make time rage
        if (tokenList[i].type === "weekDay" &&
            tokenList[i+1].type === "rangeSeparator" &&
            tokenList[i+2].type === "weekDay") {
            const startDay = tokenList[i].val;
            const endDay = tokenList[i+2].val;
            const rawText = tokenList.slice(i,i+3).map(t => t.rawText).join(" ");
            tokenList.splice(i, 3);
            addDayRange(tokenList, i, startDay, endDay, rawText, dayDict);
        }
        i++;
    }
    

    // test range patterns: rangeDelimiterStart | weekDay | rangeDelimiterEnd | WeekDay 
    // transforms into a list of weekDays. The rawText is kept in the first token
    i = 0;

    while(i < tokenList.length - 3){ 
        if (tokenList[i].type === 'rangeDelimiterStart' && tokenList[i+1].type === 'weekDay'
                && tokenList[i+2].type === 'rangeDelimiterEnd' && tokenList[i+3].type === 'weekDay'){   
                // we don't verify here that the delimiters start and end are matching, we assume that
                // it is correctly nested. To be modified if it is not the case.
            const startDay = tokenList[i+1].val;
            const endDay = tokenList[i+3].val;
            const rawText = tokenList.slice(i,i+4).map(t => t.rawText).join(" ");
            tokenList.splice(i,4);
            addDayRange(tokenList, i, startDay, endDay, rawText, dayDict);
        }
        i++;
    }

    // process exceptions: add an 'exception' flag to following weekDay tokens
    // we assume here that exceptions are always followed by a weekDay: sauf samedi à 18h
    // and never by a time (sauf 18h le samedi)
    i = 0;

    while(i < tokenList.length - 1){ 
        if (tokenList[i].type === 'exception'){
            for (let j = 1; i+j < tokenList.length; j++){
                if (tokenList[i+j].type !== 'weekDay' && tokenList[i+j].type !== 'time'){
                    break;
                }
                tokenList[i+j].type = tokenList[i+j].type+'Exception';
            }
            tokenList.splice(i,1);
        }
        i++;
    }


    //*******old comment */
    // weekday filtering. Replace the following weekDay tokens by a wildcard:
    // - weekDay tokens following any rangeDelimiter  or separator token:
    //    jusqu'au mardi 12 avril, du mardi 12 avril au jeudi 14 avril, mardi 12 avril - jeudi 14 avril
    // - weekDay tokens preceding exactly one day token and one range separator 
    // to avoid filtering information to be processed in the generated list


    // detects if a weekDay token is just after a range delimiter or separators. If yes, it means that days 
    // are always preceded by a weekDay token. Then remove those weekDay tokens.

    let tokenAfterWeekDay;

    for (let i = 1; i < tokenList.length; i++){
        if (tokenList[i].type !== 'weekDay') continue;
        
        if (['rangeDelimiterUnbalanceEnd', 
             'rangeDelimiterStart', 
             'rangeDelimiterEnd','rangeSeparator'].includes(tokenList[i - 1].type)
        ){
            // tokenList[i].val = '*';
            // weekDayBeforeDay = true;
            tokenAfterWeekDay = tokenList[i+1].type;
            break;
        }
    }

 
    if (tokenAfterWeekDay){
        let i = 0;

        while(i < tokenList.length - 1){
            if (tokenList[i].type === 'weekDay' && tokenList[i+1].type === tokenAfterWeekDay){
                tokenList.splice(i,1);
            }
            i++;
        }
    }
    return tokenList;
}

// process range delimiters tokens. Move delimiter informations to the corresponding days (the one
// opening and the one closing the range)

function propagateRangesDelimiters(tokenList){
    const finalTokenList = [];
    let rangeInfo = null;

    for (token of tokenList){
        if (token.type.startsWith('rangeDelimiter')){
            rangeInfo = {...token};
        }else if (token.type === 'rangeSeparator'){
            if (rangeInfo){
                console.log("\x1b[38;5;226mbad range separator balance. Aborting\x1b[0m", token);
                return null;
            }
            // find the last day token before the separator and add range information
            let i = finalTokenList.length - 1;
            while (finalTokenList[i].type !== 'day'){
                i--;
                if (i < 0){
                    console.log("\x1b[38;5;226mbad range separator balance. Aborting\x1b[0m", token);
                    return null;
                }
            }
            finalTokenList[i].delimiter = {type: "rangeDelimiterStart", delimiter: "separator"};
            rangeInfo =  {type: "rangeDelimiterEnd", delimiter: "separator"};

        }else{
            if (token.type === 'day' && rangeInfo){
                token.delimiter = rangeInfo;
                rangeInfo = null;
            }
            finalTokenList.push(token);
        }
    }

    if (rangeInfo){
        console.log("\x1b[38;5;226mbad range separator balance. Aborting\x1b[0m", token);
        return null;
    }

    return finalTokenList;
}


// // weekdays filtering.
// // if weekdays are present, and the first token after a week day is a date token, we assume that all dates are
// // // preceded by a weekDay. Such weekDay tokens (case 1) are discarded.
// // the remaining weekday tokens (case 2) will be treated as timeCondition. Examples:
// //
// // lundi 9 avril, du mardi 10 au jeudi 12 avril => case 1
// // monday, september 1st => case 1
// // les lundis et mardis, du 11 au 23 octobre => case 2 (a keyword is between weekDay and day)
// //
// // unhandled case (unlikely cases):
// // les lundis et mardis, du 11 au 23 octobre, mercredi 24 octobre.
// // 
    
// add a list of weekdays instead of the range.
// handles lundi - samedi as well as samedi - mardi ranges
function addDayRange(t, listIndex, startDay, endDay, text, dayDict){
    // create a day list with the first day of the range
    const newList = [{type: 'weekDay', val: startDay, rawText: text}];
    let index = Object.keys(dayDict).findIndex(el => el === startDay) + 1;
    const endDayIndex = Object.keys(dayDict).findIndex(el => el === endDay);
        
    // add new days while the index is in the range (index <= endDayIndex mod 7)
    while ((index - endDayIndex - 1) % 7 !== 0){
        newList.push({type: 'weekDay', val: Object.keys(dayDict)[index]});
        index++;
    }
    t.splice(listIndex,0, ...newList);
}



//***************************************//
// make a tree from the list of tokens   //
//***************************************//


// sequences with weekDay are considered as timeCondition (eg: le mardi à 18h, le jeudi à 19h)
// At this point there should not be any text token left.
// 

// du 12 au 20 octobre, à 15h le mardi, à 16h le jeudi
// mardi 12 à 15h, jeudi 13 à 16h
// du 12 au 20 octobre, le mardi, du 21 au 27 octobre, le vendredi
// du 01 au 31 octobre, du mardi au jeudi à 20h
// detect time condition "à 15h le lundi à 18h le mardi et jeudi "
// "les lundi, mardi et jeudi"
// "septembre 2026: le 03 à 18h, le 04 à 22h".  

function makeTree(tokenList, dateFormat, dict){
    let currentId = 0;
    const typeList = tokenList.map(token => token.type).filter(str => str === 'day' || str === 'month'
        || str === 'year' || str === 'weekDay' || str === 'time' || str === 'weekDayException'
        || str === 'timeException');
    const levels = [...new Set(['root', ...typeList])];

    if (verbose === 'full'){
        console.log("\nTree levels: ", levels,'\n');
    }
    
    const dateTokensOrder = levels.filter(str => str === 'day' || str === 'month' || str === 'year');
    if (dateTokensOrder.length !== dateFormat.order.length 
        || dateTokensOrder.some((el, i) => el !== dateFormat.order[i])){
         if (verbose){
            console.log("\x1b[38;5;226mDate sequences don't match date format. Removing tree.\n\x1b[0m", dateFormat.order);
        }
        return null;
    }

    const tree = {
        0: {
            type: 'root',
            children: []
        }
    }

    let currentPosition = 0;

    // create a child from token
    function createChild(sourceId, token){
        currentId++;
        if (verbose === 'full'){
            console.log("\x1b[38;5;226m creating child \x1b[0m", token.type,' with id ', currentId);
        }
        const value = (token.type === 'day' || token.type === 'year' || token.type === 'month') ?
            normalizeDate(token.rawText, token.type, dateFormat, dict) : token.val;
        const node = {
            type: token.type,
            parent: sourceId,
            children: [],
            val: value,
        }
        if (token.hasOwnProperty('delimiter')){
            node.delimiter = token.delimiter;
        }
        tree[currentId] = node;
        tree[sourceId].children.push(currentId);
        return currentId;
    }

    function doTransition(token, tokenId){ 
        const source = tree[currentPosition].type;
        const dest = token.type;
        if (verbose === 'full'){
            console.log('transition from', source,'to', dest);
        }

        // exhaustive verification of transitions validity
        if (levels.indexOf(dest) > levels.indexOf(source)){
            // forward tracking. The level difference should be exactly one level, except for 'weekDay'
            // that can be skipped
            if (levels.indexOf(dest) - levels.indexOf(source) === 2 
                && levels[levels.indexOf(source)+1] === 'weekDay'){
                currentPosition = createChild(currentPosition, {type: 'weekDay', val: '*'});
                currentPosition = createChild(currentPosition, token);
                return 'forward transition: '+source+' => '+dest;
            }
            if (levels.indexOf(dest) - levels.indexOf(source) !== 1){
                if (verbose){
                    console.log('\x1b[38;5;226mInvalid transition from '+source+' to '+dest+'.\x1b[0m');
                }
                return 'invalid';
            }else{
                currentPosition = createChild(currentPosition, token);
                return 'forward transition: '+source+' => '+dest;
            }
        }else if(dest === source){
            // same level. Only valid for day, time and weekDay tokens
            if (dest !== 'day' && dest !== 'time' && dest !== 'weekDay' && 
                dest !== 'timeException' && dest !== 'weekDayException'
            ){
                if (verbose){
                    console.log('\x1b[38;5;226mInvalid same level transition from '+source+' to '+dest+'.\x1b[0m');
                }
                return 'invalid';
            }else{
                currentPosition = createChild(tree[currentPosition].parent, token);
                return 'same level transition: '+source+' => '+dest;
            }
        }else{
            // backtracking. List here invalid backtracking
            //
            // If day tokens have not been passed, only backtrackgind from weekDay and time are allowed, but
            // only with a 1-level difference
            // otherwise, backtracking should only be possible if day tokens have been passed.
            if ((source === 'time' || source === 'weekDay') && (dest === 'time' || dest === 'weekDay')
                && Math.abs(levels.indexOf(source) - levels.indexOf(dest)) === 1){
                moveAndProcess(token);
                return 'Time or weekDay backward transition: '+source+' => '+dest;
            }
            if ((source === 'timeException' || source === 'weekDayException') && (dest === 'timeException' || dest === 'weekDayException')
                && Math.abs(levels.indexOf(source) - levels.indexOf(dest)) === 1){
                moveAndProcess(token);
                return 'Time or weekDay exception backward transition: '+source+' => '+dest;
            }
            // transition from and to time/weekDay are possible iff the transition between
            // the day/month/year token before source or after dest is valid. We introduce virtual source
            // and dest to compute the validity of the transition
            let vsource = source;
            if (source === 'time' || source === 'weekDay' || source === 'timeException' || source === 'weekDayException'){
                let i = tokenId - 1;
                // find the previous day/month/year token before the source. i is not supposed to be < 0
                while (tokenList[i].type.startsWith('time') || tokenList[i].type.startsWith('weekDay')){
                    i--;
                }
                vsource = tokenList[i].type;
            }
            let vdest = dest;
            if (dest === 'time' || dest === 'weekDay' || dest === 'timeException' || dest === 'weekDayException'){
                let i = tokenId;
                // find the next day/month/year token before the source. i is not supposed to be < 0
                while (tokenList[i].type.startsWith('time') || tokenList[i].type.startsWith('weekDay')){
                    i++;
                }
                vdest = tokenList[i].type;
            }

            if (levels.indexOf(vsource) < levels.indexOf('day')){
                // day tokens not passed yet: not enough info before backtracking => invalid backtracking.
                if (verbose){
                    console.log('\x1b[38;5;226mInvalid backward transition from '+source+' to '+dest+'.\x1b[0m');
                }
                return 'invalid';
            }

            // day token has been passed already.
            // backtracking day => month and month => day always allowed: [y,m,a], [y,a,m], 
            // [a,y,m], [m,y,a], [a,m,y], [m,a,y]
            if ((vsource === 'day' || vsource === 'month') && (vdest === 'day' || vdest === 'month')){
                moveAndProcess(token);
                return 'backward transition day/month: '+source+' => '+dest;
            }
            // transition from 2 to 0 is always permitted (date complete, starting a new one).
            // Transitions from 1 to 0 and from 2 to 1 are never permitted (a => m and m => a allowed
            // but already processed).
            if (dateFormat.order.indexOf(vsource) === 2 && dateFormat.order.indexOf(vdest) === 0){
                moveAndProcess(token);
                return 'backward transition to start a new date: '+source+' => '+dest;
            }
            return 'invalid';
        }

        function moveAndProcess(token){
            while (levels.indexOf(tree[currentPosition].type) > levels.indexOf(token.type)){
                currentPosition = tree[currentPosition].parent;
            }
            currentPosition = createChild(tree[currentPosition].parent, token);
        }
    }

    // build the tree
    for (tokenId = 0; tokenId < tokenList.length; tokenId++){
        token = tokenList[tokenId];
        const transition = doTransition(token, tokenId);

        if (transition === 'invalid'){
            return null;
        }
    };

    // add branches and leaves to the tree in order that at every leaf, a complete date can be found
    // example: 2 et 3 septembre 2025 provides the tree [2, 3:sept:2025] should be transformed in
    // [2:sept:2025, 3:sept:2025]
    // by propagating children nodes to the left

    function growTree(){
        const lastNode = {};
        levels.forEach(str => lastNode[str] = null);
        const leavesType = levels.at(-1);

        // explore the tree backwards for linear complexity
        for (let i = Object.keys(tree).length - 1; i >= 0; i--){
            if (i === 0) continue; // do not process root
            // get all the nodes from the same parent
            lastNode[tree[i].type] = tree[tree[i].parent].children;
            if (tree[i].type !== leavesType && tree[i].children.length === 0){
                // process tree node that is currently a leaf, but which shouldn't be. Add children
                tree[i].children = lastNode[levels[levels.indexOf(tree[i].type)+1]];
                if (tree[i].children === null){
                    if(levels[levels.indexOf(tree[i].type)+1] !== 'time' 
                        && levels[levels.indexOf(tree[i].type)+1] !== 'weekDay'){
                        // if children === null, that means that it is still a leaf. 
                        // The tree is invalid unless it is a time or a weekDay
                        return false;
                    }
                    tree[i].children = [];
                }
                if (tree[i].type === 'time' || tree[i].type === 'weekDay'){
                    // this branch of the tree will not be explored when verifying that the dates are in 
                    // ascending order
                    tree[i].excludeFromVerification = true; 
                }
            }
        }
        return true;
    }


    // complete the graph in order to get a correct distribution of tokens
    const treeWithBalancedLeaves = growTree();
    if (!treeWithBalancedLeaves){
        // unbalanced leaves, discard tree
        if (verbose){
            console.log("\x1b[38;5;226mDiscarding tree with unbalanced leaves.\x1b[0m");
            console.log(tree);
        }
        return null;
    }

    if (verbose === 'full'){
        console.log('tree: ', tree);
    }

    return tree;
}

// convert date elements to normalized (only numeric, year with 4 digits)
function normalizeDate(str, field, dateFormat, dict){
    const shortMonths = Object.values(dict.monthsDict);
    const longMonths = Object.keys(dict.monthsDict);
    if (!str){
        return str;
    }
    
    if (field === 'day'){
        return parseInt(str);
    }
    if (field === 'month'){
        if (dateFormat.month === 'short'){
            for (let i=0; i<shortMonths.length; i++){
                if (shortMonths[i].includes(str)){
                    return i+1;
                }
            }
        }else if (dateFormat.month === 'long'){
            return longMonths.indexOf(str)+1;
        }
        return parseInt(str);
    }
    if (field === 'year'){
        if (str.length === 4){
            return parseInt(str);
        }
        return 2000+parseInt(str);
    }

}


// process information in the tree
function processTree(tree){
    if (tree === null){
        return null;
    }

    // exclude from chronology verification multiple branches
    for (const ind of Object.keys(tree)){
        if (tree[ind].children.length > 1 && ['time', 'weekDay'].includes(tree[tree[ind].children[0]].type)){
            for (child of tree[ind].children.slice(1)){
                tree[child].excludeFromVerification = true;
            }
        }
    }

    // process exception subtrees to compact them into single leaves
    // first fold the second level of exceptions into the first one by removing the leaves
    let leavesToCut = [];
    Object.keys(tree).filter(key => tree[key].type.endsWith('Exception') && tree[key].children.length > 0)
        .forEach(key => {
            const node = tree[key];
            
            const val = [];
            for (let i of node.children){
                leavesToCut.push(i);
                val.push(node.type === 'weekDayException' ? {weekDay: node.val, time: tree[i].val} 
                    : {weekDay: tree[i].val, time: node.val});
            }
            node.val = val;
            node.type = 'exception';
            node.children = [];

    });
    // if there is only one level of exceptions, convert their type (weekDay) to exception
    Object.keys(tree).filter(key => tree[key].type === 'weekDayException')
        .forEach(key =>{
            tree[key].type = 'exception';
            tree[key].val = [{weekDay: tree[key].val}];
    });

    // clean the tree from cut leaves
    leavesToCut.forEach(key => delete tree[key]);

    // merge exception nodes from the same parent
    leavesToCut = [];
    let exceptionIndexes = Object.keys(tree).filter(key => tree[key].type === 'exception')
                            .map(key => Number(key));
    let i = 0;
    while (i < exceptionIndexes.length){
        
        // if (!tree.hasOwnProperty(key)) continue;
        const key = exceptionIndexes[i];
        const brothers = tree[tree[key].parent].children.filter(el => el !== key);
        for (const childId of brothers){
            for (const v of tree[childId].val){
                tree[key].val.push(v);
            }
            leavesToCut.push(childId);
            delete tree[childId];
        }
        exceptionIndexes = exceptionIndexes.filter(el => !leavesToCut.includes(el));
        i++;
    };

    // remove references to deleted leaves
    Object.values(tree).forEach(node => node.children = node.children.filter(el => !leavesToCut.includes(el)));




    // make a list of date from the tree. Does not process delimiters nor condition at this point
    const datesFromTree = tree[0].children.map(index => {
        // const subTree = tree[index];
        
        const dates = [];
        
        // function explore(currentNode, context = {}) {
        function explore(currentNodeIndex, context = {type: 'date'}) {
            const currentNode = tree[currentNodeIndex];
            if (currentNode.hasOwnProperty('excludeFromVerification')){
                context.excludeFromVerification = true;
            }
            if (currentNode.type === 'time'){
                context.time = currentNode.val;
                // the timeInfoSource should contain all time nodes from the same parents
                let timeInfoIndex = currentNodeIndex;
                while (tree[timeInfoIndex].type === 'time' || tree[timeInfoIndex].type === 'weekDay'){
                    timeInfoIndex = tree[timeInfoIndex].parent;
                }
                context.timeInfoSource = tree[timeInfoIndex].children.join('|');
            }
            if (currentNode.type === 'weekDay'){
                context.weekDay = currentNode.val;
            }
            if (currentNode.type === 'year') {
                context.year = currentNode.val;
            }
            if (currentNode.type === 'month') {
                context.month = currentNode.val;
            }
            if (currentNode.type === 'day') {
                context.day = currentNode.val;
                if (currentNode.hasOwnProperty('delimiter')){
                    context.delimiter = currentNode.delimiter.type;
                }
            }
            if(currentNode.type === 'exception'){
                context.exception = currentNode.val;
            }
            // add the date when arriving at the leaf
            if (currentNode.children.length === 0){
                const res = checkYear(context); 
                dates.push(res);
                return;
            }

            // Explore the children
            if (currentNode.children) {
                for (const index of currentNode.children) {
                    // explore(tree[index], { ...context });
                    explore(index, { ...context });
                }
            }
        }

        explore(index);
        return dates;
    }).flat();

    // rearrange timedelimiters if the order has been messed up
    for (let i = 0; i < datesFromTree.length - 1; i++){
        if (!datesFromTree[i].delimiter || datesFromTree[i].delimiter !== 'rangeDelimiterStart') continue;
        let j = 1;
        while (datesFromTree[i+j].delimiter !== 'rangeDelimiterEnd'){
            j++;
        }
        if (j > 1){
            const endToken = datesFromTree[i+j];
            datesFromTree.splice(i+j, 1);
            datesFromTree.splice(i+1, 0, endToken);
        }
    }

    //  if no info on year, add current years. If the date is passed, set next year
    function checkYear(node){
        // do nothing if the year is defined
        if (node.year){
            return node;
        }

        const currentDay = now.getDate();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        // month is passed, so the date must be next year
        if (node.month < currentMonth){
            node.year = currentYear + 1;
            return node;
        }
        // same month but the date is passed
        if (node.month === currentMonth && node.day < currentDay){
            node.year = currentYear + 1;
            return node;
        }
        node.year = currentYear;
        return node;
    }

    if (!isChronological(datesFromTree.filter(date => !date.excludeFromVerification))){
        if (verbose){
            console.log("\x1b[38;5;226mDates not in chronological order.\x1b[0m");
        }
        return null;
    }
    
    // merge rangeDelimiters

    const dateList = [];
    let startDate;
    
    for (const dateToken of datesFromTree){
        if(dateToken.delimiter === 'rangeDelimiterStart'){
            startDate = dateToken;
        }else if(dateToken.delimiter === 'rangeDelimiterEnd' || dateToken.delimiter === 'rangeDelimiterUnbalanceEnd'){
            // if there is an unbalanced end delimiter, add a start date (today)
            if (dateToken.delimiter === 'rangeDelimiterUnbalanceEnd'){
                startDate = {type: 'date', day:now.getDate(), month:now.getMonth() + 1, year: now.getFullYear()};
                 if (dateToken.hasOwnProperty('timeInfoSource')){
                    startDate.timeInfoSource = dateToken.timeInfoSource;
                }
                if (dateToken.hasOwnProperty('time')){
                    startDate.time = dateToken.time;
                }
                if (dateToken.hasOwnProperty('weekDay')){
                    startDate.weekDay = dateToken.weekDay;
                }
            }
            delete startDate.delimiter;
            // case 1: both startDate and currentToken have time info from a different timeInfoSource. So 
            // it is a time range (only one date with start and end time)
            if (dateToken.hasOwnProperty('timeInfoSource') && startDate.hasOwnProperty('timeInfoSource')
                && dateToken.timeInfoSource !== startDate.timeInfoSource){
                // time info should be a single time for both, with only one element
                if (Array.isArray(startDate.time) || Array.isArray(dateToken.time)){
                    // strange time info, send an error
                    console.log("\x1b[38;5;226mInconsistent time info in range delimiter. Aborting\x1b[0m", startDate, dateToken);
                    return null;
                }
                startDate.type = 'date';
                delete startDate.timeInfoSource;
                startDate.eventEnd = {
                    day: dateToken.day,
                    month: dateToken.month,
                    year: dateToken.year,
                    time: dateToken.time
                }
                dateList.push(startDate);
            }else{
                // case 2: it is a date range
                // now either:
                // - start and end delimiters have no time info. Push every day in the range as it is
                // - start has time but not end:
                // du 07 juin à 19h au 21 juin, only the first date as a time (par exemple pour un vernissage)
                // push the first date with time info, other dates without time info
                // - start and end have the same time info from timeInfoSource
                // In every case: push the start date as it is, and other days with the time info from the end
                // date
                
                delete startDate.timeInfoSource;
                dateList.push(startDate);
                // now all following days have the same time info as the closing date
                let current = new Date(startDate.year, startDate.month - 1, startDate.day + 1);
                const last = new Date(dateToken.year, dateToken.month - 1, dateToken.day); 
                while (current <= last) {
                    dateList.push({
                        type: 'date',
                        day: current.getDate(),
                        month: current.getMonth() + 1,
                        year: current.getFullYear()
                    });
                    if (dateToken.hasOwnProperty('time')){
                        dateList.at(-1).time = dateToken.time;
                    }
                    if (dateToken.hasOwnProperty('weekDay')){
                        dateList.at(-1).weekDay = dateToken.weekDay;
                    }
                    if (dateToken.hasOwnProperty('exception')){
                        dateList.at(-1).exception = dateToken.exception;
                    }
                    // step to the next day
                    current.setDate(current.getDate() + 1);
                }

            }
            
        }else{
            dateList.push(dateToken);
        }
    }

    if (verbose === 'full'){
        console.log('\n*** Date list after processing: ***\n\n', dateList);
    }

    const result = processTimeAndWeekDayInfo(dateList);
    if (verbose === 'full'){
        console.log('\n*** Date list after time and condition evaluation: ***\n\n', result);
    }
    
    return result;
}


//***************************************//
// auxiliary functions                   //
//***************************************//

// return str2 - str1

function removeEnding(str2, str1) {
    if (str2.endsWith(str1)) {
        return str2.slice(0, str2.length - str1.length).trim();
    }
    return str2;
}


// Funtion to test if a string str consisting of two digits can be of type element (month, year)
// eg 25 can be a year, a day, but not a mont
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

// compute the intersection of sets. Not in use anymore ?
// function intersectAll(sets) {
//     if (sets.length === 0) return new Set();

//     // from smallest to biggest for optimization
//     const [smallest, ...others] = [...sets].sort((a,b) => a.size - b.size);

//     return new Set(
//         [...smallest].filter(el => others.every(s => s.includes(el)))
//     );
// }

// tests if a list of date is in chronological order
function isChronological(dateList) {
  for (let i = 1; i < dateList.length; i++) {
    const prev = new Date(dateList[i-1].year, dateList[i-1].month - 1, dateList[i-1].day);
    const curr = new Date(dateList[i].year, dateList[i].month - 1, dateList[i].day);

    if (curr < prev) {
      return false;
    }
  }
  return true;
}

// evaluate time info and create corresponding dates
function processTimeAndWeekDayInfo(list){
    const res = [];

    for (const dateToken of list){
        // store start time in time, and end time in a new eventEnd object
        if (dateToken.hasOwnProperty('time') && Array.isArray(dateToken.time)){
            dateToken.eventEnd = {time: dateToken.time[1]};
            dateToken.time = dateToken.time[0];
        }
        // no weekDay information, push the token as it is
        if ((!dateToken.hasOwnProperty('weekDay') || dateToken.weekDay === '*')
                && !dateToken.hasOwnProperty('exception')){
            delete dateToken.weekDay;
            res.push(dateToken);
            continue;
        }
        
        const date = new Date(dateToken.year, dateToken.month - 1, dateToken.day);
        const dayOfWeek = date.toLocaleDateString('en-US', {weekday: 'long'}).toLowerCase();
  
        // apply weekDay filters
        if (dateToken.hasOwnProperty('weekDay')){
            if (dateToken.weekDay === dayOfWeek){
                delete dateToken.weekDay;       
            }else{
                // don't push the token because it does not fulfill the condition
                continue;
            }
        }

        // apply exceptions. If no exception, validate the token
        if (!dateToken.hasOwnProperty('exception')){
            res.push(dateToken);
            continue;
        }
        
        const exceptions = dateToken.exception.filter(exc => exc.weekDay === dayOfWeek);

        // if the exception does not apply to the current week day, validate the token
        if (exceptions.length === 0) {
            res.push(dateToken);
            continue;
        }

        if (exceptions[0].hasOwnProperty('time')){
            // if the exception is an array, it contains times that should replace the original ones
            for (const newTime of exceptions.map(el => el.time)){
                const newDateToken = {...dateToken};
                newDateToken.time = newTime;
                res.push(newDateToken);
            }
        }
        // if the exception has no time, then the day should not be present
        // eg: du 12 au 20 avril sauf le dimanche. The token should not be validated
    }
    return res;
}


//**************** tests *******************/

// auxiliary function to format date output
function formatDate(dateObj){
    const date = new Date(dateObj.year, dateObj.month - 1, dateObj.day);

    const options = { weekday: 'long' };
    const jour = date.toLocaleDateString('fr-FR', options);
    let txt = "Le "+jour+" "+String(dateObj.day).padStart(2, '0')
    +"/"+dateObj.month+"/"+dateObj.year+(dateObj.hasOwnProperty('time')? " à "+dateObj.time : "");
    if (dateObj.hasOwnProperty('eventEnd')){
        const end = dateObj.eventEnd;
        txt = txt + " (fin";
        if (end.hasOwnProperty('day')){
            txt = txt + " le " + end.day+"/"+end.month+"/"+end.year;
        }
        txt = txt + " à " + end.time+")";
    }
    return txt;
}

// auxiliary fonction 
function compare(res, sol){
    const array = sol.split("|");
    if (res.length !== array.length){
        return false;
    }
    for (const el of res){
        if (!array.includes(el)){
            return false;
        }
    }
    return true;
}

function extractDates(s, dateFormat, sol, i){
    console.log("\n****************** Entrée: ******************\nTest n°"+i+": "+s+"\n");
    const tokenList = tokenize(cleanDate(s, dictionary.rangeSeparators), dateFormat);
    
    const poss = resolvePossibilities(tokenList, dateFormat.order.includes('year'), dictionary);
    
    const treeList = poss.map(p => makeTree(p, dateFormat, dictionary))
        .map(tree => tree)
        .map(tree => processTree(tree))
        .filter(tree => tree !== null);
    if (verbose){
        console.log("\n*** Output ***");
    }
    
    if (treeList.length > 0){
        treeList.forEach((p,ind) => {
            if (treeList.length > 1) console.log("\nPossibility n°",ind+1,"\n");
            p.forEach(node => console.log(formatDate(node)));
        });
        const res = treeList[0].map(node => formatDate(node)).join("|");
        // console.log('*********');
        // console.log(res);
        // console.log('*********');
        if (treeList.length === 1 && compare(treeList[0].map(node => formatDate(node)), sol)){
            console.log("\n\x1b[32mTest passed\x1b[0m");
            return true;
        }else{
            console.log("\n\x1b[31mTest failed\x1b[0m");
            return false;
        }
    }else{
        console.log('No solution found.');
        console.log("\n\x1b[31mTest failed\x1b[0m");
        return false;
    }
}


const test = [];
const sols = [];

// // --- Exemple d’utilisation ---
test[0] = {text:`jusqu'au mardi 9 décembre 2025 à 18h-20h`,
dateFormat: {
    year: 'long',
    month: 'long',
    weekDay: 'long',
    order: ['day','month','year']
}};
sols[0] = "Le lundi 01/12/2025 à 18:00 (fin à 20:00)|Le mardi 02/12/2025 à 18:00 (fin à 20:00)|Le mercredi 03/12/"
    +"2025 à 18:00 (fin à 20:00)|Le jeudi 04/12/2025 à 18:00 (fin à 20:00)|Le vendredi 05/12/2025 à 18:00 (fin à "
    +"20:00)|Le samedi 06/12/2025 à 18:00 (fin à 20:00)|Le dimanche 07/12/2025 à 18:00 (fin à 20:00)|Le lundi 08/"
    +"12/2025 à 18:00 (fin à 20:00)|Le mardi 09/12/2025 à 18:00 (fin à 20:00)";

test[1] = {text: `aujourd'hi 23.09.26 à partir de 18h`,
dateFormat: {
    year: 'short',
    month: 'numeric',
    order: ['day','month','year']
}};
sols[1] = "Le mercredi 23/9/2026 à 18:00";

test[2] = {text: `du 17.02.26 à 20h au 18.02.26 à 4h`,
dateFormat: {
    year: 'short',
    month: 'numeric',
    order: ['day','month','year']
}};
sols[2] = "Le mardi 17/2/2026 à 20:00 (fin le 18/2/2026 à 04:00)";



test[3] = {text: `mar. 20 Jan, 2026, 07:30 PM-08:00 PM`,
dateFormat: {
    year: 'long',
    month: 'short',
    weekDay: 'short',
    order: ['day','month','year']
}};
sols[3] = "Le mardi 20/1/2026 à 19:30 (fin à 20:00)";

test[4] = {text: `à 21h15 les 14, 15 & 16 novembre 2025`,
dateFormat: {
    year: 'long',
    month: 'long',
    order: ['day','month','year']
}};
sols[4] = "Le vendredi 14/11/2025 à 21:15|Le samedi 15/11/2025 à 21:15|Le dimanche 16/11/2025 à 21:15";

test[5] = {text: `05 déc. 2025 20:00, 06 déc. 2025 20:00, 07 déc. 2025 15:00`,
dateFormat: {
    year: 'long',
    month: 'short',
    order: ['day','month','year']
}};
sols[5] = "Le vendredi 05/12/2025 à 20:00|Le samedi 06/12/2025 à 20:00|Le dimanche 07/12/2025 à 15:00";

test[6] = {text: "5 janvier à 8am",
dateFormat: {
    month: 'long',
    order: ['day','month']
}};
sols[6] = "Le lundi 05/1/2026 à 08:00";

test[7] = {text: "23 nov 26, 27 dec 26, 19h, 21h", // cas ambigu, même en langage naturel
dateFormat: {
    month: 'short',
    year: 'short',
    order: ['day','month','year']
}};
sols[7] = "Le lundi 23/11/2026 à 19:00|Le lundi 23/11/2026 à 21:00|Le samedi 26/12/2026 à 19:00|"
+"Le samedi 26/12/2026 à 21:00|Le dimanche 27/12/2026 à 19:00|Le dimanche 27/12/2026 à 21:00";
// test must fail ! There is ambiguity and two possibilities

test[8] = {text: "23 nov 25, 02 dec 25, de 17h à 18h, et de 19h à 20h", // ce cas n'est pas ambigu car 02 ne suit pas 25
dateFormat: {
    month: 'short',
    year: 'short',
    order: ['day','month','year']
}};
sols[8] = "Le dimanche 23/11/2025 à 17:00 (fin à 18:00)|Le dimanche 23/11/2025 à 19:00 (fin à 20:00)|"
    +"Le mardi 02/12/2025 à 17:00 (fin à 18:00)|Le mardi 02/12/2025 à 19:00 (fin à 20:00)";

test[9] = {text: "09 07.25", 
dateFormat: {
    month: 'numeric',
    year: 'short',
    order: ['month','day','year']
}};
sols[9] = "Le dimanche 07/9/2025";

test[10] = {text: "23 09 25, 02 12 25", 
dateFormat: {
    month: 'numeric',
    year: 'short',
    order: ['day','month','year']
}};
sols[10] = "Le mardi 23/9/2025|Le mardi 02/12/2025";


test[11] = {text: `03.06.26-14.06.26 à 17h et 20h`,
// test[11] = {text: `11.05.26-14.06.26 17h aa 23h`,
dateFormat: {
    month: 'numeric',
    year: 'short',
    order: ['day','month','year']
}};
sols[11] = "Le mercredi 03/6/2026 à 17:00|Le mercredi 03/6/2026 à 20:00|Le jeudi 04/6/2026 à 17:00|Le jeudi 04/6"
    +"/2026 à 20:00|Le vendredi 05/6/2026 à 17:00|Le vendredi 05/6/2026 à 20:00|Le samedi 06/6/2026 à 17:00|Le "
    +"samedi 06/6/2026 à 20:00|Le dimanche 07/6/2026 à 17:00|Le dimanche 07/6/2026 à 20:00|Le lundi 08/6/2026 à "
    +"17:00|Le lundi 08/6/2026 à 20:00|Le mardi 09/6/2026 à 17:00|Le mardi 09/6/2026 à 20:00|Le mercredi 10/6/2026"
    +" à 17:00|Le mercredi 10/6/2026 à 20:00|Le jeudi 11/6/2026 à 17:00|Le jeudi 11/6/2026 à 20:00|Le vendredi 1"
    +"2/6/2026 à 17:00|Le vendredi 12/6/2026 à 20:00|Le samedi 13/6/2026 "
    +"à 17:00|Le samedi 13/6/2026 à 20:00|Le dimanche 14/6/2026 à 17:00|Le dimanche 14/6/2026 à 20:00";

test[12] = {text: `27, 28 nov, 3 déc, 2025`,
dateFormat: {
    month: 'short',
    year: 'short',
    order: ['day','month','year']
}};
sols[12] = "Le jeudi 27/11/2025|Le vendredi 28/11/2025|Le mercredi 03/12/2025";

test[13] = {text: `nov, 27, 28, déc, 03, 2025, de 17h à 22h`,
dateFormat: {
    month: 'short',
    year: 'short',
    order: ['month','day','year']
}};
sols[13] = "Le jeudi 27/11/2025 à 17:00 (fin à 22:00)|Le vendredi 28/11/20"
        +"25 à 17:00 (fin à 22:00)|Le mercredi 03/12/2025 à 17:00 (fin à 22:00)";

test[14] = {text: `Du jeudi 13 jusqu'au samedi 15 novembre 2025, jeudi à 20h, samedi à 18h`,
dateFormat: {
    month: 'long',
    order: ['day','month','year'],
    weekDay: 'long'
}};
sols[14] = "Le jeudi 13/11/2025 à 20:00|Le samedi 15/11/2025 à 18:00";

test[15] = {text: `Samedi 15 novembre 2025 à 20h - dimanche 16 novembre 2025 à 4h`,
dateFormat: {
    month: 'long',
    order: ['day','month','year'],
    weekDay: 'long'
}};
sols[15] = "Le samedi 15/11/2025 à 20:00 (fin le 16/11/2025 à 04:00)";

test[16] = {text: `Les lundis et mardis de 18h à 19h et de 20h à 21h, du 14 au 27 septembre 2025`,
dateFormat: {
    month: 'long',
    order: ['day','month','year'],
    weekDay: 'long'
}};
sols[16] = "Le lundi 15/9/2025 à 18:00 (fin à 19:00)|Le lundi 15/9/2025 à 20:00 (fin à 21:00)|Le mardi 16/9/2025 à"
    +" 18:00 (fin à 19:00)|Le mardi 16/9/2025 à 20:00 (fin à 21:00)|Le lundi 22/9/2025 à 18:00 (fin à 19:00)|L"
    +"e lundi 22/9/2025 à 20:00 (fin à 21:00)|Le mardi 23/9/2025 à 18:00 (fin à 19:00)|Le mardi 23/9/2025 à 20:0"
    +"0 (fin à 21:00)";


test[17] = {text: `du lundi au mercredi, à 18h,  14 - 27 septembre 2025. Du samedi au lundi, à 18h, du 01 au 10 octobre 2025.`,
dateFormat: {
    month: 'long',
    year: 'long',
    order: ['day','month','year'],
    weekDay: 'long'
}};
sols[17] = "Le lundi 15/9/2025 à 18:00|Le lundi 22/9/2025 à 18:00|Le mardi 16/9/2025 à 18:00|Le mardi 23/9/2025 à 18:00|Le m"
    +"ercredi 17/9/2025 à 18:00|Le mercredi 24/9/2025 à 18:00|Le samedi 04/10/2025 à 18:00|Le dimanche 05/10/20"
    +"25 à 18:00";

test[18] = {text: "septembre 2026: le 03 à 18h, le 04 à 22h",
dateFormat: {
    month: 'long',
    year: 'long',
    order: ['month','year', 'day'],
}};
sols[18] = "Le jeudi 03/9/2026 à 18:00|Le vendredi 04/9/2026 à 22:00";

test[19] = {text: "du 07 juin à 19h au 21 juin",
dateFormat: {
    month: 'long',
    order: ['day','month']
}};
sols[19] = "Le dimanche 07/6/2026 à 19:00|Le lundi 08/6/2026|Le mardi 09/6/2026|Le mercredi 10/6/2026|Le jeudi 1"
    +"1/6/2026|Le vendredi 12/6/2026|Le samedi 13/6/2026|Le dimanche 14/6/2026|Le lundi 15/6/2026|Le mardi 1"
    +"6/6/2026|Le mercredi 17/6/2026|Le jeudi 18/6/2026|Le vendredi 19/6/2026|Le samedi 20/6/2026|Le dimanche 21/6/2026";

test[20] = {text: "mercredi, Nov 11, 07:30 PM → samedi, Nov 14",
dateFormat: {
    weekDay: 'long',
    month: 'short',
    order: ['month','day']
}};
sols[20] = "Le mercredi 11/11/2026 à 19:30|Le jeudi 12/11/2026|Le vendredi 13/11/2026|Le samedi 14/11/2026";

test[21] = {text: "septembre 2026: le 03 à 18h, le 04 à 22h, octobre 2026: le 06 à 18h",
dateFormat: {
    month: 'long',
    year: 'long',
    order: ['month','year', 'day'],
}};
sols[21] = "Le jeudi 03/9/2026 à 18:00|Le vendredi 04/9/2026 à 22:00|Le mardi 06/10/2026 à 18:00";

test[22] = {text: "2026 septembre 03, 04, octobre 02",
dateFormat: {
    month: 'long',
    year: 'long',
    order: ['year', 'month', 'day'],
}};
sols[22] = "Le jeudi 03/9/2026|Le vendredi 04/9/2026|Le vendredi 02/10/2026";

test[23] = {text: "2025: sept: 2 et 3 à 18h, le 4 à 20h, oct 4 et 5 à 19h ",
dateFormat: {
    month: 'short',
    year: 'long',
    order: ['year', 'month', 'day'],
}};
sols[23] = "Le mardi 02/9/2025 à 18:00|Le mercredi 03/9/2025 à 18:00|Le jeud"
    +"i 04/9/2025 à 20:00|Le samedi 04/10/2025 à 19:00|Le dimanche 05/10/2025 à 19:00";

test[24] = {text: "à 14h le 03, 04 et 16h le 05 septembre 2025.",
dateFormat: {
    month: 'long',
    year: 'long',
    order: ['day', 'month', 'year'],
}};
sols[24] = "Le mercredi 03/9/2025 à 14:00|Le jeudi 04/9/2025 à 14:00|Le vendredi 05/9/2025 à 16:00";

test[25] =  {text: "2025: 2 et 3 sept à 18h, 4 et 5 oct à 19h",
dateFormat: {
    month: 'short',
    year: 'long',
    order: ['year', 'day', 'month'],
}};
sols[25] = "Le mardi 02/9/2025 à 18:00|Le mercredi 03/9/2025 à 18:00|Le samedi 04/10/2025 à 19:00|Le dimanche 05/10/2025 à 19:00";

test[26] =  {text: "2025: sept 2 et 3 à 18h, oct 4 et 5 à 19h",
dateFormat: {
    month: 'short',
    year: 'long',
    order: ['year', 'month', 'day'],
}};
sols[26] = "Le mardi 02/9/2025 à 18:00|Le mercredi 03/9/2025 à 18:00|Le samedi 04/10/2025 à 19:00|Le dimanche 05/10/2025 à 19:00";

test[27] =  {text: "du 12 au 20 octobre, de 15h à 16h, le mardi, de 16h à 17h le mercredi et jeudi",
dateFormat: {
    month: 'long',
    year: 'long',
    order: ['day', 'month'],
}};
sols[27] = "Le mardi 13/10/2026 à 15:00 (fin à 16:00)|Le mercredi 14/10/2026 à 16:00 (fin à 17:00)|Le jeudi 15/10/2026 à 1"
    +"6:00 (fin à 17:00)|Le mardi 20/10/2026 à 15:00 (fin à 16:00)";

test[28] =  {text: "2025: 18h les 16 et 17 sept, 21h le 18 sept",
dateFormat: {
    month: 'short',
    year: 'long',
    order: ['year', 'day', 'month'],
}};
sols[28] = 'Le mardi 16/9/2025 à 18:00|Le mercredi 17/9/2025 à 18:00|Le jeudi 18/9/2025 à 21:00';

test[29] =  {text: "2025: 18h sept 16 et 17 21h oct 04",
dateFormat: {
    month: 'short',
    year: 'long',
    order: ['year', 'month', 'day'],
}};
sols[29] = 'Le mardi 16/9/2025 à 18:00|Le mercredi 17/9/2025 à 18:00|Le samedi 04/10/2025 à 21:00';


test[30] =  {text: "lundi et mardi, 18/10/25 - 31/10/25",
dateFormat: {
    month: 'numeric',
    year: 'short',
    order: ['day', 'month', 'year'],
}};
sols[30] = 'Le lundi 20/10/2025|Le lundi 27/10/2025|Le mardi 21/10/2025|Le mardi 28/10/2025';

test[31] =  {text: "lundi 18/10/25 - dimanche 31/10/25",
    dateFormat: {
        month: 'numeric',
        year: 'short',
        order: ['day', 'month', 'year'],
}};
sols[31] = 'Le samedi 18/10/2025|Le dimanche 19/10/2025|Le lundi 20/10/2025|Le mardi 21/10/2'
            +'025|Le mercredi 22/10/2025|Le jeudi 23/10/2025|Le vendredi 24/10/2025|Le same'
            +'di 25/10/2025|Le dimanche 26/10/2025|Le lundi 27/10/2025|Le mardi 28/10/2025|L'
            +'e mercredi 29/10/2025|Le jeudi 30/10/2025|Le vendredi 31/10/2025';



test[32] =  {text: "Du 4 au 6 décembre 2025, à 20h sauf samedi à 18h",
    dateFormat: {
        month: 'long',
        year: 'long',
        order: ['day', 'month', 'year'],
}};
sols[32] = 'Le jeudi 04/12/2025 à 20:00|Le vendredi 05/12/2025 à 20:00|Le samedi 06/12/2025 à 18:00';

test[33] =  {text: "Du 4 au 8 décembre 2025, à 20h sauf samedi et dimanche à 18h et 21h",
    dateFormat: {
        month: 'long',
        year: 'long',
        order: ['day', 'month', 'year'],
}};
sols[33] = 'Le jeudi 04/12/2025 à 20:00|Le vendredi 05/12/2025 à 20:00|Le samedi 06/12/2025 à 18:00|Le samedi 06'
            +'/12/2025 à 21:00|Le dimanche 07/12/2025 à 18:00|Le dimanche 07/12/2025 à 21:00|Le lundi 08/12/202'
            +'5 à 20:00';

test[34] =  {text: "20h, décembre 2025: du 4 au 8, sauf samedi et dimanche à 18h et 21h",
    dateFormat: {
        month: 'long',
        year: 'long',
        order: ['month', 'year', 'day'],
}};
sols[34] = 'Le jeudi 04/12/2025 à 20:00|Le vendredi 05/12/2025 à 20:00|Le samedi 06/12/2025 à 18:00|Le samedi 06/12/2'
        +'025 à 21:00|Le dimanche 07/12/2025 à 18:00|Le dimanche 07/12/2025 à 21:00|Le lundi 08/12/2025 à 20:00';

test[35] =  {text: "Du 8 au 12 décembre 2025, du lundi au mercredi sauf le mardi",
    dateFormat: {
        month: 'long',
        year: 'long',
        order: ['day', 'month', 'year'],
}};
sols[35] = 'Le lundi 08/12/2025|Le mercredi 10/12/2025';

test[36] =  {text: "Ce soir à 20h",
    dateFormat: {
        month: 'short',
        year: 'long',
        order: ['day', 'month', 'year'],
}};
sols[36] = 'Le lundi 01/12/2025 à 20:00';

test[37] =  {text: "jusqu'à demain, 20h",
    dateFormat: {
        month: 'short',
        year: 'long',
        order: ['day', 'month', 'year'],
}};
sols[37] = 'Le lundi 01/12/2025 à 20:00|Le mardi 02/12/2025 à 20:00';

console.log("\n\n\n");

let i = 37;
extractDates(test[i].text, test[i].dateFormat, sols[i], i);
console.log("test "+i+": ",test[i].text);

const failedTests = [];
for (i = 1; i < 38; i++){
    if (i === 7) continue; // test 7 cannot be and should not passed
    if (!extractDates(test[i].text, test[i].dateFormat, sols[i],i)){
        failedTests.push(i);
    };
}
if (failedTests.length === 0){
    console.log("\n\x1b[32m*** All tests passed. ***\x1b[0m");
}else{
    console.log('\n\x1b[31mSome test failed:\x1b[0m', failedTests);
}

