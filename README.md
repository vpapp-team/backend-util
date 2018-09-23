# backend-util

[![Greenkeeper badge](https://badges.greenkeeper.io/vpapp-team/backend-util.svg)](https://greenkeeper.io/)

# modules
> ## loader
> * `loader(reload)`, alias for `loader.readDir(__dirname, undefined, reload)`
> * `loader.readDir(dir, master, reload)`
>
> | arg | type | default | optional | description |
> | --- | --- | --- | --- |
> | dir | string | / | false | the folder to load |
> | master | string | / | true | the direcory the folder is located in |
> | reload | boolean | false | true | whether to clear cache before requiring |
> ## snowflake
> `snowflake`: class FlakeID
> * `constructor({epoche:int, datacenter:int, worker:int})`: return a new snowflaker
> * `next(cb)`: get the next snowflake (cb optional as long sequence doesnt overflow)
> * `undo(snowflake, base)`: resolve a snowflake given in a given base encoding
>
> `snowflake.Base64`: object
> * `fromInt(number)`: convert number to base64
> * `toInt(string)`: convert base64 string to number
>
> ## httpsCert
> class HTTPS_CERTS extends EventEmitter
> * event `CHANGE`: fired when a cert file changes
>
> supported params: `ca`, `cert`, `passphrase`, `key`, `pfx`  
> values have to be file locations as strings

# http(s)
> ## denie
> | arg | type | default | optional |
> | --- | --- | --- | --- |
> | resp | [http.ServerResponse](https://nodejs.org/api/http.html#http_class_http_serverresponse) | / | false |
> | msg | string | / | true |
> | headerOverwrite | object | / | true |
> | statusCode | number | 400 | true |
> ## accept
> | arg | type | default | optional |
> | --- | --- | --- | --- |
> | resp | [http.ServerResponse](https://nodejs.org/api/http.html#http_class_http_serverresponse) | / | false |
> | data | everything thats json.stringifiable | / | true |
> | headerOverwrite | object | / | true |
> | statusCode | number | 200 | true |
> ## acceptFile
> | arg | type | default | optional |
> | --- | --- | --- | --- |
> | resp | [http.ServerResponse](https://nodejs.org/api/http.html#http_class_http_serverresponse) | / | false |
> | filePath | string | / | false |
> | headerOverwrite | object |
/ | true |
> | range | string | / | true |
> | statusCode | number | 200 | true |
> ## getBody
> | arg | type | default | optional |
> | --- | --- | --- | --- |
> | stream | [http.IncomingMessage](https://nodejs.org/api/http.html#http_class_http_incomingmessage) | / | false |
> | callback | function(err, data:Buffer) | / | false |
> ## getWebpage
> returns a Promise that resolves with data as a buffer
>
> | arg | type | default | optional | description |
> | --- | --- | --- | --- | --- |
> | ref | string or object | null | false | ether a url or an url object |
> | paramOverwrites | object | {} | true | request params to overwrite |
> | maxRedirects | number | 3 | true | the max redirects to follow |
> ## handleCookie
> returns a header object
>
> | arg | type | default | optional | description |
> | --- | --- | --- | --- | --- |
> | setCookie | string | null | true | string for 'Set-Cookie' header |
> | headers | Object | null | true | additional headers |

# cluster
> ## requestMaster
> | arg | type | default | optional | description |
> | --- | --- | --- | --- | --- |
> | api | string | / | false | the api to request in master |
> | cb | function(data) | / | false | callback to call when master responds |
> | ...args | / | / | true | args to parse to the api |

# sql
> ## promisifiedQuery
> returns a promise that resolves with the matching rows
>
> | arg | type | default | optional | description |
> | --- | --- | --- | --- | --- |
> | connectionOrPool | / | / | false | the connection/pool to the mysql server |
> | query | string | / | false | the sql query |
> | params | / | / | true | params to replace `?` with in query |
> | retrys | number | 3 | true | how often to retry when a request fails |

# other
> ## betweenNum
> returns a boolean
>
> | arg | type | default | optional | description |
> | --- | --- | --- | --- | --- |
> | worth | number | / | false | the number to check for |
> | lowerBound | number | / | false | the lower bound |
> | upperBound | number | / | false | the upper bound |
> | tolerance | number | 0 | true | numbers by which the lower/upper bound are allowed to be incorrect |
> | inclusive | boolean | false | true | whether to include the bound's value |
> ## pad
> returns as a padded string
>
> | arg | type | default | optional | description |
> | --- | --- | --- | --- | --- |
> | txt | number/string | / | false | the value to pad |
> | width | number | 1 | true | the target string's length |
> | z | string/number | 0 | true | what to pad with, length: 1 |
> ## unDoub
> returns an array with all values that `===`
>
> | arg | type | default | optional | description |
> | --- | --- | --- | --- | --- |
> | array | array | / | false | the array to filter |
> ## parseDataStatus
> | arg | type | default | optional | description |
> | --- | --- | --- | --- | --- |
> | req | [http.IncomingMessage](https://nodejs.org/api/http.html#http_class_http_incomingmessage) | / | false | the http request to parse the body of |
> | cb | function(err, {has:[...]}) | / | false | the callback getting fired when done |

# security
> ## genSalt
> returns a random hex string
>
> | arg | type | default | optional | description |
> | --- | --- | --- | --- | --- |
> | length | number | / | false | the length of the random salt |
> ## buildHash
> returns hash as a string
>
> | arg | type | default | optional | description |
> | --- | --- | --- | --- | --- |
> | algorithm | string | 'sha512' | false | the hashing algorithm to use |
> | password | string | / | false | the data to hash |
> | salt | string | / | false | salt to improve hash security |
> ## sign
> returns signature as a string
>
> | arg | type | default | optional | description |
> | --- | --- | --- | --- | --- |
> | data | string | / | false | the data to sign |
> | privKey | string | / | false | the privKey to sign with |
> ## verifySignature
> returns a boolean whether its a valid sign
>
> | arg | type | default | optional | description |
> | --- | --- | --- | --- | --- |
> | data | string | / | false | the data to validate |
> | signature | string | / | false | the signature to validate |
> | pubKey | string | / | false | the pubKey to validate with |

# extends
> ## Map.prototype.hasCaseInsensitive
> checks whether a map contains a key ignoring case sensitivity
> returns a boolean
>
> | arg | type | default | optional | description |
> | --- | --- | --- | --- | --- |
> | targetKey | / | / | false | the key to search for |
> ## Map.prototype.getCaseInsensitive
> gets a key of a map ignoring case sensitivity
> returns the keys matching value
>
> | arg | type | default | optional | description |
> | --- | --- | --- | --- | --- |
> | targetKey | / | / | false | the key to search for |
> ## Map.prototype.find
> find an item in a map based on a boolean function
> search function should return true if its the item you search for
> returns the value of the searched item
>
> | arg | type | default | optional | description |
> | --- | --- | --- | --- | --- |
> | fn | function(val, key, map) | / | false | the search function |
> ## Map.prototype.filter
> returns a new map with the filtered items
> search function should return true to copy the item to the new map
>
> | arg | type | default | optional | description |
> | --- | --- | --- | --- | --- |
> | fn | function(val, key, map) | / | false | the search function |
> ## Map.prototype.array
> returns all values of the map as an array
> ## String.prototype.removeHTML
> returns the string without html elements
