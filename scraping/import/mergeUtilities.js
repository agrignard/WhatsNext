// import {to2digits, sameDay} from './dateUtilities.mjs';
// import {simplify, removeDoubles} from './stringUtilities.mjs';
// import {samePlace, getEventPlace, fromLocalSource, getStyleList, writeToLog,jsonRemoveDouble} from './jsonUtilities.mjs';

const path = require('path');
const {to2digits, sameDay} =  require('./dateUtilities.js');
const {simplify, removeDoubles} = require('./stringUtilities.js');
const {samePlace, getEventPlace, fromLocalSource, getStyleList, writeToLog,jsonRemoveDouble} = require('./jsonUtilities.js');


module.exports = { mergeEvents };
  
const rootDirectory = path.resolve('.').match(/.*scraping/)[0]+'/';
const outFile = rootDirectory+"/generated/afterMerge.csv";
const refStyleList = getStyleList();

function mergeEvents(eventList,showFullMergeLog){
    
    let newList = [];
    let mergeLog = '';

    // preprocessing: merge events at the same date. All similar events are stored in the list mergeCandidates
    eventList.forEach(event =>{
        const samePlaceSameDayEventList = newList.filter(el => 
            samePlace(getEventPlace(el),getEventPlace(event))
            && sameDay(el.unixDate, event.unixDate)
            && el.unixDate !== 0
            //&& el.mergeCandidates.some(subEl => similarName(subEl.eventName,event.eventName))
            && similarName(el.eventName,event.eventName)
            );
        if (samePlaceSameDayEventList.length >0){// for each event, if a similar event is found in newList, it is added to mergeCandidates
            const samePlaceSameDayEvent = samePlaceSameDayEventList[0];    
            samePlaceSameDayEvent.mergeCandidates.push(event);  
            // if other elements are found, merge everything
            for(let i=1;i<samePlaceSameDayEventList.length;i++){
                const otherEvent = samePlaceSameDayEventList[i];
                samePlaceSameDayEvent.mergeCandidates = jsonRemoveDouble(samePlaceSameDayEvent.mergeCandidates.concat(otherEvent.mergeCandidates));
                otherEvent.toRemove = true;// will remove useless entries since they have been merged to another one
            } 
        }else{// otherwise it is added as a new entry in newList
            event.mergeCandidates = [{...event}];
            newList.push(event);
        }
    });
    newList = newList.filter(el => !el.hasOwnProperty('toRemove'));
   // return newList;
    // merge process
    let res = [];
    newList.filter(el => el.hasOwnProperty('mergeCandidates')).forEach(el=> {
        res = res.concat(merge(el));
    });
   // console.log(mergeLog);
    return res;

    // auxiliary function

    // merge function. The problematic here is to find if there are different time schedule for a same event, it is
// legit (several event times like afternoon and evening shows) or if it is a mistake from one of the sources
  
    function merge(event){
        if (!event.hasOwnProperty('mergeCandidates')){// if there is no candidate to merge, return the event
            return [event];
        }
        if (event.mergeCandidates.length === 1){// if candidate list only contains the event itself, discard the list and return the event
            delete event.mergeCandidates;
            return [event];
        }else{// if there are several candidates, first choose the name, style, detailed style that are the best
            event.eventName = chooseBestEventName(event.mergeCandidates.map(el => el.eventName));
            event.eventStyle = andDoItWithStyle(event.mergeCandidates.map(el => el.eventStyle));
            const detailedStyleList = event.mergeCandidates.map(el => el.eventDetailedStyle);
            const maxLength = detailedStyleList.reduce((max, string) => Math.max(max, string.length), 0);
            event.eventDetailedStyle = detailedStyleList.filter(string => string.length === maxLength)[0];
            let dateList; // we now gather all the different time for the event. we have to determine if the different event time are legit or if it is a mistake
            const candidates = event.mergeCandidates;// keep a trace for the merge log
            const hasLocalSource = event.mergeCandidates.some(el => fromLocalSource(el));
            if (hasLocalSource){// if some events are from local source (site scraped and venue are the same), discard events from other sources (local source is assumed to be more reliable)
                event.mergeCandidates = event.mergeCandidates.filter(el => fromLocalSource(el));
                dateList = removeDoubles(event.mergeCandidates.map(el => el.unixDate));
            }else{// no local source. Event schedules time are analysed to see if they are legit or a mistake
                dateList = removeDoubles(event.mergeCandidates.map(el => el.unixDate));
                dateList = confirmDates(dateList,event.mergeCandidates);
            }
            if (dateList.length === 0){// no schedule appear to be more legit than the others. Keep the event merged
                // and keep an error log for manual checking. 
                // if a majority of sources have the same schedule, discard schedules with less occurrences.
                // if 0:00 is found, discard this time (midnight schedule should be handled in venues.json) if other times are present
                // keep then the earliest schedule time is kept
                let newDateList = mostOccurences(event.mergeCandidates.map(el => el.unixDate)); 
                if (newDateList.length > 1){// remove 0:00
                    newDateList = newDateList.filter(el => (new Date(el).getHours()) !== 0 || (new Date(el).getMinutes()) !==0);
                }
                const bestTime = Math.min(...newDateList);
                event.unixDate = bestTime;
                event.eventDate = event.mergeCandidates.find(el => el.unixDate === bestTime).eventDate;
                const times = removeDoubles(event.mergeCandidates.map(el => el.unixDate)).map(el => to2digits(String(new Date(el).getHours()))+':'+to2digits(String(new Date(el).getMinutes())));
                writeToLog('warning',event,['\x1b[31mInconsistent times for \x1b[36m%s\x1b[39m \x1b[0m(%s)\x1b[31m. Found \x1b[0m%s\x1b[31m. Consider merging or discarding.\x1b[0m',event.eventName,event.eventPlace,times],false);
                mergeLog = mergeLog + toMergeLog(event,candidates,hasLocalSource,true,showFullMergeLog);
                return [event];
            }else if (dateList.length === 1){// only one legit time schedule. Merge the candidates and remove the candidate list. Keep the different URLs just in case
                event.altURLs = removeDoubles(event.mergeCandidates.map(el => el.eventURL));
                if (hasLocalSource){// if local source, get its url
                    const localSource= event.mergeCandidates.find(el => fromLocalSource(el)); 
                    if (localSource.hasOwnProperty('eventURL')){
                        event.eventURL = localSource.eventURL;
                    }
                }
                mergeLog = mergeLog + toMergeLog(event,candidates,hasLocalSource,false,showFullMergeLog);
                delete event.mergeCandidates;
                return [event];
            }else{// several legit schedules, create new events for each show time.
                const newEvents= [];
                dateList.forEach(d => {
                    const singleEvent = createEvent(d,event);
                    mergeLog = mergeLog + toMergeLog(singleEvent,candidates,hasLocalSource,false,showFullMergeLog);
                    newEvents.push(singleEvent);
                });
                return newEvents;
            }
        }
    }
}


