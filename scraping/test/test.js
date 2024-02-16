// const date = new Date();
// const options = { timeZone: 'Europe/Paris' };
// const dateString = date.toLocaleString('en-US', options);
// console.log(dateString);
const moment = require('moment-timezone');
const { parse, isValid }  = require('date-fns');
const {convertDate, getDateConversionPatterns} = require('../import/dateUtilities.js');
const {getModificationDate} = require('../import/fileUtilities.js');

const truc = getModificationDate('../webSources/France/Lyon/Le Sucre/');
console.log(showDate(truc));

//const dateConversionPatterns = getDateConversionPatterns()['French'];


// const dateString = '24-10-2023 16:00 +01:00';
// const formatString = 'DD-MM-YYYY HH:mm Z'; // Le 'Z' indique que le fuseau horaire est inclus dans la chaîne de caractères

// const dateg = moment.tz(dateString, formatString, 'Europe/Paris'); // Remplacez 'Europe/Paris' par votre fuseau horaire approprié

// console.log(dateg.toString()); // Affichera la date convertie avec le fuseau horaire spécifié



// const truc = moment.tz('2024-02-12T12:00:00', 'Europe/Paris');
// console.log(truc.unix());
// const truc2 = moment.tz('2023-10-24T16:00:00', 'Europe/Paris');
// console.log(truc2.unix());

// console.log('\n\n\n');

// Créer une date avec le fuseau horaire 'Europe/Paris'
// const datef = moment.tz('2024-02-12T12:00:00', 'Europe/Paris');

// console.log(datef.toString()); // Affichera la date dans le fuseau horaire 'Europe/Paris'
// console.log(datef.unix());

// const s = "24-10-23-16:00";
// const dateFormat = "dd-MM-yy-HH:mm";

// const date = createDate(s, dateFormat, dateConversionPatterns, 'Europe/Paris');
// console.log('date Finale:',showDate(date));
// console.log(date.getTime());


// function createDate(s,dateFormat,dateConversionPatterns,timeZone,refDate) {
//     if (s.includes('tonight')){
//         return new Date();
//     }else{
//         s = convertDate(s,dateConversionPatterns);
//         const date = moment.tz(s,dateFormat.replace(/d/g,'D').replace(/y/g,'Y'), timeZone);
//         let tzDate = date.toDate();
//         if (!/yy/.test(dateFormat) && tzDate < refDate){// add one year if the date is past for more than one month. Useful when the year is not in the data
//             tzDate.setFullYear(tzDate.getFullYear() + 1);
//         }
//         return tzDate;
//     }
// }

// function createDate(s,dateFormat,dateConversionPatterns,timeZone) {
//     if (s.includes('tonight')){
//         return new Date();
//     }else{
//         s = convertDate(s,dateConversionPatterns);
//         const date = parse(s, dateFormat, new Date());
//         let tzDate = addTimeZone(date, timeZone).toDate();
//         if (tzDate < new Date()){// add one year if the date is past. Useful when the year is not in the data
//             tzDate.setFullYear(tzDate.getFullYear() + 1);
//         }
//         return tzDate;
//     }
//   }

// function addTimeZone(date, timeZone){
//     let normalizedDate = normalizeDate(date);
//     normalizedDate = '2023-10-24T16:00:00';
//     console.log('normalized date ',normalizedDate,' ',timeZone);
//     // const essai = moment.tz(normalizedDate);
//     // console.log('essai', essai.format());
//     const dateWithTimeZone = moment.tz(normalizedDate, timeZone);
//     console.log('unix ', dateWithTimeZone.unix());
//     const newDate = dateWithTimeZone.clone().tz('America/New_York');
//     console.log('unix ', newDate.unix());

//     //const dateWithTimeZone = moment.tz(normalizedDate, 'Europe/London');
//     // console.log('offset',dateWithTimeZone.utcOffset());
//     return dateWithTimeZone;
// }

// function normalizeDate(date){
//     const year = date.getFullYear();
//     const month = ('0' + (date.getMonth() + 1)).slice(-2);
//     const day = ('0' + date.getDate()).slice(-2);
//     const hours = ('0' + date.getHours()).slice(-2);
//     const minutes = ('0' + date.getMinutes()).slice(-2);
//     const seconds = ('0' + date.getSeconds()).slice(-2);
//     return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
// } 


// // Créer une date avec le fuseau horaire "Europe/Paris"
// const date = moment.tz('2024-02-12T12:00:00', 'Europe/Paris');
// const dd = date.toDate();
// //console.log('egsrg',showDate(dd));

