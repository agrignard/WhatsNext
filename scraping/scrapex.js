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

  // save errors to JSON file
  try{
    const jsonString = JSON.stringify(totalEventList.filter(el => el.hasOwnProperty('errorLog')), null, 2); 
    fs.writeFileSync('./errorLog.json', jsonString);
  }catch(err){
      console.log('\x1b[31mError saving to \'errorLog.json\': \x1b[0m%s',err);
  }

  // save errors to error log
  let errorLog ='';
  const nbErrors = totalEventList.filter(el => el.hasOwnProperty('errorLog')).length;
  if (nbErrors > 0){
    console.log("\x1b[31mFound %s events with errors, check \'error.log\' for details.\x1b[0m",nbErrors);
  }

  totalEventList.filter(el => el.hasOwnProperty('errorLog'))
  .forEach(el =>{
    errorLog = errorLog + displayEventFullDetails(el);
  });
  fs.writeFile('./error.log', errorLog, 'utf8', (err) => {
    if (err) {
      console.error("\x1b[31mCannot write error log file:\x1b[0m %s", err);
    }
  });
  
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
            if (venue.hasOwnProperty('eventURLIndex') && venue.eventURLIndex === -1){
              eventURL =venue.baseURL;
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
          toErrorLog(eventInfo,["\x1b[31mErreur lors de la récupération de l\'URL.\x1b[0m",err]);
        }

        if (!isEmptyEvent(eventInfo)){
          // scrap info from linked page
          if (linkedFileContent){
            try{
              const $linkedBlock = cheerio.load(linkedFileContent[eventURL]);
              Object.keys(venue.linkedPage).forEach(key => eventInfo[key.replace('Tags','')] = getText(key,venue.linkedPage,$linkedBlock));  
            }catch{
              toErrorLog(eventInfo,['\x1b[31mImpossible de lire la page liée pour l\'événement \'%s\'. Erreur lors du téléchargement ?\x1b[0m', eventInfo.eventName]);
            }
            // if the url in the linked is empty, replace by the main page one
            if (!eventInfo.hasOwnProperty('eventURL') || eventInfo.eventURL === undefined || eventInfo.eventURL.length === 0){
              eventInfo.eventURL = eventURL;
            }
          }else{
            eventInfo.eventURL = eventURL;
          }

          //*** post processing, show logs and save  ***//

          // match event place with existing one
          if (venue.scrap.hasOwnProperty('eventPlaceTags') || (venue.hasOwnProperty('linkedPage') && venue.linkedPage.hasOwnProperty('eventPlaceTags'))){
            eventInfo.eventPlace = FindLocationFromAlias(eventInfo.eventPlace,venue.country,venue.city,aliasList);
          }

          // get normalized style
          eventInfo.eventDetailedStyle = eventInfo.eventStyle;
          eventInfo.eventStyle = getStyle(eventInfo.eventStyle);
          eventInfo.source = [venue.name, venue.city, venue.country];

          // make a list of events in case of multidate
          const eventInfoList = createMultiEvents(eventInfo);
         
          
          eventInfoList.forEach(el => {
            // change the date format to Unix time
            const formatedEventDate = createDate(el.eventDate,dateFormat,dateConversionPatterns);
            if (!isValid(formatedEventDate)){
              toErrorLog(el,['\x1b[31mFormat de date invalide pour %s. Reçu \"%s\", converti en \"%s\" (attendu \"%s\")\x1b[0m', 
                venue.name,el.eventDate,convertDate(el.eventDate,dateConversionPatterns),dateFormat]);
              el.unixDate = 0;
            }else{
              el.unixDate = formatedEventDate.getTime();
              console.log(showDate(formatedEventDate));
            }

            // display
            displayEventLog(el);
            eventList.push(el);
          });
         
        }
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
      if (tagName !== 'eventMultiDateTags'){
        try{
          for (let i = 0; i <= tagList.length-1; i++) {
            let ev = tagList[i]===''?source.text():source(tagList[i]).text();
            string += ev+' ';
          }
        }catch(err){
          console.log('\x1b[31m%s\x1b[0m', 'Erreur d\'extraction à partir des balises.\x1b[0m',tagList);
        }
        return removeBlanks(string);
      }else{
        const res = source(tagList[0]).map((index, element) => source(element).text()).get();
        return res;
      }
     
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
    +eventInfo.eventName+';'+eventInfo.unixDate+';100;'+eventInfo.eventStyle+';'+eventInfo.eventDetailedStyle+';'+eventInfo.eventURL+'\n';
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

