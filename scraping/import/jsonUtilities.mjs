/**************************************/
/*    utilities to deal with json     */
/**************************************/

import {simplify} from './stringUtilities.mjs';

export function getEventPlace(object){
    return {'name':object.eventPlace, 'city':object.source.city, 'country':object.source.country};
}

export function getSource(event){
    return event.source;
}

// test if two JSON object have exactly the same key:value pairs
function isEqual(object1, object2) {
    const keyList = Object.keys(object1);
    if (keyList.length != Object.keys(object2).length){
        return false;
    }
    return keyList.every(key => object1[key] === object2[key]);
}

// return a list without duplicates
export function jsonRemoveDouble(objectList) {
    const ListWithoutDuplicates = [];
    for (const object of objectList) {
        if (!ListWithoutDuplicates.some(item => isEqual(object, item))) {
            ListWithoutDuplicates.push(object);
        }
      }
   return ListWithoutDuplicates;
}

export function samePlace(p1,p2){
    let p1name, p2name;
    if (p1.hasOwnProperty('eventPlace')){
        p1name = p1.eventPlace;
    }else if (p1.hasOwnProperty('name')){
        p1name = p1.name;
    }
    if (p2.hasOwnProperty('eventPlace')){
        p2name = p2.eventPlace;
    }else if (p2.hasOwnProperty('name')){
        p2name = p2.name;
    }
    return simplify(p1name) === simplify(p2name) && p1.city === p2.city && p1.country === p2.country;
}