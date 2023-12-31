import { createDate, numberOfInvalidDates, getCommonDateFormats, convertDate} from './import/dateUtilities.mjs';
//import { isValid }  from 'date-fns';
import * as fs from 'fs';
import * as cheerio from 'cheerio';
const sourcePath = './webSources/';
const venuesListFile = "./venues.json";
const dateConversionFile = './import/dateConversion.json';
var venuesListJSON ;

const venueName = 'Le Petit Bulletin';
const fileName = venueName+'.html';

const extendSelectionToGetURL = true;

// var eventStrings = {
//     eventNameStrings: ["okto"], // this property must exist
//     eventDateStrings: ["18", "jan"], // this property must exist
//     eventStyleStrings: [],
//     eventPlaceStrings: []
// }

var eventStrings = {
    eventNameStrings: ["kilda"], // this property must exist
    eventDateStrings: ["7","janvier"], // this property must exist
    eventStyleStrings: ["underground"],
    eventPlaceStrings: []
}

console.log('\n\n\x1b[36m%s\x1b[0m', `******* Analysing file: ${fileName}  *******\n`);


// aborting process if mandatory strings are not present (safeguard)
if (!eventStrings.hasOwnProperty('eventNameStrings')){
    console.log('\x1b[31mProperty \'eventNameStrings\' is missing in variable eventStrings. Aborting.\x1b[0m\n');
    throw new Error('Aborting.')
}
if (!eventStrings.hasOwnProperty('eventDateStrings')){
    console.log('\x1b[31mProperty \'eventDateStrings\' is missing in variable eventStrings. Aborting.\x1b[0m\n');
    throw new Error('Aborting.')
}

processFile();


