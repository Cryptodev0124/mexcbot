const axios = require('axios');
const crypto = require('crypto');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Setup and Authorization
const authorization = "WEB0dbd8eafd7f7bb3fb8a379d0b282588884b4cdf13ac9d0f04eec1ec1df22e55c"; //just example wont work you need to get this like described by me
// This is an example authorization key (not usable) which you will get in the following way:
// The preferred method is definitely to get it by using the MEXC app and using HTTP toolkit as a program to track the requests that your phone makes in MEXC. Because the app authorization stays forever if you open the app once in a while (I think every month once is even enough, maybe even less). Otherwise, you can obtain the authorization from the web which will not last that long so it's not advisable.
// In all the requests that your app makes, there will be the header Authorization and Authentication that will start with APP. You will copy this string and define it as the authorization.

async function sendOrder(params) {
    const timestamp = new Date().getTime();
    const partialHash = crypto.createHash('md5').update(authorization + timestamp.toString()).digest('hex').substring(7);
    const paramStr = JSON.stringify(params);
    const signature = crypto.createHash('md5').update(timestamp.toString() + paramStr + partialHash).digest('hex');
    const url = "https://futures.mexc.com/api/v1/private/order/create";
    const headers = {
        "x-mxc-nonce": timestamp.toString(),
        "x-mxc-sign": signature,
        "authorization": authorization,
        "user-agent": "MEXC/7 CFNetwork/1474 Darwin/23.0.0",
        "content-type": "application/json",
        "origin": "https://futures.mexc.com",
        "referer": "https://futures.mexc.com/exchange",
    };

    try {
        // const response = await axios.post(url, paramStr, { headers });
        // console.log(response.data);
        // return response.data;
    } catch (error) {
        console.error('Error sending order:', error.response ? error.response.data : error.message);
    }
}

async function fetchOrders() {
    const url = "https://futures.mexc.com/api/v1/private/order/list/open_orders?page_num=1&page_size=200";
    const headers = {
        "Authorization": authorization,
    };

    try {
        const response = await axios.get(url, { headers });
        // console.log(response.data);
    } catch (error) {
        console.error('Error fetching orders:', error.response ? error.response.data : error.message);
    }
}

async function executeTrades() {
    // Place open orders
    // await sendOrder({
    //     symbol: "BTC_USDT",
    //     side: 1, // Open Long
    //     openType: 2, // Cross Margin
    //     type: "5", // Market Order
    //     vol: 1,
    //     leverage: 20,
    //     marketCeiling: false,
    //     priceProtect: "0",
    //     reduceOnly: false
    //     });
    await sendOrder({
        symbol: "ETH_USDT",
        side: 3, // Open Short
        openType: 2, // Cross Margin
        type: "5", // Market Order
        vol: 1,
        leverage: 20,
        marketCeiling: false,
        priceProtect: "0",
        reduceOnly: false
        });

    // Wait for 5 seconds
    console.log('Waiting 5 seconds to show the orders filled');
    await sleep(5000);

    // Place close orders
    // await sendOrder({
    //     symbol: "BTC_USDT",
    //     side: 4, // Close Long
    //     openType: 2, // Cross Margin
    //     type: "5", // Market Order
    //     vol: 1,
    //     leverage: 20,
    //     marketCeiling: false,
    //     priceProtect: "0",
    //     reduceOnly: false
    // });
    // await sendOrder({
    //     symbol: "ETH_USDT",
    //     side: 2, // Close Short
    //     openType: 2, // Cross Margin
    //     type: "5", // Market Order
    //     vol: 1,
    //     leverage: 20,
    //     marketCeiling: false,
    //     priceProtect: "0",
    //     reduceOnly: false
    // });

    // Fetch orders
    await fetchOrders();
}

// Execute the trades
executeTrades();




// symbol: Trading pair identifier, e.g., "BTC_USDT".
// side: 1 = Open Long, 2 = Close Short, 3 = Open Short, 4 = Close Long
// openType: 1 = Isolated Margin, 2 = Cross Margin
// type: 1 = Limit Order, 2 = Post Only Maker, 3 = Close or Cancel Instantly,
//       4 = Close or Cancel Completely, 5 = Market Order
// vol: Order volume.
// leverage: Leverage factor.
// marketCeiling: Boolean, market price as ceiling.
// priceProtect: Boolean, enables price protection.
// reduceOnly: Boolean, order can only reduce a position.
// positionMode: Int, position mode, 1: hedge, 2: one-way, default: the user's current config
// Advanced Order Parameters:
//   takeProfitPrice: Price for automatic profit taking.
//   profitTrend: Direction for take profit.
//   stopLossPrice: Price for automatic stop loss.
//   lossTrend: Direction for stop loss.
//   trend: Int, trigger price type, 1: latest price, 2: fair price, 3: index price
// Additional parameters for trailing and other advanced orders:
//   trend, backType, backValue: Used for trailing stop orders, backValue in percent, backType 1 stands for percent
// For trailing orders, the below format will be used:
// sendOrder({"symbol":"BTC_USDT","leverage":10,"side":1,"type":"5","vol":1,"openType":2,"trend":"1","backType":"1","positionMode":2,"backValue":0.01})


// Additional useful code for setup
// const futures_exchange_info = await fetch("https://futures.mexc.com/api/v1/contract/detail");
// const futures_exchange_info_json = await futures_exchange_info.json();
// console.log(futures_exchange_info_json);

// const leverage_dict = {};  // Declare leverage_dict as a global variable
// if (futures_exchange_info_json.success) {
//     const data = futures_exchange_info_json.data || [];
//     for (const item of data) {
//         const symbol = item.symbol || '';
//         const max_leverage = item.maxLeverage || 10;
//         // Set leverage accordingly
//         const leverage = max_leverage < 50 ? Math.min(25, max_leverage) : 50;
//         leverage_dict[symbol] = leverage;
//     }
// }

// console.log(leverage_dict["TIA_USDT"]);

// function get_contract_size(symbol, futures_exchange_info) {
//     for (const item of futures_exchange_info.data) {
//         if (item.symbol === symbol) {
//             return item.contractSize;
//         }
//     }
//     return null;
// }