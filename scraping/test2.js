verbose = true;


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

const shortMonths = Object.values(monthsDict);
const longMonths = Object.keys(monthsDict);
const rangeDeLimiters = [["du","au"],["a partir du","jusqu'au"],["de","a"]];
const leftRangeDelimiters = ["jusqu'au"];
const rangeSeparators = ["->", "→", "—"]; // classic dash will be processed by default

const timeMarkers = [{"minuit": "midnight"}];
const exception = ["sauf"];

const timeRangeDelimiters = [["de","a"],["de","jusqu'a"]];
const timeListDelimiters = [["a","et"]];
const timeListSeparators = ["et"];



const dayDict = {long: ["lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche"],
                 short: ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"]
                };

const ignoreList = ["&","et","le"]; // those keywords are not mandatory to understand the structure
const startTimeKeywords = ["a", "a partir de"];


const moisRegex = Object.values(monthsDict).flat().map(m => m.replace('.', '\\.')).join('|');
const currentYear = new Date().getFullYear();
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

    // Fix caracters encoding errors
    s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
         .replace(/–/g, "-") // normalize dashes
         .replace(/[^\x00-\x7F]/g,'') //remove non standard caracters => to be improved
         .toLowerCase()
         .replace(/,|;|\|/g, " ") // remove unprocessed separators. Separators like | without semantic meanings 
         // have been found in texts, so it is discarded also.
         .replace(rangeSeparatorRegex, ' — ') // replace rangeSeparators by long dash. Add spaces around to ensure token capture
         .replace(/(?<=\p{L})\./gu, '') //replace(/(?<=[a-zÀ-ÖØ-öø-ÿ])\./g, '') // remove all dots directly following a letter
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

    // // regex to ensure separators are surrounded by spaces
    // const sepRegex = new RegExp(
    //     "\\s*(" + rangeSeparators.map(s => s.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")).join("|") + ")\\s*",
    //     "g"
    // );

    // s = s.replace(sepRegex, " $1 ");
    return s;
}
 

//***************************************//
// lexer: make a list of tokens          //
//***************************************//


