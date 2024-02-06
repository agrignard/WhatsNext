import { sameDay} from './import/dateUtilities.mjs';
import { parse, isValid }  from 'date-fns';
import {simplify,removeDoubles} from './import/stringUtilities.mjs';
import {loadLinkedPages,loadVenuesJSONFile,getAliases,getStyleConversions,saveToJSON} from './import/fileUtilities.mjs';
import {getSource,jsonRemoveDouble,samePlace,getEventPlace} from './import/jsonUtilities.mjs';
import {getStyleList} from './import/fileUtilities.mjs';
import * as fs from 'fs';

const refStyleList = await getStyleList();
let eventList;
try{
    eventList =  await JSON.parse(await fs.promises.readFile('./generated/scrapResult.json', 'utf8'));
}catch(err) {
    console.error('\x1b[36mCannot open event JSON file\x1b[0m%s\n',err);
    throw err;
}

let newList = [];

// first pass: merge events at the same date and same hour

eventList.forEach(event =>{
    const samePlaceSameDayEvent = newList.find(el => samePlace(getEventPlace(el),getEventPlace(event))
        && sameDay(el.unixDate, event.unixDate)
       // && el.unixDate === event.unixDate
        && similarName(el.eventName,event.eventName));
    if (samePlaceSameDayEvent){
        if (samePlaceSameDayEvent.hasOwnProperty('mergeCandidates')){
            samePlaceSameDayEvent.mergeCandidates.push(event);
        }else{
            samePlaceSameDayEvent.mergeCandidates = [event];
        }       
    }else{
        event.mergeCandidates = [{...event}];
        newList.push(event);
    }
});

newList.filter(el => el.hasOwnProperty('mergeCandidates')).forEach(el=> {
    merge(el);
   // eventsToMerge = el.mergeCandidates.
    //console.log(el);
});


// display
newList.filter(el => el.hasOwnProperty('mergeCandidates')).forEach(el=> {
 //   console.log(el);
});

console.log(newList.filter(el => el.hasOwnProperty('mergeCandidates')).length);


function merge(event){
    if (event.mergeCandidates.length === 1){
        delete event.mergeCandidates;
    }else{
        event.eventName = chooseBestEventName(event.mergeCandidates.map(el => el.eventName));
        event.eventStyle = andDoItWithStyle(event.mergeCandidates.map(el => el.eventStyle));
        const detailedStyleList = event.mergeCandidates.map(el => el.eventDetailedStyle);
        const maxLength = detailedStyleList.reduce((max, string) => Math.max(max, string.length), 0);
        event.eventDetailedStyle = detailedStyleList.filter(string => string.length === maxLength)[0];
        if (event.mergeCandidates.some(el => fromLocalSource(event))){
            console.log('Event a merger: ',event);
            event.mergeCandidates = event.mergeCandidates.filter(el => fromLocalSource(event));
            const dateList = removeDoubles(event.mergeCandidates.map(el => el.unixDate));
            //delete event.mergeCandidates;
            dateList.forEach(d => {
                const singleEvent = {...event};
                singleEvent.eventURL = event.mergeCandidates.find(el => d).eventURL;
                singleEvent.unixDate = d;
                delete singleEvent.mergeCandidates;
                console.log(singleEvent);
            });
            console.log('\n\n');
        }
        const dateList = removeDoubles(event.mergeCandidates.map(el => el.unixDate));
    }
}

function fromLocalSource(event){
    return event.eventPlace === event.source.name;
}

function chooseBestEventName(eventNameList){
    const nameList = removeDoubles(eventNameList);
    if (nameList.length>1){
        const maxLength = nameList.reduce((max, string) => Math.max(max, string.length), 0);
        const nc = nameList.filter(string => string.length === maxLength);// keep the longest event names
        const regexAccents = /[éèêëàâäïîöôûüÉÈÊËÀÂÄÏÎÖÔÛÜøæå]/gi;
        const maxAccents = nc.reduce((max, string) => Math.max(max, (string.match(regexAccents) || []).length), 0);
        const nc2 = nc.filter(string => (string.match(regexAccents) || []).length === maxAccents);// keep the event names with the most accents
        function caseBalanceIndex(string){// a low score means a better balance between lower and upper case letters. It favorizes a little lower case letters
            return Math.abs(1+(string.match(/[A-Z]/g) || []).length - (string.match(/[a-z]/g) || []).length);
        }       
        const minCaseBalance = nc2.reduce((min, string) => Math.min(min, caseBalanceIndex(string)), 1000);
        const nameCandidates = nc2.filter(string => caseBalanceIndex(string) === minCaseBalance);// keep the most balanced name
        // console.log('list: ',nameList);
        // console.log('res:',nameCandidates,'\n');
        return nameCandidates[0];
    }
    return eventNameList[0];
}


function andDoItWithStyle(eventStyleList){
    const styleList = removeDoubles(eventStyleList);
    if (styleList.length>1){
        const commonElements = styleList.filter(element => refStyleList.includes(element));
        if (commonElements.length > 0){
            return commonElements[0];
        }else{
            const maxLength = styleList.reduce((max, string) => Math.max(max, string.length), 0);
            return styleList.filter(string => string.length === maxLength)[0];// keep the longest style 
        }
    }
    return eventStyleList[0];
}

function similarName(name1,name2){
    const n1 = simplify(name1);
    const n2 = simplify(name2);
    if (n1===n2 || n1.includes(n2) || n2.includes(n1)){
        return true;
    }
    return false;
}