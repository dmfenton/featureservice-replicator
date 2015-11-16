'use strict';

var crypto = require('crypto');
var request = require('request-promise');
var Redis = require('ioredis');
var redis = new Redis();

module.exports = function (id, params) {
  console.log(id, params);
  return new Promise(function (resolve, reject) {
    getDataset(id).then(getLayerInfo).then(function (info) {
      console.log('here', info);
      return getJobInfo({ layer: info.layer, updated: info.updated, id: createHash(id, params) });
    }).then(function (info) {
      console.log('inside this block');
      if (info.status !== 'Ready') {
        return getJobStatus(info);
      } else {
        return getFile(info);
      }
    }).then(function (resolution) {
      resolve(resolution);
    }).catch(function (options) {
      console.log('here??', params, options);
      return requestReplica(params, options);
    }).then(function (resolution) {
      resolve(resolution);
    }, function (rejection) {
      reject(rejection);
    });
  });
};

function getDataset(id) {
  return new Promise(function (resolve, reject) {
    request('http://opendataqa.arcgis.com/datasets/' + id + '.json').then(function (data) {
      var dataset = JSON.parse(data);
      resolve(dataset.data.url);
    });
  });
}

function getLayerInfo(layer) {
  return new Promise(function (resolve, reject) {
    request(layer + '?f=json').then(function (data) {
      console.log(data);
      var layerInfo = JSON.parse(data);
      var updated = layerInfo.editingInfo.lastEditDate;
      resolve({ layer: layer, updated: updated });
    });
  });
}

function getJobInfo(options) {
  return new Promise(function (resolve, reject) {
    redis.get(options.id).then(function (json) {
      var info = JSON.parse(json);
      console.log(info);
      if (!info || info === null) return reject(options);
      if (options.updated > info.updated) return reject(options);
      console.log('down here?');
      resolve(info);
    });
  });
}

function getJobStatus(info) {
  console.log('checking status', JSON.stringify(info));
  return new Promise(function (resolve, reject) {
    request(info.url + '?f=json').then(function (result) {
      var response = JSON.parse(result);
      console.log(response);
      if (response.resultUrl) {
        console.log('Request completed');
        info.status = 'Ready';
        info.url = response.resultUrl;
        updateInfo(info.id, info);
        resolve({ code: 200, url: response.resultUrl });
      }
      if (response.status && response.status === 'ExportingData') {
        var code = 202;
        var body = {
          status: 'Processing',
          processingTime: (response.submissionTime - Date.now()) / 1000
        };
        resolve({ code: code, body: body });
      }
    });
  });
}

function getFile(info) {
  return new Promise(function (resolve, reject) {
    checkFileLink(info.url).then(function (results) {
      console.log('head results', results);
      resolve({ code: 200, url: info.url });
    }, function (error) {
      console.log(error);
      reject(info);
    });
  });
}

function requestReplica(params, options) {
  var replicaOptions = createOptions(params);
  return new Promise(function (resolve, reject) {
    postRequest(parseService(options.layer), replicaOptions).then(function (data) {
      var results = JSON.parse(data);
      console.log('new replica requested', results);
      updateInfo(options.id, { status: 'Processing', url: results.statusUrl, id: options.id });
      resolve({ code: 202, body: { status: 'Processing', processingTime: 0 } });
    });
  });
}

function parseService(url) {
  return url.split('/').slice(0, -1).join('/');
}

function checkFileLink(url) {
  var headOptions = {
    method: 'HEAD',
    uri: url
  };
  return request(headOptions);
}

function createHash(id, params) {
  var sorted_params = {};
  var sorted_keys = Object.keys(params).sort();
  if (sorted_keys.length) {
    Object.keys(params).sort().each(function (k) {
      sorted_params[k] = params[k];
    });
  }
  var paramString = JSON.stringify({ id: id, sorted_params: sorted_params });
  return crypto.createHash('md5').update(paramString).digest('hex');
}

function updateInfo(id, info) {
  console.log(id, info);
  redis.set(id, JSON.stringify(info));
  return true;
}

function createOptions(params) {
  var options = {
    layers: 0,
    transportType: 'esriTransportTypeUrl',
    replicaName: 'Test',
    syncModel: 'none',
    f: 'json',
    dataFormat: 'filegdb',
    async: true
  };
  return options;
}

function postRequest(service, options) {
  var postOptions = {
    method: 'POST',
    uri: service + '/createReplica',
    form: options
  };
  return request(postOptions);
}