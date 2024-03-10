/**********************************************************/
/*    utilities used in analex                            */
/**********************************************************/

//const path = require('path');
//const fs = require('fs');
const {removeDoubles, makeURL, cleanPage, removeBlanks} = require('./stringUtilities.js');
//const {loadLinkedPages, fetchWithRetry, fetchLink} = require('./fileUtilities.js');
const {unique, isValidEvent} = require('./jsonUtilities.js');
const {numberOfInvalidDates, getCommonDateFormats, createDate} = require('./dateUtilities.js');
const cheerio = require('cheerio');


module.exports = {getTagLocalization, tagContainsAllStrings, getTagContainingAllStrings, getMyIndex, 
    splitAndLowerCase, addJSONBlock, reduceTag, getAllDates, getBestDateFormat, adjustMainTag, countNonEmptyEvents};

function adjustMainTag(delimiterTag,$,venue, currentEventNumber){
    const mainTagEventsNumber = currentEventNumber?currentEventNumber:countNonEmptyEvents(delimiterTag,$,venue);//$(delimiterTag).length;
    let currentNumber = mainTagEventsNumber;
    let bestTag = delimiterTag;
    // console.log('refnum',currentNumber);
    const splitTag = delimiterTag.split(' ');
    for (let i=0;i<splitTag.length;i++){
        const startList = splitTag.slice(0,i);
        const endList = splitTag.slice(i+1);
        const currentTag = splitTag[i].split('.');
        if (currentTag.length>2){// only if more than one class exist
            for(let j=1;j<currentTag.length;j++){
                const startInnerList = currentTag.slice(0,j);
                const endInnerList = currentTag.slice(j+1);
                let newTag = startList.join(' ')+' '+startInnerList.join('.')+((j===currentTag.length-1)?'':'.')+
                            endInnerList.join('.')+' '+endList.join(' ');;
                const newNumber = countNonEmptyEvents(newTag,$,venue);//$(newTag).length;
                // console.log(newNumber, newTag);
                if (newNumber > currentNumber){
                    currentNumber = newNumber;
                    bestTag = newTag;
                }
            }
            //console.log('result',currentNumber,bestTag);
            if (currentNumber > mainTagEventsNumber){
                return adjustMainTag(bestTag,$,venue, currentNumber);
            }
        }
    }
    return bestTag;
}



function countNonEmptyEvents(delimiterTag,$,venue){
    let eventList = [];
    $(delimiterTag).each((index, element) => {
        const event = {};
        const $eventBlock = cheerio.load($(element).html());
        if (venue.mainPage.hasOwnProperty('eventNameTags')){
            const tagList = venue.mainPage.eventNameTags;
            event.eventName = tagList.map(tag =>{
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
    return unique(eventList).length;
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

function getBestDateFormat(dates, JSON, dateConversionPatterns){
    let bestDateFormat = "";
    let bestScore = numberOfInvalidDates(dates.map(element => createDate(element,bestDateFormat,dateConversionPatterns,'Europe/Paris')));
    const dateFormatList = getCommonDateFormats();
    dateFormatList.forEach(format => {
        const formattedDateList = dates.map(element => createDate(element,format,dateConversionPatterns));
        if (numberOfInvalidDates(formattedDateList) < bestScore){
            bestDateFormat = format;
            bestScore = numberOfInvalidDates(formattedDateList);
        }
    });
    console.log("\nFound %s events. Best date format: \x1b[36m\"%s\"\x1b[0m (%s/%s invalid dates)",dates.length,bestDateFormat,bestScore,dates.length);
    return [bestDateFormat, bestScore];
}

function addJSONBlock(scrapSource,source){
    let res =  {};
    Object.keys(scrapSource).filter(element => scrapSource[element].length > 0)
        .forEach(key =>res[key.replace(/String/,'Tag')] = getTagsForKey(scrapSource,key,source));
    // remove doubles 
    Object.keys(res).forEach(key => {res[key] = removeDoubles(res[key]);});
    return res;
}

function getTagsForKey(object,key,cheerioSource){
    const string = key.match(/event([^]*)String/);
    console.log('\n\x1b[36mEvent '+string[1]+' tags:\x1b[0m');
    const tagList = object[key].map(string2 => findTag(cheerioSource,string2));
    showTagsDetails(tagList,cheerioSource,object[key]);
    return tagList.map((tag,index) => reduceTag(getTagLocalization(tag,cheerioSource,false,[object[key][index]]),cheerioSource));
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

 function reduceTag(string,source){// reduce the tag list to keep it compact and avoid errors
    if (string == undefined){
        return undefined;
    }
    const refText = source(string).text();
    const stringList = string.split(' ');
    let reducedString = stringList.pop();
    while(stringList.length>0){
        reducedString = stringList.pop()+' '+reducedString;
        const reducedStringClasses = getClasses(reducedString);
        const remainingClasses = getClasses(stringList.join(' '));
        const noWrapping = reducedStringClasses.some(el =>!remainingClasses.includes(el));
        if (source(reducedString).text() === refText && noWrapping){
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


function getClasses(tagText){
    const classList = [];
    tagText.split(' ').forEach(tag =>{
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
    //console.log('*:contains("' + stringsToFind.join('"), :contains("') + '")');
    // pose un pb si un texte contient une parenthèse ouvrante mais pas de parenthèse fermante
    return $('*:contains("' + stringsToFind.join('"), :contains("') + '")')
    .filter((_, tag) => tagContainsAllStrings($(tag), stringsToFind));
}

function tagContainsAllStrings(tag, strings) {
    const tagContent = tag.text();//.toLowerCase(); // Convertir en minuscules
    return strings.every(string => tagContent.includes(string)); // Comparaison insensible à la casse
}

function getTagLocalization(tag,source,isDelimiter,stringsToFind){ 
    stringsToFind = stringsToFind.filter(el => el !== '');
    if (tag == null){
        return null;
    }
    if (source(tag).prop('tagName') == undefined){
        return '';
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
        // if (isDelimiter){
        //     return source(tag).prop('tagName')+tagClass;
        // }
        if (source(tag).parent().prop('tagName')=='BODY' || source(tag).parent().prop('tagName')== undefined){    
            string = '';
        }else{
            string = getTagLocalization(source(tag).parent(),source,isDelimiter,stringsToFind);
        }
        string += (string ==='')?'':' ';
        string += source(tag).prop('tagName');
        string += tagClass;
        if (!isDelimiter){
            const index =  getMyIndex(tag,source,stringsToFind);
            string +=  ':eq('+index+')';
        }
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
    // if (parentTag.prop('tagName')=='BODY'){// top level, no parent to find index from
    if (parentTag.prop('tagName') === undefined || parentTag.prop('tagName')=='BODY'){// top level, no parent to find index from
        tagIndex =  source(tag).index(indexation);
    }else{
        const $parentHtml = cheerio.load(parentTag.html());
        const str = ':contains("' + stringsToFind.join('"):contains("') + '")';
        const tagsFromParent =  $parentHtml(indexation+str).first();
        tagIndex = $parentHtml(tagsFromParent).index(indexation);
    }
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

