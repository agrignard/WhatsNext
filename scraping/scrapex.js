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
const {mergeEvents} = require('./import/mergeUtilities.js');
const {getInfo} = require('./import/scrapexUtilities.js');
const {getHrefFromAncestor} = require('./import/aspiratorexUtilities.js');

const useAI = false;
if (useAI){ 
  var {isOllamaActive, getCurrentLlamaModel, getStyleInfo, extractStyle} = require('./import/aiUtilities.js');
}


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
  await testLlamaServer(useAI);
  await scrapFiles(venues.filter(el => !isAlias(el)));
  const venuesToSkip = venues.filter(el => isAlias(el)).map(el => el.name+' ('+el.city+', '+el.country+')');
  if (venuesToSkip.length>0){
    console.log('\x1b[36mWarning: the following venues have no scraping details and are only used as aliases. Run analex if it is a mistake.\x1b[0m',venuesToSkip);    
  }
}


async function validateVenue(venue){
  if (!(venue.hasOwnProperty('eventsDelimiterTag') || venue.hasOwnProperty('eventsDelimiterRegex'))){
    writeToLog('error',undefined,'\x1b[31mAucun délimiteur de bloc d\'événement défini pour '+venue.name+'. Fichier non traité.\x1b[0m');
    return false;
  }

  if (!venue.hasOwnProperty('mainPage')) {
    writeToLog('error',undefined,'\x1b[31mPas de page principale définie pour '+venue.name+'. Fichier non traité.\x1b[0m');
    return false;
  }

  const keywords = Object.keys(venue.mainPage).concat((venue.linkedPage)?Object.keys(venue.linkedPage):[]);
  
  if(!keywords.some(keyword => keyword.includes('Name'))){
    writeToLog('error',undefined,'\x1b[31m%sAucun délimiteur de nom d\'événement défini pour '+venue.name+'. Fichier non traité.\x1b[0m');
    return false;
  }

  if(!keywords.some(keyword => keyword.includes('Date'))){
    writeToLog('error',undefined,'\x1b[31m%sAucun délimiteur de date d\'événement défini pour '+venue.name+'. Fichier non traité.\x1b[0m');
    return true;
  }
}



