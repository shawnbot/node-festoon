# Festoon
Festoon makes it easy to "decorate" [Express]--or other Node-based web
server--apps with data, and makes integrating small-ish tabular data sets into
your web apps a piece of cake. Here's a taste:

```js
var Festoon = require('festoon');

var festoon = new Festoon({
  sources: {
    people: 'people.csv'
  }
});
```

What's happening here? We've created a `Festoon` instance and registered one
named *data source*, `people`, which will load data from `people.csv`. Next,
let's create an [Express] server and "decorate" the response object with that
data:

```js
var express = require('express');
var app = express();

app.use('/', festoon.decorate('people'), function(req, res) {
  return res.render('index.html');
});

app.listen(1337, function(error) {
  var addr = this.address();
  console.log('listening @ http://%s:%s', 
});
```

When express [renders]() `index.html`, the underlying template engine will get
an array of parsed rows from `people.csv` in the `people` key of its
[res.locals](http://expressjs.com/4x/api.html#res.locals) object.

So `festoon.decorate()` takes one or more data source names (which can be
specified in a number of ways), and will populate the response locals with the
corresponding data, loaded fresh at runtime. **You describe your data sources
declaratively, and Festoon will load them as needed.**

Festoon also knows about *placeholders* in data source filenames. Say, for
instance, that you have detailed information for each of your people in a
directory structure like:

```
people/
|
+-- betty.json
+-- bobby.json
+-- etc.
```

Then we can do this:

```js
festoon.setSource('person', 'people/:person.json');

app.use('/people/:person', festoon.decorate('person'), function(req, res) {
  return res.render('person.html');
});
```

Behind the scenes, Festoon interpolates the `person` parameter of the request
*into* each of the requested data source filenames, so:

```
'people/:person.json' + {person: 'betty'} = 'people/betty.json'
```

Festoon will also raise errors when either the interpolation variable (in
this case, `person`) isn't available as a request
[URL](http://expressjs.com/4x/api.html#req.params) or
[query](http://expressjs.com/4x/api.html#req.query) parameter.

[Express]: http://expressjs.com/
