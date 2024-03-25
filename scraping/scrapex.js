const { createDate, convertDate, showDate, getDateConversionPatterns, eventTime, 
        TimeZone} = require('./import/dateUtilities.js');
const fs = require('fs');
const { parse, isValid } = require('date-fns');
const cheerio = require('cheerio');
const {parseDocument} = require('htmlparser2');
const {makeURL, simplify, removeBlanks} = require('./import/stringUtilities.js');
const {loadLinkedPages, saveToJSON, saveToCSV, getVenuesFromArguments,
        getFilesNumber, getFilesContent, getModificationDate} = require('./import/fileUtilities.js');
const {samePlace, getAliases, getStyleConversions, loadVenuesJSONFile, 
        loadCancellationKeywords, writeToLog, isAlias, geAliasesToURLMap,
        getLanguages, fromLanguages, checkLanguages, unique} = require('./import/jsonUtilities.js');
const { mergeEvents} = require('./import/mergeUtilities.js');
const { getText} = require('./import/scrapexUtilities.js');
// Chemin vers le fichier à lire
const sourcePath = './webSources/';

//var out="";// = "PLACE,TITRE,UNIX,SIZE,GENRE,URL";
const outFile = "generated/scrapexResult_lyon.csv";
const globalDefaultStyle = 'Live';
const styleConversion = getStyleConversions();
const cancellationKeywords = loadCancellationKeywords();
const showFullMergeLog = true;


const dateConversionPatterns = getDateConversionPatterns();
const venueList = loadVenuesJSONFile();
const aliasList = getAliases(venueList);
const languages = getLanguages();
const timeZones = new TimeZone();

    
//initScrap(process.argv[2]);

const venues = getVenuesFromArguments(process.argv, venueList); // venueList is kept to allow finding matches with event places

if (venues.length === 0){
  console.log("No place matching arguments.");
}else{
  scrap(venues);
} 

async function scrap(venues){
  await scrapFiles(venues.filter(el => !isAlias(el)));
  const venuesToSkip = venues.filter(el => isAlias(el)).map(el => el.name+' ('+el.city+', '+el.country+')');
  if (venuesToSkip.length>0){
    console.log('\x1b[36mWarning: the following venues have no scraping details and are only used as aliases. Run analex if it is a mistake.\x1b[0m',venuesToSkip);    
  }
}





async function scrapFiles(venues) {
  let totalEventList = [];
  for (const venue of venues) {
    let err = false;
    if (!(venue.hasOwnProperty('eventsDelimiterTag') || venue.hasOwnProperty('eventsDelimiterRegex'))){
      console.log('\x1b[31m%s\x1b[0m', 'Aucun délimiteur de bloc d\'événement défini pour '+venue.name);
      err = true;
    }
    if (!venue.hasOwnProperty('mainPage') || !(venue.mainPage.hasOwnProperty('eventNameTags') || venue.mainPage.hasOwnProperty('eventNameRegex'))){
      console.log('\x1b[31m%s\x1b[0m', 'Aucun délimiteur de nom d\'événement défini pour '+venue.name);
      err = true;
    }
    if (!venue.hasOwnProperty('mainPage') || !(venue.mainPage.hasOwnProperty('eventDateTags') || venue.mainPage.hasOwnProperty('eventDateRegex'))){
      console.log('\x1b[31m%s\x1b[0m', 'Aucun délimiteur de date d\'événement défini pour '+venue.name);
      err = true;
    }
    if (!err){
      totalEventList = totalEventList.concat(await analyseFile(venue));
    } else{
      console.log('\x1b[31mEntrée %s non traitée.\x1b[0m', venue.name);
    }
  }
  // *** post processing ***

  // merge duplicate events
  console.log('*** Merging duplicate events ***\n');
  totalEventList = mergeEvents(totalEventList,showFullMergeLog);

  // provide local URLs for alias venues

  totalEventList = fixAliasURLs(totalEventList,geAliasesToURLMap());

  console.log('Scrapex fini avec succex !! (%s events found).\n', totalEventList.length);

  saveToCSV(totalEventList, outFile);
  // save to JSON
  saveToJSON(totalEventList,'./generated/scrapResult_lyon.json');

  // save errors to JSON file
  saveToJSON(totalEventList.filter(el => el.hasOwnProperty('errorLog')),'./generated/errorLog.json');


  // save errors to error log
  writeLogFile(totalEventList,'error');
  writeLogFile(totalEventList,'warning');
  console.log('\n');

  // check missing languages
  checkLanguages(venues);
  
}