function  displayEventLog(eventInfo){
  console.log('Event : %s (%s, %s)',eventInfo.eventName,eventInfo.city,eventInfo.country);
  Object.keys(eventInfo).forEach(key => {
      if (!['eventName', 'eventDate', 'eventURL', 'unixDate', 'eventDummy', 'source','city','country'].includes(key)){
        console.log(key.replace('event',''),': ',eventInfo[key.replace('Tags','')]);
    }
  });
  console.log((eventInfo.eventURL)+'\n');
}

function  displayEventFullDetails(eventInfo){
  let string = 'Date: '+eventInfo.eventDate+'\n';
  string = string+'Event: '+eventInfo.eventName+'\n';
  Object.keys(eventInfo).forEach(key => {
      if (!['eventName', 'eventDate', 'eventURL'].includes(key)){
        string = string+(key.replace('event','')+': '+eventInfo[key.replace('Tags','')])+'\n';
    }
  });
  string = string +eventInfo.eventURL+'\n\n';
  return string;
}


function isEmptyEvent(eventInfo){
  return eventInfo.eventName === '' && (eventInfo.eventURL === '' || eventInfo.eventURL == undefined) && eventInfo.eventDate === '';
}

function toErrorLog(eventInfo, messageList){
  let string = messageList[0];
  
  for(let i=1;i<messageList.length;i++){
    string = string.replace('%s',messageList[i]);
  }
  console.log(string);
  string = string.replace(/\x1b\[\d+m/g, ''); // remove color tags
  if (eventInfo.hasOwnProperty('errorLog')){
    eventInfo.errorLog = eventInfo.errorLog+" | "+string;
  }else{
    eventInfo.errorLog = string;
  }
  
}

function createMultiEvents(eventInfo){
  if (eventInfo.hasOwnProperty('eventMultiDate')){
    if (eventInfo.eventMultiDate.length >0){
    const res = [];
    eventInfo.eventMultiDate.forEach(el =>{
      const ei = {...eventInfo};
      ei.eventDate = el;
      delete ei.eventMultiDate;
      res.push(ei);
    });
    return res;
    }else{
      delete eventInfo.eventMultiDate;
      return [eventInfo];
    }
  }else{
    return checkMultiDates(eventInfo);
  }
}

function checkMultiDates(eventInfo){
  if (eventInfo.eventDate.includes('et')){
    const r1 = /([^]*?)à([^]*?)et([^]*?)$/;
    if (r1.test(eventInfo.eventDate)){
      const m = eventInfo.eventDate.match(r1);
      const d1 = m[1]+'à'+m[2];
      const d2 = m[1]+'à'+m[3];
      const e1 = {...eventInfo};
      e1.eventDate = d1;
      const e2 = {...eventInfo};
      e2.eventDate = d2;
      return [e1, e2];
    }
    const r2 = /([^]*?)et([^]*?)à([^]*?),[^]*?à([^]*?)$/;
    if (r2.test(eventInfo.eventDate)){
      const m = eventInfo.eventDate.match(r2);
      const year = new Date().getFullYear();
      const d1 = m[1]+year+' à'+m[3];
      const d2 = m[2]+year+' à'+m[4];
      const e1 = {...eventInfo};
      e1.eventDate = d1;
      const e2 = {...eventInfo};
      e2.eventDate = d2;
      return [e1, e2];
      //eventInfo.errorLog = "CONVERSION "+d1;
    }
  }
  return [eventInfo];
}