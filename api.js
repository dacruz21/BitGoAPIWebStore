/**
 * api.js
 * 
 * Provides an API to the client to request simple data from the server. Also handles requests to the BitGo network
 * 
 * BitGo access token to be provided via the bitgoAccessToken environment variable
 */

const express = require("express")
const bitgoModule = require("bitgo")
const Promise = require("bluebird")

const dbDriver = require("./db.js")

const router = express.Router()

// Supported currencies, minus data from the BitGo API (will be fetched upon request)
const currencies = [
    {
        name: "bitcoin",
        ticker: "btc",
        icon: "/res/svg/btc.svg"
    },
    // {
    //     name: "ether",
    //     ticker: "eth",
    //     icon: "/svg/eth.svg"
    // },
    {
        name: "ripple",
        ticker: "xrp",
        icon: "/res/svg/xrp.svg"
    },
    {
        name: "bitcoincash",
        ticker: "bch",
        icon: "/res/svg/bch.svg"
    },
    {
        name: "litecoin",
        ticker: "ltc",
        icon: "/res/svg/ltc.svg"
    }
]

const bitgoEnv = 'test'
const accessToken = process.env.bitgoAccessToken
console.log(`Connecting to BitGo *${bitgoEnv.toUpperCase()}* network with access token ${accessToken.slice(0, 4)}***${accessToken.slice(-4)}`)

var bitgo = new bitgoModule.BitGo({env: bitgoEnv})
bitgo.authenticateWithAccessToken({accessToken})

// If we are on testnet, fix the tickers on the currencies
if (bitgoEnv === 'test') {
    for (let i = 0; i < currencies.length; i++) {
        // append a 't' to the beginning of each ticker
        currencies[i].ticker = 't' + currencies[i].ticker; 
    }
}

const walletIds = {}

for (let i = 0; i < currencies.length; i++) {
    let ticker = currencies[i].ticker
    bitgo.coin(ticker).wallets().list({}).then( (wallets) => {
        let wallet = wallets.wallets.find( wallet => wallet._wallet.label == "web_store_receive_wallet")
        if (wallet) {
            console.log(`Found ${ticker.toUpperCase()} wallet: ${wallet._wallet.id}`)
            walletIds[ticker] = wallet._wallet.id
        } else {
            console.log(`Unable to find ${ticker.toUpperCase()} wallet.`)
        }
    })
}

// Log all API requests
router.use((req, res, next) => {
    console.log(`API call from ${req.ip} - ${req.url}`)
    next()
})

router.get('/', (req, res) => {
    res.json({message: "API Router Root"})
})

// For each currency, fetch the exchange rate data from the BitGo market API
router.get('/currencies', (req, res) => {
    Promise.map(currencies, (currency) => {
        return bitgo.coin(currency.ticker).markets().latest({}, (err, marketData) => {
            if (err) {
                res.json({message: "Error occurred fetching market data", error: err})
                return
            }

            currency.exchangeRate = marketData.latest.currencies.USD.last
        })
    }).then(() => {
        res.json(currencies)
    })
})

// Allow users to request a list of products from MongoDB
router.get('/products', (req, res) => {
    res.json(dbDriver.products)
})

router.get('/categories', (req, res) => {
    res.json(["Category 1", "Category 2", "Category 3", "Category 4"])
})

router.post('/checkout', (req, res) => {
    // Accumulate the prices of the objects in the cart. Does NOT trust the client's values, re-calculates from the database driver
    var totalPriceUsd = req.body.cart.reduce( (price, product) => {
        return price + product.quantity * dbDriver.getProductPrice(product._id) 
    }, 0)

    dbDriver.addOrder(req.body.buyerName,
                      req.body.buyerEmail,
                      req.body.cart,
                      totalPriceUsd,
                      req.body.currencyTicker
    )

    bitgo.coin(req.body.currencyTicker).wallets().get({ id: walletIds[req.body.currencyTicker] }).then( (wallet) => {
        wallet.createAddress({ label: `Receive address for ${req.body.buyerName}`}).then((addr) => {
            console.log(`Generated ${req.body.currencyTicker.toUpperCase()} receive address ${addr.address}`)
            res.json({
                price: totalPriceUsd,
                address: addr.address,
                qrCode: `https://chart.googleapis.com/chart?cht=qr&chs=384x384&chl=${addr.address}&chld=m`
            })
        })
    })
})

// Pass the router to our main router
exports.router = router