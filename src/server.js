#!/usr/bin/env node
'use strict'

const express = require('express')
const cors = require('cors')
const replicate = require('./replicate.js')
const request = require('request')

const cluster = require('cluster')

const numCPUs = require('os').cpus().length

if (cluster.isMaster) {
  // Fork workers.
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork()
  }

  cluster.on('exit', function (worker, code, signal) {
    console.log('worker ' + worker.process.pid + ' died')
    cluster.fork()
  })
} else {
  const app = express()
  app.use(cors())
  app.get('/:id/:layer', function (req, res) {
    replicate(req.params, req.query || {})
      .then(function (results) {
        console.log('resolved successfully', results)
        if (results.code === 202) return res.status(202).json(results.body)
        request.get(results.url).pipe(res)
      })
      .catch(function (err) {
        console.log('errored', err)
        res.status(err.code).json(err.body)
      })
  })

  app.listen(3000, function () {
    console.log('Listening at http://%s:%d/', this.address().address, this.address().port)
  })
}
