verbose = false; // false, true, 'full'


// CHANGER const now !!!!!!!!!!!!

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
  decembre: ["dec"]
};

const shortMonths = Object.values(monthsDict);
const longMonths = Object.keys(monthsDict);
const rangeDeLimiters = [["du","au"],["a partir du","jusqu'au"],["de","a"]];
const rightRangeDelimiters = ["jusqu'au"];
const rangeSeparators = ["->", "→", "—"]; // classic dash will be processed by default

const timeMarkers = [{"minuit": "midnight"}];
const exception = ["sauf"];

const timeRangeDelimiters = [["de","a"],["de","jusqu'a"]];

const dayDict = {   monday: ["lun", "lundi", "lundis"],
                    tuesday: ["mar", "mardi", "mardis",],
                    wednesday: ["mer", "mercredi", "mercredis"],
                    thursday: ["jeu", "jeudi", "jeudis"],
                    friday: ["ven", "vendredi", "vendredis"],
                    saturday: ["sam", "samedi", "samedis"],
                    sunday: ["dim", "dimanche", "dimanches"]
                };

const dayList = [...Object.keys(dayDict), ...Object.values(dayDict).flat()];

const ignoreList = ["&", "et", "le", "les"]; // those keywords are not mandatory to understand the structure
const startTimeKeywords = ["a", "a partir de"];


const moisRegex = Object.values(monthsDict).flat().map(m => m.replace('.', '\\.')).join('|');
const currentYear = new Date().getFullYear();
// const now = new Date();
const now = new Date(2025, 11, 1); 
const shortCurrentYear = currentYear - Math.floor(currentYear / 100) * 100;
nextYears = [shortCurrentYear, shortCurrentYear+1, shortCurrentYear+2];


//***************************************//
// clean the string                      //
//***************************************//