async function processFile(){
    var fileContent, JSONFileContent, venuesListJSON, dateConversionPatterns;

    // load the different files
    
    try{
        fileContent = await fs.promises.readFile(sourcePath+fileName, 'utf8');
    }catch(err) {
        console.error("\x1b[31m Cannot open file :%s\x1b[0m\n%s",fileName);
        throw err;
    }
    try{
        venuesListJSON = await JSON.parse(await fs.promises.readFile(venuesListFile, 'utf8'));
    }catch(err){
        console.log('\x1b[36m Warning: cannot open venues JSON file:  \'%s\'. Will not save to venues.\x1b[0m%s\n',venuesListFile,err);
    }
    try{
        dateConversionPatterns = await JSON.parse(await fs.promises.readFile(dateConversionFile, 'utf8'));
    }catch(err){
        console.log('\x1b[36m Warning: cannot open date conversion file JSON file:  \'%s\'. Will not save to venues.\x1b[0m%s\n',dateConversionFile,err);
    }
    
    const venueJSON = {};
    venueJSON.name = venueName;
    const venueInList = venuesListJSON.find(function(element) {
        return element.name === venueName;
    });
    
    // convert everything to lower case
    try{
        for (const key in eventStrings){
            eventStrings[key] = eventStrings[key].map(string => string.toLowerCase());
        }
        
    }catch(error){
        console.error('\x1b[31mError while reading the strings to parse: %s\x1b[0m',error);
    }
    const $ = cheerio.load(convertToLowerCase(fileContent));

    let stringsToFind = [].concat(...Object.values(eventStrings));

    const tagsContainingStrings = $('*:contains("' + stringsToFind.join('"), :contains("') + '")')
    .filter((_, tag) => tagContainsAllStrings($(tag), stringsToFind));


    //Affichez les noms des balises trouvées
    if (tagsContainingStrings.length === 0){
        console.log('\x1b[31m%s\x1b[0m',"Impossible to find a tag that delimits the events.");
    }else{
        // tagsContainingStrings.each((_, tag) => {
        //     console.log('Tag found:', tag.tagName, $(tag).attr('class'),$(tag).text().length);
        // });
    
        // find a tag containing all the strings
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
       
        console.log("Found ",tagsContainingStrings.length,' tags. Best tag: \x1b[90m',
             `<${mainTag.prop('tagName')} class="${$(mainTag).attr('class')}" id="${$(mainTag).attr('id')}">`,'\x1b[0m Contains');
        console.log('\x1b[0m\x1b[32m%s\x1b[0m',removeImageTag(removeBlanks($(mainTag).text())));
    
        // console.log($(mainTag).html());
        venueJSON.eventsDelimiterTag=getTagLocalization(mainTag,$,true);
        // console.log('\x1b[32m%s\x1b[0m', `Tag: <${tag.prop('tagName')} class="${$(tag).attr('class')}" id="${$(tag).attr('id')}">`);
 
    
        
        //***************************************************************/
        //***************************************************************/

        // find and display tag for each string to find
        
        Object.keys(eventStrings).filter(element => eventStrings[element].length > 0)
            .forEach(key =>venueJSON[key.replace(/String/,'Tag')] = getTagsForKey(eventStrings,key,$eventBlock));
        // remove doubles
        Object.keys(venueJSON).forEach(key => {venueJSON[key] = removeDoubles(venueJSON[key]);});
    
        // logs depending on if URL has been found.
        console.log();
        if (hrefs.length === 1) {
          console.log('URL found:',$eventBlock(hrefs[0]).attr('href'));
        }else if (hrefs.length > 1){
            console.log(hrefs.length,'URLs found. Change index in JSON \"eventURLIndex\" to the most suitable one (default 0).');
            hrefs.each((index, element) => {
                const href = $eventBlock(element).attr('href');
                console.log('\x1b[90mURL (index\x1b[0m',index,'\x1b[90m):\x1b[0m', href);
            });
            venueJSON.eventURLIndex = 0;
        } 
        else {
          console.log('\x1b[31mNo url link found.'
            +(extendSelectionToGetURL?'':'(consider finding URLs recursively using \"extendSelectionToGetURL = true\")')+'\x1b[0m');
          venueJSON.eventURLIndex = -1;
        }

        let dates = getAllDates(venueJSON.eventsDelimiterTag,venueJSON['eventDateTags'],$);
        //console.log(dates);
        var bestDateFormat = (venueInList.hasOwnProperty('dateFormat'))?venueInList.dateFormat:"dd-MM-yyyy";
      
        var bestScore = numberOfInvalidDates(dates.map(element => createDate(element,bestDateFormat,dateConversionPatterns)));
        let dateFormatList = getCommonDateFormats();
        dateFormatList.forEach(format => {
            const formattedDateList = dates.map(element => createDate(element,format,dateConversionPatterns));
           // console.log(format+' => '+numberOfInvalidDates(formattedDateList)+' '+convertDate(dates[2],dateConversionPatterns));
            if (numberOfInvalidDates(formattedDateList) < bestScore){
                bestDateFormat = format;
                bestScore = numberOfInvalidDates(formattedDateList);
            }
        });
        console.log("\nBest date format: \x1b[36m\"%s\"\x1b[0m (%s/%s invalid dates)",bestDateFormat,bestScore,dates.length);
        venueJSON.dateFormat = bestDateFormat;
        
        console.log('Found %s events.',dates.length);

        // saving to venues JSON and test file

        if(venueInList !== undefined){
            Object.keys(venueJSON).forEach(key =>venueInList[key] = venueJSON[key]);
            console.log("\n",venueInList);
            console.log("\n");

            try{
                const jsonString = JSON.stringify(venuesListJSON, null, 2); 
                fs.writeFileSync(venuesListFile, jsonString);
                console.log('Added to venues in %s',venuesListFile);
            }catch(err){
                console.log('\x1b[31mError saving to .json: \'%s\' %s\x1b[0m',venuesListFile,err);
            }
        }
       
    }
    
    console.log("\n\n");
}











//************************************************/
//               Auxiliary functions             //
//************************************************/

function getTagWithURL(currentTag,$cgp,stringsToFind){
    var hrefs = $cgp('a[href]');
    if ($cgp(currentTag).prop('tagName')=='A'){
        const $cgparent = cheerio.load($cgp(currentTag).parent().html());  
        var tmp = $cgparent('a').filter((_, tag) => tagContainsAllStrings($cgparent(tag), stringsToFind));
        tmp.first().nextAll().remove();
        tmp.first().prevAll().remove(); 
        hrefs = $cgparent('a[href]');
    }
    // while the tag: has a name, has no url or has no class. Take the most inner tag with a class and an URL
    while ($cgp(currentTag).prop('tagName') && (hrefs.length===0 || !$cgp(currentTag).attr('class'))) {
        console.log("deeper");
        currentTag = $cgp(currentTag).parent();
        if ($cgp(currentTag).prop('tagName')){
            const gp = currentTag.html();
            $cgp = cheerio.load(gp);
            hrefs = $cgp('a[href]');
        }
    }
    return [currentTag, hrefs];
}


