import * as main from './main.js';
import * as mapUtils from './mapUtils.js';
export const placeToCoord = new Map();
export const placeToUrl = new Map();
export var places= [];
export var todaysEvent = new Map();
export var nbActiveEvent;

const showPlacesNotHandled= false;



export async function initPlaceInformation(){
    const response = await fetch(main.dataPlacePath + main.country+'_place.geojson');
    const data =   await response.json();
    for (var i = 0; i < data.features.length; i++) {
        placeToCoord.set(data.features[i].properties.title,data.features[i].geometry.coordinates);
        placeToUrl.set(data.features[i].properties.title,data.features[i].properties.description);
        places.push(data.features[i].properties.title);
    }
    console.log("Total places imported from " + main.dataPlacePath + main.country+ "_place.geojson: " + placeToCoord.size);
}

export async function getTodayEvents(_date){
    const response = await fetch(main.dataEventPath+ main.country+'_event.geojson');
    const data =   await response.json();
    var nbEventToday=0;
    todaysEvent=new Map();
    for (var i = 0; i < data.features.length; i++) {
        if(data.features[i].properties.time>_date){
            if(data.features[i].properties.time<(_date.getTime() + 86400000)){
                todaysEvent.set(data.features[i].properties.place,data.features[i].properties.title);
                nbEventToday= nbEventToday+1;
            } 
        }
    }
    let mapString = '';

    for (const [key, value] of todaysEvent) {
    mapString += " "+ key +" |";// + value + "\n";
    }
    return "";//mapString;
}


export async function getSortedNbEventPerPlaceMap(_date){
    const response = await fetch(main.dataEventPath+main.country+'_event.geojson');
    const data =   await response.json();
    const nbEventPerPlace = new Map();
    nbActiveEvent=0;
    for (var j = 0; j < places.length;j++){
        nbEventPerPlace.set(places[j], 0);
    }
    for (var i = 0; i < data.features.length; i++) {
        if(data.features[i].properties.time>_date){
            if (nbEventPerPlace.has(data.features[i].properties.place)) {
                nbEventPerPlace.set(data.features[i].properties.place, nbEventPerPlace.get(data.features[i].properties.place) + 1);
            } else {
                nbEventPerPlace.set(data.features[i].properties.place, 1);
            }
            nbActiveEvent = nbActiveEvent+1;
        }
    }    
    function sortMapByValue(map) {
        const sortedArray = [...map].sort((a, b) => b[1] - a[1]); // Sort by values in ascending order
        return new Map(sortedArray);
    }
    const sortedMap = sortMapByValue(nbEventPerPlace);
    return sortedMap;
}

export async function getSortedNbEventPerStyleMap(_date){
    const response = await fetch(main.dataEventPath+main.country+'_event.geojson');
    const data =   await response.json();
    const nbEventPerStyle = new Map();
    for (var j = 0; j < mapUtils.categoryColors.length;j++){
        nbEventPerStyle.set(mapUtils.categoryColors[j].value, 0);
    }
    for (var i = 0; i < data.features.length; i++) {
        if(data.features[i].properties.time>_date){
            if (nbEventPerStyle.has(data.features[i].properties.style)) {
                nbEventPerStyle.set(data.features[i].properties.style, nbEventPerStyle.get(data.features[i].properties.style) + 1);
            } else {
                nbEventPerStyle.set(data.features[i].properties.style, 1);
            }
        }
    }    
    function sortMapByValue(map) {
        const sortedArray = [...map].sort((a, b) => b[1] - a[1]); // Sort by values in ascending order
        return new Map(sortedArray);
    }
    const sortedMap = sortMapByValue(nbEventPerStyle);
    return sortedMap;
}

export async function getSortedNbEventPerDayMap(_date){
    const response = await fetch(main.dataEventPath+main.country+'_event.geojson');
    const data =   await response.json();
    const nbEventPerDay = new Map();
    var keyEntry;
    for (var i = 0; i < data.features.length; i++) {
        if(data.features[i].properties.time>_date){
            const tmpDate = new Date(data.features[i].properties.time);
            keyEntry = new Date(data.features[i].properties.time );
            keyEntry = new Date(keyEntry.setHours(0, 0, 0, 0));           
            if (nbEventPerDay.has(keyEntry.getTime())) {
                nbEventPerDay.set(keyEntry.getTime(), nbEventPerDay.get(keyEntry.getTime()) + 1);
            } else {
                nbEventPerDay.set(keyEntry.getTime(), 1);
            }
        }
    }
    function getDaysInYear(year) {
        const startDate = new Date(`${year}-01-01`);
        const endDate = new Date(`${year + 1}-01-01`);
        const days = [];

        for (let current = startDate; current < endDate; current.setDate(current.getDate() + 1)) {
            current = new Date(current.setHours(0, 0, 0, 0));
            days.push(new Date(current).getTime());
        }

        return days;
    }
    const yearToDisplay = 2025;
    const allDays = getDaysInYear(yearToDisplay);

    const valuesForDaysUnixTime = new Map();
    allDays.forEach(day => {
        const value = nbEventPerDay.get(day);
        valuesForDaysUnixTime.set(day, value);
    });

    // Créer une nouvelle Map avec des dates  comme clés
    let dateMap = new Map();
    valuesForDaysUnixTime.forEach((value, unixTimestamp) => {
        const date = new Date(unixTimestamp);
        dateMap.set(date, value);
    });
    return dateMap;
}

 //Show Places that are not well treated and the number of time it appears
 if(showPlacesNotHandled){
    console.log("THE FOLLOWING PLACES ARE NOT HANDLED");
    let occurrencesArray = Object.entries(unKnownPlaces);
    occurrencesArray.sort((a, b) => b[1] - a[1]);
    for (let [key, value] of occurrencesArray) {
        console.log(`Place ${key} : ${value} fois`);
    }
}

