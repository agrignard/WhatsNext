/**********************************************************/
/*    utilities used in analex                            */
/**********************************************************/

//const path = require('path');
//const fs = require('fs');
const {removeDoubles, removeBlanks, convertToLowerCase, makeURL, simplify} = require('./stringUtilities.js');
//const {loadLinkedPages, fetchWithRetry, fetchLink} = require('./fileUtilities.js');
const {unique, isValidEvent, getLanguages, fromLanguages, saveToVenuesJSON} = require('./jsonUtilities.js');
const {numberOfInvalidDates, getCommonDateFormats, createDate, convertDate} = require('./dateUtilities.js');
const {loadLinkedPages, getFilesContent} = require('./fileUtilities.js');
const {getDateConversionPatterns} = require('./dateUtilities.js');

const cheerio = require('cheerio');
const {parseDocument} =require('htmlparser2');


module.exports = {getTagLocalization, tagContainsAllStrings, getTagContainingAllStrings, getMyIndex, 
    splitAndLowerCase, addJSONBlock, reduceTag, getAllDates, getBestDateFormat, adjustMainTag, 
    regroupTags, countNonEmptyEvents, getMostUsedTagClassSets, analyze};




// main function


function analyze(venueJSON, eventStrings, sourcePath, venuesListJSON, verbose = true){
    const originalLog = console.log; 
    if (!verbose){
        console.log = function() {};
    }
    console.log('\n\n\x1b[36m%s\x1b[0m', `******* Analyzing venue: ${venueJSON.name}  *******`);

    sourcePath += venueJSON.country+'/'+venueJSON.city+'/'+venueJSON.name+'/';


    // load main pages
    const fileContent = getFilesContent(sourcePath);


    // load date conversion pattern
    const languages = getLanguages();
    const dateConversionPatterns = fromLanguages(getDateConversionPatterns(),languages[venueJSON.country]);

    let linkedFileContent;
    // load linked page
    if (eventStrings.linkedPage && fs.existsSync(sourcePath+'linkedPages.json')){
        linkedFileContent = loadLinkedPages(sourcePath);
    }

    // aborting process if mandatory strings are not present (safeguard)
    if (!eventStrings.mainPage.hasOwnProperty('eventNameStrings' || eventStrings.mainPage.eventNameStrings.length === 0)){
        console.log('\x1b[31mProperty \'eventNameStrings\' is missing in variable eventStrings. Aborting.\x1b[0m\n');
        throw new Error('Aborting.')
    }
    if (!eventStrings.mainPage.hasOwnProperty('eventDateStrings') || eventStrings.mainPage.eventDateStrings.length === 0){
        console.log('\x1b[31mProperty \'eventDateStrings\' is missing in variable eventStrings. Aborting.\x1b[0m\n');
        throw new Error('Aborting.')
    }

    
    

    //convert to lower case to allow case insensitive string match
    eventStrings = splitAndLowerCase(eventStrings);
    const parsedHtml = parseDocument(convertToLowerCase(fileContent));
    const $ = cheerio.load(parsedHtml);
    
    let stringsToFind = [].concat(...Object.values(eventStrings.mainPage));
    console.log(stringsToFind);
    const tagsContainingStrings = getTagContainingAllStrings($,stringsToFind);

    //Affichez les noms des balises trouvées
    if (tagsContainingStrings.length === 0){
        console.log('\x1b[31mCan\'t find a tag that delimits the events, aborting process. Is event too old ? (event date: \x1b[0m%s\x1b[31m)\x1b[0m',
            eventStrings.mainPage.eventDateStrings.join());
    }else{
        console.log();

        let mainTag = tagsContainingStrings.last();
        let $eventBlock = cheerio.load($(mainTag).html());
        let hrefs = $eventBlock('a[href]');

        // extend the tag if it does not include any URL link
        if (!eventStrings.noUrl){
            try{
                let mainTagWithURL;        
                [mainTagWithURL, hrefs] = getTagWithURL(mainTag,$eventBlock,stringsToFind);
                let $eventBlockURL = cheerio.load($(mainTagWithURL).html());
                if (hrefs.length > 0){
                    mainTag = mainTagWithURL;
                    $eventBlock = $eventBlockURL;
                } else{
                    console.log("\x1b[33mWarning, no URL found. Keeping the most inner block.\x1b[0m.");
                }   
            }catch(err){
                console.log("\x1b[31mError while trying to find embedded URL recursively. Aborting URL search. Put field \"noUrl\":true to prevent looking for a link url. %s\x1b[0m",err)
            }
        }
        // adding levels to the main tag
        if (venueJSON.hasOwnProperty('delimiterAddLevels')){
            console.log('\x1b[36mAdding '+venueJSON.delimiterAddLevels+' parent levels to the delimiter tag.\x1b[0m');
            for(let i=0;i<venueJSON.delimiterAddLevels;i++){
                mainTag = $eventBlock(mainTag).parent();
                $eventBlock = cheerio.load(mainTag.html());
                hrefs = $eventBlock('a[href]');
            }
        }

        const mainTagString = '<'+mainTag.prop('tagName')
            +" class="+$(mainTag).attr('class')+(mainTag.hasOwnProperty('id')?$(mainTag).attr('id'):'')+'>';
        console.log('Found %s tags. Best tag \x1b[90m%s\x1b[0m contains: \x1b[32m%s\x1b[0m\n', 
            tagsContainingStrings.length,mainTagString,removeImageTag(removeBlanks($(mainTag).text())));

            
        venueJSON.eventsDelimiterTag=getTagLocalization(mainTag,$,true,stringsToFind);
            console.log('\n\n*****************\n\n');
            console.log(venueJSON.eventsDelimiterTag);
            console.log('\n\n*****************\n\n');
        //***************************************************************/
        //***************************************************************/

        console.log('*** main page tags ***');

        // find and display tag for each string to find
        venueJSON.mainPage = addJSONBlock(eventStrings.mainPage,$eventBlock);


        // logs depending on if URLs have been found.
        console.log();
        if (!eventStrings.noUrl){
            venueJSON.eventURLIndex = getURLIndex(venueJSON,hrefs.length,$(mainTag));
            if (venueJSON.mainPage.hasOwnProperty('eventURLTags')){// tags are used to find the url to the event page
                console.log('URL found using tags: %s',$eventBlock(venueJSON.mainPage.eventURLTags[0]).attr('href'));
            }else{// automatic search for the tag
                if (hrefs.length === 1) {
                    console.log('URL found:',$eventBlock(hrefs[0]).attr('href'));
                } else if (hrefs.length > 1){
                    console.log('Found %s URLs. Change index in JSON \"eventURLIndex\" to the most suitable one (current index: %s).', hrefs.length, venueJSON.eventURLIndex);
                    hrefs.each((index, element) => {
                        const href = $eventBlock(element).attr('href');
                        console.log('\x1b[90mURL (index\x1b[0m',index+1,'\x1b[90m):\x1b[0m', href);//index+1 car 0 est réservé au maintTag de type <a=href>
                    });   
                } else {
                    console.log('\x1b[31mNo url link found.\x1b[0m');
                }
            }
        }else{
            venueJSON.eventURLIndex = -1;
        }


        // find most appropriate date format

        let dates = getAllDates(venueJSON.eventsDelimiterTag,venueJSON.mainPage['eventDateTags'],$);
        [venueJSON.dateFormat, _] = getBestDateFormat(dates, dateConversionPatterns);
        
        // find strings in linked pages

        if (eventStrings.hasOwnProperty('linkedPage')){
            if (linkedFileContent){
                let linkURL;
                if (venueJSON.mainPage.hasOwnProperty('eventURLTags')){// URL found with tags
                    linkURL = makeURL(venueJSON.baseURL,$eventBlock(venueJSON.mainPage.eventURLTags[0]).attr('href'));
                }else{// automatic URL
                    let i = ($(mainTag).prop('tagName')=='A')?venueJSON.eventURLIndex:(venueJSON.eventURLIndex-1);
                    linkURL = makeURL(venueJSON.baseURL,$eventBlock(hrefs[i]).attr('href'));
                }
                console.log('link ',linkURL);
                let linkedPage = linkedFileContent[linkURL];
                if (linkedPage){
                    console.log('\n*** linked page tags ***');
                    const parsedLinkedPage = parseDocument(convertToLowerCase('<html><head></head>'+linkedPage+'</html>'));
                    const $linked = cheerio.load(parsedLinkedPage);
                //    console.log($linked.html());
                    if (venueJSON.hasOwnProperty('linkedPage') && venueJSON.linkedPage.hasOwnProperty('eventMultiDateTags')){
                        const multiDate = venueJSON.linkedPage.eventMultiDateTags; // do not erase multidate tag
                        venueJSON.linkedPage = addJSONBlock(eventStrings.linkedPage,$linked);
                        venueJSON.linkedPage.eventMultiDateTags = multiDate;
                    }else{
                        venueJSON.linkedPage = addJSONBlock(eventStrings.linkedPage,$linked);
                    }
                    if (venueJSON.linkedPage.hasOwnProperty('eventDateTags')){
                        let dates = getAllDates("BODY",venueJSON.linkedPage['eventDateTags'],$linked);
                        [venueJSON.linkedPageDateFormat,_] = getBestDateFormat(dates, dateConversionPatterns);    
                    }
                }else{
                    console.log('\x1b[31mError getting data from linked pages. Run again \x1b[0maspiratorex.js\x1b[31m ?.\x1b[0m\n');
                }
            }else{
                venueJSON.linkedPage ={};// create an entry in venues.json to tell aspiratorex to get linked pages
                console.log('\x1b[31m\nLinked pages have not been downloaded yet. Run again \x1b[0maspiratorex.js\x1b[31m to get them.\x1b[0m\n');
            }
        }

        // saving to venues JSON and test file

        console.log("\n",venueJSON);
        console.log("\n");

        saveToVenuesJSON(venuesListJSON);
        console.log = originalLog;
    }
}

