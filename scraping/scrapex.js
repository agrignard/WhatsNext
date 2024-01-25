import { createDate, convertDate, showDate, getConversionPatterns} from './import/dateUtilities.mjs';
import * as fs from 'fs';
import { parse, isValid }  from 'date-fns';
import * as cheerio from 'cheerio';
import {parseDocument} from 'htmlparser2';
import {makeURL,fixString} from './import/stringUtilities.mjs';
import {loadLinkedPages,loadVenuesJSONFile,loadUnlistedVenues} from './import/fileUtilities.mjs';


// Chemin vers le fichier à lire
const filePath = './venues.json';
const sourcePath = './webSources/';

var out="";// = "PLACE,TITRE,UNIX,SIZE,GENRE,URL";
var outFile = "generated/scrapexResult.csv";
const globalDefaultStyle = '';


const dateConversionPatterns = await getConversionPatterns();
let venues = await loadVenuesJSONFile();
const venueNamesList = venues.map(el => el.name).concat(await loadUnlistedVenues());
console.log(venueNamesList);
    
const fileToScrap = process.argv[2];
if (fileToScrap){
  if (venues.some(element => element.name === fileToScrap)){
    console.log('\x1b[32m%s\x1b[0m', `Traitement uniquement de \'${fileToScrap}\'`);
    venues = venues.filter(element => element.name === fileToScrap);
    scrapFiles(venues);
  }else{
    console.log('\x1b[31mFichier \x1b[0m%s.html\x1b[31m non trouvé. Fin du scrapping.\x1b[0m\n', fileToScrap);
  }
}else{
  scrapFiles(venues);
}



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
  try{
    fs.writeFileSync(outFile, out, 'utf-8', { flag: 'w' });
  }catch(err){
    console.log("\x1b[31mImpossible de sauvegarder dans le fichier \x1b[0m\'%s\'\x1b[31m.\x1b[0m Erreur: %s",outfile,err);
  }
    
}



async function analyseFile(venue) {
  let linkedFileContent, inputFileList;
  const venueSourcePath = sourcePath+venue.country+'/'+venue.city+'/'+venue.name+'/';
  if (venue.hasOwnProperty('linkedPage')){
    linkedFileContent = await loadLinkedPages(venueSourcePath);
  }
  // get file list to scrap
  try {
    inputFileList = fs.readdirSync(venueSourcePath)
      .filter(fileName => fileName.endsWith('.html'))
      .map(el => venueSourcePath+el);
  } catch (err) {
    console.error('\x1b[31mError reading html files in directory \'%s\'.\x1b[0m Error: %s',venueSourcePath, err);
  }
console.log('liste',inputFileList);

  console.log('\n\x1b[32m%s\x1b[0m', `******* Venue: ${venue.name}  (${inputFileList.length} pages) *******`);
  let nbEvents = 0;
  for (let currentPage=0;currentPage<inputFileList.length;currentPage++){
    nbEvents += await analysePage(venue,inputFileList[currentPage]);
  }
  console.log("total number of events: " + nbEvents);     

  async function analysePage(venue,inputFile){
    let events,eventInfo,unixDate,eventURL, venueContent;
    eventInfo = {}; 
    let $, $eventBlock;
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
      let dateFormat = venue.dateFormat;

      events.forEach((eve,eveIndex) =>{
        $eventBlock = cheerio.load(eve);
        
        // changing to default style if no style
          
        eventInfo.eventStyle = venue.hasOwnProperty('defaultStyle')?venue.defaultStyle:globalDefaultStyle;

        // **** event data extraction ****//

        Object.keys(venue.scrap).forEach(key => eventInfo[key.replace('Tags','')] = getText(key,venue.scrap,$eventBlock));


        //extract URL
        try{
          if (venue.hasOwnProperty('eventeventURLIndex') && venue.eventURLIndex === -1){
            eventURL ='No url link.';
          }else{
            let index = venue.hasOwnProperty('eventURLIndex')?venue.eventURLIndex:0;
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

        // scrap info from linked page
        if (linkedFileContent){
          if (venue.linkedPage.hasOwnProperty('eventDateTags')){
            dateFormat = venue.linkedPageDateFormat;
          }
          try{
            const $linkedBlock = cheerio.load(linkedFileContent[eventURL]);
            Object.keys(venue.linkedPage).forEach(key => eventInfo[key.replace('Tags','')] = getText(key,venue.linkedPage,$linkedBlock));  
          }catch{
            console.log('\x1b[31mImpossible de lire la page liée pour l\'événement \'%s\'. Erreur lors du téléchargement ?\x1b[31m', eventInfo.eventName);
          }
          // if the linked page contains a direct URL to the event, replace it
          if (eventInfo.hasOwnProperty('eventURL') && eventInfo.eventURL.length > 0){
       //     console.log(eventInfo);
            eventURL = eventInfo.eventURL;
          }
        }

        //*** logs  ***//

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
          if (key !== 'eventName' && key !== 'eventDate' && key !== 'eventURL'){
            console.log(key.replace('event',''),': ',eventInfo[key.replace('Tags','')]);
          }
        });

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
     function getText(tagName,JSONblock,source){
      let string = "";
      const tagList = JSONblock[tagName];
      try{
        for (let i = 0; i <= tagList.length-1; i++) {
          let ev = tagList[i]===''?source.text():source(tagList[i]).text();
          string += ev+' ';
        }
      }catch(err){
        console.log('\x1b[31m%s\x1b[0m', 'Erreur d\'extraction à partir des balises.\x1b[0m',tagList);
      }
      return tagName === 'eventPlaceTags'?fixString(removeBlanks(string),venueNamesList):removeBlanks(string);
    }
    // end of auxiliary function




function removeBlanks(s){
  return s.replace(/[\n\t]/g, ' ').replace(/ {2,}/g, ' ').replace(/^ /,'').replace(/ $/,'');
}



