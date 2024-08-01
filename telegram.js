const tdl = require('tdl')
// https://core.telegram.org/tdlib/docs/td__api_8h.html
const Alternative = require('./src/alternative')
const Future = require('./src/future')
require('dotenv').config()
const tradingviewInit = require('./src/helpers/tradingview');
const { writeToStorage, readFromStorage } = require('./src/helpers/fs');
const allPairs = require('./src/helpers/pair.json');
const apiKey = ['mx0vgl0dTaEoRCxKyb'] //, 'mx0vgldae7OuEtdAOd', 'mx0vglyO3km2pOkAVC', 'mx0vglH6ECTI7HtRcd'];
const apiSecret = ['02cd7da91bab43f18c8971067f7efeb8'] //, '6ec14e70f61f4b73a25b909c03c0f124', 'a7cdeaee13b048329911c54472600953', 'e4a64f3500ec4565acc91572a0c90162'];
const AUTHORIZATION = ['WEB769281f625f129d2c3d3641b7c9eef916ecf405ea01506296ee367ea207a9bdf', 'WEBa397c08151f89c2600c98d1e0ed1aa1103438e45e6735d05d55b297a3e2010e7', 'WEB399f238dfef70fd97206662335f4659581f5d02d06a0402aaddab677ac1b1b75', 'WEB4d2d4b6f752b57c1693b4357a25c1a8944665b993aaf49da09f845abc20f96cd']
const baseUrl = 'https://futures.mexc.com';
let mexcClient = [];
let readClient = [];
for (let index = 0; index < apiKey.length; index++) {
    mexcClient.push(new Alternative(AUTHORIZATION[index], apiKey[index], { baseURL: baseUrl, isAlternative: true }));
    readClient.push(new Future(apiKey[index], apiSecret[index], { baseURL: 'https://contract.mexc.com' }));
}
const DEFAULT_OPTION = {
    openType: 2, // Cross Margin
    type: "5", // Market Order
    marketCeiling: false,
    priceProtect: "0",
    reduceOnly: true
}
const BASE_AMOUNT = 10000;
const TP_PERCENT = [0.45, 0.3/0.55, 0.15/0.25, 0.1/0.1];
let initialized = false;
let processNecessary = 0;
let isProcessing = false;
let info = readFromStorage('telegram_info');
info = info ?? {};
// If libtdjson is not present in the system search paths, the path to the
// libtdjson shared library can be set manually, e.g.:
//   tdl.configure({ tdjson: '/usr/local/lib/libtdjson.dylib' })
// The library directory can be set separate from the library name,
// example to search for libtdjson in the directory of the current script:
//   tdl.configure({ libdir: __dirname })

// Instead of building TDLib yourself, the aforementioned prebuilt-tdlib can be used as follows:
const { getTdjson } = require('prebuilt-tdlib')
tdl.configure({ tdjson: getTdjson() })

const client = tdl.createClient({
    apiId: 21039550, // Your api_id
    apiHash: '8742dae0999bcc6f86a8b3e823fbdd4c' // Your api_hash
})
// Passing apiId and apiHash is mandatory, these values can be obtained at https://my.telegram.org/

client.on('error', console.error)

// Aside of receiving responses to your requests, the server can push to you
// events called "updates" which ar received as follows:
client.on('update', update => {
    if (initialized) {
        // console.log('Got update:', update)
        if (update['_'] == "updateNewMessage" && update.message.chat_id == -1001336862166)
            processNecessary++;
    }
})
async function main() {
    // Log in to a Telegram account. By default, with no arguments, this function will
    // ask for phone number etc. in the console. Instead of logging in as a user,
    // it's also possible to log in as a bot using `client.loginAsBot('<TOKEN>')`.
    await client.login()

    // Invoke a TDLib method. The information regarding TDLib method list and
    // documentation is below this code block.
    const me = await client.invoke({ _: 'getMe' })
    if (me.last_name === 'sam') {
        console.log('============  successfully logged in  =============');
        initialized = true;
        const messageHistory = await client.invoke({
            _: 'getChatHistory',
            chat_id: -1001336862166,
            from_message_id: info.lastMessageId ?? 0,
            offset: -99,
            limit: 99,
        })
        processNecessary = messageHistory.messages.length - 1;
        console.log('there is', processNecessary, 'new messages');
        setInterval(() => {
            if (processNecessary > 0) {
                if (!isProcessing) {
                    isProcessing = true;
                    handler()
                        .then(() => {
                            isProcessing = false;
                            processNecessary--;
                            if (processNecessary < 0)
                                processNecessary = 0;
                        })
                        .catch((err) => {
                            console.log(err)
                            writeToStorage('telegram_info', info);
                            isProcessing = false;
                            processNecessary--;
                            if (processNecessary < 0)
                                processNecessary = 0;
                        })
                }
                else {

                }
            }
        }, 1000);
    }
    else {
        // Close the instance so that TDLib exits gracefully and the JS runtime can finish the process.
        await client.close()
    }
}
main()