// auxiliary functions

function getMostUsedTagClassSets($, topN = 10) {
    // const $ = cheerio.load(html);
    const occurrences = new Map();

    // Parcourir toutes les balises du document
    $('*').each((_, elem) => {
        const tag = elem.tagName;
        const classes = $(elem).attr('class');

        if (classes) {
            const classSet = classes.split(/\s+/).sort().join(' '); // Trie les classes pour éviter les doublons
            const key = `${tag} ${classSet}`;

            occurrences.set(key, (occurrences.get(key) || 0) + 1);
        }
    });

    // Trier par fréquence d'apparition (du plus utilisé au moins utilisé)
    const sortedOccurrences = [...occurrences.entries()].sort((a, b) => b[1] - a[1]);

    // Retourner les `topN` ensembles les plus utilisés
    return sortedOccurrences.slice(0, topN);
}


// if several tags only differ by the equation number, the equation number is removed

function regroupTags(tagList, isTest = false){
    tagList = tagList.filter(el => el !== undefined);
    if (tagList.length < 2){
        return tagList;
    }
    let regex = /(.*)(:eq\(\d+\))(?!.*:eq\(\d+\))/;
    let toProcess = tagList.slice(); // make a copy of the array tagList
    const res = [];
    while(toProcess.length >0){
        const tag = toProcess.pop();
        const shortTag = tag.replace(regex,(match, p1, p2, p3) => p1); // compute a tag without eq(XX)
        const oldLength = toProcess.length;
        toProcess= toProcess.filter(el => el.replace(regex,(match, p1, p2, p3) => p1) !== shortTag); // filter the tags that would have the same tag
        if (toProcess.length < oldLength){
            res.push(shortTag);
        }else{
            res.push(tag);
        }
    }
    return res.reverse();
}

