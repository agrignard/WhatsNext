# WhatsNext


## SCRAPPING
* ``` node aspiratorex.js ```

Input: ```venues.json```
```
{
    "name": "terminal",
    "url": "https://www.terminal-club.com/evenements/",
    "eventsDelimiterRegex": "<div class=\"tribe-events-pro-photo__event-date-tag tribe-common-g-col\">[^]*?<div class=\"is-divider\" st",
    "eventDate": "<time class=\"tribe-events-pro-photo__event-date-tag-datetime\" datetime=\"([^]*?)\">",
    "eventURL": "<a href=\"([^]*?)\"",
    "eventName": "<h5[^]*?>([^]*?)<",
    "dateFormat": "yyyy-MM-dd",
    "baseURL": ""
}
```
Output: ```webSources/*```


* ```node scrapex.js```

Input: ```venues_test.json```

Output: ```generated/scrapexResult.csv```
## Places 
```mycity_events.csv ```

```
PLACE,LATITUDE,LONGITUDE,URL
Marché Gare,45.74155495036607,4.823288269540693,https://marchegare.fr/

```
Lyon example can be found here:
https://github.com/agrignard/WhatsNext/blob/main/www/lyon_place.csv

## Events
```mycity_places.csv ```

```
PLACE,TITRE,UNIX,SIZE,GENRE,URL
Marché Gare,H JEUNECRACK,1697116852000,500,Rock,https://www.infoconcert.com/ticket/concert-h-jeunecrack-lyon/1567691.html
```
Lyon example can be found here:
https://github.com/agrignard/WhatsNext/blob/main/www/lyon_event.csv

NB: Be sure that the name of the Place is <b>EXCATLY</b> the same in both file