/******************************/
/*     auxiliary functions    */ 
/******************************/


// log function
function toMergeLog(event,mergedEvents,hasLocalSource,hasConflict,showFullMergeLog){
    const eventTag = hasConflict?'\x1b[31m':'\x1b[32m';
    if (showFullMergeLog || hasConflict){
        let res = '\x1b[0mEvent: '+eventTag+event.eventName+'\x1b[0m at '+eventTag+event.eventPlace
                +'\x1b[0m on '+eventTag+new Date(event.unixDate).getDate()+'/'
                +(new Date(event.unixDate).getMonth()+1)+'/'+new Date(event.unixDate).getFullYear() 
                +' ('+new Date(event.unixDate).getHours()+':'+to2digits(String(new Date(event.unixDate).getMinutes()))+')';
        if (hasLocalSource){
            res = res + '\x1b[0m from local source\n';
        }else{
            if (hasConflict){
                res = res + '\x1b[0m has conflicting schedule time:\x1b[0m\n';
            }else{
                res = res +'\x1b[0m obtained by comparing:\n';
            } 
        }
        mergedEvents.forEach(el =>{
        let tag = '\x1b[90m';
        if (hasLocalSource){
            if (fromLocalSource(el)){
                tag = '\x1b[36m';
            }
        }else{
            if (el.unixDate === event.unixDate){
                tag = '\x1b[36m';
            }
        }
        res = res +'   '+tag+el.eventName+'\x1b[0m at '+tag+el.eventPlace
            +'\x1b[0m on '+tag+new Date(el.unixDate).getDate()+'/'
            +(new Date(el.unixDate).getMonth()+1)+'/'+new Date(el.unixDate).getFullYear() 
            +' ('+new Date(el.unixDate).getHours()+':'+to2digits(String(new Date(el.unixDate).getMinutes()))+')\x1b[0m.'
            +'\x1b[0m Source: '+tag+el.source.name+'\x1b[0m\n';
        });
        return res+'\n';
    }
    return '';
}



