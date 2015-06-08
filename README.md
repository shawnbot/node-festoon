# Counselor
Counselor makes it easy to "decorate" Express (or other Node-based web server)
apps with data, and does a bunch of stuff to make integrating small-ish tabular
data sets into your web apps. Here's a taste:

```js
var Counselor = require('counselor');

var counselor = new Counselor({
  sources: {
    people: 'people.csv'
  }
});
```

What's happening here? We've created a `Counselor` instance and registered one
named "data source", `people`, which will load data from `people.csv`.
Next, we'll create an [Express] server and "decorate" the response object with
that data:

```js
var express = require('express');
var app = express();

app.use('/', counselor.decorate('people'), function(req, res) {
  return res.render('index.html', res.data);
});

app.listen(1337, function(error) {
  var addr = this.address();
  console.log('listening @ http://%s:%s', 
});
```

When express [renders]() `index.html`, the underlying template engine will get
an object that looks like this as its data:

```js
{
  people: [ /* a list of people parsed from people.csv */ ]
}
```

So `counselor.decorate()` takes one or more data source names (which can be
specified in [a number of ways](#data-sources)), and will populate the response
object's `data` property with the corresponding data, loaded fresh at runtime.
**You describe your data sources declaratively, and Counselor will load them as
needed.**

Counselor also knows about "placeholders" in data source filenames. Say, for
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
counselor.setSource('person', 'people/:person.json');

app.use('/people/:person', counselor.decorate('person'), function(req, res) {
  return res.render('person.html', res.data);
});
```

Behind the scenes, Counselor interpolates the `person` parameter of the request
*into* each of the requested data source filenames, so:

```
'people/:person.json' + {person: 'betty'} = 'people/betty.json'
```

Counselor will also raise errors when either the interpolation variable (in
this case, `person`) isn't available as a request
[URL](http://expressjs.com/4x/api.html#req.params) or
[query](http://expressjs.com/4x/api.html#req.query) parameter.

[Express]: http://expressjs.com/
