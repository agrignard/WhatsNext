import * as fs from 'fs';
//import * as cheerio from 'cheerio';

const lien = 'https://www.petit-bulletin.fr/lyon/agenda-recherche.html?idvillepb=lyon&pageagenda=12&thema=musique-soirees&quoi=0&ou=0&quand=0&dateprecise=&qui=&p=/';

// async function fetchAndRecode(url){
//     await fetch(url)
//     .then(async response => {
//       const encoding = response.headers.get('content-type').split('charset=')[1];
//       console.log(encoding); 
//       if (encoding === 'utf-8'){
//         return response;
//       }else{
//         try{
//             const decoder = new TextDecoder(encoding);
//             return await response.arrayBuffer().then(buffer => decoder.decode(buffer));
//         }catch(err){
//             console.log('Decoding problem while processing %s. Error: %s',url,err);
//             throw err;
//         }
        
//       }
//     })
//     .catch(error => console.error('\x1b[31mErreur lors de la récupération des entêtes :', error));
// }


async function fetchAndRecode(url){
    try{
        const response = await fetch(url);
        const encoding = response.headers.get('content-type').split('charset=')[1];
        console.log(encoding); 
        if (encoding === 'utf-8'){
            return await response.text();
        }else{
            try{
                const decoder = new TextDecoder(encoding);
                return  response.arrayBuffer().then(buffer => decoder.decode(buffer));
            }catch(err){
                console.log('Decoding problem while processing %s. Error: %s',url,err);
                throw err;
            }
        }
    }catch(error){
        throw error;
    }
}

const truc =  await fetchAndRecode(lien);

fs.writeFile('./test/essai.html', truc, 'utf8', (erreur) => {
    if (erreur) {
    console.error("Cannot write local %s", erreur);
    } else {
    console.log("sauv");
    }
});
