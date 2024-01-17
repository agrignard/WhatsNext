import { createDate, convertDate} from './import/dateUtilities.mjs';
import * as fs from 'fs';
import { parse, isValid }  from 'date-fns';
import * as cheerio from 'cheerio';
import {parseDocument} from 'htmlparser2';

// Chemin vers le fichier à lire
const filePath = './venues.json';
const sourcePath = './webSources/';

const dateConversionFile = './import/dateConversion.json';
var out="";// = "PLACE,TITRE,UNIX,SIZE,GENRE,URL";
var outFile = "generated/scrapexResult.csv";
var dateConversionPatterns;
const globalDefaultStyle = '';

fs.promises.readFile(dateConversionFile, 'utf8')
  .then((fileContent) =>{
    try {
      dateConversionPatterns = JSON.parse(fileContent); 
    } catch (erreur) {
      console.error("Erreur de parsing JSON pour les conversions de dates :", erreur.message);
    }
    fs.promises.readFile(filePath, 'utf8')
    .then((fileContent) =>{
      try {
        // Parser le texte JSON
        var venues = JSON.parse(fileContent);
        
        const fileToScrap = process.argv[2];
        if (fileToScrap){
          if (venues.some(element => element.name === fileToScrap)){
            console.log('\x1b[32m%s\x1b[0m', `Traitement uniquement de \'${fileToScrap}\'`);
            venues = venues.filter(element => element.name === fileToScrap);
            scrapFiles(venues);
          }else{
            console.log('\x1b[31mFichier \x1b[0m%s.html\x1b[31m non trouvé. Fin du scrapping.\x1b[0m\n', fileToScrap);
            return;
          }
        }else{
          scrapFiles(venues);
        }
        
      } catch (erreur) {
        console.error('\x1b[31mErreur lors de la lecture du fichier JSON :%s. %s\x1b[0m', filePath,erreur.message);
        throw new Error('JSON Error');
      }
    })
  })
  .catch((erreur ) => {
    console.error("Erreur lors de la lecture des fichiers de configuration :", erreur);
    throw new Error('readFile Error');
  });

async function scrapFiles(venues) {
  for (const venue of venues) {
    let err = false;
    if (!(venue.hasOwnProperty('eventsDelimiterTag') || venue.hasOwnProperty('eventsDelimiterRegex'))){
      console.log('\x1b[31m%s\x1b[0m', 'Aucun délimiteur de bloc d\'événement défini pour '+venue.name);
      err = true;
    }
    if (!venue.hasOwnProperty('scrap') || !(venue.scrap.hasOwnProperty('eventNameTags') || venue.scrap.hasOwnProperty('eventNameRegex'))){
      console.log('\x1b[31m%s\x1b[0m', 'Aucun délimiteur de nom d\'événement défini pour '+venue.name);
      err = true;
    }
    if (!venue.hasOwnProperty('scrap') || !(venue.scrap.hasOwnProperty('eventDateTags') || venue.scrap.hasOwnProperty('eventDateRegex'))){
      console.log('\x1b[31m%s\x1b[0m', 'Aucun délimiteur de date d\'événement défini pour '+venue.name);
      err = true;
    }
    if (!err){
      await analyseFile(venue);
    } else{
      console.log('\x1b[31mEntrée %s non traitée.\x1b[0m', venue.name);
    }
  }
  console.log('Scrapex fini avec succex !!\n\n');
    fs.writeFileSync(outFile, out, 'utf-8', { flag: 'w' });
}



