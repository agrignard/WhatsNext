import { parse, isValid }  from 'date-fns';

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

export function convertDate(s,dateConversionPatterns){
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // remove accents
  s = s.replace(/[^\x00-\x7F]/g,'');
 
  for (const key in dateConversionPatterns) {
    function replacer(match, p1, p2,p3, offset, string) {
      return ' '+key+' ';
    }
    for (const str of dateConversionPatterns[key]){
       s = s.replace(new RegExp("([^a-zA-Z.]|^)("+str+")([^a-zA-Z.]|$)",'i'),replacer);
    }
     //removing words with 2 or more letters
    // console.log('\navant:'+s);
    //s = s.replace(/\b[^0-9]{2,}\b/g,' ');
       //  console.log('après:'+s);
  }  
  return to2digits(unifyCharacters(s));
}

// count the number of invalid dates, or with a year too old (older than one year), or a year too far (in more than 2 years)
export function numberOfInvalidDates(dateList){
  return dateList.filter(element => (!isValid(element) || !yearIsValid(element.getFullYear()))).length; 
}

function yearIsValid(yyyy){// test if a year too old (older than one year), or a year too far ahead (in more than 2 years)
  let yearBefore = 1;
  let yearAfter = 2;
  let currentYear = new Date().getFullYear();
  return (yyyy >= currentYear  -yearBefore || yyyy >currentYear + yearAfter);
}

function unifyCharacters(s){
  let string = s.replace(/[\n\t\/\-,;.]/g,' ').replace(/ {2,}/g,' ').replace(/^ /,'').replace(/ $/,'').replace(/ /g,'-');
  string = string.replace('h',':').replace(/: /g,':00').replace(/:$/g,':00');//format to correct time
  return string;
}


function to2digits(dateString){
  return dateString.replace(/(?<!\d)\d(?!\d)/g,p=>'0'+p);
}