
const args = process.argv.slice(2).map(el => el.toLowerCase());
console.log(process.argv.length);

import {loadVenuesJSONFile} from '../import/jsonUtilities.mjs';
const venueList = loadVenuesJSONFile();

function normalizeArguments(args){
    if (args.length > 3){
        console.log("\x1b[31mError: too many arguments\x1b[0m");
        args = ['--help'];
    }
    if (args.some(arg => arg === '--help')){
        console.log('\nSyntax: node ./scrapex [\x1b[32msource_name\x1b[0m] '+
                    '[\x1b[32mcity\x1b[0m \x1b[90m(optional)\x1b[0m] '+
                    '[\x1b[32mcountry\x1b[0m \x1b[90m(optional)\x1b[0m]\n'+
                    'This will scrap websites with the corresponding name/city/country.\n'+
                    'Wildcards \'*\' allowed (\x1b[90mnode ./scrapex * Lyon\x1b[0m will scrap all websites from cities called Lyon)\n'+
                    'Alternatively, you can use options \x1b[90m--city=city_name\x1b[0m or \x1b[90m--country=country_name\x1b[0m, wildcards will be filled automatically');
        return undefined;
    }else{
        let i=0;
        let res ={name:'*', city:'*', country:'*'};
        for (let j = 0; j<args.length; j++){
            if (args[j].startsWith('--')){
                if (args[j].startsWith('--city=')){
                    res.city = args[j].replace('--city=','');
                }else if (args[i].startsWith('--country=')){
                    res.city = args[j].replace('--country=','');
                }else{
                    console.log('Wrong option: %s. Use option --help for syntax details.',args[i]);
                    return undefined;
                }
            }else{
                res[Object.keys(res)[i]] = args[j];
                i++;
            }
        }
        return res;
    }
}

console.log(normalizeArguments(args));
function getVenue(args,venueList){
    let venues = [];
    if (args.length ===1){// one argument, it is supposed to be a place
        if (args[0] === '*'){
    
        }
    }
}