function makeToken(str, dateFormat){
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
        if ('weekDay' in dateFormat){
            if (dateFormat.weekDay === 'short' && dayDict.short.includes(str)){
                possibilities.push('weekDay');
            }
            if (dateFormat.weekDay === 'long' && dayDict.long.includes(str)){
                possibilities.push('weekDay');
            }
        }
        if (leftRangeDelimiters.some(del => del.endsWith(str))){
            possibilities = ['leftRangeDelimiter','text'];
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

    // weekdays filtering.
    // if for the first day token is preceded by a weekDay, we assume that weekdays are used, and that all
    // day tokens are preceded by a weekDay. 
    // We assume that for that case, all weekdays are used in combination with a date. weekDay tokens are discarded
    // otherwise, all weekdays are timeCondition
    // lundi 9 avril, du mardi 10 au jeudi 12 avril => case 1
    // les lundis et mardis, du 11 au 23 octobre => case 2 (a keyword is between weekDay and day)
    const firstWeekDay = list.findIndex(t => t.type === 'weekDay');
    const newList =
        firstWeekDay !== -1 &&
        list[firstWeekDay + 1]?.type === 'day'
            ? list.filter(t => t.type !== 'weekDay')
            : list;

    for (const token of newList) {

        if (token.type === "text") {
        if (buffer) {
            buffer.rawText += " " + token.rawText;
        } else {
            buffer = { ...token };
        }

        } else {
        // if the type is not text, the buffer is released
        if (buffer) {
            result.push(buffer);
            buffer = null;
        }

        result.push(token);
        }
    }

    // if there is some text remaining at the end
    if (buffer) {
        result.push(buffer);
    }

    return timeParser(result).map(token => processTextToken(token))
                .filter(token => token.type !== 'unknown text');
}

// aux function to regroupe time and text:
// Assemble sequences of time, text and weekDay. Sequences without time are discarded (no relevant information)
// sequences with time and text are treated as simple time info, or time range (start-end), or timeList.
// sequences with weekDay are considered as timeCondition (eg: le mardi à 18h, le jeudi à 19h)
// Since this function is called at the end of preprocessToken, there can't be two text tokens in a row.
// weekDays token separate time conditions: eg "à 18h le jeudi, à 20h le vendredi". It has to be determined which
// side is the info.
// then info sequence 
function timeParser(tokens) {
    console.log("time parser", tokens);
    const result = [];
    let buffer = []; // tokens time/text/weekDay buffer

    const flushBuffer = () => {
        console.log("********buffer *********\nà flusher", buffer);

        // not processed if exactly one weekDay is present, unless it is at the end.
        // cannot handle something like 'du 12 au 20 octobre, le mardi, du 21 au 27 octobre, le vendredi'
        // du 12 au 20 octobre, à 15h le mardi, à 16h le jeudi
        // mardi 12 à 15h, jeudi 13 à 16h
        // but we have not encountered this case yet
        // 'du 12 au 20 octobre, le mardi, du 21 au 27 octobre, le vendredi'
        // du 01 au 31 octobre, du mardi au jeudi à 20h
        // detect time condition "à 15h le lundi à 18h le mardi et jeudi "
        // "les lundi, mardi et jeudi"
        
        // empty buffer returns nothing
        if (buffer.length === 0) return;

        // if it is only text, return the buffer. Else captures the last token if it is text. 
        // Will be pushed at the end.
        // example: 'du 17.02.26 à 20h au 18.02.26 à 4h'. 'au' should end the buffer 'à 20h au'

        if (buffer.length === 1 && buffer[0].type === 'text'){
            result.push(buffer[0]);
            buffer = [];
            return;
        }

        let lastToken;
        if (buffer[buffer.length-1].type === 'text'){
            lastToken = buffer.pop();
        }

        const isTimeCondition = buffer.some(t => t.type === 'weekDay');

        // buffer should contain a time token or a weekDay token, otherwise it is not a time buffer. 
        if (!buffer.some(t => t.type === 'time') && !isTimeCondition){
            for (const t of buffer){
                result.push(t);
            }
            buffer = [];
            if (lastToken) {result.push(lastToken)};
            return;
        }

        // test now time | rangeSeparator | time: 18h-20h, etc... this range has priority over others (weekDays, dates)
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
                    rawText: buffer.slice(i,i+3).map(t => t.rawText).join(" "),
                });
            }
            i++;
        }
        
        // time or weekDay token found

        // test range patterns: text | time | text | time pattern
        i = 0;
        while(i < buffer.length - 3){ 
            if (buffer[i].type === "text" &&
                buffer[i+1].type === "time" &&
                buffer[i+2].type === "text" &&
                buffer[i+3].type === "time") {

                const t1 = buffer[i].rawText.trim().toLowerCase();
                const t2 = buffer[i+2].rawText.trim().toLowerCase();
                for (const pair of timeRangeDelimiters) {
                    if (t1.endsWith(pair[0]) && t2 === pair[1]) {
                        buffer.splice(i, 4, {
                            type: "timeRange",
                            startTime: buffer[i+1].time, 
                            endTime: buffer[i+3].time,
                            rawText: buffer.slice(i,i+3).map(t => t.rawText).join(" "),
                            delimiter: pair
                        });
                    }
                }
            }
            i++;
        }

        // from here we can assume than texts before time tokens are not relevant
        // since they can be regrouped only in timeList, not timeRange.
        // we move the text to the following time token

        i = 0;
        while(i < buffer.length - 1){ 
            if (buffer[i].type === "text" &&
                buffer[i+1].type === "time") {
                    buffer[i+1].textBefore = buffer[i].rawText;
                    buffer.splice(i, 1);
            }
            i++;
        }

        // flush the buffer and return if it is not a time condition
        if (!isTimeCondition){
            // if only one time or timeRangeToken, return simple token
            if (buffer.length === 1){
                result.push(buffer[0]);
                buffer = [];
                if (lastToken) {result.push(lastToken)};
                return;
            }

            result.push({
                type: "timeList",
                rawText: buffer.map(t => t.rawText).join(" "),
                timeList: buffer.filter(t => t.type === "time" || t.type === "timeRange")
            });
            testInconsistencies(buffer);
            buffer = [];
            if (lastToken) {result.push(lastToken)};
            return;
        }


        // test weekDay range patterns: text | weekDay | time | text | weekDay | time pattern
        // there cannot be time within this pattern: 
        // du 18 au 27 juin, du mercredi à 7h au jeudi à 18h 
        i = 0;
        while(i < buffer.length - 5){ 
            if (buffer[i].type === "text" &&
                buffer[i+1].type === "weekDay" &&
                buffer[i+2].type === "time" &&
                buffer[i+3].type === "text" &&
                buffer[i+4].type === "weekDay" &&
                buffer[i+5].type === "time") {

                const t1 = buffer[i].rawText.trim().toLowerCase();
                const t2 = buffer[i+3].rawText.trim().toLowerCase();
                for (const pair of timeRangeDelimiters) {
                    if (t1.endsWith(pair[0]) && t2 === pair[1]) {
                        buffer.splice(i, 4, {
                            type: "weekDayRange",
                            startDay: buffer[i+1].rawText,
                            endDay: buffer[i+4].rawText,
                            rangeStartTime: buffer[i+2].rawText, 
                            rangeEndTime: buffer[i+5].rawText,
                            rawText: buffer.slice(i,i+5).map(t => t.rawText).join(" "),
                            delimiter: pair
                        });
                    }
                }
            }
            i++;
        }

        // test weekDay range patterns: text | weekDay | text | weekDay pattern
        // there cannot be time within this pattern: 
        // du 18 au 27 juin, du mercredi à 7h au jeudi à 18h
        i = 0;
        while(i < buffer.length - 3){ 
            if (buffer[i].type === "text" &&
                buffer[i+1].type === "weekDay" &&
                buffer[i+2].type === "text" &&
                buffer[i+3].type === "weekDay") {

                const t1 = buffer[i].rawText.trim().toLowerCase();
                const t2 = buffer[i+2].rawText.trim().toLowerCase();
                for (const pair of timeRangeDelimiters) {
                    if (t1.endsWith(pair[0]) && t2 === pair[1]) {
                        buffer.splice(i, 4, {
                            type: "weekDayRange",
                            startDay: buffer[i+1].rawText, 
                            endDay: buffer[i+3].rawText,
                            rawText: buffer.slice(i,i+3).map(t => t.rawText).join(" "),
                            delimiter: pair
                        });
                    }
                }
            }
            i++;
        }

        // remove all remaining text
        testInconsistencies(buffer);
        buffer = buffer.filter(t => t.type !== 'text');
        
        

        
        
        // function for the default behaviour, after having parsed time ranges. Makes a list of the time and 
        // time ranges encountered.
        // // every remaining text is tested for inconsistencies.
        // const makeDefaultGroup = () => {
        //     result.push({
        //         type: "timeList",
        //         rawText: buffer.map(t => t.rawText).join(" "),
        //         // timeList: buffer.filter(t => t.type === "time").map(t => t.rawText)
        //         timeList: buffer.filter(t => t.type === "time" || t.type === "timeRange")
        //     });
        //     if (lastToken){
        //         result.push(lastToken);
        //     }
           
        // };

    
        // Default case
        // makeDefaultGroup();
        buffer = [];
    };

    for (const token of tokens) {
        if (token.type === "time" || token.type === "text" || token.type === "weekDay" || token.type === "rangeSeparator") {
            buffer.push(token);
        } else {
            flushBuffer();
            result.push(token);
        }
    }
    
    flushBuffer();
    console.log("*** tokens after time parser***",result);
    return result;
}




