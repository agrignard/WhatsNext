/**************************************/
/*    utilities to deal with dates    */
/**************************************/


import { parse, isValid }  from 'date-fns';
import * as fs from 'fs';

const dateConversionFile = './import/dateConversion.json';
const styleConversionFile = './import/styleConversion.json';

export function showDate(date){
  const day = to2digits(String(date.getDate()));
  const month = to2digits(String(date.getMonth() + 1)); 
  const year = date.getFullYear();
  const hour = to2digits(String(date.getHours()));
  const minutes = to2digits(String(date.getMinutes()));
  const string = day+'/'+month+'/'+year+' (time: '+hour+':'+minutes+')';
  return string;
}

// load style conversion patterns
export async function getConversionStylePatterns(){
  try{
      return await JSON.parse(await fs.promises.readFile(styleConversionFile, 'utf8'));
  }catch(err){
      console.log('\x1b[36mWarning: cannot open style conversion file JSON file:  \'%s\'. Will not save to venues.\x1b[0m%s\n',styleConversionFile,err);
  }
}

// clean the style 
export function convertStyle(s,styleConversionPatterns){
  convertDate,nsole.log("yo ca convertir du style)")
  for (const key in styleConversionPatterns) {
    console.log(key);
    /*function replacer(match, p1, p2, p3, offset, string) {
      return ' '+key+' ';
    }
    for (const str of dateConversionPatterns[key]){
       s = s.replace(new RegExp("([^a-zA-Z.]|^)("+str+")([^a-zA-Z.]|$)",'i'),replacer);
    }*/

  }  
  return to2digits(unifyCharacters(s));
}


// load date conversion patterns
export async function getConversionPatterns(){
  try{
      return await JSON.parse(await fs.promises.readFile(dateConversionFile, 'utf8'));
  }catch(err){
      console.log('\x1b[36mWarning: cannot open date conversion file JSON file:  \'%s\'. Will not save to venues.\x1b[0m%s\n',dateConversionFile,err);
  }
}

// get common date formats
export function getCommonDateFormats(){
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
export function createDate(s,dateFormat,dateConversionPatterns) {
  s = convertDate(s,dateConversionPatterns);
  //console.log(s);
  if (s.includes('tonight')){
    return new Date();
  }else{
    let date = parse(s, dateFormat, new Date());
    if (date < new Date()){// add one year if the date is past. Useful when the year is not in the data
      date.setFullYear(date.getFullYear() + 1);
    }
    return date;
  }
}

// clean the date (remove unwanted characters)
export function convertDate(s,dateConversionPatterns){
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
     //  //removing words with 2 or more letters
    // // console.log('\navant:'+s);
    // s = s.replace(/\b[^0-9]{2,}\b/g,' ');
    //    //  console.log('après:'+s);
    
    //removing all words with 2 that are not 'h'
   //  console.log('\navant:'+s);
    s = s.replace(/\b[^0-9]{2,}\b/g,' ');
      //  console.log('après:'+s);
  return to2digits(unifyCharacters(s));
}

// count the number of invalid dates, or with a year too old (older than one year), or a year too far (in more than 2 years)
export function numberOfInvalidDates(dateList){
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
  string = string.replace('h',':').replace(/: /g,':00').replace(/:$/g,':00');//format to correct time
  return string;
}

// convert 1 digit elements (day, month) to 2 digits 
function to2digits(dateString){
  return dateString.replace(/(?<!\d)\d(?!\d)/g,p=>'0'+p);
}

