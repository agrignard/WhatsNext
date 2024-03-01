const dateConversionPatterns ={
    "01": ["jan","jan.","janvier","janv.","janv"],
"02": ["fev","fev.","fevrier","fevr.","fevr","fvrier"],
"03": ["mar","mars"],
"04": ["avr","avr.","avril","avri.","avri"],
"05": ["mai"],
"06": ["juin","jui.","jun.","jui"],
"07": ["jul","jul.","juill","juillet","juil.","juil"],
"08": ["aou","aou.","aout","aot"],
"09": ["sep","sep.","septembre", "sept.", "sept"],
"10": ["oct","oct.","octobre","oct.","octo"],
"11": ["nov","nov.","novembre","nov.","nove"],
"12": ["dec","dec.","decembre","dec.","dece","dcembre"],
"tonight": ["ce soir","en ce moment"],
"": ["lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche",
        "lun.","mar.","mer.","jeu.","ven.","sam.","dim.",
        "lun","mar","mer","jeu","ven","sam","dim"]
}


function convertDate(s,dateConversionPatterns){
    s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // remove accents
    s = s.replace(/[^\x00-\x7F]/g,''); //remove non standard caracters => to be improved
   
    for (const key in dateConversionPatterns) {
      function replacer(match, p1, p2, p3, offset, string) {
        return ' '+key+' ';
      }
      for (let str of dateConversionPatterns[key]){
        const str2 = str.replace(/\./g,'\\.');
        s = s.replace(new RegExp("([^a-zA-Z.]|^)("+str2+")([^a-zA-Z.]|$)",'i'),replacer);
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

  function to2digits(dateString){
    return dateString.replace(/(?<!\d)\d(?!\d)/g,p=>'0'+p);
  }

  function unifyCharacters(s){
    let string = s.replace(/[\n\t\/\-,;.]/g,' ').replace(/ {2,}/g,' ').replace(/^ /,'').replace(/ $/,'').replace(/ /g,'-');
    string = string.replace(/h/g,':').replace(/: /g,':00').replace(/:$/g,':00');//format to correct time
    string = string.replace(/:-+/g,':');//remove - after :
    return string;
  }
  const s = " 10 mars sam 2024 à 17h";
  console.log(s);
  console.log(convertDate(s,dateConversionPatterns));