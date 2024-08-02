const crypto = require('crypto');
const axios = require('axios');
const APIBase = require('./APIbase')
const modules = require('./modules')
const { removeEmptyValue, buildQueryString, createRequest, CreateRequest, pubRequest, flowRight, defaultLogger } = require('./helpers/utils')

class Future extends flowRight(...Object.values(modules))(APIBase) {
  constructor(apiKey = '', apiSecret = '', options = {}) {
    options.baseURL = options.baseURL || 'https://futures.mexc.com'
    super({
      apiKey,
      apiSecret,
      ...options
    })
  }

  publicRequest(method, path, params = {}) {
    params = removeEmptyValue(params)
    params = buildQueryString(params)
    if (params !== '') {
      path = `${path}?${params}`
    }
    return createRequest({
      method: method,
      baseURL: this.baseURL,
      url: path,
      apiKey: this.apiKey
    })
  }

  SignRequest(method, path, params = {}) {
    console.log('signing here', path);
    const regex = /{([^}]+)}/g;
    const matches = [...path.matchAll(regex)];
    const extractedStrings = matches.map(match => match[1]);
    for (let i = 0; i < extractedStrings.length; i++) {
      const str = extractedStrings[i];
      path = path.replaceAll('{' + str + '}', params[str] ?? '');
      delete params[str];
    }
    params = removeEmptyValue(params)
    const timestamp = new Date().getTime();
    const partialHash = crypto.createHash('md5').update(this.apiKey + timestamp.toString()).digest('hex').substring(7);
    let objectString = '';
    if (method === 'POST') {
      path = `${path}`
      objectString += JSON.stringify(params)
    } else {
      let queryString = buildQueryString({ ...params })
      // path = `${path}?${queryString}`
      // Modified by sam 2024-03-09
      path = `${path}?`
      objectString += queryString
    }

    const Signature = crypto.createHash('md5').update(timestamp.toString() + objectString + partialHash).digest('hex');
    const headers = {
      "x-mxc-nonce": timestamp.toString(),
      "x-mxc-sign": Signature,
      "authorization": this.apiKey,
      "user-agent": "MEXC/7 CFNetwork/1474 Darwin/23.0.0",
      "content-type": "application/json",
      "origin": "https://futures.mexc.com",
      "referer": "https://futures.mexc.com/exchange",
    };

    return axios.post(this.baseURL + path, params, { headers });
  }


}

module.exports = Future