

var truc = 'texte <div href="http://www.yahoo.fr" src="http://truc.png" "prout" class ="premie?re" tata= "bt$r]-ue"> chose <span class = "t\\\/ot@o"> truc </span></div>';
console.log(clean(truc));


// let inputString = 'ils sont tous "grands" et "bleus" tour "rp"';
// let regex = /"([^"]*)"/g;

// let matches = inputString.match(regex);

// console.log(matches);

function cleanScripts(htmlContent){
  res = htmlContent.replace(/<script[^]*?<\/script>/g,'');// remove scripts
  return res;
}


function clean(content){
  function removeForbiddenCaracters(match,p,offset,string){
    return p.replace(/[~!@$%^&*()+=\-,>.<\/';:?\[\]\\{}|`#]/g,'');
  }

  function replaceClass(p) {
    return p.replace(/(?<![href|src]=[^"]*)("[^"]*")/g,removeForbiddenCaracters);
  }
  function findClasses(match,p,offset,string) {
    return '<'+p.replace(/([^"]*)("[^"]*")/g,replaceClass)+'>';
  }

  return content.replace(/<([^<>]*)>/g, findClasses);
}