async function analyseFile(venue) {
  //var events,eventInfo,eventDate,eventName,eventStyle,unixDate,eventURL, venueContent;
  var inputFileList = [];
  const venueSourcePath = sourcePath+venue.country+'/'+venue.city+'/'+venue.name+'/';
  
  if (venue.hasOwnProperty('multiPages')){
    for(let i=0;i<venue.multiPages.nbPages;i++){
      inputFileList.push(venueSourcePath+venue.name+i+".html");
    }
  }else{
    inputFileList = [venueSourcePath+venue.name+".html"];
  }
  console.log('\n\x1b[32m%s\x1b[0m', `******* Venue: ${venue.name}  (${inputFileList.length} pages) *******`);
  let nbEvents = 0;
  for (let currentPage=0;currentPage<inputFileList.length;currentPage++){
    nbEvents += await analysePage(venue,inputFileList[currentPage]);
  }
  console.log("total number of events: " + nbEvents);     

  async function analysePage(venue,inputFile){
    var events,eventInfo,unixDate,eventURL, venueContent;
    eventInfo = {}; 
    var $, $eventBlock;
    try{
      venueContent = await fs.promises.readFile(inputFile, 'utf8');
      const parsedHtml = parseDocument(venueContent);
      $ = cheerio.load(parsedHtml);
    }catch (err){
      console.error("\x1b[31mErreur lors de la lecture du fichier local: \'%s\'.\x1b[0m %s",inputFile, (err.code==='ENOENT')?'':err);
      return 0;
    }
    try{
      if (venue.hasOwnProperty('eventsDelimiterTag')){
        events = [];
        $(venue.eventsDelimiterTag).each((index, element) => {
          let ev = $(element).html();
          events.push(ev);
        });
      }else{
        const regexDelimiter = new RegExp(venue.eventsDelimiterRegex, 'g');
        events = venueContent.match(regexDelimiter);
      }
      

      // console.log("total number of events: " + events.length);      
    }catch(err){        
      console.log('\x1b[31m%s\x1b[0m. %s', 'Délimiteur mal défini pour '+venue.name,err);      
    }

    // parsing each event
    try{
      const dateFormat = venue.dateFormat;

      //for (var eve of events){   
      events.forEach((eve,eveIndex) =>{
       // let eventLog = '';
        $eventBlock = cheerio.load(eve);
        
        // changing to default style if no style
          
        eventInfo.eventStyle = venue.hasOwnProperty('defaultStyle')?venue.defaultStyle:globalDefaultStyle;

        // **** event data extraction ****//

        Object.keys(venue.scrap).forEach(key => eventInfo[key.replace('Tags','')] = getText(key,venue,$eventBlock));

        // change the date format to Unix time
        const formatedEventDate = createDate(eventInfo.eventDate,dateFormat,dateConversionPatterns);
        if (!isValid(formatedEventDate)){
          console.log('\x1b[31mFormat de date invalide pour %s. Reçu \"%s\", converti en \"%s\" (attendu \"%s\")\x1b[0m', 
            venue.name,eventInfo.eventDate,convertDate(eventInfo.eventDate,dateConversionPatterns),dateFormat);
          unixDate = new Date().getTime(); // en cas d'erreur, ajoute la date d'aujourd'hui
        }else{
          unixDate = formatedEventDate.getTime();
          console.log(showDate(formatedEventDate));
        }

        // display
        console.log((eventInfo.eventName));
        Object.keys(eventInfo).forEach(key => {
          if (key !== 'eventName' && key !== 'eventDate'){
            console.log(key.replace('event',''),': ',eventInfo[key.replace('Tags','')]);
       //     console.log((key.replace('event',''),': ',eventInfo[key.replace('Tags','')]));
          }
        });

        //extract URL
        try{
          if (venue.hasOwnProperty('eventeventURLIndex') && venue.eventURLIndex === -1){
            eventURL ='No url link.';
          }else{
            var index = venue.hasOwnProperty('eventURLIndex')?venue.eventURLIndex:0;
            if (index == 0){// the URL is in A href
              eventURL = makeURL(venue.baseURL,$(venue.eventsDelimiterTag+':eq('+eveIndex+')').attr('href'));
            }else{// URL is in inner tags
                index = index - 1;
              const tagsWithHref = $eventBlock('a[href]');
              eventURL = makeURL(venue.baseURL,$eventBlock(tagsWithHref[index]).attr('href'));
            }
          }
        }catch(err){
          console.log("\x1b[31mErreur lors de la récupération de l\'URL.\x1b[0m",err);
        }

        console.log((eventURL)+'\n');
        out = out+''+(eventInfo.hasOwnProperty('eventPlace')?eventInfo.eventPlace:venue.name)+';'
              +eventInfo.eventName+';'+unixDate+';100;'+eventInfo.eventStyle+';'+eventURL+'\n';
       // console.log(eventLog);
      }); 
      
    }catch(error){
      console.log("Erreur générale pour "+venue.name,error);
    }
    return events.length;
  }
  console.log("\n\n");
}
  


//********************************************/
//***            aux functions             ***/
//********************************************/


     // auxiliary function to extract data
     function getText(tagName,venue,source){
      let string = "";
     // console.log(tagName);
      const tagList = venue.scrap[tagName];
     // console.log(tagList);
      try{
        for (let i = 0; i <= tagList.length-1; i++) {
          let ev = tagList[i]===''?source.text():source(tagList[i]).text();
          string += ev+' ';
        }
      }catch(err){
        console.log('\x1b[31m%s\x1b[0m', 'Erreur d\'extraction à partir des balises',tagList,' pour '+venue.name);
      }
      return removeBlanks(string);
    }
    // end of auxiliary function




function removeBlanks(s){
  return s.replace(/[\n\t]/g, ' ').replace(/ {2,}/g, ' ').replace(/^ /,'').replace(/ $/,'');
}

function showDate(date){
  const day = date.getDate();
  const month = date.getMonth() + 1; 
  const year = date.getFullYear();
  const hour = date.getHours();
  const minutes = date.getMinutes();
  const string = day+'/'+month+'/'+year+' (time: '+hour+':'+minutes+')';
  return string;
}

function makeURL(baseURL, URL){
  if (URL.startsWith(baseURL)){
    return URL;
  }else{
    return baseURL+URL;
  }
}