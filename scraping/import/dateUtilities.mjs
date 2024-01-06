import { parse, isValid }  from 'date-fns';

export function createDate(s,dateFormat,dateConversionPatterns) {
  s = convertDate(s,dateConversionPatterns);
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
 
  for (const key in dateConversionPatterns) {
    function replacer(match, p1, p2,p3, offset, string) {
      return ' '+key+' ';
    }
    for (const str of dateConversionPatterns[key]){
       s = s.replace(new RegExp("([^a-zA-Z.]|^)("+str+")([^a-zA-Z.]|$)",'i'),replacer);
    }
  }  
  return unifyCaracters(s);
}


function unifyCaracters(s){
  return s.replace(/[\n\t\/\-]/g,' ').replace(/ {2,}/g,' ').replace(/^ /,'').replace(/ $/,'');
}