var htmlContent;
var regex, dateUni, year, totalEventOnSite;
console.log("regex Tranbordeur");
var out="";// = "PLACE,TITRE,UNIX,SIZE,GENRE,URL";
var outFile = "generated/transbo_scrapped.csv";

var url="https://www.transbordeur.fr/agenda/";


// Afficher l'URL dans la console
console.log("URL originale : " + url);
nbEvents = 0;

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
    regex = /<div class="span4 articletype[^]*?class="cartoucheEvenement"/g;
    var occurrences = htmlContent.match(regex);
    totalEventOnSite= occurrences.length;
    for (var valeur of occurrences) {
      console.log('\nEvent: ' + nbEvents );
      regex = /class="jourMois"> <h2> (\w*?)\./;
      var day = valeur.match(regex)[1];
      regex = /class="jourMois"> <h2> \w*?\. ([^]*?) </;
      var date = valeur.match(regex)[1];
      //console.log("Raw date from the site " + date);
      
      //Replace month string to month number
      dateUni = date.replace(/ /g,'-').replace('janvier','1').replace(/f.vrier/,'2').replace('mars','3').replace('avril','4').replace('mai','5').replace('juin','6').replace('juillet','7').replace(/ao.t/,'8').replace('septembre','9').replace('octobre','10').replace('novembre','11').replace(/d.cembre/,'12')
      .replace('janv.','1').replace('févr.','2').replace('déc.','2');
      //console.log("Date with replacement " + dateUni);


      const date_string = dateUni;
      const pattern = /(?<day>\d+)-(?<month>\d+)-(?<year>\d+)/;
      const match = date_string.match(pattern);
      var day, month, year;
      if (match) {
        day = parseInt(match.groups.day, 10); // Convert to number to remove leading zeros
        month = parseInt(match.groups.month, 10);
        year = parseInt(20+ match.groups.year, 10);
        nbEvents=nbEvents+1;
      } else {
        console.log("Invalid date format: " + dateUni);
      }
      var maDate = new Date(year, month, day).getTime();
      regex = /<a href="([^]*?)"/;
      var url = "https://www.transbordeur.fr"+valeur.match(regex)[1];
      regex = /<h2> <a href="[^]*?"> ([^]*?) <\/a/;
      var eventName = valeur.match(regex)[1];
      console.log(eventName);
      console.log(maDate);
      console.log(url,'\n');
      if(maDate!=null){
        out = out+"Transbordeur"+','+eventName+','+maDate+',100,'+"Rock"+','+url+'\n';
      }else{
        console.log("Invalid date format for eventName: " + eventName + " date:  " + dateUni);
      }     
    }
  })
  .catch(error => {
    // Gérer les erreurs
    console.error('Erreur lors de la récupération de la page :', error);
  });

  setTimeout(function() {
    console.log('Total events: ', nbEvents, " written in " + outFile + " for a total of : " + totalEventOnSite);
  const fs = require('fs');
  fs.writeFileSync(outFile, out, 'utf-8', { flag: 'w' });
  }, 2000);
