var Festoon = require('../');
var assert = require('assert');

var FIXTURES = {
  path: __dirname + '/fixtures',
  sources: {
    foo: 'foo.csv',
    list: ['foo.csv', 'bar.csv'],
    named: {
      foo: 'foo.csv',
      bar: 'bar.csv'
    }
  }
};

describe('Festoon()', function() {

  it('returns a Festoon instance without `new`', function() {
    var instance = Festoon();
    assert.ok(instance instanceof Festoon);
  });

  it('initializes data sources', function() {
    var c = new Festoon({
      sources: {
        foo: 'bar.csv'
      }
    });
    assert.ok(c.sources.foo, 'no source "foo" provided in config');
  });

  describe('setSource()', function() {
    it('sets a named source', function() {
      var c = new Festoon(FIXTURES);
      c.setSource('foo', ':foo.csv');
      assert.equal(c.sources.foo, ':foo.csv');
    });
  });

  describe('setSources()', function() {

    it('sets all sources', function() {
      var c = new Festoon(FIXTURES);
      c.setSources({x: 'foo.csv'});
      assert.ok(!c.sources.foo);
      assert.ok(c.sources.x);
    });

    it('throws an error on non-Objects', function() {
      var c = new Festoon();
      assert.throws(function() { c.setSources('foo'); });
      assert.throws(function() { c.setSources(null); });
      assert.throws(function() { c.setSources(123); });
    });

  });

  describe('load()', function() {

    beforeEach(createInstance);
    afterEach(removeInstance);

    it('loads a single source as a string', function(done) {
      this.instance.load('foo', function(error, data) {
        assert.ok(!error, 'error: ' + error);
        assert.equal(typeof data.foo, 'object', 'no "foo" data');
        done();
      });
    });

    it('throws an error for invalid sources', function() {
      assert.throws(function() {
        this.load('0xBADCAFE', function() { });
      }.bind(this));
    });

    it('loads a single source as an Array', function(done) {
      this.instance.load(['foo'], function(error, data) {
        assert.ok(!error, 'error: ' + error);
        assert.equal(typeof data.foo, 'object', 'no "foo" data');
        done();
      });
    });

    it('loads an aliased data source', function(done) {
      this.instance.load({bar: 'foo'}, function(error, data) {
        assert.ok(!error, 'error: ' + error);
        assert.equal(typeof data.bar, 'object', 'no "bar" data: ' + Object.keys(data));
        done();
      });
    });

    it('loads Array data sources', function(done) {
      this.instance.load('list', function(error, data) {
        assert.ok(!error, 'error: ' + error);
        assert.equal(typeof data.list, 'object');
        assert.ok(Array.isArray(data.list), 'data is not an Array');
        done();
      });
    });

    it('loads named (map) data sources', function(done) {
      this.instance.load('named', function(error, data) {
        assert.ok(!error, 'error: ' + error);
        assert.equal(typeof data.named, 'object');
        assert.ok(Array.isArray(data.named.foo), 'data is not an Array');
        done();
      });
    });

    it('loads data source references', function(done) {
      this.instance.setSource('ref', '#foo');
      this.instance.load(['ref', 'foo'], function(error, data) {
        assert.ok(!error, 'error: ' + error);
        assert.equal(typeof data.ref, 'object');
        assert.equal(typeof data.foo, 'object');
        assert.deepEqual(data.ref, data.foo);
        done();
      });
    });

    it('loads interpolated references', function(done) {
      this.instance.setSource('ref', '#:bar');
      this.instance.load(['ref', 'foo'], {bar: 'foo'}, function(error, data) {
        assert.ok(!error, 'error: ' + error);
        assert.equal(typeof data.ref, 'object');
        assert.equal(typeof data.foo, 'object');
        assert.deepEqual(data.ref, data.foo);
        done();
      });
    });

    it('loads function data sources', function(done) {
      this.instance.setSource('func', function(params, done) {
        return done(null, params);
      });
      var params = {x: 1, y: 2};
      this.instance.load('func', params, function(error, data) {
        assert.ok(!error, 'error: ' + error);
        assert.strictEqual(data.func, params);
        done();
      });
    });

    it('loads all data sources with "*"', function(done) {
      this.instance.setSources({x: 'foo.csv', y: 'bar.csv'});
      this.instance.load('*', function(error, data) {
        assert.ok(!error, 'error: ' + error);
        assert.ok(data.x, 'no "x" data');
        assert.ok(data.y, 'no "y" data');
        done();
      });
    });

    it('throws errors for missing interpolated data sources', function(done) {
      this.instance.setSource('x', ':x.csv');
      this.instance.load('x', {x: 'baz'}, function(error, data) {
        assert.ok(error);
        done();
      });
    });

  });

  describe('decorate()', function() {

    beforeEach(createInstance);
    afterEach(removeInstance);

    it('loads data from a request', function(done) {
      var load = this.instance.decorate('foo');
      var req = {};
      var res = {};
      load(req, res, function(error) {
        assert.ok(!error, 'error: ' + error);
        assert.equal(typeof res.locals.foo, 'object');
        done();
      });
    });

    it('interpolates data sources', function(done) {
      this.instance.setSource('bar', ':bar.csv');
      this.instance.load('bar', {bar: 'foo'}, function(error, data) {
        assert.ok(!error, 'error: ' + error);
        assert.equal(typeof data.bar, 'object');
        done();
      });
    });

    it('throws errors for missing interpolation placeholders', function() {
      this.instance.setSource('bar', ':bar.csv');
      assert.throws(function() {
        this.instance.load('bar', {baz: 'foo'}, function() { });
      }.bind(this));
    });

  });

  describe('Festoon.transform()', function() {

    beforeEach(createInstance);
    afterEach(removeInstance);

    it('transforms data', function(done) {
      this.instance.setSource('length', Festoon.transform('foo', function(data) {
        return data.length;
      }));

      this.instance.load('length', function(error, data) {
        assert.ok(!error, 'error: ' + error);
        assert.strictEqual(data.length, 2);
        done();
      });
    });

  });

  describe('Festoon.transform.filter()', function() {

    beforeEach(createInstance);
    afterEach(removeInstance);

    it('filters arrays', function(done) {
      this.instance.setSource('filter', Festoon.transform.filter('foo', function(d) {
        return d.a == 1;
      }));
      this.instance.load('filter', function(error, data) {
        assert.ok(!error, 'error: ' + error);
        assert.ok(Array.isArray(data.filter), 'data.filter is not an Array');
        assert.equal(data.filter.length, 1, 'filtered data length != 1');
        done();
      });
    });

    it('filters arrays by parameter value', function(done) {
      this.instance.setSource('filter', Festoon.transform.filter('foo', function(d) {
        return d.a == this.a;
      }));
      this.instance.load('filter', {a: 1}, function(error, data) {
        assert.ok(!error, 'error: ' + error);
        assert.ok(Array.isArray(data.filter), 'data.filter is not an Array');
        assert.equal(data.filter.length, 1, 'filtered data length != 1');
        done();
      });
    });

    it('recognizes objects uses `filter.call(params, data)`', function(done) {
      this.instance.setSource('filter', Festoon.transform.filter('named', function(data) {
        return data.foo;
      }));
      this.instance.load('filter', function(error, data) {
        assert.ok(!error, 'error: ' + error);
        assert.ok(Array.isArray(data.filter), 'data.filter is not an Array');
        assert.equal(data.filter.length, 2, 'filtered data length != 2');
        done();
      });
    });

  });

  describe('Festoon.transform.findByParam()', function() {

    beforeEach(createInstance);
    afterEach(removeInstance);

    it('does lookups by key', function(done) {
      this.instance.setSource('lookup', Festoon.findByParam('foo', 'a'));
      var params = {a: 1};
      this.instance.load('lookup', params, function(error, data) {
        assert.ok(!error, 'error: ' + error);
        assert.equal(typeof data.lookup, 'object');
        done();
      });
    });

    it('does lookups from one key to another', function(done) {
      this.instance.setSource('lookup', Festoon.findByParam('foo', 'b', 'a'));
      var params = {b: 1};
      this.instance.load('lookup', params, function(error, data) {
        assert.ok(!error, 'error: ' + error);
        assert.equal(typeof data.lookup, 'object');
        done();
      });
    });

  });

});

