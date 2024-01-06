

truc = 'texte <div class="premie?re" tata="bt$r]ue"> chose <span class = "t\\\/ot@o">truc </span></div>';
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
  function removeForbiddenCaracters(string){
    return string.replace(/[~!@$%^&*()+=,.\/';:?><\[\]\\{}|`#]/g,'');
  }

  function replaceInTag(match,p,offset,string) {
    return '<'+p.replace(/"[^"]*"/g,removeForbiddenCaracters)+'>';
  }
  return content.replace(/<([^<]*)>/g, replaceInTag);
}


// let inputString = 'Date: 2022-12-28';
// let regex = /(\d{4})-(\d{2})-(\d{2})/;
// let replacedString = inputString.replace(regex, '$3/$2/$1');

// console.log(replacedString);