function getTagLocalization(tag,source,isDelimiter){
    try{
        if (source(tag).prop('tagName')=='BODY'){// if we are already at top level... may happen ?
            return '';
        }
       // console.log('tag name: ',source(tag).prop('tagName'));
        if (source(tag).attr('class')){
            const tagClass = source(tag).attr('class');//.split(' ')[0];
            let string = source(tag).prop('tagName')+'.'+tagClass;
            if (!isDelimiter){// if delimiter, no index should be stored since many blocks should match (one per event)
                string += ':eq('+getMyIndex(tag,source)+')';
            }
            string = string.replace(/ /g,'.');
            return string;
        }else{// if no class is found, recursively search for parents until a class is found.
            let string;
            const index =  getMyIndex(tag,source);
            if (source(tag).parent().prop('tagName')=='BODY'){       
                string = '';
           }else{
                string = getTagLocalization(source(tag).parent(),source,isDelimiter)+' ';
           }
            string += ' '+source(tag).prop('tagName') + ':eq('+index+')';
            return string;
            // if (source(tag).parent().prop('tagName')=='BODY'){
            //      const index =  getMyIndex(tag,source);
            //      return source(tag).prop('tagName') + ':eq('+index+')';
            // }else{
            //     const index = getMyIndex(tag,source);
            //     let string = getTagLocalization(source(tag).parent(),source,isDelimiter);
            //     string += ' '+source(tag).prop('tagName') + ':eq('+index+')';
            //     return string;
            // }
        }
    }catch(err){
        console.log("\x1b[31mErreur de localisation de la balise: %s\x1b[0m",err);
    //    console.log(source(tag).html());
    }

}

function getMyIndex(tag,source){// get the index of the tag div.class among the same type and same class
    let indexation = source(tag).prop('tagName');
    let index;
    if (source(tag).attr('class')){
    //    indexation += '.'+source(tag).attr('class');//.split(' ')[0];
        indexation += '.'+source(tag).attr('class').replace(/ /g,'.');//.split(' ')[0];
    }
    const parentTag = source(tag).parent();
    if (parentTag.prop('tagName')=='BODY'){// top level, no parent to find index from
        index =  source(tag).index(source(tag).prop('tagName'));
        console.log(index);
        console.log(parentTag.html());
    }else{
        const $parentHtml = cheerio.load(parentTag.html());
        const tagsFromParent =  $parentHtml(indexation+`:contains('${source(tag).text()}')`).last();
        
        index = $parentHtml(tagsFromParent).index(indexation);
    }
    return index;
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
    const tag = html(`*:contains('${string}')`).last();
    return tag.length > 0 ? tag.get(0) : null;
}


function removeBlanks(s){
    return s.replace(/[\n\t]/g, ' ').replace(/ {2,}/g, ' ').replace(/^ /,'').replace(/ $/,'');
//    return s.replace(/ {2,}/g, ' ').replace(/\n[ \t\n]*/g, ' ').replace(/^ /,'');
 //    return s.replace(/[\t]*/g, '').replace(/ {2,}/g, ' ').replace(/^ /,'').replace(/[\n]*/, '\n');
 }
 
 
 function convertToLowerCase(s){
     const regex = /^[^<]*?<|>([^]*?)<|>[^>]*?$/g;
     return s.replace(regex,match => match.toLowerCase());
 }

 function removeImageTag(s){
    const regex = /<img.*?>/g;
    return s.replace(regex,'[***IMAGE***]');
 }


 function getTagsForKey(object,key,cheerioSource){
    const string = key.match(/event([^]*)String/);
    console.log('\nEvent '+string[1]+' tags:');
    const tagList = object[key].map(string => findTag(cheerioSource,string));
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


 function removeDoubles(list) {
   if (Array.isArray(list)){
    const res = [];
    list.forEach((element) => {
        if (res.indexOf(element) === -1) {
            res.push(element);
        }
      });
    return res;
   }else{
    return list;
   }
  }