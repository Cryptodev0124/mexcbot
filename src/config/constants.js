const Alternative = require('../../src/alternative')
const Future = require('../../src/future')
require('dotenv').config()
const tradingviewInit = require('../../src/helpers/tradingview');
const { writeToStorage, readFromStorage } = require('../../src/helpers/fs');
const apiKey = process.env.API_KEY
const apiSecret = process.env.SECRET_KEY
const baseUrl = 'https://futures.mexc.com/';
const client = new Alternative(process.env.AUTHORIZATION, apiSecret, { baseURL: baseUrl, isAlternative: true })
const readClient = new Future(apiKey, apiSecret, { baseURL: 'https://contract.mexc.com' });

const main = async () => {
    const res = await readClient.OpenPositions();
    console.log(res.data.data.filter(position => position.positionType == 2 && position.symbol == 'DOGE_USDT'))
    // const res1 = await client.CancelStopOrder(res.data.data);
    // console.log(res1.data)
}
main();