async function scrapFiles(venues) {
  let totalEventList = [];
  for (const venue of venues) {
    if (validateVenue(venue)){
      totalEventList = totalEventList.concat(await analyseFile(venue));
    }else{
      console.log('\x1b[31mVenue %s non traitée.\x1b[0m', venue);
    }
    
  }
  // *** post processing *** 

  // merge duplicate events
  // console.log('*** Merging duplicate events ***\n');
 
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

  // let eventList = await analyseEvents(eventBlockList.slice(0,15), hrefInDelimiterList, venue);
  let eventList = await analyseEvents(eventBlockList, hrefInDelimiterList, venue);

  eventList = unique(eventList);


    // // find the style with AI

    // for (ev of eventList) {
    //   const $linkedBlock = cheerio.load(linkedFileContent[ev.eventURL]);
    //   ev.ChatStyle = await getStyleInfo($linkedBlock.html());
    //   console.log(ev);
    // };

  console.log('Found %s events for %s.\n\n',eventList.length,venue.name);
  return eventList;



  async function analyseEvents(eventBlockList, hrefInDelimiterList, venue){
    let eventList = [];
    const possibleDateFormats = [venue.linkedPageDateFormat, venue.dateFormat].filter(el => el);
    
    const eventLanguages = languages[venue.country]; 
    const localDateConversionPatterns = fromLanguages(dateConversionPatterns,eventLanguages);

    //*** aux functio for post processing, show logs and save  ***//
    function postProcess(eventInfo) {

      // perform regexp
      if (venue.hasOwnProperty('regexp')) {
        applyRegexp(eventInfo, venue.regexp);
      }

      // match event place with existing one when the eventPlace comes from a generic site such as 'infoconcerts'
      if (venue.mainPage.hasOwnProperty('eventPlaceTags') || (venue.hasOwnProperty('linkedPage') && venue.linkedPage.hasOwnProperty('eventPlaceTags'))) {
        eventInfo.eventPlace = FindLocationFromAlias(eventInfo.eventPlace, venue.country, venue.city, aliasList);
      }

      // get normalized style
      eventInfo.eventDetailedStyle = eventInfo.hasOwnProperty('eventStyle') ? eventInfo.eventStyle : '';
      if (!eventInfo.hasOwnProperty('eventStyle') || eventInfo.eventStyle === '') {
        const eventPlace = venueList.find(el => samePlace(el, { name: eventInfo.eventPlace, city: venue.city, country: venue.country }));
        if (eventPlace && eventPlace.hasOwnProperty('defaultStyle')) {// if no style is found, first apply the event place default style
          eventInfo.eventStyle = eventPlace.defaultStyle;
        } else if (venue.hasOwnProperty('defaultStyle')) {// if no default style for the place, take the one of the scrapped site
          eventInfo.eventStyle = venue.defaultStyle;
        } else {// otherwise use the global style
          eventInfo.eventStyle = globalDefaultStyle;
        }
      }
      eventInfo.eventStyle = getStyle(eventInfo.eventStyle, eventLanguages);
      eventInfo.source = { 'name': venue.name, 'city': venue.city, 'country': venue.country };

      // process date: change the date format to Unix time. Test all formats of possibleDateFormat until one is valid
      let formatFound = false; 
      if (!eventInfo.hasOwnProperty('eventDate') && !eventInfo.hasOwnProperty('altEventDate')){
        eventInfo.unixDate = -1;
        const errorString = '\x1b[31mPas de date trouvée pour \x1b[0m'+venue.name+'\x1b[31m.\x1b[0m';
        writeToLog('error',eventInfo, [errorString], false);
        displayEventLog(eventInfo);
        return eventInfo;
      }

      eventInfo.unixDate = 0;
      let formatedEventDate;

      for (const dateFormat of possibleDateFormats){
        formatedEventDate = createDate(convertDate(eventInfo.eventDate,localDateConversionPatterns), dateFormat, timeZone, modificationDate);
        if (isValid(formatedEventDate)) {
          formatFound = true;
          break;
        }
      }

      // if no format is found, and alt date is declared, try to find an alternate date
      if (!formatFound &&  eventInfo.hasOwnProperty('altEventDate')){
        const possibleAltDateFormats = Object.keys(venue.alternateDateFormat).map(page => venue.alternateDateFormat[page]);
        for (const dateFormat of possibleAltDateFormats){
          formatedEventDate = createDate(convertDate(eventInfo.altEventDate,localDateConversionPatterns), dateFormat, timeZone, modificationDate);
          if (isValid(formatedEventDate)) {
            formatFound = true;
            break;
          }
        }
      }

      delete eventInfo.altEventDate;

      if (!formatFound){
        const errorString = '\x1b[31mFormat de date invalide pour '+venue.name+'. Reçu \''+eventInfo.eventDate+'\', converti en \''
            +convertDate(eventInfo.eventDate, localDateConversionPatterns)+'\'. Formats essayés: \x1b[0m'
            +possibleDateFormats.join('\x1b[31m, \x1b[0m');
          
        writeToLog('error',eventInfo, [errorString], true);
      }else{
        // changer 00:00 en 23:59 si besoin
        if (venue.hasOwnProperty('midnightHour')) {
          formatedEventDate = changeMidnightHour(formatedEventDate, venue.midnightHour, eventInfo);
        }
        eventInfo.unixDate = formatedEventDate.getTime();
        eventInfo.eventTime = eventTime(formatedEventDate, timeZone);
      }
  

      // display
      displayEventLog(eventInfo);
      return eventInfo;
    }


    // parsing each event
    try{
      for (let eveIndex = 0; eveIndex < eventBlockList.length; eveIndex++) {

        let eve = eventBlockList[eveIndex];
        let $eventBlock = cheerio.load(eve);
        
        let eventInfo = {'eventPlace':venue.name, 'city':venue.city, 'country':venue.country};

        /*** extract info from main page ***/

        // const altEventInfo = venue.alternateTags.mainpage;
        const altEventInfo = venue.hasOwnProperty('alternateTags') ? venue.alternateTags.mainPage : undefined;
        getInfo(venue.mainPage,$eventBlock,eventInfo, altEventInfo);

        // find if cancelled
        eventInfo.isCancelled = isCancelled($eventBlock.text(),cancellationKeywords[venue.country]);

       
        let eventInfoList = createMultipleEvents(eventInfo);
        

        eventInfoList = eventInfoList.filter(subEventInfo => !isEmptyEvent(subEventInfo));
        // let eventInfoListAfterLinkedPage = []; // this second list is needed in case there are multiple events in the linked page too

        for (const subEventInfo of eventInfoList){
         

           // if no URL tags have been provided, try to find an URL in the delimiter tag
          if (!subEventInfo.hasOwnProperty('eventURL') && hrefInDelimiterList[eveIndex]){
            subEventInfo.eventURL = hrefInDelimiterList[eveIndex];
          }


          // format URL
          if (subEventInfo.hasOwnProperty('eventURL')){
            subEventInfo.eventURL = makeURL(venue.baseURL,subEventInfo.eventURL);
          }

          // scrap info from linked page
          if (linkedFileContent && subEventInfo.hasOwnProperty('eventURL')){
            if (linkedFileContent.hasOwnProperty(subEventInfo.eventURL)){
              try{
                // console.log('file content',subEventInfo.eventURL,linkedFileContent[subEventInfo.eventURL]);
                const $linkedBlock = cheerio.load(linkedFileContent[subEventInfo.eventURL]);
                // add info from linked page to the sub event. If subEventInfo has no information for key, create a nes entry
                const altLinkedPageInfo = venue.hasOwnProperty('alternateTags') ? venue.alternateTags.linkedPage : undefined;
   
                getInfo(venue.linkedPage, $linkedBlock, subEventInfo, true, altLinkedPageInfo);
                
                // look for cancellation keywords. Leave commented since it appears that linkedpages do not contain appropriate information about cancellation 
                // eventInfo.iscancelled = eventInfo.iscancelled || isCancelled($linkedBlock.text(),cancellationKeywords[venue.country]);
                if (useAI){
                  subEventInfo.chatStyleComment = await getStyleInfo($linkedBlock.html());
                  subEventInfo.chatStyle = extractStyle(subEventInfo.chatStyleComment);
                }
                // tests if there are sub events in the linked page, and return sub events if they exist
                createMultipleEvents(subEventInfo).forEach(el => {
                  eventList.push(postProcess(el));
                });
              }catch(err){
                writeToLog('error',eventInfo,['\x1b[31mImpossible de lire la page liée pour l\'événement \'%s\'. Erreur lors du téléchargement ?\x1b[0m'+err, subEventInfo.eventName],true);
                eventList.push(postProcess(subEventInfo));
              }
            }else{
              writeToLog('error',eventInfo,['\x1b[31mLa page liée pour l\'événement \'%s\' n\'a pas été téléchargée. Relancer aspiratorex.\x1b[0m', subEventInfo.eventName],false);
              eventList.push(postProcess(subEventInfo));
            }
            
          }else{
            eventList.push(postProcess(subEventInfo));
          }
          

        };

      }; 
      
    }catch(error){
      console.log("Unknown error while processing "+venue.name,error);
      // throw error;
    }
    return eventList;
  }
}
  