function adjustMainTag(delimiterTag,$,venue, currentEventNumber){
    delimiterTag = delimiterTag.replace(/\s*$/,'');
    // console.log(delimiterTag);
    const mainTagEventsNumber = currentEventNumber?currentEventNumber:countNonEmptyEvents(delimiterTag,$,venue);//$(delimiterTag).length;
    let currentNumber = mainTagEventsNumber;
    // console.log('start number', currentNumber, delimiterTag);
    let bestTag = delimiterTag;
    const splitTag = delimiterTag.split('\>');
    // console.log('split',splitTag);
    for (let i=0;i<splitTag.length;i++){
        const startList = splitTag.slice(0,i);
        const endList = splitTag.slice(i+1);
        const currentTag = splitTag[i].split('.');
        if (currentTag.length>2){// only if more than one class exist
            for(let j=1;j<currentTag.length;j++){
                const startInnerList = currentTag.slice(0,j);
                const endInnerList = currentTag.slice(j+1);
                let newTag = [startList.join('\>'),
                               startInnerList.join('.')+((j===currentTag.length-1)?'':'.')+endInnerList.join('.'),
                                endList.join('\>')].filter(el => el !='').join('\>').trim();
                // newTag = newTag.replace(/\s*$/,'');
                const newNumber = countNonEmptyEvents(newTag,$,venue);//$(newTag).length;
                // console.log('newTag',newNumber, newTag);
                if (newNumber > currentNumber){
                    currentNumber = newNumber;
                    bestTag = newTag;//.replace(/\s*$/,'');
                }
            }
            // console.log('result',currentNumber,bestTag);
            if (currentNumber > mainTagEventsNumber){
                return adjustMainTag(bestTag,$,venue, currentNumber);
            }
        }
    }
    return [bestTag.trim(), currentNumber];
}