// create an event at the schedule time d
function createEvent(d,event){
    const singleEvent = {...event};
    const candidateList = event.mergeCandidates.filter(el => el.unixDate === d);
    const localSource = candidateList.find(el => fromLocalSource(el));
    if (localSource===undefined){
        singleEvent.eventURL = candidateList[0].eventURL;
    }else{
        singleEvent.eventURL = localSource.eventURL;
    }
    
    singleEvent.eventDate = candidateList[0].eventDate;
    singleEvent.altURLs = removeDoubles(candidateList.map(el => el.eventURL));
    singleEvent.unixDate = d;
    singleEvent.source = candidateList[0].source;// ensure that if there is a local source,  this local source is assigned to the event as a reference
    delete singleEvent.mergeCandidates;
    return singleEvent;
}


// analyse the dates. A date is valid if only one date exist, or if a same source has two different 
// dates (we assume that if a soure has two schedule time for the same event it is not a mistake).
// Mistakes are assumed to be only if two different sources provide two different schedule time.
function confirmDates(dateList,eventList){
    if (dateList.length ===1){
        return dateList;
    }
    return dateList.filter(date =>{
        const eventAtDate = eventList.filter(el => el.unixDate === date).map(el => el.source.name);
        const eventAtOtherDate = eventList.filter(el => el.unixDate !== date).map(el => el.source.name);
        const intersection =  eventAtDate.filter(el => eventAtOtherDate.includes(el));
        return (intersection.length>0); // a date is valid if a source validates two different times
    });
}

// keep the longest event name (more information), then the one that contains a more balanced appearance (accents
// vs no accent, mix of upper and lower case)
function chooseBestEventName(eventNameList){
    const nameList = removeDoubles(eventNameList);
    if (nameList.length>1){
        const maxLength = Math.max(...nameList.map(string=>string.length));
        const nc = nameList.filter(string => string.length === maxLength);// keep the longest event names
        const regexAccents = /[éèêëàâäïîöôûüÉÈÊËÀÂÄÏÎÖÔÛÜøæå]/gi;
        const maxAccents = nc.reduce((max, string) => Math.max(max, (string.match(regexAccents) || []).length), 0);
        const nc2 = nc.filter(string => (string.match(regexAccents) || []).length === maxAccents);// keep the event names with the most accents
        function caseBalanceIndex(string){// a low score means a better balance between lower and upper case letters. It favorizes a little lower case letters
            return Math.abs(1+(string.match(/[A-Z]/g) || []).length - (string.match(/[a-z]/g) || []).length);
        }       
        const minCaseBalance = Math.min(...nc2.map(string=>caseBalanceIndex(string)));
        const nameCandidates = nc2.filter(string => caseBalanceIndex(string) === minCaseBalance);// keep the most balanced name
        return nameCandidates[0];
    }
    return eventNameList[0];
}


// among the styles, find if one matches the default styles. If not, keep the most informative (longest string)
function andDoItWithStyle(eventStyleList){
    const styleList = removeDoubles(eventStyleList);
    if (styleList.length>1){
        const commonElements = styleList.filter(element =>element => element !== '' && refStyleList.includes(element));
        if (commonElements.length > 0){
            return commonElements[0];
        }else{
            const maxLength = styleList.reduce((max, string) => Math.max(max, string.length), 0);
            return styleList.filter(string => string.length === maxLength)[0];// keep the longest style 
        }
    }
    return eventStyleList[0];
}

// test if two event names are similar. Either there are the same, or one include the other
// for example, 'Daniel Avery' and 'Daniel Avery B2B Laurent Garnier' is most probably the same event
// May have to be improved if there is a few differences between the two strings 
function similarName(name1,name2){
    const n1 = simplify(name1);
    const n2 = simplify(name2);
    if (n1===n2 || n1.includes(n2) || n2.includes(n1)){
        return true;
    }
    return false;
}

// return the elements of the list that have the maximum number of occurrences
function mostOccurences(list){
    const occurrences = list.reduce((count, element) => {
        count[element] = (count[element] || 0) + 1;
        return count;
    }, {});
    const maxOccurence = Math.max(...Object.values(occurrences));
    return Object.keys(occurrences).filter(key => occurrences[key] === maxOccurence).map(el => parseInt(el));
}




 
  

 