
const moment = require('moment-timezone');

// Obtenir le fuseau horaire du pays "France"
//const fuseauHoraire = moment.tz.zone('Europe/Paris');

const fuseauHoraire = moment.tz.zone('France');

console.log(fuseauHoraire); // Affichera les informations sur le fuseau horaire de la France

const date = new Date();

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
  


  console.log(showDate(date));