async function analyseFile(venue) {
  const timeZone = timeZones.getTimeZone(venue);
  let linkedFileContent;//, inputFileList;
  const venueSourcePath = sourcePath+venue.country+'/'+venue.city+'/'+venue.name+'/';
  if (venue.hasOwnProperty('linkedPage')){
    linkedFileContent = loadLinkedPages(venueSourcePath);
  }
  // get file list to scrap
  // try {
  //   inputFileList = fs.readdirSync(venueSourcePath)
  //     .filter(fileName => fileName.endsWith('.html'))
  //     .map(el => venueSourcePath+el);
  // } catch (err) {
  //   console.error('\x1b[31mError reading html files in directory \'%s\'.\x1b[0m Error: %s',venueSourcePath, err);
  // }
const fileContent = getFilesContent(venueSourcePath);
const modificationDate = getModificationDate(venueSourcePath);

  console.log('\n\x1b[32m%s\x1b[0m', `******* Venue: ${venue.name}  (${getFilesNumber(venueSourcePath)} page(s)) *******`);

  // build event list and analyze the events
  //const [eventBlockList, hrefInDelimiterList] = await extractEvents(inputFileList,venue);
  const [eventBlockList, hrefInDelimiterList] = await extractEvents(fileContent,venue);
  let eventList = analyseEvents(eventBlockList, hrefInDelimiterList, venue);
  eventList = unique(eventList);
  console.log('Found %s events for %s.\n\n',eventList.length,venue.name);
  return eventList;



  function analyseEvents(eventBlockList, hrefInDelimiterList, venue){
    let eventList = [];
    const dateFormat = (venue.hasOwnProperty('linkedPage') && venue.linkedPage.hasOwnProperty('eventDateTags'))?venue.linkedPageDateFormat:venue.dateFormat; 
    const eventLanguages = languages[venue.country]; 
    const localDateConversionPatterns = fromLanguages(dateConversionPatterns,eventLanguages);
    // parsing each event
    try{
      eventBlockList.forEach((eve,eveIndex) =>{
        let $eventBlock = cheerio.load(eve);
        let eventInfo = {'eventPlace':venue.name, 'city':venue.city, 'country':venue.country};
        
        // **** event data extraction ****/
        Object.keys(venue.mainPage).forEach(key => eventInfo[key.replace('Tags','')] = getText(key,venue.mainPage,$eventBlock));

        // find if cancelled
        eventInfo.isCancelled = isCancelled($eventBlock.text(),cancellationKeywords[venue.country]);

        //extract URL
        let eventURL;
        try{
          if (!venue.mainPage.hasOwnProperty('eventURLTags')){
            if (venue.hasOwnProperty('eventURLIndex') && venue.eventURLIndex === -1){
              eventURL =venue.baseURL;
            }else{
              let index = venue.hasOwnProperty('eventURLIndex')?venue.eventURLIndex:0;
              if (index == 0){// the URL is in A href
                  eventURL = makeURL(venue.baseURL,hrefInDelimiterList[eveIndex]);
              }else{// URL is in inner tags
                  index = index - 1;
                const tagsWithHref = $eventBlock('a[href]');
                const hrefFromAttribute = $eventBlock(tagsWithHref[index]).attr('href');
                if (hrefFromAttribute){
                  eventURL = makeURL(venue.baseURL,hrefFromAttribute);
                }else{
                  eventURL = $eventBlock(tagsWithHref[index]).text();
                }     
              }
            }
          }else{ // if a delimiter for the URL has been defined
            eventURL = makeURL(venue.baseURL,$eventBlock(venue.mainPage.eventURLTags[0]).attr('href'));
            eventInfo.eventURL = eventURL;
          }
        }catch(err){
          writeToLog('error',eventInfo,["\x1b[31mErreur lors de la récupération de l\'URL.\x1b[0m",err],true);
        }


        if (!isEmptyEvent(eventInfo)){
          // scrap info from linked page
          if (linkedFileContent){
            try{
              const $linkedBlock = cheerio.load(linkedFileContent[eventURL]);
              Object.keys(venue.linkedPage).forEach(key => eventInfo[key.replace('Tags','')] = getText(key,venue.linkedPage,$linkedBlock));  
              // look for cancellation keywords. Leave commented since it appears that linkedpages do not contain appropriate information about cancellation 
              // eventInfo.iscancelled = eventInfo.iscancelled || isCancelled($linkedBlock.text(),cancellationKeywords[venue.country]);
            }catch{
              writeToLog('error',eventInfo,['\x1b[31mImpossible de lire la page liée pour l\'événement \'%s\'. Erreur lors du téléchargement ?\x1b[0m', eventInfo.eventName],true);
            }
            // if the url in the linked is empty, replace by the main page one
            if (!eventInfo.hasOwnProperty('eventURL') || eventInfo.eventURL === undefined || eventInfo.eventURL.length === 0){
              eventInfo.eventURL = eventURL;
            }
          }else{
            eventInfo.eventURL = eventURL;
          }

          //*** post processing, show logs and save  ***//

          // perform regexp
          if (venue.hasOwnProperty('regexp')){
            applyRegexp(eventInfo,venue.regexp);
          }
      
          // match event place with existing one
          if (venue.mainPage.hasOwnProperty('eventPlaceTags') || (venue.hasOwnProperty('linkedPage') && venue.linkedPage.hasOwnProperty('eventPlaceTags'))){
            eventInfo.eventPlace = FindLocationFromAlias(eventInfo.eventPlace,venue.country,venue.city,aliasList);
          }

          // get normalized style
          eventInfo.eventDetailedStyle = eventInfo.hasOwnProperty('eventStyle')?eventInfo.eventStyle:'';
          if (!eventInfo.hasOwnProperty('eventStyle') || eventInfo.eventStyle ===''){
            const eventPlace = venueList.find(el => samePlace(el,{name:eventInfo.eventPlace, city: venue.city, country:venue.country}));
            if (eventPlace && eventPlace.hasOwnProperty('defaultStyle')){// if no style is found, first apply the event place default style
              eventInfo.eventStyle = eventPlace.defaultStyle;
            }else if (venue.hasOwnProperty('defaultStyle')){// if no default style for the place, take the one of the scrapped site
              eventInfo.eventStyle = venue.defaultStyle;
            }else{// otherwise use the global style
              eventInfo.eventStyle = globalDefaultStyle;
            }
          }
          eventInfo.eventStyle = getStyle(eventInfo.eventStyle, eventLanguages);
          eventInfo.source = {'name':venue.name, 'city':venue.city, 'country':venue.country};

          // make a list of events in case of multidate
          const eventInfoList = createMultiEvents(eventInfo);
         
          
          eventInfoList.forEach(el => {
            // change the date format to Unix time
            let formatedEventDate = createDate(el.eventDate,dateFormat,localDateConversionPatterns,timeZone,modificationDate);
            //createDate(el.eventDate,dateFormat,localDateConversionPatterns);
           // el.date = formatedEventDate;
            if (!isValid(formatedEventDate)){
              writeToLog('error',el,['\x1b[31mFormat de date invalide pour %s. Reçu \"%s\", converti en \"%s\" (attendu \"%s\")\x1b[0m', 
                venue.name,el.eventDate,convertDate(el.eventDate,localDateConversionPatterns),dateFormat],true);
              el.unixDate = 0;
            }else{
              // changer 00:00 en 23:59 si besoin
              if (venue.hasOwnProperty('midnightHour')){
                formatedEventDate = changeMidnightHour(formatedEventDate,venue.midnightHour,el);
              }
              el.unixDate = formatedEventDate.getTime();
              el.eventTime = eventTime(formatedEventDate,timeZone);
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





// function removeBlanks(s){
//   return s.replace(/[\n\t]/g, ' ').replace(/ {2,}/g, ' ').replace(/^[ ]{1,}/,'').replace(/[ ]{1,}$/,'');
// }

async function extractEvents(fileContent, venue){
  let eventBlockList = [];
  let hrefInDelimiterList = [];
  const $ = cheerio.load(parseDocument(fileContent));
  try{
    $(venue.eventsDelimiterTag).each((index, element) => {
      let ev = $(element).html();
      eventBlockList.push(ev);
      hrefInDelimiterList.push($(venue.eventsDelimiterTag+':eq('+index+')').attr('href'));
    });
  }catch(err){        
    console.log('\x1b[31m%s\x1b[0m. %s', 'Délimiteur mal défini pour '+venue.name,err);      
  }
  return [eventBlockList, hrefInDelimiterList];
}


// async function extractEvents(inputFileList, venue){
//   let eventBlockList = [];
//   let hrefInDelimiterList = [];
//   const promise = inputFileList.map(async inputFile =>{
//     try{
//       const venueContent = await fs.promises.readFile(inputFile, 'utf8');
//       const $ = cheerio.load(parseDocument(venueContent));
//       try{
//         $(venue.eventsDelimiterTag).each((index, element) => {
//           let ev = $(element).html();
//           eventBlockList.push(ev);
//           hrefInDelimiterList.push($(venue.eventsDelimiterTag+':eq('+index+')').attr('href'));
//       });     
//       }catch(err){        
//         console.log('\x1b[31m%s\x1b[0m. %s', 'Délimiteur mal défini pour '+venue.name,err);      
//       }
//     }catch (err){
//       console.error("\x1b[31mErreur lors de la lecture du fichier local: \'%s\'.\x1b[0m %s",inputFile, (err.code==='ENOENT')?'':err);
//     }
//   });
//   await Promise.all(promise);
//   return [eventBlockList, hrefInDelimiterList];
// }








function FindLocationFromAlias(string,country,city,aliasList){
  let res = string;
  aliasList.filter(venue => venue.country === country && venue.city === city)
  .forEach(venue => {
    if (venue.aliases.filter(al => simplify(al) === simplify(string)).length > 0){// if the name of the place of the event is in the alias list, replace by the main venue name
      res = venue.name;
    }
  });
  return res;
}

function getStyle(string, eventLanguages){
  const stringComp = simplify(string);
  let res = string;
  let localStyleConversion = fromLanguages(styleConversion,eventLanguages);
  Object.keys(localStyleConversion).forEach(style =>{
    if (localStyleConversion[style].some(word => stringComp.includes(simplify(word)))){
      res = style;
    }
  });
  return res;
}

function  displayEventLog(eventInfo){
  console.log('Event : %s (%s, %s)%s',eventInfo.eventName,eventInfo.city,eventInfo.country,eventInfo.isCancelled?' (cancelled)':'');
  Object.keys(eventInfo).forEach(key => {
      if (!['eventName', 'eventDate', 'eventURL', 'unixDate', 'eventDummy', 'source','city','country','isCancelled'].includes(key)
          && eventInfo[key.replace('Tags','')] !== ''){
        console.log(key.replace('event','')+': %s',eventInfo[key.replace('Tags','')]);
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


function applyRegexp(event, rulesSet){
  Object.keys(rulesSet).forEach(key =>{
    if (typeof rulesSet[key] === 'string'){// a string, regexp is used for a match
      event[key] = event[key].match(new RegExp(rulesSet[key]));
    }else if (rulesSet[key].length === 2){// a list of two elements. replace pattern (1st) with (2nd)
      event[key] = event[key].replace(new RegExp(rulesSet[key][0]),rulesSet[key][1]);
    }
  });
}


function changeMidnightHour(date,targetDay,eventInfo){
  let newDate = date;
  if (newDate.getHours() === 0 && newDate.getMinutes() === 0) {
    //newDate.setHours(24);
    newDate.setHours(23);
    newDate.setMinutes(59);
  }
  if (simplify(targetDay) === 'sameday'){
    // do nothing
  }else if (simplify(targetDay) === 'previousday'){// set to previous day
    newDate.setTime(date.getTime() - 86400000);
  }else{
    writeToLog('error',eventInfo,['\x1b[31mMidnight date string invalid. Received %s, should be \'sameDay\' or \'previousDay\'.\x1b[0m',targetDay],true);  
  }
  return newDate;
}


function writeLogFile(eventList,type){
  const colorTag = type==='error'?'\x1b[31m':'\x1b[36m';
  const key = type+'Log';
  const list = eventList.filter(el => el.hasOwnProperty(key));
  const nbEntries = list.length;
  if (nbEntries > 0){
    console.log("\x1b[0mFound %s%s\x1b[0m events with %s%ss\x1b[0m, check \'%s.log\' for details.\x1b[0m",
            colorTag,nbEntries,colorTag,type,type);
  }

  let log = '';
  list.forEach(el =>{
    log = log + displayEventFullDetails(el);
  });
  fs.writeFile('./'+type+'.log', log, 'utf8', (err) => {
    if (err) {
      console.error("\x1b[31mCannot write error log file:\x1b[0m %s", err);
    }
  });
}

// find in an event text if the venue is cancelled
function isCancelled(text,keywords){
  const txt = simplify(text);
  return keywords.some(kw => txt.includes(kw));
}


function fixAliasURLs(events, venueToURL){
  events.forEach(event => {
    const correspondingVenue = venueToURL.find(el => samePlace(event,el));
    if (correspondingVenue){
      if (!event.hasOwnProperty('altURLs')){
        event.altURLs = [event.eventURL];
      }
      event.eventURL = correspondingVenue.url;
      event.altURLs.push(event.eventURL);
    }
  });
  return events;
}