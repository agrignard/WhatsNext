import { createDate, convertDate, showDate, getConversionPatterns} from './import/dateUtilities.mjs';
import * as fs from 'fs';
import { parse, isValid }  from 'date-fns';
import * as cheerio from 'cheerio';
import {parseDocument} from 'htmlparser2';
import {makeURL, removeAccents} from './import/stringUtilities.mjs';
import {loadLinkedPages,loadVenuesJSONFile,getAliases,getStyleConversions} from './import/fileUtilities.mjs';


// Chemin vers le fichier à lire
const sourcePath = './webSources/';

//var out="";// = "PLACE,TITRE,UNIX,SIZE,GENRE,URL";
const outFile = "generated/scrapexResult.csv";
const globalDefaultStyle = '';
const styleConversion = await getStyleConversions();


const dateConversionPatterns = await getConversionPatterns();
let venues = await loadVenuesJSONFile();
let aliasList = await getAliases(venues);

//const venueNamesList = venues.map(el => el.name);
    
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
  await scrapFiles(venues.filter(el => el.hasOwnProperty('eventsDelimiterTag')));
  const venuesToSkip = venues.filter(el => !el.hasOwnProperty('eventsDelimiterTag')).map(el => el.name+' ('+el.city+', '+el.country+')');
  console.log('\x1b[36mWarning: the following venues have no scraping details and are only used as aliases. Run analex if it is a mistake.\x1b[0m',venuesToSkip);
}



async function scrapFiles(venues) {
  let totalEventList = [];
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
      totalEventList = totalEventList.concat(await analyseFile(venue));
    } else{
      console.log('\x1b[31mEntrée %s non traitée.\x1b[0m', venue.name);
    }
  }
  console.log('Scrapex fini avec succex !! (%s events found).\n\n', totalEventList.length);
  saveToCSV(totalEventList, outFile);
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

  console.log('\n\x1b[32m%s\x1b[0m', `******* Venue: ${venue.name}  (${inputFileList.length} page(s)) *******`);

  // build event list and analyze the events
  const [eventBlockList, hrefInDelimiterList] = await extractEvents(inputFileList,venue);
  let eventList = analyseEvents(eventBlockList, hrefInDelimiterList, venue);
  eventList = unique(eventList);
  console.log('Found %s events for %s.\n\n',eventList.length,venue.name);
  return eventList;



  function analyseEvents(eventBlockList, hrefInDelimiterList, venue){
    let eventList = [];
    const dateFormat = (venue.hasOwnProperty('linkedPage') && venue.linkedPage.hasOwnProperty('eventDateTags'))?venue.linkedPageDateFormat:venue.dateFormat; 

    // parsing each event
    try{
      eventBlockList.forEach((eve,eveIndex) =>{
        //let unixDate, eventURL;
        let $eventBlock = cheerio.load(eve);
        let eventInfo = {'eventPlace':venue.name};
        
        // changing to default style if no style
        eventInfo.eventStyle = venue.hasOwnProperty('defaultStyle')?venue.defaultStyle:globalDefaultStyle;

        // **** event data extraction ****/
        Object.keys(venue.scrap).forEach(key => eventInfo[key.replace('Tags','')] = getText(key,venue.scrap,$eventBlock));


        //extract URL
        let eventURL;
        try{
          if (!venue.scrap.hasOwnProperty('eventURLTags')){
            if (venue.hasOwnProperty('eventeventURLIndex') && venue.eventURLIndex === -1){
              eventURL ='No url link.';
            }else{
              let index = venue.hasOwnProperty('eventURLIndex')?venue.eventURLIndex:0;
              if (index == 0){// the URL is in A href
                  //     eventURL = makeURL(venue.baseURL,$(venue.eventsDelimiterTag+':eq('+eveIndex+')').attr('href'));
                  eventURL = makeURL(venue.baseURL,hrefInDelimiterList[eveIndex]);
              }else{// URL is in inner tags
                  index = index - 1;
                const tagsWithHref = $eventBlock('a[href]');
                eventURL = makeURL(venue.baseURL,$eventBlock(tagsWithHref[index]).attr('href'));
              }
            }
          }else{ // if a delimiter for the URL has been defined
            eventURL = makeURL(venue.baseURL,$eventBlock(venue.scrap.eventURLTags[0]).attr('href'));
            eventInfo.eventURL = eventURL;
          }
        }catch(err){
          console.log("\x1b[31mErreur lors de la récupération de l\'URL.\x1b[0m",err);
        }

        // scrap info from linked page
        if (linkedFileContent){
          try{
            const $linkedBlock = cheerio.load(linkedFileContent[eventURL]);
            Object.keys(venue.linkedPage).forEach(key => eventInfo[key.replace('Tags','')] = getText(key,venue.linkedPage,$linkedBlock));  
          }catch{
            console.log('\x1b[31mImpossible de lire la page liée pour l\'événement \'%s\'. Erreur lors du téléchargement ?\x1b[0m', eventInfo.eventName);
          }
          // if the url in the linked is empty, replace by the main page one
          if (!eventInfo.hasOwnProperty('eventURL') || eventInfo.eventURL === undefined || eventInfo.eventURL.length === 0){
            eventInfo.eventURL = eventURL;
          }
        }else{
          eventInfo.eventURL = eventURL;
        }

        //*** logs  ***//

        // change the date format to Unix time
        const formatedEventDate = createDate(eventInfo.eventDate,dateFormat,dateConversionPatterns);
        if (!isValid(formatedEventDate)){
          console.log('\x1b[31mFormat de date invalide pour %s. Reçu \"%s\", converti en \"%s\" (attendu \"%s\")\x1b[0m', 
            venue.name,eventInfo.eventDate,convertDate(eventInfo.eventDate,dateConversionPatterns),dateFormat);
          eventInfo.unixDate = new Date().getTime();
          //eventInfo.unixDate = eventInfo.unixDate.setFullYear(eventInfo.unixDate.getFullYear() - 10); // en cas d'erreur, ajoute la date d'aujourd'hui A MODIFIER POUR MIEUX REPERER L'ERREUR
        }else{
          eventInfo.unixDate = formatedEventDate.getTime();
          console.log(showDate(formatedEventDate));
        }

        // match event place with existing one
        if (venue.scrap.hasOwnProperty('eventPlaceTags') || (venue.hasOwnProperty('linkedPage') && venue.linkedPage.hasOwnProperty('eventPlaceTags'))){
          eventInfo.eventPlace = FindLocationFromAlias(eventInfo.eventPlace,venue.country,venue.city,aliasList);
        }

        // get normalized style
        eventInfo.eventStyle = getStyle(eventInfo.eventStyle);

        // display
        console.log('Event : %s',eventInfo.eventName);
        Object.keys(eventInfo).forEach(key => {
          if (key !== 'eventName' && key !== 'eventDate' && key !== 'eventURL' && key != 'unixDate' && key != 'eventDummy'){
            console.log(key.replace('event',''),': ',eventInfo[key.replace('Tags','')]);
          }
        });
        console.log((eventInfo.eventURL)+'\n');
        eventList.push(eventInfo);
      }); 
      
    }catch(error){
      console.log("Unknown error while processing "+venue.name,error);
    }
    return eventList;
  }
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
      return removeBlanks(string);
      //return tagName === 'eventPlaceTags'?fixString(removeBlanks(string),venueNamesList):removeBlanks(string);
    }
    // end of auxiliary function




