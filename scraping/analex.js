import { createDate, numberOfInvalidDates, getCommonDateFormats, getDateConversionPatterns} from './import/dateUtilities.mjs';
import {removeDoubles, convertToLowerCase, removeBlanks, makeURL} from './import/stringUtilities.mjs';
import {loadLinkedPages} from './import/fileUtilities.mjs';
import {loadVenueScrapInfofromFile, loadVenueJSON, loadVenuesJSONFile, saveToVenuesJSON, 
        getLanguages, checkLanguages, fromLanguages} from './import/jsonUtilities.mjs';

import * as fs from 'fs';
import * as cheerio from 'cheerio';
import {parseDocument} from 'htmlparser2';

var sourcePath = './webSources/';
const languages = getLanguages();

let linkedFileContent, venuesListJSON, venueJSON;// eventStrings;

const venueToAnalyse = filterFromArguments(process.argv);// argument to load default strings to parse
let eventStrings = loadVenueScrapInfofromFile(venueToAnalyse);
let venueName;



// set the venue to analyze
// if (venueToAnalyse){
//     eventStrings = loadVenueScrapInfofromFile(venueToAnalyse);
//     venueName = venueToAnalyse;
// }

console.log('\n\n\x1b[36m%s\x1b[0m', `******* Analyzing venue: ${venueName}  *******`);
Object.keys(eventStrings.mainPage)
.forEach(key =>{
    if(typeof eventStrings.mainPage[key] === "string"){
        eventStrings.mainPage[key] = eventStrings.mainPage[key].split(/\s+/);
    }
});

if (eventStrings.hasOwnProperty('linkedPage')){
    Object.keys(eventStrings.linkedPage)
    .forEach(key =>{
        if(typeof eventStrings.linkedPage[key] === "string"){
            eventStrings.linkedPage[key] = eventStrings.linkedPage[key].split(/\s+/);
        }
    });
}

// load JSON data for the venue
venuesListJSON = loadVenuesJSONFile();
venueJSON =  loadVenueJSON(venueName,venuesListJSON);
sourcePath += venueJSON.country+'/'+venueJSON.city+'/'+venueName+'/';
const fileName = venueName+(venueJSON.hasOwnProperty('multiPages')?'0':'')+'.html';

let inputFileList;
try {
    inputFileList = fs.readdirSync(sourcePath)
      .filter(fileName => fileName.endsWith('.html'))
      .map(el => sourcePath+el);
} catch (err) {
    console.error('\x1b[31mError reading html files in directory \'%s\'.\x1b[0m Error: %s',sourcePath, err);
}
function readBodyContent(file) {
    const content = fs.readFileSync(file, 'utf-8');
    const $ = cheerio.load(content);
    return $('body').html();
}

// load main pages
const fileContent = inputFileList.map(readBodyContent).join('\n');


// load date conversion pattern
const dateConversionPatterns = fromLanguages(getDateConversionPatterns(),languages[venueJSON.country]);
console.log(dateConversionPatterns);
//const dateConversionPatterns = getDateConversionPatterns()[];



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

// convert everything to lower case
try{
    for (const key in eventStrings.mainPage){
        eventStrings.mainPage[key] = eventStrings.mainPage[key].map(string => string.toLowerCase());
    }
    for (const key in eventStrings.linkedPage){
        eventStrings.linkedPage[key] = eventStrings.linkedPage[key].map(string => string.toLowerCase());
    }
    
}catch(error){
    console.error('\x1b[31mError while reading the strings to parse: %s\x1b[0m',error);
}
//const parsedHtml = parseDocument(convertToLowerCase(fileContent));
const parsedHtml = parseDocument(convertToLowerCase(fileContent));
const $ = cheerio.load(parsedHtml);

let stringsToFind = [].concat(...Object.values(eventStrings.mainPage));

const tagsContainingStrings = $('*:contains("' + stringsToFind.join('"), :contains("') + '")')
.filter((_, tag) => tagContainsAllStrings($(tag), stringsToFind));