function countNonEmptyEvents(delimiterTag,$,venue){
    // console.log('deli', venue.mainPage.eventNameTags);
    if (delimiterTag === undefined){
        return 0;
    }
    let eventList = [];
    $(delimiterTag).each((index, element) => {
        const event = {};
        const $eventBlock = cheerio.load($(element).html());
        if (venue.mainPage.hasOwnProperty('eventNameTags')){
            const tagList = venue.mainPage.eventNameTags;
            event.eventName = tagList.map(tag =>{
                // console.log('tag:',tag,$eventBlock(tag).text());
                return tag ===''?$eventBlock.text():$eventBlock(tag).text();
            }).join(' ');
        }
        if (venue.mainPage.hasOwnProperty('eventDateTags')){
            const tagList = venue.mainPage.eventDateTags;
            event.eventDate = tagList.map(tag =>{
                return tag ===''?$eventBlock.text():$eventBlock(tag).text();
            }).join(' ');
        }
        if (isValidEvent(event,venue)){
            eventList.push(event);
        }
    });
    // console.log('kff',eventList.length);
    return unique(eventList).length;
}


// get the list of dates in all the events. If several date tags are found for one event, the results are concatenated
function getAllDates(mainTag,dateTags,source){
    let events = [];
    let dates = [];
    if (!dateTags){
        return dates;
    }
    source(mainTag).each((index, element) => {
        let ev = source(element).html();
        events.push(ev);
    });
    try{
        events.forEach(event =>{
            const $eve = cheerio.load(event);
            let string = "";
            for (let i = 0; i <= dateTags.length-1; i++) {
                let ev = $eve(dateTags[i]).text();                
                string += ev+' ';
            }
            dates.push(string);
        });

    }catch(err){
        console.log('\x1b[31m%s\x1b[0m%s', 'Error extracting the dates:',err);
    }
    return dates;
}




function getBestDateFormat(dates, dateConversionPatterns){
    let bestDateFormat;// = "";
    dates = dates.map(el => convertDate(el,dateConversionPatterns));
    let bestScore = dates.length + 1;
    //  numberOfInvalidDates(dates.map(element => createDate(element,bestDateFormat,'Europe/Paris')));
    const dateFormatList = getCommonDateFormats();

    dateFormatList.forEach(format => {
        const formattedDateList = dates.map(element => createDate(element,format));
       
        if (format === 'dd-MM-HH:mm'){
            // console.log(format, numberOfInvalidDates(formattedDateList));
            const truc = dates.map(element => createDate(element,format,'Europe/Paris'));
        }
        
        if (numberOfInvalidDates(formattedDateList) < bestScore){
            bestDateFormat = format;
            bestScore = numberOfInvalidDates(formattedDateList);
        }
    });
    console.log("\nFound %s events. Best date format: \x1b[36m\"%s\"\x1b[0m (%s/%s invalid dates)",dates.length,bestDateFormat,bestScore,dates.length);
    return [bestDateFormat, bestScore];
}


function addJSONBlock(scrapSource,source, showLog){
    let res =  {};
    Object.keys(scrapSource).filter(element => scrapSource[element].length > 0)
        .forEach(key =>{
            const keyTag = key.replace(/String/,'Tag');
            // if (scrapSource[key].length>0 && !(scrapSource[key].length === 1 && scrapSource[key][0] !== '')){
            res[keyTag] = getTagsForKey(scrapSource,key,source, showLog);
            if (key.startsWith('eventMulti')){//replaces the last occurence of :eq(x)
                // res[keyTag] = res[keyTag].map(el=>el.replace(/:eq\(\d+\)(?!.*:eq\(\d+\))/,''));//remove the last references to :eq(x) if multitag
                res[keyTag] = res[keyTag].map(el=>el.replace(/:eq\(\d+\)/g,''));//remove references to :eq(x) if multitag
            }
            // }
        });
    // remove doubles 
    Object.keys(res).forEach(key => {res[key] = removeDoubles(res[key]);});
    return res;
}

