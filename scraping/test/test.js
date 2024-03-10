const tl = ['DIV.labels:eq(0) DIV.titre:eq(0)','DIV.artistes:eq(0) DIV:eq(0)','DIV.artistes:eq(0) DIV:eq(1)'];
// const tl = ['DIV.labels:eq(0) DIV.titre:eq(0) truc','DIV.artistes:eq(0) DIV:eq(0)','DIV.artistes:eq(0) DIV:eq(1)'];



function regroupTags(tagList){
    let regex = /(.*)(:eq\(\d+\))(?!.*:eq\(\d+\))/;
    let toProcess = tagList.slice();
    const res = [];
    while(toProcess.length >0){
        const tag = toProcess.pop();
        const shortTag = tag.replace(regex,(match, p1, p2, p3) => p1);
        const oldLength = toProcess.length;
        toProcess= toProcess.filter(el => el.replace(regex,(match, p1, p2, p3) => p1) !== shortTag);
        if (toProcess.length < oldLength){
            res.push(shortTag);
        }else{
            res.push(tag);
        }
    }
    return res;
}
// regroupTags(tl);

console.log(regroupTags(tl));