//Affichez les noms des balises trouvées
if (tagsContainingStrings.length === 0){
    console.log('\x1b[31mCan\'t find a tag that delimits the events, aborting process. Is event too old ? (event date: \x1b[0m%s\x1b[31m)\x1b[0m',
        eventStrings.mainPage.eventDateStrings.join());
}else{
    // find a tag containing all the strings
    for (let i = 0; i <= tagsContainingStrings.length-1; i++){
        let t = $(tagsContainingStrings[i]);
        let str = t.prop('tagName');
        if (t.attr('class')){
            str += ' class='+t.attr('class');
        }
    }
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

    
    //***************************************************************/
    //***************************************************************/

    console.log('*** main page tags ***');

    // find and display tag for each string to find
    venueJSON.scrap = addJSONBlock(eventStrings.mainPage,$eventBlock);
    
    // logs depending on if URLs have been found.
    console.log();
    if (!eventStrings.noUrl){
        venueJSON.eventURLIndex = getURLIndex(venueJSON,hrefs.length,$(mainTag));
        if (venueJSON.scrap.hasOwnProperty('eventURLTags')){// tags are used to find the url to the event page
            console.log('URL found using tags: %s',$eventBlock(venueJSON.scrap.eventURLTags[0]).attr('href'));
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

    let dates = getAllDates(venueJSON.eventsDelimiterTag,venueJSON.scrap['eventDateTags'],$);
    venueJSON.dateFormat = getBestDateFormat(dates,venueJSON, dateConversionPatterns);
    
    // find strings in linked pages

    if (eventStrings.hasOwnProperty('linkedPage')){
        if (linkedFileContent){
            let linkURL;
            if (venueJSON.scrap.hasOwnProperty('eventURLTags')){// URL found with tags
                linkURL = makeURL(venueJSON.baseURL,$eventBlock(venueJSON.scrap.eventURLTags[0]).attr('href'));
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
                    venueJSON.linkedPageDateFormat = getBestDateFormat(dates,venueJSON.linkedPage, dateConversionPatterns);    
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
    
}

console.log("\n\n");
checkLanguages([venueJSON]);











//************************************************/
//               Auxiliary functions             //
//************************************************/

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

function reduceTag(string,source){// reduce the tag list to keep it compact and avoid errors
    if (string == undefined){
        return undefined;
    }
    const refText = source(string).text();
    const stringList = string.split(' ');
    let reducedString = stringList.pop();
    while(source(reducedString).text() !== refText){
        reducedString = stringList.pop()+' '+reducedString;
        if (stringList.length<0){
            console.log('Error, while loop should have ended before.');
            break;
        }
    }
    // console.log(source(reducedString).text());
    // console.log(reducedString);
    return reducedString;
}

function getTagLocalization(tag,source,isDelimiter,stringsToFind){
    if (tag == null){
        return null;
    }
    try{
       //console.log(source.html());
        if (source(tag).prop('tagName')=='BODY' ||source(tag).prop('tagName')=='HEAD'){// if we are already at top level... may happen ?
            return '';
        }
        let tagClass = '';
        let string;
        if (source(tag).attr('class')){
            tagClass = '.'+source(tag).attr('class');//.split(' ')[0];
            tagClass = tagClass.replace(/[ ]*$/g,'').replace(/[ ]{1,}/g,'.');
        }
        if (isDelimiter){
            return source(tag).prop('tagName')+tagClass;
        }
        if (source(tag).parent().prop('tagName')=='BODY'){    
            string = '';
        }else{
            string = getTagLocalization(source(tag).parent(),source,false,stringsToFind)+' ';
        }
        string += ' '+source(tag).prop('tagName');
        string += tagClass;
        const index =  getMyIndex(tag,source,stringsToFind);
        //console.log(source(tag).prop('tagName'),tagClass,index,'\n');
        string +=  ':eq('+index+')';
        return string;
    }catch(err){
      console.log("\x1b[31mErreur de localisation de la balise: %s\x1b[0m: %s",source(tag).prop('tagName'),err);
      throw err;
    }
}


function getMyIndex(tag,source,stringsToFind){// get the index of the tag div.class among the same type and same class
    let indexation = source(tag).prop('tagName');
    let tagIndex;
    if (source(tag).attr('class')){
        indexation += '.'+source(tag).attr('class').replace(/[ ]*$/g,'').replace(/[ ]{1,}/g,'.');//.split(' ')[0];
    }
    const parentTag = source(tag).parent();
    if (parentTag.prop('tagName')=='BODY'){// top level, no parent to find index from
        tagIndex =  source(tag).index(indexation);
    }else{
        const $parentHtml = cheerio.load(parentTag.html());
        const str = ':contains("' + stringsToFind.join('"), :contains("') + '")';
        const tagsFromParent =  $parentHtml(indexation+str).first();
        tagIndex = $parentHtml(tagsFromParent).index(indexation);
    }
    return tagIndex;
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


function tagContainsAllStrings(tag, strings) {
    const tagContent = tag.text();//.toLowerCase(); // Convertir en minuscules
    return strings.every(string => tagContent.includes(string)); // Comparaison insensible à la casse
}

function findTag(html,string) {
   // console.log('ess',string);
   // console.log(html.html());
  //  const tag = html(`*:contains('${string}')`).last();
    const candidates = html(`*:contains('${string}')`);
  //  let tag;
    if (candidates.length === 0){
       // console.log('\x1b[31mNo Tag Found matching string \x1b[0m\'%s\'\x1b[36m.',string);
        return null;
    }
    let i = 0;
    while(i<candidates.length-1 && html(candidates[i]).is(html(candidates[i+1]).parent())){
        i++;
    }
    return candidates[i];
}



 
 


 function removeImageTag(s){
    const regex = /<img.*?>/g;
    return s.replace(regex,'[***IMAGE***]');
 }


 function getTagsForKey(object,key,cheerioSource){
    const string = key.match(/event([^]*)String/);
    console.log('\n\x1b[36mEvent '+string[1]+' tags:\x1b[0m');
    const tagList = object[key].map(string2 => findTag(cheerioSource,string2));
    showTagsDetails(tagList,cheerioSource,object[key]);
    return tagList.map((tag,index) => reduceTag(getTagLocalization(tag,cheerioSource,false,[object[key][index]]),cheerioSource));
 }
 

 function getAllDates(mainTag,dateTags,source){
    let events = [];
    let dates = [];
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


function addJSONBlock(scrapSource,source){
    let res =  {};
    Object.keys(scrapSource).filter(element => scrapSource[element].length > 0)
        .forEach(key =>res[key.replace(/String/,'Tag')] = getTagsForKey(scrapSource,key,source));
    // remove doubles 
    Object.keys(res).forEach(key => {res[key] = removeDoubles(res[key]);});
    return res;
}



function getBestDateFormat(dates, JSON, dateConversionPatterns){
   // console.log(dates);
    let bestDateFormat = (JSON.hasOwnProperty('dateFormat'))?JSON.dateFormat:"dd-MM-yyyy";
    let bestScore = numberOfInvalidDates(dates.map(element => createDate(element,bestDateFormat,dateConversionPatterns)));
    const dateFormatList = getCommonDateFormats();
    dateFormatList.forEach(format => {
        const formattedDateList = dates.map(element => createDate(element,format,dateConversionPatterns));
        if (numberOfInvalidDates(formattedDateList) < bestScore){
            bestDateFormat = format;
            bestScore = numberOfInvalidDates(formattedDateList);
        }
    });
    console.log("\nFound %s events. Best date format: \x1b[36m\"%s\"\x1b[0m (%s/%s invalid dates)",dates.length,bestDateFormat,bestScore,dates.length);
    return bestDateFormat;
}


function filterFromArguments(args){
    args = args.slice(2).map(el => el.toLowerCase()); 
    if (args.length > 3){
      console.log(args.length);
      console.log("\x1b[31mError: too many arguments\x1b[0m");
      args = ['--help'];
    }
    if (args.length === 0){
        console.log("\x1b[31mError: not enough arguments\x1b[0m");
        args = ['--help'];
      }
    if (args.some(arg => arg === '--help')){
        console.log('\nSyntax: node ./analex [\x1b[32msource_name\x1b[0m] '+
                    '[\x1b[32mcity\x1b[0m \x1b[90m(optional)\x1b[0m] '+
                    '[\x1b[32mcountry\x1b[0m \x1b[90m(optional)\x1b[0m]\n'+
                    'This will analyse the website with the corresponding name/city/country.\n'+
                    'Only one venue should correspond to the arguments. Use the optional arguments to ensure that the venue is unique');
        return undefined;
    }else{
        return args;
    }
}