function getTagsForKey(object,key,cheerioSource, showLog){
    const string = key.match(/event([^]*)String/);
    const tagStrings = object[key].filter(el => el !== '');
    const tagList = tagStrings.map(string2 => findTag(cheerioSource,string2));
    if (string[1] === 'Date'){
        const truc = getTagLocalization(cheerioSource(tagList[0]),cheerioSource,false);
        // console.log(tagStrings[0],truc);
    }
    // const truc = reduceTag(getTagLocalization(cheerioSource(tagList[0]),cheerioSource,false),cheerioSource);
    // console.log(tagStrings[0],truc);
    // console.log(cheerioSource(truc).text());
    if(showLog === undefined || showLog === true){
        console.log('\n\x1b[36mEvent '+string[1]+' tags:\x1b[0m');
        showTagsDetails(tagList,cheerioSource,object[key]);
    }
    return tagList.map((tag,ind) => reduceTag(getTagLocalization(cheerioSource(tag),cheerioSource,false),cheerioSource));
 }

 function showTagsDetails(tagList,source,stringsToFind){
    tagList.forEach((element,i) => {
        if (element == null){
            console.log('\x1b[31mNo Tag Found matching string \x1b[0m\'%s\'\x1b[31m.\x1b[0m', stringsToFind[i]);
        }else{
            console.log('\x1b[90mTag: <%s class=%s> (index %s): \x1b[0m%s', 
            element.tagName,source(element).attr('class'),
            getMyIndex(element,source,[stringsToFind[i]]),removeBlanks(source(element).text()));
        }
    });
}

function findTag(html,string) {
    // console.log('ess',string);
    // console.log(html.html());
    //  const tag = html(`*:contains('${string}')`).last();
    const string2 = string.replace('(','\\(').replace(')','\\)');
    const candidates = html(`*:contains('${string2}')`);
    // console.log('rzg',candidates.length);
    if (candidates.length === 0){
    // console.log('\x1b[31mNo Tag Found matching string \x1b[0m\'%s\'\x1b[36m.',string);
        return null;
    }
    let i = 0;
    // for(let j=0;j<candidates.length;j++){
    //     console.log(html(candidates[j]).text());
    //     console.log('loc',j,getTagLocalization(candidates[j],html,false,[string]));
    //     console.log(html(candidates[j]).html());
    // }
    while(i<candidates.length-1 && html(candidates[i]).is(html(candidates[i+1]).parent())){
        i++;
    }
    return candidates[i];
 }

 function reduceTag(string,source){// reduce the tag list to keep it compact and avoid errors
    if (string == undefined){
        return undefined;
    }
    const refText = source(string).text();
    // console.log("truc ",string);
    // console.log(string.replace(/:not\(\[class\]\)/g,''));
    // const refText = source(string.replace(/:not\(\[class\]\)/g,'')).text();
    // const stringList = string.replace(/\s*$/,'').split('\>');
    const stringList = string.trim().split('\>');
    // if (testP){
    //     console.log('before reduc',stringList);
    //     console.log('ref',refText);
    // }
    let reducedString = '';//stringList.pop();//why pop and not '' ? I don't remember if there is a reason or if it is a mistake.
    while(stringList.length>0){
        reducedString = stringList.pop()+(reducedString===''?'':('\>'+reducedString));
        const reducedStringClasses = getClasses(reducedString);
        const remainingClasses = getClasses(stringList.join('\>'));
        const noWrapping = reducedStringClasses.some(el =>!remainingClasses.includes(el));// prevent problems if some classes are present several times in the string
        // if (testP){
        // console.log(stringList.length, noWrapping);
        // }
        if (source(reducedString).text() === refText && noWrapping){
            // if (testP){
            //     console.log('afterreduc',reducedString);
            // }
            return reducedString;
        }
    }
    // while(source(reducedString).text() !== refText){
    //     reducedString = stringList.pop()+' '+reducedString;
    //     if (stringList.length<0){
    //         console.log('Error, while loop should have ended before.');
    //         return string;
    //     }
    // }
    // console.log(source(reducedString).text());
    // console.log(reducedString);
    return reducedString;
}