// process text token: if it is a keyword, change the type to the corresponding situation.
// Remove others and send a warning to developpers if verbose 
// non text tokens are unchanged
function processTextToken(token){
    // don't process non text tokens
    if (token.type !== 'text'){
        return token;
    }    // if it is a starting delimiter
    // if (rangeDeLimiters.map(el => el[0]).flat().includes(token.rawText)){
    if (rangeDeLimiters.some(el => token.rawText.endsWith(el[0]))){
        token.type = 'rangeDelimiterStart';
        return token;
    }
    // if it is a end delimiter
    if (rangeDeLimiters.some(el => token.rawText.endsWith(el[1]))){
        token.type = 'rangeDelimiterEnd';
        return token;
    }
    // if it is a range separator
    if (token.rawText === '—'){
        token.type = 'rangeSeparator';
        return token;
    }
    // if it is in the left delimiter
    if (leftRangeDelimiters.some(el => token.rawText.endsWith(el))){
        token.type = 'rangeLeftDelimiter';
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

    // the lists must have at least one occurrence of 'day' and 'month', as well as 'year' if hasYear is true
    return result.filter(list => {
        const types = new Set(list.map(el => el.type));

        if (!types.has('month')) return false;
        if (!types.has('day')) return false;
        if (hasYears && !types.has('year')) return false;

        return true;
    });
}

function lexer(s, dateFormat){
    // console.log(s.split(" ").map(e => makeToken(e, dateFormat)).flat());
    return s.split(" ").map(e => makeToken(e, dateFormat)).flat();
    
}

//***************************************//
// make a tree from the list of tokens   //
//***************************************//

function makeTree(tokenList, dateFormat){
    let currentId = 0;
    const levels = ['root','year','month','day'];
    dateLength = dateFormat.order.length;

    const tree = {
        0: {
            type: 'root',
            children: []
        }
    }

    let currentPosition = 0;
    let currentState = null;
    let lastDayNode = null;

    // test if n_1 is at a lower level than n_2
    function isUnder(n1, n2) {
        const i_n1 = levels.indexOf(n1);
        const i_n2 = levels.indexOf(n2);
        // return false if one does not exist
        if (i_n1 === -1 || i_n2 === -1) return false;
        return i_n2 < i_n1;
    }

    function createChild(sourceId, value, type){
        // console.log("\x1b[38;5;226m creating child \x1b[0m", type);
        currentId++;
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
        
            
        //****  transitions with range delimiters ****

        if (dest === 'rangeDelimiterStart'){
            // only valid transitions are root -> rangeDelimiterXXX and end of date -> rangeDelimiterXXX (cannot do this transition in
            // the middle of a date processing)
            // cannot start a new range within a range (currentState !== 'making range')
            if ((source === 'root' || source === 'date' || source === dateFormat.order.at(-1)) && currentState !== 'making range'){
                currentState = 'making range';
                currentPosition = createChild(0, null, 'rangeDelimiterStart');
                return 'opening range delimiter';
            }
            return 'invalid';
        }

        if (dest === 'rangeDelimiterEnd'){
            // only valid transitions are root -> rangeDelimiterXXX and end of date -> rangeDelimiterXXX (cannot do this transition in
            // the middle of a date processing)
            // can be used only when making a range
            if ((source === 'date' || source === dateFormat.order.at(-1)) && currentState === 'making range'){
                currentState = null;
                currentPosition = createChild(0, null, 'rangeDelimiterEnd');
                return 'closing range delimiter';
            }
            return 'invalid';
        }

        if (source === 'rangeDelimiterStart' || source === 'rangeDelimiterEnd'){
            if (dest === 'date'){
                let pos = [];
                pos['year'] = createChild(currentPosition, token.year, 'year');
                pos['month'] = createChild(pos['year'], token.month, 'month');
                pos['day'] = createChild(pos['month'], token.day, 'day');
                currentPosition = pos[dateFormat.order.at(-1)];
                return 'creating date for delimiter';
            }else if (dest === dateFormat.order[0]){
                moveAndProcess(token);
                return 'creating date for delimiter';
            }
            return 'invalid';
        }

        if (dest === 'rangeSeparator'){
            // create a range delimiter start, and move the last date at this delimiter
            const lastDateNode = tree[0].children.pop();
            currentPosition = createChild(0, null, 'rangeDelimiterStart');
            tree[currentPosition].children.push(lastDateNode);
            // tree[0].children = tree[0].children.filter(el => el !== value);

            // create an end delimiter
            currentPosition = createChild(0, null, 'rangeDelimiterEnd');
            return 'creating range from separator';
        }

        //**** other transitions ****

        if (dest === 'date'){
            // make a new date. cannot do this transition in the middle of a date processing
            if ((source === 'root' || source === dateFormat.order.at(-1)) && currentState !== 'making range'){
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
            // only possibility: start a new date
            if (dest === dateFormat.order[0]){
                moveAndProcess(token);
                return 'new date'; 
            }else{
                return 'invalid';
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
                currentPosition = 0;
                moveAndProcess(token);
                return 'new date';
            }
        }
        if (dateFormat.order.indexOf(dest) === dateFormat.order.indexOf(source) + 1){
            moveAndProcess(token);
            return 'add element';
        }
        if (dateFormat.order.indexOf(dest) === dateFormat.order.indexOf(source) - 1){// backtracking
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
        // if a range delimiter has been defined, create 
        if (tree[currentPosition].type === "rangeDelimiterStart" || tree[currentPosition].type === "rangeDelimiterEnd"){
            // go down one level and proceed
            currentPosition = createChild(currentPosition, undefined, 'year');
            moveAndProcess(token);
            return;
        }

        if (isUnder(token.type, tree[currentPosition].type)){
            // if just under, create a new node from the token
            if (levels.indexOf(token.type) === levels.indexOf(tree[currentPosition].type) +1){
                currentPosition = createChild(currentPosition,token.rawText);
            }else{
                // else go down one level.
                currentPosition = createChild(currentPosition);
                moveAndProcess(token);
            }
        }else{
            // same level and value is undefined
            if (token.type === tree[currentPosition].type && !tree[currentPosition].val){
                tree[currentPosition].val = convertDate(token.rawText, token.type, dateFormat);
            }else{
                // else go up one level
                currentPosition = tree[currentPosition].parent;
                moveAndProcess(token);
            } 
        }
    }

    
    for (const token of tokenList){
        // console.log('\n\n **** new transition ****');
        // console.log('position before: ', currentPosition);
        // console.log(tree);

        // if (token.type === 'weekDay'){ // *** ignore weekdays
        //     continue;
        // }

        // add time token to the current day
        if (token.type.startsWith('time')){ 
            tree[lastDayNode].timeInfo = token;
            continue;
        }

        const transition = doTransition(token);
        if (token.type === 'date' || token.type === 'day'){
            lastDayNode = currentPosition;
        }
        // console.log(transition,'from',tree[currentPosition].type, 'to', token.type);

        if (transition === 'invalid'){
            return null;
        }

        // console.log('position after',currentPosition);
    }

    return tree;
    // return tree.map(el => convertDate(el));
}

//******************************************//
// process the trees to something simpler   //
//******************************************//

function isValidTree(tree, dateFormat) {
    console.log("validating following tree:\n",tree);

    hasYears = 'year' in Object.keys(dateFormat);
    if (tree === null){
        return false;
    }

   

    // let rangeOpened = false;
    
    for (const key of Object.keys(tree)) {
        const el = tree[key];
        // console.log(el.type);

        // the element should have children, unless it is a leaf ('day)
        if (el.type !== 'day' && el.children.length === 0){
            if (verbose){
                console.log("This block has no children: ", el);
            } 
            return false; 
        }

        // test for missing values
        if (el.type === 'day' || el.type === 'month' || (hasYears && el.type === 'year')) {
            if (!el.val) {
                if (verbose){
                    console.log("Missing value: ",el);
                } 
                return false; 
            }
        }

        //not needed ? balance should be ok by design
        //
        // // test if the ranges are correctly defined.
        // // a closing token should always be just after an opening one in the parent's children
        // if (rangeOpened && el.type !== 'rangeDelimiterEnd'){
        //     if (verbose){
        //         console.log("Unbalanced range: closing before opening", el);
        //         return false;
        //     }
        // }
        // if (el.type === 'rangeDelimiterStart'){
        //     const nextToken = el.parent.children.firstIndexOf()
        //     rangeOpened = true;
        // }
        // if (el.type === 'rangeDelimiterEnd'){
        //     rangeOpened = false;
        // }
 

        // check if nodes have exactly one child
        if (el.type === 'rangeDelimiterStart' || el.type === 'rangeDelimiterEnd'){
            let currentNode = el;
            while (currentNode.type !== 'day') {
                if (currentNode.children.length !== 1){
                    return false;
                }
                currentNode = tree[currentNode.children[0]];
            }
        }
        // check if the dates are chronologically relevant. 
        if (el.type === 'root' && hasYears){
            let y = 0;
            for (i of el.children){
                const year = tree[i].val;
                if (year < y){
                    if (verbose){
                        console.log("Years not in correct order");
                    }
                    return false;
                }
                y = year;
            }
        }
        if (el.type === 'year'){
            let m = 0;
            for (i of el.children){
                const month = tree[i].val;
                if (month < m){
                    if (verbose){
                        console.log("Months not in correct order");
                    }
                    return false;
                }
                m = month;
            }
        }
        if (el.type === 'month'){
            let d = 0;
            for (i of el.children){
                const day = tree[i].val;
                if (day < d){
                    if (verbose){
                        console.log("Days not in correct order");
                    }
                    return false;
                }
                d = day;
            }
        }
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
            for (let i=0;i<shortMonths.length;i++){
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

    // console.log(tree);
    // // show time info
    // for (index in Object.keys(tree)){
    //     console.log(tree[index].timeInfo);
    // }



    // assign time info to leaves
    const newTree = tree[0].children.map(index => {
        const subTree = tree[index];
        if (subTree.type === 'date'){
            return checkYear(subTree);
        }
        if (subTree.type === 'rangeDelimiterStart' || subTree.type === 'rangeDelimiterEnd'){
            
            let currentNode = subTree;
            while(currentNode.children.length === 1){
                currentNode = tree[currentNode.children[0]];
                subTree[currentNode.type] = currentNode.val;
                if (currentNode.hasOwnProperty('timeInfo')){
                    subTree['timeInfo'] = currentNode.timeInfo;
                }
            }
            delete subTree.children;
            delete subTree.val;
            delete subTree.parent;
            return checkYear(subTree);
        }
        const dates = [];
        
        function explore(currentNode, context = {}) {
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
                
                if (currentNode.hasOwnProperty('timeInfo')){
                    res.timeInfo = currentNode.timeInfo;
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
       
        const now = new Date();

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

    const treeAfterMerge = [];
    let mergedNode;
    
    for (const node of newTree){
        if(node.type === 'rangeDelimiterStart'){
            // console.log('debut');
            mergedNode = node;
        }else if(node.type === 'rangeDelimiterEnd'){
            // console.log('fin', mergedNode,node);
            // case 1: no time for the end range. It is a list of dates, with the only first one possibly 
            // having a start time. If timeInfo is present for the start range, add it to the first date
            if (!node.hasOwnProperty('timeInfo')){
                // push the first date with its time info, which should correspond to only one start time. We verify
                // that we only have a start time
                if (mergedNode.timeInfo.type !== 'time'){
                    // strange time info, send an error
                    console.log("\x1b[38;5;226mbad time info in range delimiter. Aborting\x1b[0m", mergedNode);
                    return null;
                }else{
                    
                    mergedNode.type = 'date';
                    treeAfterMerge.push(mergedNode);
                }
                // all following days
                let current = new Date(mergedNode.year, mergedNode.month - 1, mergedNode.day + 1);
                const last = new Date(node.year, node.month - 1, node.day); 
                while (current <= last) {
                    treeAfterMerge.push({
                        type: 'date',
                        day: current.getDate(),
                        month: current.getMonth() + 1,
                        year: current.getFullYear()
                    });

                    // step to the next day
                    current.setDate(current.getDate() + 1);
                }
            }else{
                // case 2: end delimiter has time info.
                // case 2b: start delimiter has time info, so its only a single event, with a start day and time
                // and an end day/time
                // time info in node and merged should be simple times, otherwise the syntax is bad.
                if (mergedNode.hasOwnProperty('timeInfo')){
                    if (mergedNode.timeInfo.type !== 'time'){
                        // strange time info, send an error
                        console.log("\x1b[38;5;226mbad time info in range delimiter. Aborting\x1b0m", mergedNode);
                        return null;
                    }
                    if (node.timeInfo.type !== 'time'){
                        // strange time info, send an error
                        console.log("\x1b[38;5;226mbad time info in range delimiter. Aborting\x1b0m", node);
                        return null;
                    }
                    mergedNode.type = 'date';
                    mergedNode.eventEnd = {
                        day: node.day,
                        month: node.month,
                        year: node.year,
                        time: node.timeInfo.time
                    }
                    treeAfterMerge.push(mergedNode);
                }else{
                    // we have a list of dates, all sharing the same time information
                    // all following days
                    let current = new Date(mergedNode.year, mergedNode.month - 1, mergedNode.day);
                    const last = new Date(node.year, node.month - 1, node.day); 
                    while (current <= last) {
                        treeAfterMerge.push({
                            type: 'date',
                            day: current.getDate(),
                            month: current.getMonth() + 1,
                            year: current.getFullYear()
                        });
                        treeAfterMerge.at(-1).timeInfo = node.timeInfo;

                        // step to the next day
                        current.setDate(current.getDate() + 1);
                    }
                }
            }
            
        }else{
            treeAfterMerge.push(node);
        }
    }

    // process and propagate time information to the previous leaves
    function propagateTimeInfo(){
        let currentTimeInfo = undefined;
        // propagates time info backwards, until some time info is found
        for(let i = treeAfterMerge.length - 1; i >= 0; i--){      
            if (treeAfterMerge[i].hasOwnProperty('timeInfo')){
                currentTimeInfo = treeAfterMerge[i].timeInfo; // end data should be included in time info at this this
            }else{
                if (currentTimeInfo){
                    treeAfterMerge[i].timeInfo = currentTimeInfo;
                }
            }
            // console.log('time info', currentTimeInfo);
        }
    }

    propagateTimeInfo();

    // evaluate time info and create corresponding dates
    function evaluateTimeInfo(t){
        // console.log(t);
        const res = [];
        for (const node of t){
            if (!node.hasOwnProperty('timeInfo')){
                res.push(node);
            }else if (node.timeInfo.type === 'time'){
                // if it is simple time, add time to the node
                node.time = node.timeInfo.time;
                delete node.timeInfo;
                res.push(node);
                continue;
            } else if (node.timeInfo.type === 'timeRange'){
                // if time range: should add a start and end time
                node.time = node.timeInfo.startTime;
                node.eventEnd = {time: node.timeInfo.endTime};
                delete node.timeInfo;
                res.push(node);
            } else if (node.timeInfo.type === 'timeList'){
                // if time list, should generate a date per item
                for (const timeToken of node.timeInfo.timeList){
                    const newNode = {...node};
                    if (timeToken.type === 'timeRange'){
                        newNode.time = timeToken.startTime;
                        newNode.eventEnd = {time: timeToken.endTime};
                    }else{
                        newNode.time = timeToken.time;
                    }
                    
                    delete newNode.timeInfo;
                    res.push(newNode);
                }
                
            }
        }
        return res;
    }

    return evaluateTimeInfo(treeAfterMerge);
}


function formatDate(dateObj){
    let txt = ""+dateObj.day+"/"+dateObj.month+"/"+dateObj.year+(dateObj.hasOwnProperty('time')? " à "+dateObj.time : "");
    if (dateObj.hasOwnProperty('eventEnd')){
        const end = dateObj.eventEnd;
        txt = txt + " (ends";
        if (end.hasOwnProperty('day')){
            txt = txt + " on " + end.day+"/"+end.month+"/"+end.year;
        }
        txt = txt + " at " + end.time+")";
    }
    return txt;
}


function extractDates(s, dateFormat){
    console.log("**************** Entrée: ****************\n"+s);
    const tokenList = lexer(cleanDate(s), dateFormat);
    const poss = resolvePossibilities(tokenList, dateFormat.order.includes('year'));
    // console.log("nombre de possibilités",poss.length);
    // console.log(poss);
    // console.log(makeTree(poss[0], dateFormat));
    const treeList = poss.map(p => makeTree(preprocessTokens(p), dateFormat))
        .filter(tree => isValidTree(tree, dateFormat))
        .map(tree => processTree(tree));
    // console.log("Nombre arbres filtrés:", treeList.length);
    console.log("*** sortie ***"); 
    treeList.forEach((p,ind) => {
        console.log("\nPossibilité",ind+1);
        console.log();
        p.forEach(node => console.log(formatDate(node)));
    });
    console.log("\n");
}


// // --- Exemple d’utilisation ---
const text1 = `
  jusqu'au mardi 23 septembre 2026 à 18h
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

const text2b = "mardi, Nov 11, 07:30 PM → vendredi, Nov 14";
const dateFormat2b = {
    weekDay: 'long',
    month: 'short',
    order: ['month','day']
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

const text7= "23 nov 26, 27 dec 26, 19h, 21h"; // cas ambigu, même en langage naturel

const dateFormat7 = {
    month: 'short',
    year: 'short',
    order: ['day','month','year']
}

const text8= "23 nov 25, 02 dec 25, de 17h à 18h, et de 19h à 20h"; // ce cas n'est pas ambigu car 02 ne suit pas 25

const dateFormat8 = {
    month: 'short',
    year: 'short',
    order: ['day','month','year']
}

const text9= "09 07.25"; 

const dateFormat9 = {
    month: 'numeric',
    year: 'short',
    order: ['month','day','year']
}

const text10= "23 09 25, 02 12 25"; 

const dateFormat10 = {
    month: 'numeric',
    year: 'short',
    order: ['day','month','year']
}


const text11 = `03.06.26-14.06.26 à 17h et 20h`;
// const text11 = `11.05.26-14.06.26 17h aa 23h`;

const dateFormat11 = {
    month: 'numeric',
    year: 'short',
    order: ['day','month','year']
}

const text12 = `27, 28 nov, 3 déc, 2025`;

const dateFormat12 = {
    month: 'short',
    year: 'short',
    order: ['day','month','year']
}

const text13 = `nov, 27, 28, déc, 03, 2025, de 17h à 22h`;

const dateFormat13 = {
    month: 'short',
    year: 'short',
    order: ['month','day','year']
}

const text14 = `Du 13 au 15 novembre 2025, jeudi à 20h, samedi à 18h`;

const dateFormat14 = {
    month: 'long',
    order: ['day','month'],
    weekDay: 'long'
}

const text15 = `Lundi 15 novembre 2025 à 20h - mardi 16 novembre à 4h`;

const dateFormat15 = {
    month: 'long',
    order: ['day','month'],
    weekDay: 'long'
}

console.log("\n\n\n");
console.log("text1: ");extractDates(text1,dateFormat1);
// console.log("text1b: ");extractDates(text1b,dateFormat1b);
// console.log("text2: ");extractDates(text2,dateFormat2);
// console.log("text2b: ");extractDates(text2b,dateFormat2b);
// console.log("text3: ");extractDates(text3,dateFormat3);
// console.log("text4: ");extractDates(text4,dateFormat4);
// console.log("text5: ");extractDates(text5,dateFormat5);
// console.log("text6: ",extractDates(text6,dateFormat6), text6);
// console.log("text7: ",extractDates(text7,dateFormat7), text7); //multiposs
// console.log("text8: ",extractDates(text8,dateFormat8), text8);
// console.log("text9: ",extractDates(text9,dateFormat9), text9);
// console.log("text10: ",extractDates(text10,dateFormat10), text10);//multiposs
// console.log("text11: ",extractDates(text11,dateFormat11), text11);
// console.log("text12: ",extractDates(text12,dateFormat12), text12);//multiposs
// console.log("text13: ",extractDates(text13,dateFormat13), text13);
// console.log("text14: ",extractDates(text14,dateFormat14), text14);






// aux functions

// test inconsistencies
        function testInconsistencies(b){
            const inconsistencies = b.filter(t => t.type === "text" && !ignoreList.includes(t.rawText));
            if (verbose && inconsistencies.length > 0){
            console.log("\x1b[38;5;226mWarning: found a unknown texts: \x1b[0m"
                +inconsistencies.map(t => t.rawText).join(" ")
                +"\x1b[38;5;226m they are neither in the timeRangeList, timeSeparatorList nor in ignore list. Check if it is a missing keyword.\x1b[0m");
            }
        }