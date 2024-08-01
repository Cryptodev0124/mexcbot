const analyze = require('tradingview-technical-analysis');
const Alternative = require('./src/alternative')
const Future = require('./src/future')
require('dotenv').config()
const tradingviewInit = require('./src/helpers/tradingview');
const apiKey = process.env.API_KEY
const apiSecret = process.env.SECRET_KEY
const baseUrl = 'https://futures.mexc.com';
const client = new Alternative(process.env.AUTHORIZATION, apiSecret, { baseURL: baseUrl, isAlternative: true })
const readClient = new Future(apiKey, apiSecret, { baseURL: 'https://contract.mexc.com' });
const allPairs = require('../src/helpers/pair.json');

const MARKET_SYMBOL = "PEPE_USDT";
const pairInfo = allPairs.data.filter(s => s.symbol == MARKET_SYMBOL)[0]
// console.log(pairInfo);
const BASE_AMOUNT = 2000;
const LEAVERAGE_MULTIPLIER = 200;
const DEFAULT_OPTION = {
  symbol: MARKET_SYMBOL,
  openType: 2, // Cross Margin
  type: "5", // Market Order
  leverage: LEAVERAGE_MULTIPLIER,
  marketCeiling: false,
  priceProtect: "0",
  reduceOnly: true
}
var latestPrice = 0;

const readline = require('readline');
readline.emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);
process.stdin.on('keypress', async (_str, key) => {
  switch (key.name) {
    case 'up':
      console.log('creating long order>>>>>>>>>>>>>>');
      client.PlaceNewOrder({
        ...DEFAULT_OPTION,
        side: 1,
        vol: (BASE_AMOUNT / latestPrice / pairInfo.contractSize).toFixed(0) * 1,
        stopLossPrice: latestPrice * 0.9975,
      }).then((s) => console.log(s));
      break;
    case 'down':
      console.log('creating short order>>>>>>>>>>>>>>>');
      client.PlaceNewOrder({
        ...DEFAULT_OPTION,
        side: 3,
        vol: (BASE_AMOUNT / latestPrice * 100).toFixed(0) * 1,
        stopLossPrice: latestPrice * 1.0025,
      });
      break;
    case 'end':
      console.log('<<<<<<<<<<<<<<<<<creating double order>>>>>>>>>>>>>>');
      client.PlaceNewOrder({
        ...DEFAULT_OPTION,
        side: 1,
        vol: (BASE_AMOUNT / latestPrice * 100).toFixed(0) * 1,
        stopLossPrice: latestPrice * 0.999,
        takeProfitPrice: latestPrice * 1.003
      });
      client.PlaceNewOrder({
        ...DEFAULT_OPTION,
        side: 3,
        vol: (BASE_AMOUNT / latestPrice * 100).toFixed(0) * 1,
        stopLossPrice: latestPrice * 1.001,
        takeProfitPrice: latestPrice * 0.997,
      });
    case 'left':
      console.log('<<<<<<<<<<<<<<<<<creating double order>>>>>>>>>>>>>>');
      client.PlaceNewOrder({
        ...DEFAULT_OPTION,
        side: 1,
        vol: (BASE_AMOUNT / latestPrice * 100).toFixed(0) * 1,
      });
      client.PlaceNewOrder({
        ...DEFAULT_OPTION,
        side: 3,
        vol: (BASE_AMOUNT / latestPrice * 100).toFixed(0) * 1,
      });
      break;
    case 'right':
      const ress = await readClient.OpenPositions();
      if (ress.data.success) {
        const positions = ress.data.data;
        const main_position = positions.filter(position => position.positionType == 1 && position.symbol == MARKET_SYMBOL)[0];
        const assist_position = positions.filter(position => position.positionType == 2 && position.symbol == MARKET_SYMBOL)[0];
        if (main_position) {
          console.log('<<<<<<<<<<<<<<<closing long order');
          client.PlaceNewOrder({
            ...DEFAULT_OPTION,
            side: 4,
            vol: main_position.holdVol,
          });
        }
        if (assist_position) {
          console.log('<<<<<<<<<<<<<<<<<closing short order');
          client.PlaceNewOrder({
            ...DEFAULT_OPTION,
            side: 2,
            vol: assist_position.holdVol,
          });
        }
      }
      break;
    case 'x':
      const res = await readClient.OpenPositions();
      if (res.data.success) {
        const positions = res.data.data;
        const main_position = positions.filter(position => position.positionType == 1 && position.symbol == MARKET_SYMBOL)[0];
        const assist_position = positions.filter(position => position.positionType == 2 && position.symbol == MARKET_SYMBOL)[0];
        if (main_position) {
          console.log('<<<<<<<<<<<<<<<closing long order');
          client.PlaceNewOrder({
            ...DEFAULT_OPTION,
            side: 4,
            vol: main_position.holdVol,
          });
        }
        if (assist_position) {
          console.log('<<<<<<<<<<<<<<<<<closing short order');
          client.PlaceNewOrder({
            ...DEFAULT_OPTION,
            side: 2,
            vol: assist_position.holdVol,
          });
        }
      }
      break;
    case 'q':
      process.exit();
      break;
    default:
      break;
  }
});

const main = async (chart) => {
  // console.log(chart.periods[0])
  latestPrice = chart.periods[0].close;
  // const results = await analyze(['MEXC:DOGEUSDT.P', 'MEXC:SOLUSDT.P'], ['5m']);
  // console.log(latestPrice, results['MEXC:DOGEUSDT.P'].signals['5m']);
}

const setDirection = () => {
}

tradingviewInit(main, setDirection);