const handler = async () => {
    // 29168238592 -> Dash Entry
    const messageHistory = await client.invoke({
        _: 'getChatHistory',
        chat_id: -1001336862166,
        from_message_id: info.lastMessageId ?? 0,
        offset: -2,
        limit: 2,
    })
    console.log(info.lastMessageId)
    const lastMessage = messageHistory.messages[0]
    // messageHistory.messages.map(m => console.log(m.id, m.content.text.text))
    if (info.lastMessageId == lastMessage.id) {
        console.log('There is no new message');
        processNecessary = 0;
        return;
    }
    info.lastMessageId = lastMessage.id;
    console.log('last message is', lastMessage?.content?.text?.text)
    let openPositions = [];
    let openOrders = [];
    for (let index = 0; index < apiKey.length; index++) {
        openPositions.push(await readClient[index].OpenPositions());
        openOrders.push(await readClient[index].Stoporder({
            is_finished: 0
        }));
    }
    // console.log(openOrders[0].data.data, openPositions[0].data.data)
    // console.log(openOrders[1].data.data, openPositions[1].data.data)
    if (openPositions[0].data.success && openOrders[0].data.success) {
        writeToStorage('telegram_info', info);

        // Analyse Telegram Message
        let exchange, direction, entry, pair, target, stoploss;
        if (lastMessage.reply_to) {
            const replymessage = await client.invoke({
                _: 'getMessage',
                chat_id: -1001336862166,
                message_id: lastMessage.reply_to.message_id,
            })
            const extractedSignalText = replymessage.content.text.text.split('\n');
            stoploss = extractedSignalText.pop().split(':')[1]?.trim() * 1;
            while (extractedSignalText[extractedSignalText.length - 1]?.trim() == '') extractedSignalText.pop();
            target = extractedSignalText.pop().split(':')[1]?.trim()?.split('-')?.map(s => s?.trim() * 1);
            while (extractedSignalText[extractedSignalText.length - 1]?.trim() == '') extractedSignalText.pop();
            entry = extractedSignalText.pop().split(':')[1]?.trim()?.split('-')?.map(s => s?.trim() * 1);
            while (extractedSignalText[extractedSignalText.length - 1]?.trim() == '') extractedSignalText.pop();
            extractedSignalText.pop();
            while (extractedSignalText[extractedSignalText.length - 1]?.trim() == '') extractedSignalText.pop();
            exchange = extractedSignalText.pop().split(':')[1]?.trim();
            while (extractedSignalText[extractedSignalText.length - 1]?.trim() == '') extractedSignalText.pop();
            direction = extractedSignalText.pop().split(':')[1]?.trim();
            while (extractedSignalText[extractedSignalText.length - 1]?.trim() == '') extractedSignalText.pop();
            pair = extractedSignalText.pop().split(':')[1]?.trim()?.substring(1)?.replace("/", "_");
            if(isNaN(stoploss) || target == undefined || entry == undefined) {
                console.log('extracting data failed with some reason', stoploss, target, entry);
            }
        }
        else return;
        // console.log(lastMessage.content.text.text);
        if (exchange != "Binance Futures") { console.log(exchange); return; }
        console.log(exchange, direction, entry, pair, target, stoploss)
        const operationText = lastMessage.content.text.text.split('\n')[1] ?? lastMessage.content.text.text.split('\n')[0];
        let operation = operationText.split(' ')[1];
        console.log(exchange, pair, operation)
        let step = operationText.split(' ')[2];
        if (operation == "All") {
            if (operationText.split(' ')[2] == "take-profit") {
                operation = "Manually";
            }
            if (operationText.split(' ')[2] == "entry") {
                operation = "Entry";
                step = entry.length
            }
        }
        // Do operation

        // console.log(position)
        // console.log(order)
        const pairInfo = allPairs.data.filter(s => s.symbol == pair || s.displayNameEn == pair + " PERPETUAL")[0]
        if (pairInfo == undefined) {
            console.log(pair, 'is not supported, ending now');
            return;
        }
        pair = pairInfo.symbol;
        let result = [];
        let res;
        switch (operation) {
            case "Entry":
                console.log('processing Entry Operation');
                const price = lastMessage.content.text.text.split('\n')[2].split(':')[1].split(' ')[1] * 1;
                console.log(price)
                if (!price) return;
                if (step > 1) return;
                for (let index = (step == 1 ? 0 : 2); index < apiKey.length; index++) {
                    const position = openPositions[index].data.data.filter(position => position.positionType == (direction == "Long" ? 1 : 2) && position.symbol == pair)[0];
                    const order = openOrders[index].data.data.filter(order => order.positionType == (direction == "Long" ? 1 : 2) && order.symbol == pair)[0];
                    let ordered = false;
                    if (position && order) {
                        console.log('ordering additional order');
                        if (index > 1) {
                            res = await mexcClient[index].PlaceNewOrder({
                                ...DEFAULT_OPTION,
                                type: "1",
                                price: entry[3 - step],
                                symbol: pair,
                                leaverage: pairInfo.maxLeverage,
                                side: direction == "Long" ? 1 : 3,
                                vol: (BASE_AMOUNT / entry[3 - step] / pairInfo.contractSize * Math.pow(1.1, step - 1)).toFixed(0) * 1,
                            });
                            ordered = true;
                            result.push(res.data);
                        }
                    }
                    else {
                        const override = { type: "1", price: price };
                        res = await mexcClient[index].PlaceNewOrder({
                            ...DEFAULT_OPTION,
                            symbol: pair,
                            leaverage: pairInfo.maxLeverage,
                            side: direction == "Long" ? 1 : 3,
                            vol: (BASE_AMOUNT / price / pairInfo.contractSize * Math.pow(1.1, step - 1)).toFixed(0) * 1,
                            stopLossPrice: 2 * entry[2] - target[0],
                        });
                        result.push(res.data);
                        res = await mexcClient[index].PlaceNewOrder({
                            ...DEFAULT_OPTION,
                            ...override,
                            symbol: pair,
                            leaverage: pairInfo.maxLeverage,
                            side: direction == "Long" ? 1 : 3,
                            vol: (BASE_AMOUNT * 3 / price / pairInfo.contractSize * Math.pow(1.1, step - 1)).toFixed(0) * 1,
                            stopLossPrice: 2 * entry[2] - target[0],
                        });
                        result.push(res.data);
                    }

                    if (ordered) {
                        console.log('changing existing stoploss option <--', index, '-->', order.id, (BASE_AMOUNT / price / pairInfo.contractSize * Math.pow(1.1, step)).toFixed(0) * 1 + position.holdVol);
                        res = await mexcClient[index].ChangePlanOrder({
                            lossTrend: "1",
                            orderId: order.id,
                            stopLossPrice: index == 3 ? stoploss : index == 2 ? entry[0] : entry[1],
                            stopLossReverse: 2,
                            stopLossVolume: (BASE_AMOUNT / price / pairInfo.contractSize * Math.pow(1.1, step)).toFixed(0) * 1 + position.holdVol,
                        })
                        result.push(res.data);
                    }
                }
                console.log('Entry Operation Finished', result);
                break;
            case "Take-Profit":
                step = operationText.split(' ')[3];
                for (let index = 0; index < apiKey.length; index++) {
                    const position = openPositions[index].data.data.filter(position => position.positionType == (direction == "Long" ? 1 : 2) && position.symbol == pair)[0];
                    const order = openOrders[index].data.data.filter(order => order.positionType == (direction == "Long" ? 1 : 2) && order.symbol == pair)[0];
                    if (order && position) {
                        if (!isNaN(step)) {
                            res = await mexcClient[index].PlaceNewOrder({
                                ...DEFAULT_OPTION,
                                symbol: pair,
                                leaverage: pairInfo.maxLeverage,
                                side: direction == "Long" ? 4 : 2,
                                vol: (position.holdVol * TP_PERCENT[step - 1]).toFixed(0) * 1,
                            });
                            result.push(res.data);
                        }
                        let newStopLoss = entry[1];
                        switch (index) {
                            case 0:
                                // newStopLoss = step < 2 ? entry[2] : target[step - 2];
                                newStopLoss = step == 1 ? 1.5 * entry[2] - 0.5 * target[step - 1] : entry[2];
                                break;
                            case 1:
                                newStopLoss = step == 1 ? 2 * entry[2] - target[step - 1] : target[step - 2];
                                break;
                            case 2:
                                newStopLoss = step == 1 ? 2 * entry[2] - target[step - 1] : target[step - 2];
                                break;
                            case 3:
                                newStopLoss = step == 1 ? 1.5 * entry[2] - 0.5 * target[step - 1] : entry[2];
                                break;
                            default:
                                break;
                        }
                        console.log('changing existing stoploss option <--', index, '-->', order.id, newStopLoss, position.holdVol);
                        res = await mexcClient[index].ChangePlanOrder({
                            lossTrend: "1",
                            orderId: order.id,
                            stopLossPrice: newStopLoss.toFixed(pairInfo.priceScale) * 1,
                            stopLossReverse: 2,
                            stopLossVolume: (position.holdVol - position.holdVol * TP_PERCENT[step - 1]).toFixed(0) * 1,
                        })
                        result.push(res.data)
                    }
                    console.log('canceling limit orders...')
                    const openLimitOrders = await readClient[index].OpenOrders({ symbol: pair, page_num: 1, page_size: 20 });
                    if (openLimitOrders.data.data.length > 0) {
                        res = await mexcClient[index].CancelAll();
                        result.push(res.data);
                    }
                    // console.log('canceling no necessary stoploss orders...')
                    // const a_order = openOrders[index].data.data.filter(order => order.positionType == (direction == "Long" ? 1 : 2) && order.symbol == pair)[1];
                    // if (a_order) {
                    //     res = await mexcClient[index].CancelStopOrder([{orderid: a_order.id}]);
                    //     result.push(res.data);
                    // }
                }
                console.log('Take_profit action finished', result);
                break;
            case "Manually":
            case "Cancelled":
                console.log('Closing Position Manually');
                for (let index = 0; index < apiKey.length; index++) {
                    const position = openPositions[index].data.data.filter(position => position.positionType == (direction == "Long" ? 1 : 2) && position.symbol == pair)[0];
                    if (position) {
                        res = await mexcClient[index].PlaceNewOrder({
                            ...DEFAULT_OPTION,
                            symbol: pair,
                            leaverage: pairInfo.maxLeverage,
                            side: direction == "Long" ? 4 : 2,
                            vol: position.holdVol,
                        });
                        result.push(res.data);
                    }
                }
                console.log('Manual Close Action Finished', result);
                break;
            case "Closed":
                console.log('Closing Position with some reason');
                for (let index = 0; index < apiKey.length; index++) {
                    const position = openPositions[index].data.data.filter(position => position.positionType == (direction == "Long" ? 1 : 2) && position.symbol == pair)[0];
                    if (position) {
                        res = await mexcClient[index].PlaceNewOrder({
                            ...DEFAULT_OPTION,
                            symbol: pair,
                            leaverage: pairInfo.maxLeverage,
                            side: direction == "Long" ? 4 : 2,
                            vol: position.holdVol,
                        });
                        result.push(res.data);
                    }
                }
                console.log('Force Close Action Finished', result);
                break;
            default:
                break;
        }
    }
    else {
        console.log(openPositions[0].data.message, openOrders[0].data.message)
        info = readFromStorage('telegram_info');
        processNecessary++;
    }
}