describe('Express compatibilty', function() {

  var express = require('express');
  var request = require('request');

  beforeEach(function(done) {
    createInstance.call(this);
    createServer.call(this, done);
  });

  afterEach(function(done) {
    removeInstance.call(this);
    removeServer.call(this, done);
  });

  it('returns an Express-compatible function: `load(req, res, next)`', function() {
    var load = this.instance.decorate('foo');
    assert.equal(load.length, 3);
  });

  it('serves up data', function(done) {
    this.app.get('/foo', this.instance.decorate('foo'), function(req, res) {
      assert.ok(res.locals.foo, 'no "foo" data');
      assert.ok(Array.isArray(res.locals.foo), '"foo" is not an Array');
      res.send('ok');
    });
    var url = this.baseURL + '/foo';
    request(url, function(error, res, body) {
      assert.ok(!error && res.statusCode === 200, 'bad request: ' + res.statusCode);
      assert.equal(body, 'ok');
      done();
    });
  });

  function createServer(done) {
    var self = this;
    var app = express();
    this.app = app;
    app.listen(process.env.PORT || 4001, function(error) {
      if (error) return done(error);
      self.server = this;
      self.baseURL = ['http://127.0.0.1:', this.address().port].join('');
      done();
    });
  }

  function removeServer(done) {
    var server = this.server;
    this.server = null;
    server.close();
    done();
  }
});

function createInstance() {
  this.instance = new Festoon(FIXTURES);
}

function removeInstance() {
  this.instance = null;
}
