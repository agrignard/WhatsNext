import { createDate, numberOfInvalidDates, getCommonDateFormats, getConversionPatterns} from './import/dateUtilities.mjs';
import {removeDoubles, convertToLowerCase, removeBlanks} from './import/stringUtilities.mjs';
import {loadVenueScrapInfofromFile, loadVenueJSON,loadVenuesJSONFile,venuesListJSONFile} from './import/fileUtilities.mjs';

import * as fs from 'fs';
import * as cheerio from 'cheerio';
import {parseDocument} from 'htmlparser2';

var sourcePath = './webSources/';

const venueToAnalyse = process.argv[2];// argument to load default strings to parse
const extendSelectionToGetURL = true;

var venueName = 'Le Petit Bulletin';

var eventStrings = {// is overriden later if an argument is passed to the script
    //mainPage:{
    // eventNameStrings: ["punxa"], // this property must exist
    // eventDateStrings: ["13","janvier"], // this property must exist
    // eventStyleStrings: ["rock"],
    // eventPlaceStrings: ["Kraspek Myzik"]
    //}
}


processFile();


async function processFile(){
    var fileContent, linkedFileContent, venuesListJSON, dateConversionPatterns, venueJSON;
    let eventStrings;
   
    // set the venue to analyze
    if (venueToAnalyse){
        eventStrings = await loadVenueScrapInfofromFile(venueToAnalyse);
        venueName = venueToAnalyse;
    }
   
    console.log('\n\n\x1b[36m%s\x1b[0m', `******* Analysing venue: ${venueName}  *******\n`);
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
    venuesListJSON = await loadVenuesJSONFile();
    venueJSON =  loadVenueJSON(venueName,venuesListJSON);
    sourcePath += venueJSON.country+'/'+venueJSON.city+'/'+venueName+'/';
    const fileName = venueName+(venueJSON.hasOwnProperty('multiPages')?'0':'')+'.html';

    // load date conversion pattern
    dateConversionPatterns = await getConversionPatterns();

    // load main page
    try{
        fileContent = await fs.promises.readFile(sourcePath+fileName, 'utf8');
    }catch(err) {
        console.error("\x1b[31mCannot open file :%s\x1b[0m\n%s",fileName,err);
        throw err;
    }

    // load linked page
    if (eventStrings.linkedPage){
        console.log("loading linked pages.");
        try{
            linkedFileContent = await JSON.parse(await fs.promises.readFile(sourcePath+'linkedPages.json', 'utf8'));
        }catch(err) {
            console.error("\x1b[31mCannot open linked pages :%s\x1b[0m\n");
            throw err;
        }
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
   
    venueJSON.scrap = {};
    
    // convert everything to lower case
    try{
        for (const key in eventStrings.mainPage){
            eventStrings.mainPage[key] = eventStrings.mainPage[key].map(string => string.toLowerCase());
        }
        
    }catch(error){
        console.error('\x1b[31mError while reading the strings to parse: %s\x1b[0m',error);
    }
    const parsedHtml = parseDocument(convertToLowerCase(fileContent));
    const $ = cheerio.load(parsedHtml);

    let stringsToFind = [].concat(...Object.values(eventStrings.mainPage));

    const tagsContainingStrings = $('*:contains("' + stringsToFind.join('"), :contains("') + '")')
    .filter((_, tag) => tagContainsAllStrings($(tag), stringsToFind));


    //Affichez les noms des balises trouvées
    if (tagsContainingStrings.length === 0){
        console.log('\x1b[31mCan\'t find a tag that delimits the events, aborting process. Is event passed ? (event date: %s)\x1b[0m',
            eventStrings.mainPage.eventDateStrings.join());
    }else{
        // tagsContainingStrings.each((_, tag) => {
        //     console.log('Tag found:', tag.tagName, $(tag).attr('class'),$(tag).text().length);
        // });
    
        // find a tag containing all the strings
        for (let i = 0; i <= tagsContainingStrings.length-1; i++){
            let t = $(tagsContainingStrings[i]);
            let str = t.prop('tagName');
            if (t.attr('class')){
                str += ' class='+t.attr('class');
            }
        }
        console.log();

        var mainTag = tagsContainingStrings.last();
        var $eventBlock = cheerio.load($(mainTag).html());
        var hrefs = $eventBlock('a[href]');

      
        // extend the tag if it does not include any URL link
        if (extendSelectionToGetURL){
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
                console.log("\x1b[31mError while trying to find embedded URL recursively. Aborting URL search. Try to turn flag \'extendSelectionToGetURL\' to false to prevent recursive search. %s\x1b[0m",err)
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
        console.log('Found %s tags. Best tag \x1b[90m%s\x1b[0m contains:', tagsContainingStrings.length,mainTagString);
        console.log('\x1b[0m\x1b[32m%s\x1b[0m',removeImageTag(removeBlanks($(mainTag).text())));
    

        
        venueJSON.eventsDelimiterTag=getTagLocalization(mainTag,$,true);
  
        
        //***************************************************************/
        //***************************************************************/

        // find and display tag for each string to find
        
        Object.keys(eventStrings.mainPage).filter(element => eventStrings.mainPage[element].length > 0)
            .forEach(key =>venueJSON.scrap[key.replace(/String/,'Tag')] = getTagsForKey(eventStrings.mainPage,key,$eventBlock));
        // remove doubles
        
        Object.keys(venueJSON.scrap).forEach(key => {venueJSON.scrap[key] = removeDoubles(venueJSON.scrap[key]);});

        // logs depending on if URL has been found.
        console.log();
        if ($(mainTag).prop('tagName')=='A'){
            venueJSON.eventURLIndex = 0;
        }else{
            venueJSON.eventURLIndex = 1;
        }
        let linkedPage;
        if (hrefs.length === 1) {
            let linkURL = $eventBlock(hrefs[0]).attr('href');
            console.log('URL found:',linkURL);
            if (eventStrings.hasOwnProperty('linkedPage')){
                linkedPage = linkedFileContent[linkURL];
            }
        }else if (hrefs.length > 1){
            console.log('Found %s URLs. Change index in JSON \"eventURLIndex\" to the most suitable one (default 0).', hrefs.length);
            hrefs.each((index, element) => {
                const href = $eventBlock(element).attr('href');
                console.log('\x1b[90mURL (index\x1b[0m',index+1,'\x1b[90m):\x1b[0m', href);//index+1 car 0 est réservé au maintTag de type <a=href>
            });
            
        } 
        else {
          console.log('\x1b[31mNo url link found.'
            +(extendSelectionToGetURL?'':'(consider finding URLs recursively using \"extendSelectionToGetURL = true\")')+'\x1b[0m');
          venueJSON.eventURLIndex = -1;
        }

        // find strings in linked pages
        
        if (linkedPage){
            console.log('loading linked page');
            const parsedLinkedPage = parseDocument(convertToLowerCase(linkedPage));
            const $linked = cheerio.load(parsedLinkedPage);
            Object.keys(eventStrings.linkedPage).filter(element => eventStrings.linkedPage[element].length > 0)
            .forEach(key =>venueJSON.linkedPage[key.replace(/String/,'Tag')] = getTagsForKey(eventStrings.linkedPage,key,$linked));
        }

        let dates = getAllDates(venueJSON.eventsDelimiterTag,venueJSON.scrap['eventDateTags'],$);
 
        var bestDateFormat = (venueJSON.hasOwnProperty('dateFormat'))?venueJSON.dateFormat:"dd-MM-yyyy";
      
        var bestScore = numberOfInvalidDates(dates.map(element => createDate(element,bestDateFormat,dateConversionPatterns)));
        let dateFormatList = getCommonDateFormats();
        dateFormatList.forEach(format => {
            const formattedDateList = dates.map(element => createDate(element,format,dateConversionPatterns));
            if (numberOfInvalidDates(formattedDateList) < bestScore){
                bestDateFormat = format;
                bestScore = numberOfInvalidDates(formattedDateList);
            }
        });
        console.log("\nFound %s events. Best date format: \x1b[36m\"%s\"\x1b[0m (%s/%s invalid dates)",dates.length,bestDateFormat,bestScore,dates.length);
        venueJSON.dateFormat = bestDateFormat;
        
        

        // saving to venues JSON and test file

        console.log("\n",venueJSON);
        console.log("\n");

        try{
            const jsonString = JSON.stringify(venuesListJSON, null, 2); 
            fs.writeFileSync(venuesListJSONFile, jsonString);
            console.log('Added to venues in %s',venuesListJSONFile);
        }catch(err){
            console.log('\x1b[31mError saving to .json: \'%s\' %s\x1b[0m',venuesListJSONFile,err);
        }

       
    }
    
    console.log("\n\n");
}











//************************************************/
//               Auxiliary functions             //
//************************************************/

function getTagWithURL(currentTag,$cgp,stringsToFind){
   // displayTag(currentTag,$cgp);
    var hrefs = $cgp('a[href]');
    if ($cgp(currentTag).prop('tagName')=='A'){
        const $cgparent = cheerio.load($cgp(currentTag).parent().html());  
        var tmp = $cgparent('a').filter((_, tag) => tagContainsAllStrings($cgparent(tag), stringsToFind));
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


function getTagLocalization(tag,source,isDelimiter){
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
            string = getTagLocalization(source(tag).parent(),source,false)+' ';
        }
        string += ' '+source(tag).prop('tagName');
        string += tagClass;
        const index =  getMyIndex(tag,source);
        string +=  ':eq('+index+')';
        return string;
    }catch(err){
      //  console.log("\x1b[31mErreur de localisation de la balise: %s\x1b[0m:",source(tag).prop('tagName'));
        console.log("\x1b[31mErreur de localisation de la balise: %s\x1b[0m: %s",source(tag).prop('tagName'),err);
    }
}



function getMyIndex(tag,source){// get the index of the tag div.class among the same type and same class
    let indexation = source(tag).prop('tagName');
    let tagIndex;
    if (source(tag).attr('class')){
    //    indexation += '.'+source(tag).attr('class');//.split(' ')[0];
        indexation += '.'+source(tag).attr('class').replace(/[ ]*$/g,'').replace(/[ ]{1,}/g,'.');//.split(' ')[0];
    }
    const parentTag = source(tag).parent();
    if (parentTag.prop('tagName')=='BODY'){// top level, no parent to find index from
        tagIndex =  source(tag).index(indexation);
    }else{
        const $parentHtml = cheerio.load(parentTag.html());
        const tagsFromParent =  $parentHtml(indexation+`:contains('${source(tag).text()}')`).last();
        tagIndex = $parentHtml(tagsFromParent).index(indexation);
    }
    return tagIndex;
}



function showTagsDetails(tagList,source){
    tagList.forEach(element => console.log('\x1b[90mTag: <%s class=%s> (index %s): \x1b[0m%s', 
        element.tagName,source(element).attr('class'),getMyIndex(element,source),removeBlanks(source(element).text())));
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
    let tag;
    if (candidates.length === 0){
        console.log('truc');
        return null;
    }
    let i = 0;
    while(i<candidates.length-1 && html(candidates[i]).is(html(candidates[i+1]).parent())){
        i++;
    }
    return candidates[i];
    // for (let i=0;i<candidates.length-1;i++){
    //     console.log('i=',i);
    //     // console.log(getTagLocalization(html(candidates[i]),html,false));
    //     // console.log(html(candidates[i]).prop('tagName'));  
    //     // console.log(html(candidates[i+1]).parent().prop('tagName'));  
    //     console.log(html(candidates[i]).is(html(candidates[i+1]).parent()));
    // }
    
//    candidates.forEach(el => console.log(html(el).prop('tagName')));
    return tag.length > 0 ? tag.get(0) : null;
}



 
 


 function removeImageTag(s){
    const regex = /<img.*?>/g;
    return s.replace(regex,'[***IMAGE***]');
 }


 function getTagsForKey(object,key,cheerioSource){
    const string = key.match(/event([^]*)String/);
    console.log('\n\x1b[36mEvent '+string[1]+' tags:\x1b[0m');
    console.log(object[key]);
    const tagList = object[key].map(string2 => findTag(cheerioSource,string2));
    //console.log(cheerioSource.html());
    //console.log("tagList: ",tagList.map(el => cheerioSource(el).prop('tagName')));
    showTagsDetails(tagList,cheerioSource);
    return tagList.map(tag => getTagLocalization(tag,cheerioSource,false));
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






//   function displayTag(tag,$cgp){
//     let str = $cgp(tag).prop('tagName');
//     if ($cgp(tag).attr('class')){
//         str += ' class: '+$cgp(tag).attr('class');
//     }
//     console.log('Tag name: ',str);
//   }

//   function displayFullTag(tag,$cgp){
//     let str ='';
//     let par = $cgp(tag).parent();
//     if (par.prop('tagName') !== 'BODY'){
//         str += displayFullTag(par,cheerio.load(par.html()))+' ';
//         str +=' ';
//     }
//     str += $cgp(tag).prop('tagName');
//     if ($cgp(tag).attr('class')){
//         str += ' class: '+$cgp(tag).attr('class');
//     }
//     return(str);
//   }