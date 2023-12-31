var htmlContent;
var regex,nbEvents;


var out="";// = "PLACE,TITRE,UNIX,SIZE,GENRE,URL";
var outFile = "generated/terminal_scrapped.csv";


console.log("regex");

// Récupérer l'URL du navigateur
//var url = window.location.href;
var url="https://www.terminal-club.com/evenements/";

nbEvents = 0;
// Afficher l'URL dans la console
console.log("URL originale : " + url);


// Utiliser Fetch pour récupérer la page
fetch(url)
  .then(response => {
    // Vérifier si la requête a réussi (statut 200)
    if (!response.ok) {
      throw new Error('Erreur de réseau');
    }
    
    // Extraire le contenu de la réponse
    return response.text();
  })
  .then(htmlContent => {
    // Faire quelque chose avec le contenu de la page (par exemple, l'afficher dans la console)
   // console.log("Contenu de la page :", htmlContent);
    //var chaineDeCaracteres = htmlContent.match(/Dojo/);
    //console.log("Chaîne de caractères : " + chaineDeCaracteres);
    let r;
    //const regex = /Dojo/g;
    regex = /<div class="tribe-events-pro-photo__event-date-tag tribe-common-g-col">[^]*?<div class="is-divider" st/g;
    var occurrences = htmlContent.match(regex);
    console.log("total number of event" + occurrences.length);
    for (var valeur of occurrences) {
      nbEvents = nbEvents+1;
      console.log('\n');
      regex = /<div class="no-margin no-padding"[^]*?>(\w*?)</;
      var day = valeur.match(regex)[1];
      //console.log(valeur.match(regex));
      regex = /<time class="tribe-events-pro-photo__event-date-tag-datetime" datetime="([^]*?)">/;
      var date = valeur.match(regex)[1];
      regex = /<a href="([^]*?)"/;
      var url = valeur.match(regex)[1];
      regex = /<h5[^]*?>([^]*?)<///;
      var eventName = valeur.match(regex)[1];
      console.log(day,date);
      console.log(eventName);
      console.log(url,'\n');
      out = out+"Terminal"+','+eventName+','+date+', 100,'+"Electro"+','+url+'\n';
    }
  })
  .catch(error => {
    // Gérer les erreurs
    console.error('Erreur lors de la récupération de la page :', error);
  });

  setTimeout(function() {
    console.log('Total events: ', nbEvents, " written in " + outFile);
    //console.log('Liste des salles: ', [...new Set(listeSalles)]);
    const fs = require('fs');
    fs.writeFileSync(outFile, out, 'utf-8', { flag: 'w' });
}, 5000);

// Transformer l'URL en chaîne de caractères


// Afficher la chaîne de caractères dans la console
//