'use strict'

const crypto = require('crypto')
const request = require('request-promise')
const Redis = require('ioredis')
const redis = new Redis()

module.exports = function (params, query) {
  console.log(params, query)
  return new Promise(function (resolve, reject) {
    console.log(params)
    getDataset(params.id)
      .then(function (service) {
        return getLayerInfo(service, params.layer)
      })
      .then(function (info) {
        return getJobInfo({service: info.service, layer: params.layer, updated: info.updated, id: createHash(params, query)})
      })
      .then(function (info) {
        if (info.status !== 'Ready') {
          return getJobStatus(info)
        } else {
          return getFile(info)
        }
      }).then(function (resolution) {
        resolve(resolution)
      })
      .catch(function (options) {
        return requestReplica(options, query)
      })
      .then(function (resolution) {
        resolve(resolution)
      }, function (rejection) {
        reject(rejection)
      })
  })
}

function getDataset (id) {
  return new Promise(function (resolve, reject) {
    request(`https://www.arcgis.com/sharing/rest/content/items/${id}?f=json`).then(function (data) {
      const item = JSON.parse(data)
      resolve(item.url)
    })
  })
}

function getLayerInfo (service, layer) {
  return new Promise(function (resolve, reject) {
    request(`${service}/${layer}?f=json`).then(function (data) {
      const layerInfo = JSON.parse(data)
      const updated = layerInfo.editingInfo.lastEditDate
      console.log('get layer info', service)
      resolve({service, updated})
    })
  })
}

function getJobInfo (options) {
  return new Promise(function (resolve, reject) {
    redis.get(options.id).then(function (json) {
      const info = JSON.parse(json)
      console.log(options)
      console.log(info)
      if (!info || info === null) return reject(options)
      if (options.updated > info.updated) return reject(options)
      resolve(info)
    })
  })
}

function getJobStatus (info) {
  console.log('checking status', JSON.stringify(info))
  return new Promise(function (resolve, reject) {
    request(`${info.url}?f=json`).then(function (result) {
      const response = JSON.parse(result)
      console.log(response)
      if (response.resultUrl) {
        console.log('Request completed')
        info.status = 'Ready'
        info.url = response.resultUrl
        updateInfo(info.id, info)
        resolve({code: 200, url: response.resultUrl})
      }
      if (response.status && response.status === 'ExportingData') {
        const code = 202
        const body = {
          status: 'Processing',
          processingTime: (Date.now() - response.submissionTime) / 1000
        }
        resolve({code, body})
      }
    })
  })
}

function getFile (info) {
  return new Promise(function (resolve, reject) {
    checkFileLink(info.url).then(function (results) {
      console.log('head results', results)
      resolve({code: 200, url: info.url})
    }, function (error) {
      console.log(error)
      reject(info)
    })
  })
}

function requestReplica (params, query) {
  const replicaOptions = createOptions(params)
  return new Promise(function (resolve, reject) {
    console.log('req rep', params, query)
    postRequest(params.service, replicaOptions).then(function (data) {
      const results = JSON.parse(data)
      console.log('new replica requested', results)
      updateInfo(params.id, {status: 'Processing', url: results.statusUrl, id: params.id})
      resolve({code: 202, body: { status: 'Processing', processingTime: 0 }})
    })
  })
}

function parseService (url) {
  return url.split('/').slice(0, -1).join('/')
}

function checkFileLink (url) {
  const headOptions = {
    method: 'HEAD',
    uri: url
  }
  return request(headOptions)
}

function createHash (params, query) {
  const sorted_query = {}
  const sorted_keys = Object.keys(query).sort()
  if (sorted_keys.length) {
    Object.keys(params).sort().forEach(function (k) {
      if (k !== 'session') {
        sorted_query[k] = query[k]
      }
    })
  }
  var queryString = JSON.stringify({params, sorted_query})
  return crypto.createHash('md5').update(queryString).digest('hex')
}

function updateInfo (id, info) {
  console.log(id, info)
  redis.set(id, JSON.stringify(info))
  return true
}

function createOptions (params) {
  const options = {
    layers: 0,
    transportType: 'esriTransportTypeUrl',
    replicaName: 'Test',
    syncModel: 'none',
    f: 'json',
    dataFormat: 'filegdb',
    async: true
  }
  return options
}

function postRequest (service, options) {
  const postOptions = {
    method: 'POST',
    uri: `${service}/createReplica`,
    form: options
  }
  return request(postOptions)
}
