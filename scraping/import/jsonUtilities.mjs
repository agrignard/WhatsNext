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
    return simplify(p1.name) === simplify(p2.name) && p1.city === p2.city && p1.country === p2.country;
}