var extend = require('extend');
var async = require('async');
var fs = require('fs');
var joinPath = require('path').join;
var tito = require('tito');

var Counselor = function(config) {
  // support calling Counselor() without `new`
  if (!(this instanceof Counselor)) {
    return new Counselor(config);
  }

  this.config = config || {};
  this.sources = {};
  this.loaders = extend({}, Counselor.loaders, this.config.loaders);

  this.interpolationPattern = this.config.interpolationPattern || /:(\w+)/g;

  if (this.config.sources) {
    this.addSources(this.config.sources);
  }
};

Counselor.prototype = {

  addSources: function(sources) {
    if (Array.isArray(sources)) {
      sources.forEach(function(source) {
        this.setSource(source.id, source);
      }, this);
    } else {
      for (var id in sources) {
        this.setSource(id, sources[id]);
      }
    }
    return this;
  },

  setSource: function(id, source) {
    if (!id) throw new Error('invalid source id: "' + id + '"');
    this.sources[id] = source;
    return this;
  },

  setSources: function(sources) {
    if (!sources || typeof sources !== 'object') {
      throw new Error('sources must be an Object, got ' + typeof sources);
    }
    this.sources = sources;
    return this;
  },

  decorate: function(sources) {
    var self = this;
    return function loader(req, res, next) {
      if (!res.data) res.data = {};
      var params = extend({}, req.params, req.query);
      self.load(sources, params, function(error, data) {
        if (error) return next(error);
        extend(res.data, data);
        return next();
      });
    };
  },

  load: function(sources, params, next) {
    if (arguments.length === 2) {
      next = params;
      params = {};
    }
    sources = this.interpolateSources(sources, params);
    return this.loadSources(sources, params, next);
  },

  interpolateSources: function(sources, params) {
    if (sources === '*') {
      sources = objectify(Object.keys(this.sources));
    } else if (typeof sources === 'string') {
      sources = objectify([sources]);
    } else if (typeof sources === 'object') {
      if (Array.isArray(sources)) {
        sources = objectify(sources);
      }
    }

    for (var dest in sources) {
      var src = sources[dest];
      if (!src) throw new Error('no such data source: "' + src + '"');
      sources[dest] = this.interpolate(this.sources[src], params);
    }

    return sources;
  },

  interpolate: function(value, params) {
    if (typeof value === 'object') {
      return mapObject(value, this.interpolate, this);
    } else if (typeof value === 'function') {
      return value;
    }

    // always coerce to a string
    value = String(value).replace(this.interpolationPattern, function(_, key) {
      if (!(key in params)) {
        throw new Error('non-existent key: "' + key + '" in "' + value + '"');
      }
      return params[key];
    });

    // follow references to other data sources
    if (value.charAt(0) === '#') {
      var id = value.substr(1);
      if (!(id in this.sources)) {
        throw new Error('bad source reference: "' + value + '"');
      }
      value = this.interpolate(this.sources[id]);
    }

    return value;
  },

  loadSources: function(sources, params, done) {
    var data = sources[0] ? [] : {};
    var self = this;
    async.map(Object.keys(sources), function(id, next) {
      self.loadSource(sources[id], params, function(error, source) {
        data[id] = source;
        return next(error);
      });
    }, function(error) {
      done(error, data);
    });
  },

  loadSource: function(source, params, done) {
    switch (typeof source) {
      case 'string':
        return this.loadFile(source, done);

      case 'function':
        return source.call(this, params, done);

      case 'object':
        if (source.file) {
          return this.loadFile(source.file, done);
        } else if (Array.isArray(source)) {
          var self = this;
          return async.map(source, function(src, next) {
            self.loadSource(src, params, next);
          }, done);
        } else {
          return this.loadSources(source, params, done);
        }
    }
    throw new Error('invalid source type: ' + typeof source);
  },

  loadFile: function(filename, done) {
    var path = this.config.path;
    if (path) filename = joinPath(path, filename);
    var ext = filename.split('.').pop();
    if (ext in this.loaders) {
      return this.loaders[ext].call(this, filename, done);
    } else {
      var loader = this.loaders['default'];
      if (loader) return loader.call(this, filename, done);
    }
    throw new Error('no loader found for: "' + filename + '"');
  }

};

Counselor.getTabularLoader = function(type, options) {
  return function(filename, done) {
    var parse = tito.formats.createReadStream(type, options);
    var data = [];
    return fs.createReadStream(filename)
      .on('error', done)
      .pipe(parse)
      .on('error', done)
      .on('data', function(d) {
        data.push(d);
      })
      .on('end', function() {
        done(null, data);
      });
  };
};

Counselor.loadJSON = function(filename, done) {
  fs.readFile(filename, function(error, buffer) {
    if (error) return done(error);
    try {
      var data = JSON.parse(buffer.toString());
    } catch (error) {
      return done(error);
    }
    return done(null, data);
  });
};

Counselor.loadText = function(filename, done) {
  fs.readFile(filename, function(error, buffer) {
    if (error) return done(error);
    return done(null, buffer.toString());
  });
};

Counselor.loaders = {
  json: Counselor.loadJSON,
  csv: Counselor.getTabularLoader('csv'),
  tsv: Counselor.getTabularLoader('tsv'),
  txt: Counselor.loadText,
  // 'default': Counselor.loadText
};

Counselor.transform = function(source, transform) {
  return function(params, done) {
    this.load(source, params, function(error, data) {
      if (source in data) {
        data = data[source];
      } else {
        console.warn('data lacks key:', source);
      }
      return error
        ? done(error)
        : done(null, transform(data, params));
    });
  };
};

// creates a lookup function that returns the first value for which
// the test() function returns truthy in the data source with the
// given id.
Counselor.findByParam = function(sourceId, param, key) {
  if (typeof sourceId !== 'string') {
    throw new Error('findByParam() requires a single source id as the first argument');
  }
  if (!key) key = param;
  return Counselor.transform(sourceId, function(data, params) {
    var id = params[param];
    return data.filter(function(d, i) {
      return d[key] == id;
    })[0];
  });
};

Counselor.transform.filter = function(sourceId, filter) {
  if (typeof sourceId !== 'string') {
    throw new Error('findByParam() requires a single source id as the first argument');
  }
  return Counselor.transform(sourceId, function(data, params) {
    return Array.isArray(data)
      ? data.filter(filter, params)
      : filter.call(params, data);
  });
};

function objectify(keys, values) {
  var obj = {};
  keys.forEach(function(key) {
    obj[key] = values ? values[key] : key;
  });
  return obj;
}

function mapObject(obj, fn, thisArg) {
  var out = {};
  for (var key in obj) {
    out[key] = fn.call(thisArg, obj[key], key);
  }
  return out;
}

function getFilenameRelativeTo(filename, path) {
  if (!path) return filename;
  else if (filename.match(/^[.\/]/)) return filename;
  else if (path.match(/\/$/)) return path + filename;
  return [path, filename].join('/');
}

module.exports = Counselor;
