#!/usr/bin/env node

'use strict';

var express = require('express');
var cors = require('cors');
var replicate = require('./replicate.js');
var request = require('request');

var cluster = require('cluster');

var numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
  // Fork workers.
  for (var i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', function (worker, code, signal) {
    console.log('worker ' + worker.process.pid + ' died');
    cluster.fork();
  });
} else {
  var app = express();
  app.use(cors());
  app.get('/', function (req, res) {
    res.status(200).send('Replicator up and running');
  });
  app.get('/:id/:layer', function (req, res) {
    replicate(req.params, req.query || {}).then(function (results) {
      console.log('resolved successfully', results);
      if (results.code === 202) return res.status(202).json(results.body);
      res.setHeader('Content-disposition', 'attachment; filename=' + req.params.id + '_' + req.params.layer + '.fgdb.zip');
      res.contentType('application/octet-stream');
      request.get(results.url).pipe(res);
    }).catch(function (err) {
      console.log('errored', err);
      res.status(err.code).json(err.body);
    });
  });

  app.listen(3000, function () {
    console.log('Listening at http://%s:%d/', this.address().address, this.address().port);
  });
}