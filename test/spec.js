var Counselor = require('../');
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

describe('Counselor()', function() {

  it('returns a Counselor instance without `new`', function() {
    var c = Counselor();
    assert.ok(c instanceof Counselor);
  });

  it('initializes data sources', function() {
    var c = new Counselor({
      sources: {
        foo: 'bar.csv'
      }
    });
    assert.ok(c.sources.foo, 'no source "foo" provided in config');
  });

  describe('setSource()', function() {
    it('sets a named source', function() {
      var c = new Counselor(FIXTURES);
      c.setSource('foo', ':foo.csv');
      assert.equal(c.sources.foo, ':foo.csv');
    });
  });

  describe('setSources()', function() {

    it('sets all sources', function() {
      var c = new Counselor(FIXTURES);
      c.setSources({x: 'foo.csv'});
      assert.ok(!c.sources.foo);
      assert.ok(c.sources.x);
    });

    it('throws an error on non-Objects', function() {
      var c = new Counselor();
      assert.throws(function() { c.setSources('foo'); });
      assert.throws(function() { c.setSources(null); });
      assert.throws(function() { c.setSources(123); });
    });

  });

  describe('load()', function() {

    beforeEach(createWithFixtures);
    afterEach(removeCounselor);

    it('loads a single source as a string', function(done) {
      this.counselor.load('foo', function(error, data) {
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
      this.counselor.load(['foo'], function(error, data) {
        assert.ok(!error, 'error: ' + error);
        assert.equal(typeof data.foo, 'object', 'no "foo" data');
        done();
      });
    });

    it('loads an aliased data source', function(done) {
      this.counselor.load({bar: 'foo'}, function(error, data) {
        assert.ok(!error, 'error: ' + error);
        assert.equal(typeof data.bar, 'object', 'no "bar" data: ' + Object.keys(data));
        done();
      });
    });

    it('loads Array data sources', function(done) {
      this.counselor.load('list', function(error, data) {
        assert.ok(!error, 'error: ' + error);
        assert.equal(typeof data.list, 'object');
        assert.ok(Array.isArray(data.list), 'data is not an Array');
        done();
      });
    });

    it('loads named (map) data sources', function(done) {
      this.counselor.load('named', function(error, data) {
        assert.ok(!error, 'error: ' + error);
        assert.equal(typeof data.named, 'object');
        assert.ok(Array.isArray(data.named.foo), 'data is not an Array');
        done();
      });
    });

    it('loads data source references', function(done) {
      this.counselor.setSource('ref', '#foo');
      this.counselor.load(['ref', 'foo'], function(error, data) {
        assert.ok(!error, 'error: ' + error);
        assert.equal(typeof data.ref, 'object');
        assert.equal(typeof data.foo, 'object');
        assert.deepEqual(data.ref, data.foo);
        done();
      });
    });

    it('loads interpolated references', function(done) {
      this.counselor.setSource('ref', '#:bar');
      this.counselor.load(['ref', 'foo'], {bar: 'foo'}, function(error, data) {
        assert.ok(!error, 'error: ' + error);
        assert.equal(typeof data.ref, 'object');
        assert.equal(typeof data.foo, 'object');
        assert.deepEqual(data.ref, data.foo);
        done();
      });
    });

    it('loads function data sources', function(done) {
      this.counselor.setSource('func', function(params, done) {
        return done(null, params);
      });
      var params = {x: 1, y: 2};
      this.counselor.load('func', params, function(error, data) {
        assert.ok(!error, 'error: ' + error);
        assert.strictEqual(data.func, params);
        done();
      });
    });

    it('loads all data sources with "*"', function(done) {
      this.counselor.setSources({x: 'foo.csv', y: 'bar.csv'});
      this.counselor.load('*', function(error, data) {
        assert.ok(!error, 'error: ' + error);
        assert.ok(data.x, 'no "x" data');
        assert.ok(data.y, 'no "y" data');
        done();
      });
    });

    it('throws errors for missing interpolated data sources', function(done) {
      this.counselor.setSource('x', ':x.csv');
      this.counselor.load('x', {x: 'baz'}, function(error, data) {
        assert.ok(error);
        done();
      });
    });

  });

  describe('decorate()', function() {

    beforeEach(createWithFixtures);
    afterEach(removeCounselor);

    it('returns an Express-compatible function: `load(req, res, next)`', function() {
      var load = this.counselor.decorate('foo');
      assert.equal(load.length, 3);
    });

    it('loads data from a request', function(done) {
      var load = this.counselor.decorate('foo');
      var req = {};
      var res = {};
      load(req, res, function(error) {
        assert.ok(!error, 'error: ' + error);
        assert.equal(typeof res.locals.foo, 'object');
        done();
      });
    });

    it('interpolates data sources', function(done) {
      this.counselor.setSource('bar', ':bar.csv');
      this.counselor.load('bar', {bar: 'foo'}, function(error, data) {
        assert.ok(!error, 'error: ' + error);
        assert.equal(typeof data.bar, 'object');
        done();
      });
    });

    it('throws errors for missing interpolation placeholders', function() {
      this.counselor.setSource('bar', ':bar.csv');
      assert.throws(function() {
        this.counselor.load('bar', {baz: 'foo'}, function() { });
      }.bind(this));
    });

  });

  describe('Counselor.transform()', function() {

    beforeEach(createWithFixtures);
    afterEach(removeCounselor);

    it('transforms data', function(done) {
      this.counselor.setSource('length', Counselor.transform('foo', function(data) {
        return data.length;
      }));

      this.counselor.load('length', function(error, data) {
        assert.ok(!error, 'error: ' + error);
        assert.strictEqual(data.length, 2);
        done();
      });
    });

  });

  describe('Counselor.transform.filter()', function() {

    beforeEach(createWithFixtures);
    afterEach(removeCounselor);

    it('filters arrays', function(done) {
      this.counselor.setSource('filter', Counselor.transform.filter('foo', function(d) {
        return d.a == 1;
      }));
      this.counselor.load('filter', function(error, data) {
        assert.ok(!error, 'error: ' + error);
        assert.ok(Array.isArray(data.filter), 'data.filter is not an Array');
        assert.equal(data.filter.length, 1, 'filtered data length != 1');
        done();
      });
    });

    it('filters arrays by parameter value', function(done) {
      this.counselor.setSource('filter', Counselor.transform.filter('foo', function(d) {
        return d.a == this.a;
      }));
      this.counselor.load('filter', {a: 1}, function(error, data) {
        assert.ok(!error, 'error: ' + error);
        assert.ok(Array.isArray(data.filter), 'data.filter is not an Array');
        assert.equal(data.filter.length, 1, 'filtered data length != 1');
        done();
      });
    });

    it('recognizes objects uses `filter.call(params, data)`', function(done) {
      this.counselor.setSource('filter', Counselor.transform.filter('named', function(data) {
        return data.foo;
      }));
      this.counselor.load('filter', function(error, data) {
        assert.ok(!error, 'error: ' + error);
        assert.ok(Array.isArray(data.filter), 'data.filter is not an Array');
        assert.equal(data.filter.length, 2, 'filtered data length != 2');
        done();
      });
    });

  });

  describe('Counselor.transform.findByParam()', function() {

    beforeEach(createWithFixtures);
    afterEach(removeCounselor);

    it('does lookups by key', function(done) {
      this.counselor.setSource('lookup', Counselor.findByParam('foo', 'a'));
      var params = {a: 1};
      this.counselor.load('lookup', params, function(error, data) {
        assert.ok(!error, 'error: ' + error);
        assert.equal(typeof data.lookup, 'object');
        done();
      });
    });

    it('does lookups from one key to another', function(done) {
      this.counselor.setSource('lookup', Counselor.findByParam('foo', 'b', 'a'));
      var params = {b: 1};
      this.counselor.load('lookup', params, function(error, data) {
        assert.ok(!error, 'error: ' + error);
        assert.equal(typeof data.lookup, 'object');
        done();
      });
    });

  });

});

function createWithFixtures() {
  this.counselor = new Counselor(FIXTURES);
}

function removeCounselor() {
  this.counselor = null;
}
