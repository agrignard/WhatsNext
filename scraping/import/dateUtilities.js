/**************************************/
/*    utilities to deal with dates    */
/**************************************/

const path = require('path');
const { parse, isValid }  = require('date-fns');
const fs = require('fs'); 
const moment = require('moment-timezone');

const rootDirectory = path.resolve('.').match(/.*scraping/)[0]+'/';
const timeZoneFile = rootDirectory+'/import/timeZone.json';





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

// identify from a list of dates the best date format:
// the representation of the months: short, long or numeric (sept, september, 09)
// the year if present: short, long (26, 2026)
// the order of appearance day/month/year

function initDateFormat(dateList, dictionary){
  const threshold = 0.5; // threshold to validate the formats. Should not be too low in order to avoid
                          // false positive, but not too high to avoid problems with wrong tokens
  const monthsDict = dictionary.monthsDict;
  const dateFormat = {month: 'numeric'};

  // look for long month
  const longMonthPattern = `\\b(?:${Object.keys(monthsDict).join("|")})\\b`;
  const longMonthRegex = new RegExp(longMonthPattern, "i");
  const longMonthScore = dateList.filter(dateStr => longMonthRegex.test(dateStr)).length / dateList.length;
  if (longMonthScore > threshold){
    dateFormat.month = 'long';
  }else{
    const shortMonthPattern = `\\b(?:${Object.values(monthsDict).flat().join("|")})\\b`;
    const shortMonthRegex = new RegExp(shortMonthPattern, "i");
    const shortMonthScore = dateList.filter(dateStr => shortMonthRegex.test(dateStr)).length / dateList.length;
    if (shortMonthScore > threshold){
      dateFormat.month = 'short';
    }
  }

  // look for years
  const currentYear = (new Date()).getFullYear();
  const possibleYears = [String(currentYear), String(currentYear + 1)];
  const longYearPattern = `\\b(?:${possibleYears.join("|")})\\b`;
  const longYearRegex = new RegExp(longYearPattern, "i");
  const longYearScore = dateList.filter(dateStr => longYearRegex.test(dateStr)).length / dateList.length;
  if (longYearScore > threshold){
    dateFormat.year = 'long';
  }else{
    const shortPossibleYears = possibleYears.map(str => str.slice(2,4));
    const shortYearPattern = `\\b(?:${shortPossibleYears.join("|")})\\b`;
    const shortYearRegex = new RegExp(shortYearPattern, "i");
    const shortYearScore = dateList.filter(dateStr => shortYearRegex.test(dateStr)).length / dateList.length;
    if (shortYearScore > threshold){
      dateFormat.year = 'short';
    }
  }

  // select the best order
  const possibleOrder = dateFormat.hasOwnProperty('year') ? 
  [['day','month','year'], ['month','day','year'], 
    ['year','day','month'], ['year','month','day'],
    ['day','year','month'], ['month','year','day']
  ] :
  [['day','month'],['month','day']];

  function compareToOrder(list, order){
    const numListIndex = list.indexOf(token => Array.isArray(token.type) || Array.isArray(token.type[0]));
    if (numListIndex > -1){
      // this is a numList. If one of the possibilities match, then it works.
      for(const numSeq of list[numListIndex]){
        const newList = [...list];
        newList.splice(numListIndex,1,numSeq);
        if (compareToOrder(newList, order)) return true;
      }
      return false;
    }
    // console.log('test', list, order);
    // warning: list with duplicates are not discarded (day, day, month, year)
    if (list.length < order.length) return false;
    for (let i = 0; i < list.length; i++){
      if (Array.isArray(list[i]) && !list[i].includes(order[i])) return false;
      if (list[i] !== order[i]) return false;
    }
    // console.log('vald');
    return true;
  }

  let bestScore = - 1;
  let bestOrder;
  for (const order of possibleOrder){
    dateFormat.order = order;
    const orderList = dateList.map(dateStr => lightTokenizer(dateStr, dateFormat)).filter(el => el !== null);
    const score = orderList.filter(tokens => compareToOrder(tokens, order)).length;
    if (score > bestScore){
      bestScore = score;
      bestOrder = order;
      if (score === orderList.length) break; // if it works for all the dates, no need to look further
    }
  }


  dateFormat.order = bestOrder;
  const orderList = dateList.map(dateStr => lightTokenizer(dateStr, dateFormat));//.filter(el => el !== null);

// console.log(orderList);
// console.log(orderList.filter(tokens => compareToOrder(tokens, bestOrder)));
// console.log(dateList);
  return [dateFormat, bestScore];

  function lightTokenizer(str, format){
    const basicTokenList = str.split(" ").map(e => makeBasicToken(e, format, dictionary)).flat();
    // if several possibilities, discard this analysis
    return basicTokenList.filter(token => token.type === 'day' || token.type === 'month' 
      || token.type === 'year' || Array.isArray(token.type))
          .map(token => token.type);
  }
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
            // else return a  list of possible group of tokens
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


// // this tokenizer is a light version to determine day/month/year order
// // it does not need to be accurate (ignore other tokens, ignore collisions)

// function lightDateTokenizer(str, dateFormat, monthList, possibleYears){
//   const list = str.split(" ");
//   for (const word of list){
//     // detect years

//   }
// }






//***************************************//
// file browsing utilities               //
//***************************************//



// Get a list of URLs from date patterns. Used for multipages, when the index of the pages refer to a 
// date such as 2024-03 (eg: Ville Morte)
// This function takes in argument a base URL, a pattern (such as yyyy-mm) and a number of pages, and return
// the list of the URLs of the different pages.
//
// patterns should include the followings:
// 
// yyyy is year with 4 digits
// yy is year with 2 digits
// MM (or mm) is month with 2 digits
// M (or m) is month with 1 or 2 digits



function getURLListFromPattern(url,pattern,nbPages){
  let res = [];
  const currentDate = new Date();
  const day = currentDate.getDate();
  let month = currentDate.getMonth() + 1; 
  let year = currentDate.getFullYear();
  //const week = currentDate.getWeek();
  for(let i = 0; i<nbPages; i++){
    let d = pattern.replace(/MM|mm/,to2digits(String(month))).replace(/M|m/,month)
                    .replace(/yyyy/,year).replace(/yy/,year-Math.round(year/100)*100)
                    .replace(/DD/i,to2digits(String(day))).replace(/d/i,day);
    if (/\{index\}/.test(url)){
      res.push(url.replace(/\{index\}/,d));
    } else{
      res.push(url+d);
    }
    month++;
    if (month>12){
      month = 1;
      year++;
    }
  }
  return res;
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


//***************************************//
// Time zone, display utilities          //
//***************************************//


// create a date object from a string
function createDate(s,dateFormat,timeZone,refDate, verbose = false) {
  if (s.includes('tonight')){
      return new Date();
  }else{
      // s = convertDate(s,dateConversionPatterns);
      // const testDate = parse(s, dateFormat, new Date());// use Date to see if a date is valid, because it doesn't work with moment
      // if (!isAValidDate(testDate)){
      //   return testDate;
      // }
      // peut-être que true force moment.tz à faire un formattage strict. Si ça ne fonctionne pas,
      // enlever true et décommenter les lignes précédentes
      const date = moment.tz(s,dateFormat.replace(/d/g,'D').replace(/y/g,'Y'), true, timeZone);
      // console.log(s,dateFormat);
      let tzDate = date.toDate();
      // if (refDate && !/yy/.test(dateFormat) && tzDate < refDate){// add one year if the date is past for more than one month. Useful when the year is not in the data
      //     tzDate.setFullYear(tzDate.getFullYear() + 1);
      // }
      if (verbose){
        console.log(tzDate);
      }
      return tzDate;
  }
}


// convert 1 digit elements (day, month) to 2 digits 
function to2digits(dateString){
  return dateString.replace(/(?<!\d)\d(?!\d)/g,p=>'0'+p);
}

// function to obtain the formatted time (hour:minutes) of the event
function eventTime(date, timeZone){
  const languageZone = 'fr-FR';
  const timeString = date.toLocaleTimeString(languageZone, { hour: 'numeric', minute: 'numeric', timeZone: timeZone});
  const day = date.toLocaleString('fr-FR', { day: 'numeric', timeZone: timeZone });
  const weekDay = date.toLocaleString(languageZone, { weekday: 'long' , timeZone: timeZone});
  const month = date.toLocaleString(languageZone, { month: 'long', timeZone: timeZone});

  const string = weekDay + " " + day+" "+month + " à " + timeString;
  return string;
}

// verify if two unix dates correspond to the same day
function  sameDay(timestamp1, timestamp2) {// as unixdate
  const date1 = new Date(timestamp1); 
  const date2 = new Date(timestamp2); 

  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

// display date as dd/MM/yyyy (hh:mm)
function showDate(date){
  const day = to2digits(String(date.getDate()));
  const month = to2digits(String(date.getMonth() + 1)); 
  const year = date.getFullYear();
  const hour = to2digits(String(date.getHours()));
  const minutes = to2digits(String(date.getMinutes()));
  const string = day+'/'+month+'/'+year+' (time: '+hour+':'+minutes+')';
  return string;
}


// get the current week in the year
Date.prototype.getWeek = function() {
  const date = new Date(this.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
};



class TimeZone {
  constructor() {
    try {
      this.timeZones = JSON.parse(fs.readFileSync(timeZoneFile, 'utf8'));
    } catch (err) {
      console.log('\x1b[36mWarning: cannot open time zone file:  \'%s\'. Will not save to venues.\x1b[0m%s\n', timeZoneFile, err);
    }
  }
  getTimeZone(place) {
    if (this.timeZones.hasOwnProperty(place.country)) {
      const countryTimeZone = this.timeZones[place.country];
      if (typeof (countryTimeZone) === 'string') {
        return countryTimeZone;
      } else {
        if (this.timeZones[place.country].hasOwnProperty(place.city)) {
          return this.timeZones[place.country][place.city];
        } else {
          console.log("\x1b[31mError, city %s (%s) has no time zone. Add time zone to \'import/timeZone.json\'\x1b[0m", place.city, place.country);
        }
      }
    } else {
      console.log("\x1b[31mError, country %s has no time zone. Add time zone to \'import/timeZone.json\'\x1b[0m", place.country);
    }
  }
}

module.exports = {sameDay, showDate, createDate, to2digits,
  getURLListFromPattern, eventTime, cleanDate, initDateFormat, TimeZone};