function getClasses(tagText){//return all the classes found in a tag string
    const classList = [];
    tagText.split('\>').forEach(tag =>{
        tag.split('.').forEach((el,index) =>{
            if (index > 0){
                classList.push(el);
            }
        });
    });
    return classList;
}











function getTagContainingAllStrings($,stringsToFind){
    // return $('*:contains("' + stringsToFind.join('"):contains("') + '")');

    const stringsToFind2 = stringsToFind.map(el => el.replace('(','\\(').replace(')','\\)'));
    // console.log('*:contains("' + stringsToFind.join('"), :contains("') + '")');
    // pose un pb si un texte contient une parenthèse ouvrante mais pas de parenthèse fermante
    return $('*:contains("' + stringsToFind2.join('"), :contains("') + '")')
    .filter((_, tag) => {
        return tagContainsAllStrings($(tag), stringsToFind)
    });
}

function tagContainsAllStrings(tag, strings) {
    const tagContent = tag.text();//.toLowerCase(); // Convertir en minuscules
    return strings.every(string => tagContent.includes(string)); // Comparaison insensible à la casse
}

function getTagLocalization(tag,$page,isDelimiter){

  let path = '';
  let currentElement = tag;

  while (currentElement.length) {
      let name = currentElement.get(0).name;
      let className = currentElement.attr('class');
      let index;  
      if (className){
        className = className.trim();//prevent problem when classes ends with ' '
        const classList = className.split(' ');
        let childrenWithClass = currentElement.parent().children(name);
        childrenWithClass = childrenWithClass.filter((_,element)=>{
          const elClass = $page(element).attr('class');
          return elClass && !classList.some(cl => !elClass.includes(cl));
        });
        index = childrenWithClass.index(currentElement) + 1;
      }else{
        const childrenWithoutClass = currentElement.parent().children(`${name}`).filter(function() {
            return !$page(this).attr('class');
        });
        index = childrenWithoutClass.index(currentElement) + 1;
        if (name==='span'){
            console.log('span ',childrenWithoutClass.length);
        }
      }
    // console.log('elem: ',name,className, index);  

    let node = name;
    if (className) {
        node += `.${className.replace(/\s+/g, '.')}`;
    }else{
        node += ':not([class])';
      }
    if (index && !isDelimiter) {
        node += `:eq(${index - 1})`;
    }

    path = node + (path ? '>' + path : '');
    currentElement = currentElement.parent();
  }
  return path;
}


// function getTagLocalization(tag,source,isDelimiter,stringsToFind){ 
//     stringsToFind = stringsToFind.filter(el => el !== '');
//     if (tag == null){
//         return null;
//     }
//     if (source(tag).prop('tagName') == undefined){
//         return '';
//     }
//     try{
//        //console.log(source.html());
//         if (source(tag).prop('tagName')=='BODY' ||source(tag).prop('tagName')=='HEAD'){// if we are already at top level... may happen ?
//             return source(tag).prop('tagName');
//         }
//         let tagClass = '';
//         let string;
//         if (source(tag).attr('class')){
//             tagClass = '.'+source(tag).attr('class');//.split(' ')[0];
//             tagClass = tagClass.replace(/[ ]*$/g,'').replace(/[ ]{1,}/g,'.');
//         }
//         // if (isDelimiter){
//         //     return source(tag).prop('tagName')+tagClass;
//         // }
//         if (source(tag).parent().prop('tagName')=='BODY' || source(tag).parent().prop('tagName')== undefined){    
//             string = '';
//         }else{
//             string = getTagLocalization(source(tag).parent(),source,isDelimiter,stringsToFind);
//         }
//         string += (string ==='')?'':'>';
//         string += source(tag).prop('tagName');
//         string += tagClass;
//         if (!isDelimiter){
//             const index =  getMyIndex(tag,source,stringsToFind);
//             string +=  ':eq('+index+')';
//         }
//         return string;
//     }catch(err){
//       console.log("\x1b[31mErreur de localisation de la balise: %s\x1b[0m: %s",source(tag).prop('tagName'),err);
//       throw err;
//     }
// }