//********************************************/
//***            aux functions             ***/
//********************************************/



async function extractEvents(fileContent, venue){
  let eventBlockList = [];
  let hrefInDelimiterList = [];
  const $ = cheerio.load(parseDocument(fileContent));
  try{
    const elements = $(venue.eventsDelimiterTag); 
    eventBlockList = elements.map((_, element) => $(element).html()).get();
    hrefInDelimiterList = elements.map((_, element) => $(element).attr('href') || null).get();
    // $(venue.eventsDelimiterTag).each((index, element) => {
    //   let ev = $(element).html();
    //   eventBlockList.push(ev);
    //   hrefInDelimiterList.push($(venue.eventsDelimiterTag+':eq('+index+')').attr('href'));
    // });
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
    if (!['eventName', 'eventDate', 'eventURL', 'unixDate', 'eventDummy', 'source','city','country','isCancelled','chatStyleComment'].includes(key)
        && eventInfo[key.replace('Tags','')] !== ''){
          const string = key === 'errorLog' ? '\x1b[31m'+eventInfo[key.replace('Tags','')]+'\x1b[0m':eventInfo[key.replace('Tags','')];
          // console.log(key.replace('event','')+': %s',eventInfo[key.replace('Tags','')]);
          console.log(key.replace('event','')+': '+string);
        }
  });
  if (eventInfo.eventURL){
    console.log((eventInfo.eventURL)+'\n');
  }else{
    console.log('(No URL defined.)\n');
  }
  
}

