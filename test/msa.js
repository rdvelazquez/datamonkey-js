
var fs = require('fs'),
    mongoose = require('mongoose'),
    path = require('path'),
    spawn = require('child_process').spawn,
    setup = require('../config/setup'),
    globals = require('../config/globals');

// Bootstrap models
require('../app/models/msa');

var Msa     = mongoose.model('Msa'),
    should  = require('should');

describe('msa datareader validation', function() {

  var Msa  = mongoose.model('Msa');

  it('should parse msa and have all properties', function(done) {
    this.timeout(3000);

    var hyphy =  spawn(globals.hyphy,
                      [path.join(__dirname, '/../lib/bfs/datareader.bf')]);

    hyphy.stdout.on('data', function (data) {
      var results = JSON.parse(data);

      //Ensure that all information is there
      results.should.have.property('FILE_INFO');
      results.FILE_INFO.should.have.property('partitions');
      results.FILE_INFO.should.have.property('gencodeid');
      results.FILE_INFO.should.have.property('sites');
      results.FILE_INFO.should.have.property('sequences');
      results.FILE_INFO.should.have.property('timestamp');
      results.FILE_INFO.should.have.property('goodtree');
      results.FILE_INFO.should.have.property('nj');
      results.FILE_INFO.should.have.property('rawsites');

      results.should.have.property('SEQUENCES');

      results.should.have.property('FILE_PARTITION_INFO');
      results.FILE_PARTITION_INFO.should.have.property('partition');
      results.FILE_PARTITION_INFO.should.have.property('startcodon');
      results.FILE_PARTITION_INFO.should.have.property('endcodon');
      results.FILE_PARTITION_INFO.should.have.property('span');
      results.FILE_PARTITION_INFO.should.have.property('usertree');

    });

    hyphy.stdin.write(path.join(__dirname, '/res/HIV_gp120.nex\n'));
    hyphy.stdin.write('0');
    hyphy.stdin.end();
    hyphy.on('close', function (code) {
      done();
    });
  });

  it('should return an error message', function(done) {
    var hyphy =  spawn(globals.hyphy,
                      [path.join(__dirname, '/../lib/bfs/datareader.bf')]);

    hyphy.stdout.on('data', function (data) {
      var results = JSON.parse(data);
      results.should.have.property('error');
    });

    hyphy.stdin.write(path.join(__dirname, '/res/mangled_nexus.nex\n'));
    hyphy.stdin.write('0');
    hyphy.stdin.end();

    hyphy.on('close', function (code) {
      done();
    });

  });


});

describe.only('msa parseFile', () => {

  it.only('should save multiple partitions', done => {

    Msa.parseFile(path.join(__dirname, '/res/multiple_partitions.nex'), 0, 0, (err, msa) => {
      msa.partition_info.should.be.length(4);
      done();
    });

  });

  it('should save one partition', done => {

    Msa.parseFile(path.join(__dirname, '/res/HIV_gp120.nex'), 0, 0, (err, msa) => {
      msa.partition_info.should.be.length(1);
      done();
    });

  });


});

describe('msa codon translation', function() {

  it('should be a clean standard translation', function(done) {

    var options = {
      'no-equal-length': 0,
      'headers-only': 0,
      'progress-callback': function (){}
    }


    var msa = new Msa;
    msa.gencodeid = 0;
    fs.writeFileSync(msa.filepath, fs.readFileSync('./test/res/Flu.fasta'));

    msa.aminoAcidTranslation(function(err, result) {

      fs.readFile('./test/res/Flu.aa', function (err, data) {
        result.should.equal(data.toString());
        done();
      });

    }, options);

  });

});

describe('hyphy friendly', function() {

  it('should not have attribute map', function(done) {

    var msa = new Msa;
    msa.gencodeid = 0;
    fs.writeFileSync(msa.filepath, fs.readFileSync('./test/res/Flu.fasta'));

    // save attribute map

    // Example : 
    // 'map': ['unknown','unknown1','unknown2','ma3ybe_date'] should transform to
    // 'map': { '0' : 'unknown', '1': 'unknown1', '2': 'unknown2', '3': 'maybe_date' }

    msa.attribute_map =  {'map': ['unknown','unknown1','unknown2','maybe_date'], 'delimiter':'_'};
    (msa.hyphy_friendly.attribute_map == undefined).should.be.true;
    done();

  });

});

describe('parse file', function() {

  it('should return a well formed msa', function(done) {

    this.timeout(5000);

    var msa = new Msa;
    var datatype  = 0;
    var gencodeid = 0;
    var fn = path.join(__dirname, '/res/Flu.fasta');

    Msa.parseFile(fn, datatype, gencodeid, function(err, result) {
      result.sequence_info.should.have.length(21);
      result.sites.should.eql(566);
      result.sequences.should.eql(21);
      done();
    });

  });

});

describe('validate fasta file', function() {

  it('should be valid', function(done) {

    var options = {
      'no-equal-length': 0,
      'headers-only': 0,
      'progress-callback': function (){}
    }

    var fn = path.join(__dirname, '/res/Flu.fasta');
    Msa.validateFasta(fn, function(err, result) {

      result.forEach(function(d) {
        d.should.have.property('seq');
        d.should.have.property('name');
      });

      done();

    }, options);

  });

  it('should not be valid', function(done) {

    var options = {
      'no-equal-length': 0,
      'headers-only': 0,
      'progress-callback': function (){}
    }

    var fn = path.join(__dirname, '/res/HIV_gp120.nex');

    Msa.validateFasta(fn, function(err, result) {

      err.should.have.property('msg');
      result.should.be.false;
      done();

    }, options);

  });

  it('parse fasta file should fail due to unequal lengths', function(done) {

    var options = {
      'no-equal-length': 0,
      'headers-only': 0,
      'progress-callback': function (){}
    }

    var cb = function(err, data) {
      err.should.have.property('msg');
      done();
    }

    Msa.validateFasta('./test/res/Flu.unaligned.fasta', cb, options);

  });



});
