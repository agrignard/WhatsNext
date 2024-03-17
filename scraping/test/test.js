const puppeteer = require('puppeteer');
const fs = require('fs');

async function getPageByPuppeteer(pageURL, timeOut){
    const browser = await puppeteer.launch({
        // headless: false
    });
    const page = await browser.newPage();
    await page.goto(pageURL);
    await page.setViewport({
        width: 1200,
        height: 800
    });

    await autoScroll(page, timeOut);

    const content = await page.content();
    await browser.close();

    // fs.writeFileSync('page.html', content);
    return content;
};

getPageByPuppeteer('https://www.ninkasi.fr/agenda',300);

async function autoScroll(page, timeOut){
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            var totalHeight = 0;
            var distance = 100;
            var timer = setInterval(() => {
                var scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if(totalHeight >= scrollHeight - window.innerHeight){
                    clearInterval(timer);
                    resolve();
                }
            }, timeOut);
        });
    });
}


// (async () => {
//   // Lancer une instance de navigateur Puppeteer
//   const browser = await puppeteer.launch();

//   // Ouvrir une nouvelle page
//   const page = await browser.newPage();

//   // Naviguer vers la page souhaitée
//   await page.goto('https://www.ninkasi.fr/agenda');

//   // Simuler le défilement de la page pour charger tout le contenu
// await autoScroll(page);

// //   // Attendre que la page soit complètement chargée
// // await page.waitForTimeout(2000); // Attendre 2 secondes pour être sûr que tout est chargé
// // await page.waitForNavigation();
// await page.waitForNavigation({ timeout: 60000 })

//   // Télécharger le contenu de la page
//   const content = await page.content();

//   // Fermer le navigateur Puppeteer
//   await browser.close();

//   fs.writeFileSync('page.html', content);
// })();

// async function autoScroll(page) {
//   await page.evaluate(async () => {
//     await new Promise((resolve, reject) => {
//       let totalHeight = 0;
//       let distance = 100;
//       let timer = setInterval(() => {
//         let scrollHeight = document.body.scrollHeight;
//         window.scrollBy(0, distance);
//         totalHeight += distance;
//         if (totalHeight >= scrollHeight) {
//           clearInterval(timer);
//           resolve();
//         }
//       }, 100);
//     });
//   });
// }
