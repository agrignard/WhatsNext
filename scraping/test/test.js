const s = '<img width= "220"> <svg width="443">';


  const regexWidth = /(\<(?:img|svg)[^\<]*width\s*=\s*\")([^\"]*)\"/g;
  const regexHeight = /(\<(?:img|svg)[^\<]*height\s*=\s*\")([^\"]*)\"/g;

  function replace(p1,p2,p3){
    if (p3 > 100){
      return p2+'100'+'\"';
    }
    return p1;
  }

console.log(s.match(regexWidth));
console.log(s.replace(regexWidth,replace));