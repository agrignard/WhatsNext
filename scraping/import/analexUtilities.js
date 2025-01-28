/**********************************************************/
/*    utilities used in analex                            */
/**********************************************************/

//const path = require('path');
//const fs = require('fs');
const {removeDoubles, removeBlanks} = require('./stringUtilities.js');
//const {loadLinkedPages, fetchWithRetry, fetchLink} = require('./fileUtilities.js');
const {unique, isValidEvent} = require('./jsonUtilities.js');
const {numberOfInvalidDates, getCommonDateFormats, createDate} = require('./dateUtilities.js');
const cheerio = require('cheerio');



module.exports = {getTagLocalization, tagContainsAllStrings, getTagContainingAllStrings, getMyIndex, 
    splitAndLowerCase, addJSONBlock, reduceTag, getAllDates, getBestDateFormat, adjustMainTag, 
    regroupTags, countNonEmptyEvents};


// if several tags only differ by the equation number, the equation number is removed
function regroupTags(tagList){
    tagList = tagList.filter(el => el !== undefined);
    if (tagList.length < 2){
        return tagList;
    }
    let regex = /(.*)(:eq\(\d+\))(?!.*:eq\(\d+\))/;
    let toProcess = tagList.slice();
    const res = [];
    while(toProcess.length >0){
        const tag = toProcess.pop();
        const shortTag = tag.replace(regex,(match, p1, p2, p3) => p1);
        const oldLength = toProcess.length;
        toProcess= toProcess.filter(el => el.replace(regex,(match, p1, p2, p3) => p1) !== shortTag);
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
    console.log(delimiterTag);
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

function getTagLocalization(tag,source,isDelimiter){

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
            // newES.mainPage[key] = newES.mainPage[key].map(string => string.toLowerCase());
        }
        for (const key in newES.linkedPage){
            if(typeof newES.linkedPage[key] === "string"){
                newES.linkedPage[key] = newES.linkedPage[key].split(/\s+/);
            }
            // newES.linkedPage[key] = newES.linkedPage[key].map(string => string.toLowerCase());
        }
        return newES;
    }catch(error){
        console.error('\x1b[31mError while reading the strings to parse: %s\x1b[0m',error);
    }
}

