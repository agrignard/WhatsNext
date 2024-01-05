
## SCRAPPING
### ``` node aspiratorex.js ```

#### Input: ```venues.json```
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
#### Output: ```webSources/*```

### ```node analex.js```

#### Output: ```venueOutput.json```

### ```node scrapex.js```

#### Input: ```venues_test.json```

#### Output: ```generated/scrapexResult.csv```

## MAPPING
### ``` node datacleanex.js ```
#### Input: ```lyon_place.csv``` and ```lyon_event.csv```
#### Output: ```lyon_place.geojson``` and ```lyon_event.geojson```

### ``` node server.js ```
#### Input: ```lyon_place.geojson``` and ```lyon_event.geojson```
