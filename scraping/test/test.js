function reduceImgSize(html){
    const regexWidth = /(width\s*=\s*\")(.*?)\"/;
    const regexHeight = /(height\s*=\s*\")(.*?)\"/;
    const regexImg = /\<(?:img|svg).*?\>/g;
  
    function innerReplace(e1,e2,e3){
        if (e3 > 100){
            return e2+'50"';
        }
        return e1;
    }

    function replace(p1){
        let res = regexWidth.test(p1)?p1.replace(regexWidth,innerReplace):p1.replace(/img/,'img width="50"');
        res = regexHeight.test(res)?res.replace(regexHeight,innerReplace):res.replace(/img/,'img height="50"');
        return res;
    }
    return html.replace(regexImg,replace);
}

const  truc = 'ljmfe<img width="450" height = "30" class="eer">kmk';
console.log(reduceImgSize(truc));