// const date2 = normalizeDate(new Date());
// console.log(date2);

// const date3 = moment.tz(date2, 'Europe/Paris');
// const date4 = moment.tz(date2, 'America/New_York');
// console.log(date3.format());
// console.log(date4.format());

// Convertir la date dans le fuseau horaire "America/New_York"
//const newDate = date.clone().tz('America/New_York');

// Obtenir le fuseau horaire actuel de la date
//const timeZone = date.zone();

// Changer le fuseau horaire de la date en "Australia/Sydney"
// date.tz('Australia/Sydney');

// console.log(date.format()); // Affichera la date et l'heure dans le fuseau horaire "Australia/Sydney"


// const date = new Date();

// // Récupérer le décalage de temps en minutes entre l'heure locale et l'heure UTC
// const offsetMinutes = date.getTimezoneOffset();

// // Convertir le décalage en heures et minutes
// const offsetHours = Math.abs(Math.floor(offsetMinutes / 60));
// const offsetMinutesRemainder = Math.abs(offsetMinutes % 60);

// Déterminer si le décalage est positif ou négatif
// const sign = offsetMinutes > 0 ? "-" : "+";

// // Afficher le fuseau horaire
// const timeZone = `GMT${sign}${offsetHours}:${offsetMinutesRemainder}`;

// console.log(timeZone);


// const s = "24-10-23-16:00"
// const dateFormat = "dd-MM-yy-HH:mm";

// const date = parse(s, dateFormat, new Date());
// const str_date = "2015-05-01T22:00:00+10:00";//(date.toLocaleString()+"+1:00").replace(' ','T');
// //console.log(str_date);
// const date3 = new Date(Date.parse(str_date));
// const date4 = new Date(Date.parse("2015-05-01T22:00:00+04:00"));

// console.log(date3.toLocaleString());
// console.log(date4.toLocaleString());
// const s2 = "24-10-23-16:00+02:00"


// const date2 = parse(s2, dateFormat, new Date());
// console.log(date2.getTime());

// const timeZone = 'Asia/Ho_Chi_Minh';
// const date2 = moment.tz(date, timeZone).toDate();
// console.log(date2.getTime());

// const timeZone2 = 'Europe/Paris';
// const date3 = moment.tz(date, timeZone2).toDate();
// console.log(date3.getTime());
//console.log(showDate(date));

// const date2 = new Date();
// const unixDate = date2.getTime();
// console.log(unixDate);
// const timeZone = 'Asia/Ho_Chi_Minh';
// const date = moment.tz(date2, timeZone).toDate();
// const unixDate2 = date.getTime();
// console.log(unixDate2);



// const offset = date.getTimezoneOffset() * 60 * 1000; // Convertit le décalage en millisecondes
// const summerTimeOffset = 3600 * 1000; // Décalage pour l'heure d'été en millisecondes (1 heure)
// const isSummerTime = new Date(date.getFullYear(), 5, 1).getTimezoneOffset() !== date.getTimezoneOffset(); // Vérifie si l'heure d'été est en cours

// if (isSummerTime) {
//   date.setTime(date.getTime() - offset + summerTimeOffset); // Ajoute le décalage pour l'heure d'été
// }

//console.log(showDate(date));


// const moment = require('moment-timezone');
// const { TimeZone} = require('../import/dateUtilities.js');
// const timeZoneList = new TimeZone();


// let place = {city: "Lyon", country: "France"};



// // Récupérer l'offset de temps du fuseau horaire de la France

// const dateFrance = makeDate(place);

// place = {city: "Lyon", country: "Vietnam"};

// //console.log(tz.getTimeZone(place));

// const date = new Date();

// const dateVietnam = makeDate(place);


// console.log(showDate(dateFrance));
// console.log(showDate(dateVietnam));


// function makeDate(place){
//     const offset = moment.tz.zone(timeZoneList.getTimeZone(place)).utcOffset(new Date());
//     return new Date(new Date().getTime() + (offset * 60 * 1000));
// }




function showDate(date){
    const day = to2digits(String(date.getDate()));
    const month = to2digits(String(date.getMonth() + 1)); 
    const year = date.getFullYear();
    const hour = to2digits(String(date.getHours()));
    const minutes = to2digits(String(date.getMinutes()));
    const string = day+'/'+month+'/'+year+' (time: '+hour+':'+minutes+')';
    return string;
  }

  function to2digits(dateString){
    return dateString.replace(/(?<!\d)\d(?!\d)/g,p=>'0'+p);
  }
  

