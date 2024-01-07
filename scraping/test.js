
var truc = "1 23 2 1h 91";

//const regex =   /(?<!\d)\d(?!\d)/g; ///(?:^|[^0-9])([0-9])[^0-9]/g;

function unifyCharacters(s){
  return s.replace(/[\n\t\/\-]/g,' ').replace(/ {2,}/g,' ').replace(/^ /,'').replace(/ $/,'').replace(/ /g,'-').replace('h',':');
}


function to2digits(dateString){
  return dateString.replace(/(?<!\d)\d(?!\d)/g,p=>'0'+p);
}//

console.log(to2digits(unifyCharacters(" 12 22-4 19:20")));

//console.log(to2digits(truc));


// var truc = 'texte <div href="http://www.yahoo.fr" src="http://truc.png" "prout" class ="premie?re" tata= "bt$r]-ue"> chose <span class = "t\\\/ot@o"> truc </span></div>';
// truc = "<div class=\"smallcontent uk-width-1-4@m uk-grid-margin\"><div></div>";
// console.log(clean(truc));


// // let inputString = 'ils sont tous "grands" et "bleus" tour "rp"';
// // let regex = /"([^"]*)"/g;

// // let matches = inputString.match(regex);

// // console.log(matches);

// function cleanScripts(htmlContent){
//   res = htmlContent.replace(/<script[^]*?<\/script>/g,'');// remove scripts
//   return res;
// }


// function clean(content){  
//   function removeForbiddenCaracters(match,p,offset,string){
//     return p.replace(/[~!$%@^&*()+=\-,>.<\/';:?\[\]\\{}|`#]/g,'');
//   }

//   function replaceClass(p) {
//     return p.replace(/(?<!(?:href|src)=[^"]*)("[^"]*")/g,removeForbiddenCaracters);
//   }
//   function findClasses(match,p,offset,string) {
//    console.log('\n'+p);
//     return '<'+p.replace(/([^"]*)("[^"]*")/g,replaceClass)+'>';
//   }
//  // console.log(content.match(/<([^<>]*)>/g));
//   return content.replace(/<([^<>]*)>/g, findClasses);
// }

