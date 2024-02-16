/**************************************/
/*    utilities to deal with dates    */
/**************************************/

const path = require('path');
const { parse, isValid }  = require('date-fns');
const fs = require('fs'); 
const moment = require('moment-timezone');

const rootDirectory = path.resolve('.').match(/.*scraping/)[0]+'/';
const dateConversionFile = rootDirectory+'/import/dateConversion.json';
const timeZoneFile = rootDirectory+'/import/timeZone.json';


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


// load date conversion patterns
function getDateConversionPatterns(){
  try{
      return JSON.parse(fs.readFileSync(dateConversionFile, 'utf8'));
  }catch(err){
      console.log('\x1b[36mWarning: cannot open date conversion file JSON file:  \'%s\'. Will not save to venues.\x1b[0m%s\n',dateConversionFile,err);
  }
}

// get common date formats
function getCommonDateFormats(){
  const date = ["dd-MM","MM-dd",
                "dd-MM-yy","dd-yy-MM","MM-dd-yy","MM-yy-dd","yy-MM-dd","yy-dd-MM",
                "dd-MM-yyyy","dd-yyyy-MM","MM-dd-yyyy","MM-yyyy-dd","yyyy-MM-dd","yyyy-dd-MM"];
  const time = ["HH:mm","mm:HH"];
  let dateList = date;
  date.forEach(el1 => 
    time.forEach(el2 => {
      dateList.push(el1+'-'+el2);
      dateList.push(el2+'-'+el1);
    })
  );
  return dateList;
}

// create a date object from a string
function createDate(s,dateFormat,dateConversionPatterns,timeZone,refDate) {
  if (s.includes('tonight')){
      return new Date();
  }else{
      s = convertDate(s,dateConversionPatterns);
      const date = moment.tz(s,dateFormat.replace(/d/g,'D').replace(/y/g,'Y'), timeZone);
      let tzDate = date.toDate();
      if (refDate && !/yy/.test(dateFormat) && tzDate < refDate){// add one year if the date is past for more than one month. Useful when the year is not in the data
          tzDate.setFullYear(tzDate.getFullYear() + 1);
      }
      return tzDate;
  }
}

// function createDate(s,dateFormat,dateConversionPatterns) {
//   s = convertDate(s,dateConversionPatterns);
//   if (s.includes('tonight')){
//     return new Date();
//   }else{
//     let date = parse(s, dateFormat, new Date());
//     if (date < new Date()){// add one year if the date is past. Useful when the year is not in the data
//       date.setFullYear(date.getFullYear() + 1);
//     }
//     return date;
//   }
// }

// clean the date (remove unwanted characters)
function convertDate(s,dateConversionPatterns){
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // remove accents
  s = s.replace(/[^\x00-\x7F]/g,''); //remove non standard caracters => to be improved
 
  for (const key in dateConversionPatterns) {
    function replacer(match, p1, p2, p3, offset, string) {
      return ' '+key+' ';
    }
    for (const str of dateConversionPatterns[key]){
       s = s.replace(new RegExp("([^a-zA-Z.]|^)("+str+")([^a-zA-Z.]|$)",'i'),replacer);
    }
  }  
  // change some inconsistencies
  s = s.replace(/de([^]*?)[aà][^]*$/,(_,p) =>'a'+p);

     //  //removing words with 2 or more letters
    // s = s.replace(/\b[^0-9]{2,}\b/g,' ');
 
  s = s.replace(/\b[^0-9]{2,}\b/g,' ');
;
  s = to2digits(unifyCharacters(s));
  // remove end time if present. Undo if end time is required
  s =  s.replace(/\b(\d{2}:\d{2})-\d{2}:\d{2}\b/,(_,p) => p);
  return s;
}

// count the number of invalid dates, or with a year too old (older than one year), or a year too far (in more than 2 years)
function numberOfInvalidDates(dateList){
  return dateList.filter(element => (!isValid(element) || !yearIsValid(element.getFullYear()))).length; 
}

// test if a year too old (older than one year), or a year too far ahead (in more than 2 years)
function yearIsValid(yyyy){
  let yearBefore = 1;
  let yearAfter = 2;
  let currentYear = new Date().getFullYear();
  return (yyyy >= currentYear  -yearBefore || yyyy >currentYear + yearAfter);
}

// clean the date string by removing unwanted characters
function unifyCharacters(s){
  let string = s.replace(/[\n\t\/\-,;.]/g,' ').replace(/ {2,}/g,' ').replace(/^ /,'').replace(/ $/,'').replace(/ /g,'-');
  string = string.replace(/h/g,':').replace(/: /g,':00').replace(/:$/g,':00');//format to correct time
  string = string.replace(/:-+/g,':');//remove - after :
  return string;
}

// convert 1 digit elements (day, month) to 2 digits 
function to2digits(dateString){
  return dateString.replace(/(?<!\d)\d(?!\d)/g,p=>'0'+p);
}


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
  let month = currentDate.getMonth() + 1; 
  let year = currentDate.getFullYear();
  //const week = currentDate.getWeek();
  for(let i = 0; i<nbPages; i++){
    let d = pattern.replace(/MM|mm/,to2digits(String(month))).replace(/M|mm/,month);
    d = d.replace(/yyyy/,year).replace(/yy/,year-Math.round(year/100)*100);
    if (/{index}/.test(url)){
      res.push(url.replace(/{index}/,d));
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
      console.log('\x1b[36mWarning: cannot open time zone file:  \'%s\'. Will not save to venues.\x1b[0m%s\n', dateConversionFile, err);
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

module.exports = {dateConversionFile, sameDay, showDate, getDateConversionPatterns, getCommonDateFormats,
  createDate, convertDate, numberOfInvalidDates, to2digits, getURLListFromPattern,
  TimeZone };