function getMyIndex(tag,source,stringsToFind){// get the index of the tag div.class among the same type and same class
    // console.log(stringsToFind);
    let indexation = source(tag).prop('tagName');
    let tagIndex;
    if (source(tag).attr('class')){
        indexation += '.'+source(tag).attr('class').replace(/[ ]*$/g,'').replace(/[ ]{1,}/g,'.');//.split(' ')[0];
    }
    const parentTag = source(tag).parent();
    // if (parentTag.prop('tagName')=='BODY'){// top level, no parent to find index from
    if (parentTag.prop('tagName') === undefined || parentTag.prop('tagName')=='BODY'){// top level, no parent to find index from
        tagIndex =  source(tag).index(indexation);
    }else{
        const $parentHtml = cheerio.load(parentTag.html());
        const stringsToFind2 = stringsToFind.map(el => el.replace('(','\\(').replace(')','\\)'));
        const str = ':contains("' + stringsToFind2.join('"):contains("') + '")';
        const tagsFromParent =  $parentHtml(indexation+str).first();
        tagIndex = $parentHtml(tagsFromParent).index(indexation);
    }
    console.log(tagIndex, stringsToFind);
    return tagIndex;
}

// convert everything to lower case
function splitAndLowerCase(eventStrings){
    try{
        const newES = {...eventStrings};
        for (const key in newES.mainPage){
            if(typeof newES.mainPage[key] === "string"){
                newES.mainPage[key] = newES.mainPage[key].split(/\s+/);
            }
            newES.mainPage[key] = newES.mainPage[key].map(string => string.toLowerCase());
        }
        for (const key in newES.linkedPage){
            if(typeof newES.linkedPage[key] === "string"){
                newES.linkedPage[key] = newES.linkedPage[key].split(/\s+/);
            }
            newES.linkedPage[key] = newES.linkedPage[key].map(string => string.toLowerCase());
        }
        return newES;
    }catch(error){
        console.error('\x1b[31mError while reading the strings to parse: %s\x1b[0m',error);
    }
}






function getTagWithURL(currentTag,$cgp,stringsToFind){
    // displayTag(currentTag,$cgp);
     let hrefs = $cgp('a[href]');
     if ($cgp(currentTag).prop('tagName')=='A'){
         const $cgparent = cheerio.load($cgp(currentTag).parent().html());  
         let tmp = $cgparent('a').filter((_, tag) => tagContainsAllStrings($cgparent(tag), stringsToFind));
         tmp.first().nextAll().remove();
         tmp.first().prevAll().remove(); 
         hrefs = $cgparent('a[href]');
     }
     // while the tag: has a name, has no url or has no class. Take the most inner tag with a class and an URL
     if ($cgp(currentTag).prop('tagName') && (hrefs.length===0 || !$cgp(currentTag).attr('class'))) {
         currentTag = $cgp(currentTag).parent();
         if ($cgp(currentTag).prop('tagName')){
             const gp = currentTag.html();
             $cgp = cheerio.load(gp);
             [currentTag,hrefs] = getTagWithURL(currentTag,$cgp,stringsToFind);
         }
     }
     return [currentTag, hrefs];
 }
 
 
 
 
 
 
  
  
 
 
 function removeImageTag(s){
     const regex = /<img.*?>/g;
     return s.replace(regex,'[***IMAGE***]');
 }
 
 
 
  
 
 
 function getURLIndex(venueJSON,nbHrefs,source){
     let maxIndex = (source.prop('tagName')=='A')?(nbHrefs-1):nbHrefs; // index span is [1,nbHrefs] if main tag is not A, and [0,nbHrefs-1]
     let minIndex = (source.prop('tagName')=='A')?0:1;
     if (nbHrefs == 0){// no url found, returns -1
         return -1;
     }    
     if (nbHrefs == 1
         || !venueJSON.hasOwnProperty('eventURLIndex') 
         || (venueJSON.eventURLIndex > maxIndex)
         || (venueJSON.eventURLIndex < minIndex)){
         // if only one url, or no index set previously, or index is not in the right range, returns default index
         if (source.prop('tagName')=='A'){
             return 0;
         }else{
             return 1;
         }
     }else{//more than one reference, verifies is the index is still valid
         return venueJSON.eventURLIndex; // return previous value of the index
     }   
 }
 