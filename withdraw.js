const axios = require('axios');
const crypto = require('crypto');

const apiKey = 'mx0vgliOAvdTj1fSYv';
const secretKey = 'abf83bae1acd4f24899a6c0fc0818ecb';

function createSignature(secretKey, queryString) {
    return crypto.createHmac('sha256', secretKey)
                 .update(queryString)
                 .digest('hex');
}

async function withdraw(apiKey, secretKey, amount, address, currency) {
    const endpoint = '/open/api/v2/account/withdraw';
    const baseUrl = 'https://www.mexc.com';
    const timestamp = Date.now();

    const params = {
        api_key: apiKey,
        timestamp: timestamp,
        amount: amount,
        address: address,
        currency: currency
    };

    const queryString = Object.keys(params).map(key => `${key}=${params[key]}`).join('&');
    const signature = createSignature(secretKey, queryString);
    
    params.signature = signature;

    try {
        const response = await axios.post(`${baseUrl}${endpoint}`, null, {
            params: params
        });
        console.log(response.data);
    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
    }
}

// Usage example
const amount = '18';  // Amount to withdraw
const address = '0xf469E3809BaEFa69Ec0325B4e4184f2557471d4d';
const currency = 'USDT';  // Currency to withdraw

withdraw(apiKey, secretKey, amount, address, currency);