function removeBlanks(s){
  return s.replace(/[\n\t]/g, ' ').replace(/ {2,}/g, ' ').replace(/^ /,'').replace(/ $/,'');
}



async function extractEvents(inputFileList, venue){
  let eventBlockList = [];
  let hrefInDelimiterList = [];
  const promise = inputFileList.map(async inputFile =>{
    try{
      const venueContent = await fs.promises.readFile(inputFile, 'utf8');
      const $ = cheerio.load(parseDocument(venueContent));
      try{
        $(venue.eventsDelimiterTag).each((index, element) => {
          let ev = $(element).html();
          eventBlockList.push(ev);
          hrefInDelimiterList.push($(venue.eventsDelimiterTag+':eq('+index+')').attr('href'));
      });     
      }catch(err){        
        console.log('\x1b[31m%s\x1b[0m. %s', 'Délimiteur mal défini pour '+venue.name,err);      
      }
    }catch (err){
      console.error("\x1b[31mErreur lors de la lecture du fichier local: \'%s\'.\x1b[0m %s",inputFile, (err.code==='ENOENT')?'':err);
    }
  });
  await Promise.all(promise);
  return [eventBlockList, hrefInDelimiterList];
}


function unique(list) {
  const uniqueSet = new Set(list.map(obj => JSON.stringify(obj)));
  return Array.from(uniqueSet).map(str => JSON.parse(str));
};


function saveToCSV(eventList, outFile){
  let out = '';
  eventList.forEach(eventInfo =>{
    out = out+''+eventInfo.eventPlace+';'
    +eventInfo.eventName+';'+eventInfo.unixDate+';100;'+eventInfo.eventStyle+';'+eventInfo.eventURL+'\n';
  });
  try{
    fs.writeFileSync(outFile, out, 'utf-8', { flag: 'w' });
  }catch(err){
    console.log("\x1b[31mImpossible de sauvegarder dans le fichier \x1b[0m\'%s\'\x1b[31m. %s\x1b[0m",outFile,err.message);
  } 
}


function FindLocationFromAlias(string,country,city,aliasList){
  let res = string;
  aliasList.filter(venue => venue.country === country && venue.city === city)
  .forEach(venue => {
    if (venue.aliases.filter(al => removeAccents(al.toLowerCase()) === removeAccents(string.toLowerCase())).length > 0){// if the name of the place of the event is in the alias list, replace by the main venue name
      res = venue.name;
    }
  });
  return res;
}

function getStyle(string){
  const stringComp = removeAccents(string.toLowerCase());
  let res = string;
  Object.keys(styleConversion).forEach(style =>{
    if (styleConversion[style].some(word => stringComp.includes(word))){
      res = style;
    }
  });
  return res;
}