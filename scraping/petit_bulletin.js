var htmlContent;
var regex, day, date, eventName,url,nbEvents,salle,style, dateUni;
var listeSalles = [];
var out="";// = "PLACE,TITRE,UNIX,SIZE,GENRE,URL";

var outFile = "generated/petit_bulletin_scrapped.csv";
console.log("\n\n\n********* Petit Bulletin *********\n\n");

var url="https://www.petit-bulletin.fr/lyon/agenda-recherche.html?thema=musique-soirees&quoi=0&ou=0&quand=0&dateprecise=&qui=";
var mainURL="https://www.petit-bulletin.fr/lyon/agenda-recherche.html?idvillepb=lyon&pageagenda=12&thema=musique-soirees&quoi=0&ou=0&quand=0&dateprecise=&qui=&p=";

var i=1;
nbEvents = 0;
var occurrences = [0];
while (i<12){
    console.log(mainURL+i);
    url = mainURL+i;


    // Utiliser Fetch pour récupérer la page
    fetch(url)
    .then(response => {
        // Vérifier si la requête a réussi (statut 200)
        if (!response.ok) {
        occurrences = [];
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
        regex = /<a class="term-7"[^]*?<\/p>\n\n/g;
        occurrences = htmlContent.match(regex);
        
        //console.log(occurrences);
        if (occurrences != null){
           // console.log(occurrences);
        
            for (var valeur of occurrences) {
            console.log('Event:\n');
            nbEvents = nbEvents+1;
            regex = /(Lundi|Mardi|Mercredi|Jeudi|Vendredi|Samedi|Dimanche|Jusqu'au)/;// a changer au cas ou ce soit le nom d un spectacle
            day = valeur.match(regex);

            if (day != null) {
                day=day[1];
            }else{
                day='';
            }
            regex = /(\d+ (?:janvier|f.vrier|mars|avril|mai|juin|juillet|ao.t|septembre|octobre|novembre|d.cembre) \d*)/;
            date = valeur.match(regex)[1];
            dateUni = date.replace(/ /g,'-').replace('janvier','1').replace(/f.vrier/,'2').replace('mars','3').replace('avril','4').replace('mai','5').replace('juin','6').replace('juillet','7').replace(/ao.t/,'8').replace('septembre','9').replace('octobre','10').replace('novembre','11').replace(/d.cembre/,'12');
            if (dateUni.match(/(\d{4})/) == null){
                annee = 2023;
            }else{
                annee = +dateUni.match(/(\d{4})/)[1];
            }
            mois = +dateUni.match(/-(\d+)-/)[1]-1;
            jour = +dateUni.match(/(\d+)-/)[1]+1;
            var maDate = new Date(annee, mois, jour).getTime();
            //console.log(maDate);
            
            regex = /href="([^]*?)"/;
            url = "https://www.petit-bulletin.fr/lyon/"+valeur.match(regex)[1];
            regex = /\n([^]*?)<\/h2/;
            eventName = valeur.match(regex)[1];
            regex = /<br>([^]*?)<\/p/;
            salle = valeur.match(regex)[1];
            listeSalles.push(salle);
            regex=/#ec5957;'>\n([^]*?)<\/p/;
            if (valeur.match(regex) != null){
                style = valeur.match(regex)[1];
            }else{
                console.log('%c'+valeur,'color: red');
 //               const chalk = require('chalk');
   //             console.log(chalk.red('Ceci est du texte rouge'));
            }
            
            console.log(day,dateUni);    
            console.log(eventName);
            console.log(salle);
            console.log(style);
            console.log(url,'\n');
            out = out+salle+','+eventName+','+maDate+', 100,'+style+','+url+'\n';
            }
        }    
    })
      
  /*  .catch(error => {
        // Gérer les erreurs
        console.error('Erreur lors de la récupération de la page :', error);
    });*/

  i = i+1;
}

setTimeout(function() {
    console.log('Total events: ', nbEvents);
//console.log('Liste des salles: ', [...new Set(listeSalles)]);
const fs = require('fs');
fs.writeFileSync(outFile, out, 'utf-8', { flag: 'w' });
}, 2000);


// Transformer l'URL en chaîne de caractères


// Afficher la chaîne de caractères dans la console
//