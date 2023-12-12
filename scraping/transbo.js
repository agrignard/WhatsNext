var htmlContent;
var regex;
console.log("regex Tranbordeur");

var url="https://www.transbordeur.fr/agenda/";


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
    regex = /<div class="span4 articletype[^]*?class="cartoucheEvenement"/g;
    var occurrences = htmlContent.match(regex);
    //console.log(occurrences);
    for (var valeur of occurrences) {
      console.log('\nEvent:\n');
      //console.log(valeur);
      regex = /class="jourMois"> <h2> (\w*?)\./;
      var day = valeur.match(regex)[1];
      regex = /class="jourMois"> <h2> \w*?\. ([^]*?) </;
      var date = valeur.match(regex)[1];
      regex = /<a href="([^]*?)"/;
      var url = valeur.match(regex)[1];
      regex = /<h2> <a href="[^]*?"> ([^]*?) <\/a/;
      var eventName = valeur.match(regex)[1];
      console.log(day,date);
      console.log(eventName);
     console.log(url,'\n');
    }
  })
  .catch(error => {
    // Gérer les erreurs
    console.error('Erreur lors de la récupération de la page :', error);
  });


// Transformer l'URL en chaîne de caractères


// Afficher la chaîne de caractères dans la console
//