// il reste les . et / et - entre les nombres
function cleanDate(s){

    // regex to identify range separators. "-" strictly surrounded by letters are ignored (it is not a
    // separator in "après-midi")
    const rangeSeparatorRegex = new RegExp("-(?![A-Za-zÀ-ÖØ-öø-ÿ])|(?<![A-Za-zÀ-ÖØ-öø-ÿ])-"+rangeSeparators.join("|"), "g");

    // regex to remove 
    const escaped = ignoreList.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const ignoreRegex = new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");

    // Fix caracters encoding errors
    s = s.replace(/→/g,"—").normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
         .replace(/–/g, "-") // normalize dashes
         .replace(/[^\x00-\x7F—]/g,'') //remove non standard caracters => to be improved
         .toLowerCase()
         .replace(/,|;|\||\. |\.$/g, " ") // remove unprocessed separators. Separators like | without semantic meanings 
                    //  have been found in texts, so it is discarded also.
         .replace(rangeSeparatorRegex, ' — ') // replace rangeSeparators by long dash. Add spaces around to ensure token capture
         .replace(/(?<=\p{L})\./gu, '') //replace(/(?<=[a-zÀ-ÖØ-öø-ÿ])\./g, '') // remove all dots directly following a letter
         .replace(ignoreRegex, "") // remove elements from the ignore list
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
function makeBasicToken(str, dateFormat){
    // range separator token
    if (str === '—'){
        return {type: 'rangeSeparator'};
    }
    if (/\p{L}/u.test(str) || /^[^0-9]*$/.test(str)){
        // contains letters
        // if it is a time marker
        if (Object.keys(timeMarkers).includes(str)){
            return {type: 'time', time: timeMarkers[str], rawText: timeMarkers[str]};
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
            return {type: 'time', time: str, rawText: str};
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
            for (let i = 0; i<2; i++){
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

// aux funtion to test if a string str consisting of two digits can be of type element (month, year)
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




// prepare text tokens: sequence of text tokens are regrouped. Their texts are merged and
// passed to the following (non-text) token in attribute previousText 

function preprocessTokens(list){

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
        } else if (token.type === "time"){
            
            if (buffer.length > 0){
                 token.textBefore = buffer.trim();
            }
            // token.textBefore = buffer.length > 0 ? buffer.trim() : null;
            buffer = "";
            result.push(token);
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
        list.at(-1).textAfter = buffer;
    }
    

    // parse time now so it does not have to be done for every tree possibility
    return timeParser(result).map(token => processTextToken(token))
        .filter(el => el.type !== 'unknown text');
    // return timeParser(result);
}

// aux function to regroupe time and text:
// Assemble sequences of time tokens into one time token, which has a list timeList of time objects

function timeParser(tokens) {
    // console.log("before time parser", tokens);
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

        // if the first token is a separator, push it
        if (buffer[0].type === 'rangeSeparator'){
            result.push(buffer.shift());
        }

        // if the last token is a separator, capture it and push it at the end
        let lastToken;
        if (buffer[buffer.length-1].type === 'rangeSeparator'){
            lastToken = buffer.pop();
        }

        // normally, there should not be any range separator now

        // search for pattern time | rangeSeparator | time and replace them by a time range
        // e.g. : 18h-20h, etc... this range has priority over everyhtin

        let i = 0;
        while(i < buffer.length - 2){ 
            // if pattern found, make time rage
            if (buffer[i].type === "time" &&
                buffer[i+1].type === "rangeSeparator" &&
                buffer[i+2].type === "time") {

                buffer.splice(i, 3, {
                    type: "timeRange",
                    startTime: buffer[i].time, 
                    endTime: buffer[i+2].time,
                    rawText: buffer[i].rawText+"—"+buffer[i].rawText,
                    delimiter: "separator"
                });
            }
            i++;
        }

        // test range patterns: time | time pattern with delimiters 
        i = 0;
        while(i < buffer.length - 1){ 
            const t1 = buffer[i].textBefore;
            const t2 = buffer[i+1].textBefore;
            if (t1 && t2){
                for (const pair of timeRangeDelimiters) {
                    if (t1.endsWith(pair[0]) && t2.endsWith(pair[1])) {
                        buffer.splice(i, 2, {
                            type: "timeRange",
                            startTime: buffer[i].time, 
                            endTime: buffer[i+1].time,
                            rawText: buffer[i].textBefore + " " +buffer[i].rawText + " " 
                                + buffer[i+1].textBefore + " " +buffer[i+1].rawText,
                            delimiter: pair
                        });
                    }
                }
            }
            i++;
        }
            
        // push the buffer in time list
        result.push({
            type: "time",
            rawText: buffer.map(t => (t.textBefore ? t.textBefore : "")+" "+t.rawText).join(" "),
            timeList: buffer
        });
            
        // }

        buffer = [];
        if (lastToken) {result.push(lastToken)};
        return; 
    };

    for (const token of tokens) {
        // not a separator between two time tokens. 
        if (token.type === "rangeSeparator" && buffer.length === 0){
            result.push(token);
            continue;
        }
        if (token.type === "time" || token.type === "rangeSeparator") {
            buffer.push(token);
        } else {
            flushBuffer();
            result.push(token);
        }
    }
    
    flushBuffer();
    return result;
}






// process text token: if it is a keyword, change the type to the corresponding situation.
// Remove others and send a warning to developpers if verbose 
// non text tokens are unchanged
function processTextToken(token){
    // don't process non text tokens

    if (token.type !== 'text'){
        return token;
    }    
    
    const possibilities = [];
    // if it is a starting delimiter
    if (rangeDeLimiters.some(el => token.rawText.endsWith(el[0]))){
        possibilities.push('rangeDelimiterStart');
    }
    // if it is a end delimiter
    if (rangeDeLimiters.some(el => token.rawText.endsWith(el[1]))){
        possibilities.push('rangeDelimiterEnd');
    }
    // if it is a range separator
    if (token.rawText === '—'){
        possibilities.push('rangeSeparator');
    }
    // if it is in the left delimiter
    if (rightRangeDelimiters.some(el => token.rawText.endsWith(el))){
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
    if (verbose && !ignoreList.includes(token.rawText)){
        console.log("\x1b[38;5;226mWarning: text \x1b[0m"
                    +token.rawText
                    +"\x1b[38;5;226m not found in ignore list. Check if it is a missing keyword.\x1b[0m");
    }
    return token;
}


// main tokenizer function

function tokenize(s, dateFormat){
    const basicTokenList = s.split(" ").map(e => makeBasicToken(e, dateFormat)).flat();
    const tokenList = preprocessTokens(basicTokenList);
    if (verbose === 'full'){
        console.log("\n*** tokens after time parser ***\n\n",tokenList);
    }
    return tokenList;
}

//**********************************************//
// produce a list of possible token sequences   //
//**********************************************//


// for each list of tokens, produce a list of (list of tokens) by resolving
// possibilities (each token has only one type). Each element of the list will be processed
// and discarded later if there are inconsistencies

function resolvePossibilities(tokenList, hasYears){

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
    
    const filteredResults = result.filter(list => {
        // the lists must have at least one occurrence of 'day' and 'month', as well as 'year' if hasYear is true
        const types = new Set(list.map(el => el.type));
        if (!types.has('month')) return false;
        if (!types.has('day')) return false;
        if (hasYears && !types.has('year')) return false;

        // tests if the rangeDelimiters look well balanced
        return testRangeBalance(list);
    });
    const finalResults = filteredResults.map(list => simplifyTokens(list));

    if (verbose === 'full'){
        console.log("\n*** number of possibilities: "+finalResults.length+" ***");
        console.log(finalResults);
        console.log();
    }
    
    return finalResults;
}

// aux function to test if range are well balanced: end follow start, token after opening and closing
// have the same type
function testRangeBalance(list){
    // list must have at most one "rangeDelimiterUnbalancedEnd"
    if (list.filter(el => el.type === "rangeDelimiterUnbalancedEnd").length > 1){
        return false;
    }
    let balance = 0;
    let tokenTypeAfterOpening;
    for (let i=0; i < list.length; i++){
        const token = list[i];
        if (token.type === "rangeDelimiterStart"){
            balance++;
            if (i+1 > list.length - 1){
                if (verbose){
                    console.log("\x1b[38;5;226mRange delimiters opens on nothing\x1b[0m", list);
                }
                return false;
            }
            tokenTypeAfterOpening = list[i+1].type;
        }
        if (token.type === "rangeDelimiterEnd"){
            balance--;
            if (i+1 > list.length - 1){
                if (verbose){
                    console.log("\x1b[38;5;226mRange delimiters have no end information\x1b[0m", list);
                }
                return false;
            }
            if (list[i+1].type !== tokenTypeAfterOpening){
                if (verbose){
                    console.log("\x1b[38;5;226mToken types after opening and closing delimiters do not match\x1b[0m", list);
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

function simplifyTokens(tokenList){

    // filter weekdays and convert to normalized day format (english spelling)
    tokenList = filterWeekDays(tokenList).map(token => convertToDayKeys(token));

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
            addDayRange(tokenList, i, startDay, endDay, rawText);
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
            addDayRange(tokenList, i, startDay, endDay, rawText);
        }
        i++;
    }

    // here we assume that if time is related to a week day, it is just next to it.
    // determine if a time is present to the left or the right or the week day.
    // if left, propagates the time to the right (resp to the left) until no week day is found.
    let firstWeekDayIndex = tokenList.findIndex(t => t.type === 'weekDay');
    // if there are weekDay tokens
    if (firstWeekDayIndex > - 1){
        if (firstWeekDayIndex > 0 && tokenList[firstWeekDayIndex - 1].type === 'time'){
        // there is a time token to the left of the first week day, propagates time to the right for all sequences
            // find all sequences starting with time | weekDay
            for (let startIndex = firstWeekDayIndex; startIndex < tokenList.length; startIndex++) {
                if (tokenList[startIndex].type === "weekDay" && tokenList[startIndex - 1].type === 'time') {  
                    // when a sequence has been found, propagates the time to the right  
                    let i = startIndex;
                    while (i < tokenList.length && tokenList[i].type === 'weekDay'){
                        tokenList[i].time = tokenList[startIndex - 1];
                        i++;
                    }
                    tokenList.splice(startIndex-1, 1);
                }
            } 
        }else{
            // get the last weekDay token of the first sequence
            while (firstWeekDayIndex < tokenList.length - 2 && tokenList[firstWeekDayIndex + 1].type === 'weekDay'){
                firstWeekDayIndex++;
            }
            if (tokenList[firstWeekDayIndex + 1].type === 'time'){
                // there is a time token to the right of the last week day token of the first sequence.
                // propagates time to the left. An indexMin is set to prevent propagating to much to the left
                // (splicing time tokens result in too long weekDay sequences)
                let indexMin = 0;
                for (let startIndex = firstWeekDayIndex; startIndex < tokenList.length - 1; startIndex++) {
                    if (tokenList[startIndex].type === "weekDay" && tokenList[startIndex + 1].type === 'time') {  
                        // when a sequence has been found, propagates the time to the right  
                        let i = startIndex;
                        while (i >= indexMin && tokenList[i].type === 'weekDay'){
                            tokenList[i].time = tokenList[startIndex + 1];
                            i--;
                        }
                        indexMin = startIndex + 1;
                        tokenList.splice(startIndex+1, 1);
                    }
                } 
            }
        }
    }

    // regroup weekDay as a condition token with a list of weekDay

    const intermediateTokenList = [];
    let buffer = [];

    for (token of tokenList){
        if (token.type === 'weekDay'){
            buffer.push(token);
        }else{
            flushBuffer();
            intermediateTokenList.push(token);
        }
    }

    function flushBuffer(){
        if (buffer.length > 0){
            for (t of buffer){
                delete t.type;
            }
            intermediateTokenList.push({type: 'time', conditionList: buffer});
            buffer = [];
        }
    }

    // move delimiter tokens information to the next following day token

    flushBuffer();
    const finalTokenList = [];
    let rangeInfo = null;

    for (token of intermediateTokenList){
        if (token.type.startsWith('rangeDelimiter')){
            rangeInfo = {...token};
        }else if (token.type === 'rangeSeparator'){
            if (rangeInfo){
                console.log("\x1b[38;5;226mbad range separator balance. Aborting\x1b[0m", token);
                return null;
            }
            // find the last day token and add range information
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


// weekdays filtering.
// if weekdays are present, and the first token after a week day is a date token, we assume that all dates are
// // preceded by a weekDay. Such weekDay tokens (case 1) are discarded.
// the remaining weekday tokens (case 2) will be treated as timeCondition. Examples:
//
// lundi 9 avril, du mardi 10 au jeudi 12 avril => case 1
// monday, september 1st => case 1
// les lundis et mardis, du 11 au 23 octobre => case 2 (a keyword is between weekDay and day)
//
// unhandled case (unlikely cases):
// les lundis et mardis, du 11 au 23 octobre, mercredi 24 octobre.
// 

function filterWeekDays(list){
    const firstWeekDay = list.findIndex(t => t.type === 'weekDay');
    // if no weekDay token is present, or if it is at the last index (case 2), return the list
    if (firstWeekDay === -1 || firstWeekDay === list.length){
        return list;
    }
    const nextType = list[firstWeekDay+1].type;
    if (nextType !== 'day' && nextType !== 'month' && nextType !== 'year'){
        // next token is not a date token. 
        return list;
    }
    return list.filter((t, i) => {
        if (t.type !== 'weekDay') return true;
        const next = list[i + 1];
        return !(next && next.type === nextType);
    });
   
}
    

// add a list of weekdays instead of the range.
    // handles lundi - samedi as well as samedi - mardi ranges
    function addDayRange(t, listIndex, startDay, endDay, text){
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

function makeTree(tokenList, dateFormat){
    let currentId = 0;
    let levels;
    // let timeBeforeDay = null;
    dateLength = dateFormat.order.length;

    // decide the level of time tokens. Default place should be between root and year, but it should
    // be just above the relevant info. In the following example, it should be right above the days,
    // as the second day as only day informations
    // "septembre 2026: le 03 à 18h, le 04 à 22h".
    // if no time token is present, use default levels.

    let possibleTokenAfterTime;
    let possibleTokenBeforeTime;
   
    if (tokenList.some(token => token.type.startsWith('time'))){
         // we determine which "date" tokens are present between time or timeCondition tokens
        const tokenSetBetweenTimes = intersectAll(tokenList.map(el => el.type)
            .join(" ").split('time').map(str => str.trim()).filter(str => str.length > 0)
            .map(str => [... new Set(str.split(' '))]));
        const tmp = tokenList.map(el => el.type).join(" ")
            .split('time')[0].trim().split(' ');
        if (tmp.length > 0){possibleTokenBeforeTime= tmp.at(-1)};
    
        if (!tokenSetBetweenTimes.has('month')){
            levels =  ['root','year','month','time','day'];
        }else if (!tokenSetBetweenTimes.has('year')){
            levels =  ['root','year','time','month','day'];
        }else{
            levels =  ['root','time','year','month','day'];
        }
        possibleTokenAfterTime = dateFormat.order.filter(el => tokenSetBetweenTimes.has(el))[0];
    }else{
        levels =  ['root','year','month','day'];
    }



    // const tokenTypeOrder = [...new Set(tokenList.map(token => token.type)
    //     .filter(el => !el.startsWith('range') && el != 'year' && el !== 'month'))];
     const tokenTypeOrder = [...new Set(tokenList.map(token => token.type)
        .filter(el => el === 'time' || el === 'day'))];
    const timeAfterDay = tokenTypeOrder.length > 1 && tokenTypeOrder[1] === 'time';

    const tree = {
        0: {
            type: 'root',
            children: []
        }
    }

    let currentPosition = 0;
    // let lastDayNode = null;

    // test if n_1 is at a lower level than n_2
    function isUnder(n1, n2) {
        const i_n1 = levels.indexOf(n1);
        const i_n2 = levels.indexOf(n2);
        // return false if one does not exist
        if (i_n1 === -1 || i_n2 === -1) return false;
        return i_n2 < i_n1;
    }

    function createChild(sourceId, value, type){
        currentId++;
        if (verbose === 'full'){
            console.log("\x1b[38;5;226m creating child \x1b[0m", type,' with id ', currentId);
        }
        type = type ? type:levels[levels.indexOf(tree[sourceId].type)+1];
        if (type === 'day' || type === 'year' || type === 'month'){
            value = convertDate(value, type, dateFormat);
        }
        const node = {
            type: type,
            parent: sourceId,
            children: [],
            val: value
        }
        tree[currentId] = node;
        tree[sourceId].children.push(currentId);
        return currentId;
    }

    function doTransition(token){ // warning, 'date' token is actually never generated by the lexer
        const source = tree[currentPosition].type;
        const dest = token.type;
        if (verbose === 'full'){
            console.log('transition from',source,'to',dest);
        }
        

        if (dest === 'date'){
            // make a new date. cannot do this transition in the middle of a date processing
            if ((source === 'root' || source === dateFormat.order.at(-1)) || source === 'time'){
                let pos = [];
                pos['year'] = createChild(currentPosition, convertDate(token.year, 'year', dateFormat), 'year');
                pos['month'] = createChild(pos['year'], convertDate(token.month, 'month', dateFormat), 'month');
                pos['day'] = createChild(pos['month'], token.day, 'day');
                currentPosition = pos[dateFormat.order.at(-1)];
                return 'new date';
            }
            return 'invalid';
        }

        if (source === 'root'){
            // only possibilities: start a new date or a new time info
            if (dest === dateFormat.order[0]){
                moveAndProcess(token);
                return 'new date'; 
            }else if (dest === 'time'){
                moveAndProcess(token);
                return 'new time info';
            }
            return 'invalid';
        }
        
        if (source === 'time'){
            // 2025: sept: 2 et 3 à 18h, 4 et 5 à 19h 
            // 2025: 2 et 3 sept à 18h, 4 et 5 oct à 19h 
            // 2025: sept 2 et 3 à 18h, oct 4 et 5 à 19h 
            // if timeAfterDay, can only be possibleTokenAfterTime type. If creating a new date and 
            // the time is after date, 
            // create a new time node
            if (timeAfterDay){
                if (dest === possibleTokenAfterTime){
                    // create a new date on the branch
                    currentPosition = createChild(tree[currentPosition].parent);
                    moveAndProcess(token);
                    return 'new date'; 
                }else if (dest === dateFormat.order[0]){
                    // new date from scratch
                    currentPosition = 0;
                    moveAndProcess(token);
                    return 'new date'; 
                }else{
                    currentPosition = tree[currentPosition].parent;
                    moveAndProcess(token);
                    return 'add date';
                }
            }else{
                // either start a date
                if (dest === dateFormat.order[0]){
                    moveAndProcess(token);
                    return 'new date'; 
                }else{
                    moveAndProcess(token);
                    // console.log(levels);
                    return 'new date';
                    //possible token

                }
                // return 'invalid';
            }
        }

        // source 'root' already processed at this point
        if (dest === 'time'){
            if (timeAfterDay){
                // must be after a full date or day token ??
                if (source === dateFormat.order.at(-1) || source === 'day'){
                    moveAndProcess(token);
                    return 'add time info';
                }else{
                    return 'invalid';
                }
            }else{
                // if some tokens are before the time, move to this position

                if (possibleTokenBeforeTime){
                    while(tree[currentPosition].type !== possibleTokenBeforeTime){
                        currentPosition = tree[currentPosition].parent;
                    }
                }
                if (tree[currentPosition].children.length > 0 
                    && tree[tree[currentPosition].children.at(-1)].type
                    && isUnder(token, tree[currentPosition].type)){
                    createChild(currentPosition);
                }
                
                
                moveAndProcess(token);
                return 'add time info';
            }
            
        }

        // one leaf to be added
        if (source === 'day' && dest === 'day'){
            moveAndProcess(token);
            return 'make leaf';
        }
        // a date is complete, start a new date
        if (source === dateFormat.order.at(-1)){
            // new date
            if (dest === dateFormat.order[0]){
                while (tree[currentPosition].type !== 'root' && tree[currentPosition].type !== 'time'){
                    currentPosition = tree[currentPosition].parent;
                }
                // currentPosition = 0;
                // 2025: 18h les 16 et 17 sept, 21h le 18 sept 
                moveAndProcess(token);
                return 'new date';
            }
        }
        // move one step forward in the order of date format. Moving two steps forward is impossible
        if (dateFormat.order.indexOf(dest) === dateFormat.order.indexOf(source) + 1){
            moveAndProcess(token);
            return 'add element';
        }
        // backtracking
        if (dateFormat.order.indexOf(dest) === dateFormat.order.indexOf(source) - 1){
            // backtracking with year as source or dest is impossible
            if (dest === 'year' || source === 'year'){
                return 'invalid';
            }
            if (dest === 'month'){// day -> month
                moveAndProcess(token);
            }else{// month -> day
                currentPosition = createChild(tree[currentPosition].parent);
                moveAndProcess(token);
            }
            
            return 'backtracking';
        }
        return 'invalid';
    }

    function moveAndProcess(token){
        // console.log('token',token, currentPosition,tree[currentPosition]);

        if (isUnder(token.type, tree[currentPosition].type)){
            // if just under, create a new node from the token
            if (levels.indexOf(token.type) === levels.indexOf(tree[currentPosition].type) +1){
                currentPosition = createChild(currentPosition,token.rawText);
                if (token.type === 'time'){
                    if (token.hasOwnProperty('timeList')){
                        tree[currentPosition].timeList = token.timeList;
                    }
                    if (token.hasOwnProperty('conditionList')){
                        tree[currentPosition].conditionList = token.conditionList;
                    }
                    delete tree[currentPosition].val;
                }
                if (token.hasOwnProperty('delimiter')){
                    tree[currentPosition].delimiter = token.delimiter;
                    // add the identifier of the time info. Will help identifying if two
                    // delimiters end share the same time info
                    let parentTimeInfo = currentPosition;
                    while(parentTimeInfo > 0 && tree[parentTimeInfo].type !== 'time'){
                        parentTimeInfo = tree[parentTimeInfo].parent;
                    }
                    if (parentTimeInfo > 0){
                        tree[currentPosition].parentTimeInfo = parentTimeInfo;
                    }
                }
            }else{
                
                // sept 2025: 03; 04, jan 2026: 05
                // 2025 3, 4 sept 2026 2, 3 janv ok
                // 2025 le 3 septembre 18h, le 2 oct 17h 
                // else go down one level.
                if (tree[currentPosition].type === 'year' && token.type === 'day' 
                    && tree[currentPosition].children.length > 0){

                    currentPosition = tree[currentPosition].children.at(-1);
                }else if(tree[currentPosition].children.length > 0 
                    && !tree[tree[currentPosition].children.at(-1)].type){
                        
                    currentPosition = tree[currentPosition].children.at(-1);
                }else if(tree[currentPosition].children.length > 0 && 
                    tree[tree[currentPosition].children.at(-1)].type === 'time'
                ){
                    currentPosition = tree[currentPosition].children.at(-1);
                }else{
                    currentPosition = createChild(currentPosition);
                }
                
                moveAndProcess(token);
            }
        }else{
            // same level and value is undefined
            if (token.type === tree[currentPosition].type && token.type !== 'time' && !tree[currentPosition].val){
                tree[currentPosition].val = convertDate(token.rawText, token.type, dateFormat);
            // if time
            }else if (token.type === tree[currentPosition].type && token.type === 'time' 
                    &&  !tree[currentPosition].hasOwnProperty('timeList') && !tree[currentPosition].hasOwnProperty('timeCondition')){
                if (token.hasOwnProperty('timeList')){
                    tree[currentPosition].timeList = token.timeList;
                }
                if (token.hasOwnProperty('conditionList')){
                    tree[currentPosition].conditionList = token.conditionList;
                }
                delete tree[currentPosition].val;    
            }else{
                // else go up one level
                if (verbose === 'full'){
                    console.log('moving from ', currentPosition,'to', tree[currentPosition].parent);
                }
                currentPosition = tree[currentPosition].parent;
                moveAndProcess(token);
            } 
        }
    }

    
    for (const token of tokenList){

        const transition = doTransition(token);

        if (transition === 'invalid'){
            if (verbose){
                console.log('invalid transition');
            }
           
            return null;
        }
    }

    // remove parentTimeInfo when there is no time info
    for (const key of Object.keys(tree)){
        const node = tree[key];
        if (node.hasOwnProperty('parentTimeInfo')){
          if (!tree[node.parentTimeInfo].hasOwnProperty('timeList') && !tree[node.parentTimeInfo].hasOwnProperty('conditionList')){
            delete node.parentTimeInfo;
          }  
        }
    }

    return tree;
    // return tree.map(el => convertDate(el));
}

//******************************************//
// process the trees to something simpler   //
//******************************************//

function isValidTree(tree, dateFormat) {
    if (verbose === 'full'){
        console.log("\n*** validating the following tree: ***\n\n",tree);
    }
    
    hasYears = 'year' in Object.keys(dateFormat);
    if (tree === null){
        if (verbose){
            console.log("\x1b[38;5;226mInvalid tree: null tree.\x1b[0m");
        }
        return false;
    }

   
    for (const key of Object.keys(tree)) {
        const el = tree[key];

        // the element should have children, unless it is a leaf ('day)
        if (el.type !== 'day' && el.children.length === 0){
            if (verbose){
                console.log("\x1b[38;5;226mInvalid tree: block \x1b[0m"+key+"\x1b[38;5;226m has no children in tree:\x1b[0m", tree);
            } 
            return false; 
        }

        // test for missing values
        if (el.type === 'day' || el.type === 'month' || (hasYears && el.type === 'year')) {
            if (!el.val) {
                if (verbose){
                    console.log("\x1b[38;5;226mInvalid tree: missing value for node \x1b[0m"+el+"\x1b[38;5;226m in tree:\x1b[0m",tree);
                } 
                return false; 
            }
        }

        // test for range balance
        if (el.type === 'day' && el.hasOwnProperty('delimiter') && el.delimiter.type === 'rangeDelimiterStart'){
            // the very next 'day' node should have a delimiter
            const followingDayNodes = Object.keys(tree).filter(k => k > key && tree[k].type === 'day');
            if (followingDayNodes.length === 0 || !tree[followingDayNodes[0]].hasOwnProperty('delimiter')
                || tree[followingDayNodes[0]].delimiter.type !== 'rangeDelimiterEnd'){
                if (verbose){
                    console.log('\x1b[38;5;226mInvalid tree: no end delimiter found or end '+
                        'delimiter not at the right place for node \x1b[0m'+key+'\x1b[38;5;226m in tree:\x1b[0m', tree);
                }
                return false;
            }
        }

        // check if the dates are chronologically relevant. 
        if (el.type === 'root' && hasYears){
            let y = 0;
            for (const i of el.children){
                const year = tree[i].val;
                if (year < y){
                    if (verbose){
                        console.log("\x1b[38;5;226mInvalid tree: years not in correct order for tree:\x1b[0m", tree);
                    }
                    return false;
                }
                y = year;
            }
        }
        if (el.type === 'year'){
            let m = 0;
            for (const i of el.children){
                const month = tree[i].val;
                if (month < m){
                    if (verbose){
                        console.log("\x1b[38;5;226mInvalid tree: months not in correct order for tree:\x1b[0m", tree);
                    }
                    return false;
                }
                m = month;
            }
        }
        if (el.type === 'month'){
            let d = 0;
            for (const i of el.children){
                const day = tree[i].val;
                if (day < d){
                    if (verbose){
                        console.log("\x1b[38;5;226mInvalid tree: days not in correct order for tree:\x1b[0m", tree);
                    }
                    return false;
                }
                d = day;
            }
        }
    }

    if (verbose){
        console.log('Valid tree.');
    }

    return true; 
}

// convert date elements to normalized (only numeric, year with 4 digits)
function convertDate(str, field, dateFormat){
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

    // assign time info to leaves
    const datesFromTree = tree[0].children.map(index => {
        const subTree = tree[index];
        if (subTree.type === 'date'){
            return checkYear(subTree);
        }
        
        const dates = [];
        
        function explore(currentNode, context = {}) {
            if (currentNode.type === 'time'){
                // if (currentNode.hasOwnProperty('timeList')){
                    context.timeList = currentNode.timeList;
                // }
                // if (currentNode.hasOwnProperty('conditionList')){
                    context.conditionList = currentNode.conditionList;
                // }
            }
            // console.log('exploring',currentNode);
            if (currentNode.type === 'year') {
                context.year = currentNode.val;
            } else if (currentNode.type === 'month') {
                context.month = currentNode.val;
            } else if (currentNode.type === 'day') {
                context.day = currentNode.val;
                // add the date when arriving at the leaf
                // const type = (subTree.type === 'rangeDelimiterStart' || subTree.type === 'rangeDelimiterEnd') ? subTree.type : 'date';
                const res = checkYear({type: 'date', day: context.day, month: context.month, year: context.year });
                if (context.timeList){
                    res.timeList = context.timeList;
                }
                if (context.conditionList){
                    res.conditionList = context.conditionList;
                }
                if (currentNode.hasOwnProperty('delimiter')){
                    res.delimiter = currentNode.delimiter.type;
                    if (currentNode.hasOwnProperty('parentTimeInfo')){
                        res.parentTimeInfo = currentNode.parentTimeInfo;
                    }
                }
                dates.push(res);
                return;
            }

            // Explore the children
            if (currentNode.children) {
                for (const index of currentNode.children) {
                    explore(tree[index], { ...context });
                }
            }
        }

        explore(subTree);
        return dates;
    }).flat();

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
    
    // merge rangeDelimiters

    const dateList = [];
    let startDate;
    
    for (const dateToken of datesFromTree){
        if(dateToken.delimiter === 'rangeDelimiterStart'){
            // console.log('debut');
            startDate = dateToken;
        }else if(dateToken.delimiter === 'rangeDelimiterEnd' || dateToken.delimiter === 'rangeDelimiterUnbalanceEnd'){
            // if there is an unbalanced end delimiter, add a start date (today)
            if (dateToken.delimiter === 'rangeDelimiterUnbalanceEnd'){
                startDate = {type: 'date', day:now.getDate(), month:now.getMonth() + 1, year: now.getFullYear()};
                if (dateToken.hasOwnProperty('parentTimeInfo')){
                    startDate.parentTimeInfo = dateToken.parentTimeInfo;
                }
                if (dateToken.hasOwnProperty('timeList')){
                    startDate.timeList = dateToken.timeList;
                }
                if (dateToken.hasOwnProperty('conditionList')){
                    startDate.conditionList = dateToken.conditionList;
                }
            }
            // case 1: both startDate and currentToken have time info from a different parentTimeInfo. So 
            // it is a time range (only one date with start and end time)
            // if (dateToken.hasOwnProperty('timeList') && startDate.hasOwnProperty('timeList')
            if (dateToken.hasOwnProperty('parentTimeInfo') && startDate.hasOwnProperty('parentTimeInfo')
                && dateToken.parentTimeInfo !== startDate.parentTimeInfo){
                // time info should be a timeList for both, with only one element
                if (!startDate.hasOwnProperty('timeList') || startDate.timeList.length !== 1 || startDate.timeList[0].type !== 'time'){
                    // strange time info, send an error
                    console.log("\x1b[38;5;226mbad time info in opening range delimiter. Aborting\x1b[0m", startDate);
                    return null;
                }
                if (!dateToken.hasOwnProperty('timeList') || dateToken.timeList.length !== 1 || dateToken.timeList[0].type !== 'time'){
                    // strange time info, send an error
                    console.log("\x1b[38;5;226mbad time info in closing range delimiter. Aborting\x1b[0m", dateToken);
                    return null;
                }
                startDate.type = 'date';
                startDate.eventEnd = {
                    day: dateToken.day,
                    month: dateToken.month,
                    year: dateToken.year,
                    time: dateToken.timeList[0].time
                }
                dateList.push(startDate);
            }else{
                // case 2: it is a date range
                // if the ending delimiter as time info while start delimiter not, there is a mistake somewhere
                if (!startDate.hasOwnProperty('parentTimeInfo') && dateToken.hasOwnProperty('parentTimeInfo')){
                    console.log("\x1b[38;5;226mClosing range delimiter have time info, but not opening delimiter. Aborting\x1b0m", dateToken);
                    return null;
                }

                // now either:
                // - start and end delimiters have no time info. Push every day in the range as it is
                // - start has time but not end:
                // du 07 juin à 19h au 21 juin, only the first date as a time (par exemple pour un vernissage)
                // push the first date with time info, other dates without time info
                // - start and end have the same time info from parentTimeInfo
                // In every case: push the start date as it is, and other days with the time info from the end
                // date
                delete startDate.delimiter;
                // if (!startDate.hasOwnProperty('timeList') && dateToken.hasOwnProperty('timeList')){
                //     startDate.timeList = dateToken.timeList;
                // }
                // if (!startDate.hasOwnProperty('conditionList') && dateToken.hasOwnProperty('conditionList')){
                //     startDate.conditionList = dateToken.conditionList;
                // }
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
                    if (dateToken.hasOwnProperty('timeList')){
                        dateList.at(-1).timeList = dateToken.timeList;
                    }
                    if (dateToken.hasOwnProperty('conditionList')){
                        dateList.at(-1).conditionList = dateToken.conditionList;
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
    


    // evaluate time info and create corresponding dates
    function evaluateTimeInfo(list){
        const res = [];

        function developTimeList(dateToken, timeList){
            delete dateToken.timeList;
            for (const timeToken of timeList){
                const newDateToken = {...dateToken};
                if (timeToken.type === 'time'){
                    // if it is simple time, add time to the dateToken
                    newDateToken.time = timeToken.time;
                    res.push(newDateToken);
                } else {
                    // it should be a time range. Should add a start and end time
                    newDateToken.time = timeToken.startTime;
                    newDateToken.eventEnd = {time: timeToken.endTime};
                    res.push(newDateToken);
                } 
            }
        }

        for (const dateToken of list){
            // incompatible time informations
            if (dateToken.hasOwnProperty('timeList') && dateToken.hasOwnProperty('conditionList')){
                // if (verbose){
                    console.log("\x1b[38;5;226mThe following date has both timeList and conditionList: \x1b[0m", dateToken);
                // }
                continue;
            }
            // no time information, push the token as it is
            if (!dateToken.hasOwnProperty('timeList') && !dateToken.hasOwnProperty('conditionList')){
                res.push(dateToken);
                continue;
            }
            // if condition, verify if the date corresponds to the condition, if yes, process the timeList
            // within the condition
            if (dateToken.hasOwnProperty('conditionList')){
                for (const condition of dateToken.conditionList){
                    const date = new Date(dateToken.year, dateToken.month - 1, dateToken.day);
                    const dayOfWeek = date.toLocaleDateString('en-US', {weekday: 'long'}).toLowerCase();
                    if (condition.val === dayOfWeek){
                        const newDateToken = {...dateToken};
                        delete newDateToken.conditionList;
                        if (condition.hasOwnProperty('time')){
                            developTimeList(newDateToken, condition.time.timeList);
                        }else{
                            res.push(newDateToken);
                        }
                    }
                }
                continue;
                // continue
            }
            // now there is just a time list
            developTimeList(dateToken, dateToken.timeList);
        }
        return res;
    }

    const result = evaluateTimeInfo(dateList);
    if (verbose === 'full'){
        console.log('\n*** Date list after time and condition evaluation: ***\n\n', result);
    }
    
    return result;
}


function formatDate(dateObj){
    const date = new Date(dateObj.year, dateObj.month - 1, dateObj.day);

    const options = { weekday: 'long' };
    const jour = date.toLocaleDateString('fr-FR', options);
    // let txt = ""+dateObj.day+"/"+dateObj.month+"/"+dateObj.year+(dateObj.hasOwnProperty('time')? " à "+dateObj.time : "");
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


function extractDates(s, dateFormat, sol, i){
    console.log("\n****************** Entrée: ******************\nTest n°"+i+": "+s);
    const tokenList = tokenize(cleanDate(s), dateFormat);
    
    // console.log('time list',tokenList.filter(t => t.type === 'time').map(t => t.timeList));
    const poss = resolvePossibilities(tokenList, dateFormat.order.includes('year'));
    
    const treeList = poss.map(p => makeTree(p, dateFormat))
        .filter(tree => isValidTree(tree, dateFormat))
        .map(tree => processTree(tree))
        .filter(tree => tree !== null);
    if (verbose){
        console.log("\n*** Output ***");
    }
    
    if (treeList.length > 0){
        treeList.forEach((p,ind) => {
            console.log("\nPossibility n°",ind+1);
            console.log();
            p.forEach(node => console.log(formatDate(node)));
        });
        const res = treeList[0].map(node => formatDate(node)).join("|");
        // console.log('*********');
        // console.log(res);
        // console.log('*********');
        if (treeList.length === 1 && res === sol){
            console.log("\n\x1b[32mTest passed\x1b[0m");
        }else{
            console.log("\n\x1b[31mTest failed\x1b[0m");
        }
    }else{
        console.log('No solution found.');
        console.log("\n\x1b[31mTest failed\x1b[0m");
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

test[1] = {text: `23.09.26 à partir de 18h`,
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



test[3] = {text: `mar. 24 Jan, 2026, 07:30 PM-08:00 PM`,
dateFormat: {
    year: 'long',
    month: 'short',
    weekDay: 'short',
    order: ['day','month','year']
}};
sols[3] = "Le samedi 24/1/2026 à 19:30 (fin à 20:00)";

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
// test doit fail !

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
sols[13] = "Le jeudi 27/11/2025 à 17:00 (fin à 22:00)|Le vendredi 28/11/2025 à 17:00 (fin à 22:00)|Le mercredi 03/12/2025 à 17:00 (fin à 22:00)";

test[14] = {text: `Du jeudi 13 jusqu'au samedi 15 novembre 2025, jeudi à 20h, samedi à 18h`,
dateFormat: {
    month: 'long',
    order: ['day','month','year'],
    weekDay: 'long'
}};
sols[14] = "Le jeudi 13/11/2025 à 20:00|Le samedi 15/11/2025 à 18:00";

test[15] = {text: `Lundi 15 novembre 2025 à 20h - mardi 16 novembre 2025 à 4h`,
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


test[17] = {text: `du lundi au mercredi, à 18h, du 14 au 27 septembre 2025. Du samedi au lundi, à 18h, du 01 au 10 octobre 2025.`,
dateFormat: {
    month: 'long',
    year: 'long',
    order: ['day','month','year'],
    weekDay: 'long'
}};
sols[17] = "Le dimanche 14/9/2025 à 18:00|Le samedi 20/9/2025 à 18:00|Le dimanche 21/9/2025 à 18:00|Le samedi 27/9/2025 à 1"
    +"8:00|Le samedi 04/10/2025 à 18:00|Le dimanche 05/10/2025 à 18:00";

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
console.log("\n\n\n");

// let i = 29;
// extractDates(test[i].text, test[i].dateFormat, sols[i], i);
// console.log("test "+i+": ",test[i].text);

for (i = 0; i < 30; i++){
    extractDates(test[i].text, test[i].dateFormat, sols[i],i)
}







// // aux functions

function intersectAll(sets) {
    if (sets.length === 0) return new Set();

    // from smallest to biggest for optimization
    const [smallest, ...others] = [...sets].sort((a,b) => a.size - b.size);

    return new Set(
        [...smallest].filter(el => others.every(s => s.includes(el)))
    );
}

// // test inconsistencies
//         function testInconsistencies(b){
//             const inconsistencies = b.filter(t => t.type === "text" && !ignoreList.includes(t.rawText));
//             if (verbose && inconsistencies.length > 0){
//             console.log("\x1b[38;5;226mWarning: found a unknown texts: \x1b[0m"
//                 +inconsistencies.map(t => t.rawText).join(" ")
//                 +"\x1b[38;5;226m they are neither in the timeRangeList, timeSeparatorList nor in ignore list. Check if it is a missing keyword.\x1b[0m");
//             }
//         }