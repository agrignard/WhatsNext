const fs = require('fs');
const cheerio = require('cheerio');

const content = fs.readFileSync('../test/test.html', 'utf-8');
const $page = cheerio.load(content);





// function getPath(element) {
//   let path = '';
//   let currentElement = element;

//   while (currentElement.length) {
//       let name = currentElement.get(0).name;
//       let id = currentElement.attr('id');
//       let className = currentElement.attr('class');
//       let index = currentElement.parent().children(`${name}.${className}`).index(currentElement) + 1;
//       console.log(name,index);
//       console.log(currentElement.parent().children().length);

//       let node = name;
//       if (id) {
//           node += `#${id}`;
//       }
//       if (className) {
//           node += `.${className.replace(/\s+/g, '.')}`;
//       }
//       if (index) {
//           node += `:eq(${index - 1})`;
//       }

//       path = node + (path ? '>' + path : '');
//       currentElement = currentElement.parent();
//   }

//   return path;
// }

function getPath(element) {
  let path = '';
  let currentElement = element;

  while (currentElement.length) {
      let name = currentElement.get(0).name;
      let id = currentElement.attr('id');
      let className = currentElement.attr('class');
      let index;
      console.log('el:',name,className);
      
    if (className){
      className = className.trim();
      const classList = className.split(' ');
      let childrenWithClass = currentElement.parent().children(name);
      childrenWithClass = childrenWithClass.filter((_,element)=>{
        const elClass = $page(element).attr('class');
        return elClass && !classList.some(cl => !elClass.includes(cl));
      });
      childrenWithClass.each((index,el) =>console.log('->',$page(el).attr('class')));
      index = childrenWithClass.index(currentElement) + 1;
    }else{
      const childrenWithoutClass = currentElement.parent().children(`${name}`).filter(function() {
          return !$page(this).attr('class');
      });
      index = childrenWithoutClass.index(currentElement) + 1;
    }
    let node = name;
    if (id) {
        node += `#${id}`;
    }
    if (className) {
        node += `.${className.replace(/\s+/g, '.')}`;
    }else{
      node += ':not([class])';
    }
    if (index) {
        node += `:eq(${index - 1})`;
    }

    path = node + (path ? '>' + path : '');
    currentElement = currentElement.parent();
  }
  return path;
}

// const mainTag = $page('*:contains("el12")').last();
const mainTag = $page('*:contains("09/03")').last();

// const tag = 'div.truc1:eq(1)>div:not([class]):eq(1)';
// console.log('tag', $page(tag).text().trim());
const path = getPath(mainTag);
console.log('texte cherché',$page(mainTag).text().trim());
console.log('maintag',path);
console.log($page(path).text());

const truc = $page('div.truc1').children('div.element.rep');

console.log(truc.length);

// const res = "body>div.truc1:eq(1)>div.element3:eq(0)";
// console.log('trc',$page(res).text());

// const aa = 'body:eq(1)';
// console.log($page.html());