function  displayEventFullDetails(eventInfo){
  let string = 'Date: '+eventInfo.eventDate+'\n';
  string = string+'Event: '+eventInfo.eventName+'\n';
  Object.keys(eventInfo).forEach(key => {
    if (!['eventName', 'eventDate', 'eventURL'].includes(key)){
      if(key === 'source'){
        // string = string + 'source: '+JSON.stringify(eventInfo.source);
        string = string + 'source: '+ eventInfo.source.name + ' (' +eventInfo.source.city
                        + ', ' + eventInfo.source.country + ')\n';
      }else{
        string = string+(key.replace('event','')+': '+eventInfo[key.replace('Tags','')])+'\n';         
      }
    }
  });
  string = string +eventInfo.eventURL+'\n\n';
  return string;
}


function isEmptyEvent(eventInfo){
  return eventInfo.eventName === '' && (eventInfo.eventURL === '' || eventInfo.eventURL == undefined) && eventInfo.eventDate === '';
}


// separate sub events and return a list of each sub event.
// if the event does not have sub events, it returns a list with one element containing itself

function createMultipleEvents(eventInfo){

  // test if sub events are present
  if (eventInfo.hasOwnProperty('subEvents')){
    const eventList = [];
    // create a new event for each sub event
    eventInfo.subEvents.forEach(subEventInfo => {
      const subEvent = {...eventInfo};
      Object.keys(subEventInfo).forEach(field => {
        // add a new field to the subevent if it does not exist. If field is URL, erase the exisiting URL field (there can be only one URL value)
        if (!subEvent.hasOwnProperty(field) || field.includes('URL') || field.includes('Place')){
          subEvent[field] = subEventInfo[field];
        }else{
          subEvent[field] = subEvent[field] + ' ' + subEventInfo[field];
        } 
      });
      delete subEvent.subEvents;
      eventList.push(subEvent);
    });
    return eventList;
  }else{
    return [eventInfo];
  }


  // if (eventInfo.hasOwnProperty('eventMultiDate')){
  //   if (eventInfo.eventMultiDate.length >0){
  //   const res = [];
  //   eventInfo.eventMultiDate.forEach(el =>{
  //     const ei = {...eventInfo};
  //     ei.eventDate = el;
  //     delete ei.eventMultiDate;
  //     res.push(ei);
  //   });
  //   return res;
  //   }else{
  //     delete eventInfo.eventMultiDate;
  //     return [eventInfo];
  //   }
  // }else{
  //   return checkMultiDates(eventInfo);
  // }
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
    // console.log('Applying regex', key);
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


async function testLlamaServer(useAI){
  if (!useAI){
    return;
  }
  const res = await isOllamaActive();
  if (res){
    console.log('\n\n\x1b[36m***** Llama server active, using model \x1b[0m'+getCurrentLlamaModel()+'\x1b[36m. *****\x1b[0m\n\n');
  }else{
    console.log('\x1b[31mError: Llama server not active.\x1b[0m');
  }
  
}
