/*
  Datamonkey - An API for comparative analysis of sequence alignments using state-of-the-art statistical models.

  Copyright (C) 2015
  Sergei L Kosakovsky Pond (spond@ucsd.edu)
  Steven Weaver (sweaver@ucsd.edu)

  Permission is hereby granted, free of charge, to any person obtaining a
  copy of this software and associated documentation files (the
  "Software"), to deal in the Software without restriction, including
  without limitation the rights to use, copy, modify, merge, publish,
  distribute, sublicense, and/or sell copies of the Software, and to
  permit persons to whom the Software is furnished to do so, subject to
  the following conditions:

  The above copyright notice and this permission notice shall be included
  in all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
  CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
  TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

const logger = require('./lib/logger');
setup = require('./config/setup');
var error = require('./lib/error');

ROOT_PATH = __dirname;
HOST      = setup.host;

// Necessary packages
var express          = require('express'),
    expressValidator = require('express-validator'),
    mongoose         = require('mongoose'),
    upload           = require('jquery-file-upload-middleware'),
    helpers          = require('./lib/helpers'),
    fs               = require('fs'),
    path             = require("path"),
    mongoose         = require('mongoose'),
    redis            = require('redis'),
    bb               = require('express-busboy');


// Connect to database
mongoose.connect(setup.database);

//Ensure that upload paths exists
mkdirErrorLogger = error.errorLogger(["EEXIST"]);

fs.mkdir(path.join(__dirname, '/uploads'), '0750', function(e) {

  if(e) {
    if(e.code != "EEXIST") {
      throw e;
    }
  }
  // need to do this in the callback to ensure uploads
  // directory exists first
  fs.mkdir(path.join(__dirname, '/uploads/hivtrace'), '0750', mkdirErrorLogger);
  fs.mkdir(path.join(__dirname, '/uploads/msa'), '0750', mkdirErrorLogger);

});

// ensure logging dir exists
fs.mkdir(path.join(__dirname, '/logs'), '0750', mkdirErrorLogger);

// START FLEA
// TODO: Move this out of main

upload.configure({
  //TODO: customize filename
  uploadDir: path.join(__dirname, '/uploads/flea/tmp'),
  uploadUrl: '/fleaupload',
});

upload.on('end', function (fileInfo, req, res) { 

});

// END FLEA

// Main app configuration
var app = express();
app.engine('.ejs', require('ejs').__express);
app.set('views', path.join(__dirname, '/app/templates'));


var server = app.listen(setup.port);
var io = require('socket.io').listen(server);

//app.use(express.compress());
app.use(require('morgan')('combined', { 'stream': logger.stream }));
app.use(expressValidator());
app.use('/fleaupload', upload.fileHandler());
app.set('json spaces', 0);
app.enable('trust proxy');

bb.extend(app, {
    upload: true,
    path: '/tmp/express-busboy/'
});

var models_path = path.join(__dirname, '/app/models');
fs.readdirSync(models_path).forEach(function (file) {
  require(path.join(models_path,'/',file));
});



app.use(express.static(path.join(__dirname, '/public')));
app.use('/uploads', express.static(path.join(__dirname + '/uploads')));

require('./config/routes')(app);
app.use('/flea/', express.static(path.join(__dirname, '/public/assets/lib/flea/dist/')));

app.use(function(err, req, res, next) {
    res.json(500, {'error' : err.message});
});


//Port to listen on
logger.info('Listening on port ' + setup.port + '...');

module.exports = server;

// Set up socket.io server
var jobproxy = require('./lib/hpcsocket.js');

io.sockets.on('connection', function (socket) {
  socket.emit('connected');
  socket.on ('acknowledged', function (data) {
    var clientSocket = new jobproxy.ClientSocket(socket, data.id);
  });
  
  socket.on ('fasta_parsing_progress_start', function (data) {
    var fasta_listener = redis.createClient ();
    fasta_listener.subscribe ("fasta_parsing_progress_" + data.id);
    fasta_listener.on ("message", function (channel, message) {
        //console.log ("fasta_parsing_update", message);
        socket.emit ("fasta_parsing_update", message);
        if (message == "done") {
            fasta_listener.end();
        }
        //socket.emit ("fasta_parsing_update",   JSON.parse (message));    
    });
  });

  socket.on ('attribute_parsing_progress_start', function (data) {
    var attr_listener = redis.createClient ();
    attr_listener.subscribe ("attribute_parsing_progress_" + data.id);
    //console.log ('attribute_parsing_progress_start', data.id);
    attr_listener.on ("message", function (channel, message) {
        //console.log ("attribute_parsing_progress", message);
        socket.emit ("attribute_parsing_progress", message);
        if (message == "done") {
            attr_listener.end();
        }
    });
  });
});
