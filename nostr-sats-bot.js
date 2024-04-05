require('log-timestamp');

const config = require('./config')

const cron = require("node-cron");
const https = require("https");
const { Relay, signId, calculateId, getPublicKey } = require('nostr')
const { bech32 } = require('bech32')
const buffer = require('buffer')

process.on('uncaughtException', (err) => console.log(err))

console.log('start')

for (let bot of config.bots) {
  if (bot.privkey) {
    const pubkey = getPublicKey(bot.privkey)
    const npub = pubkeytonpub(pubkey)
    console.log(`init ${bot.name} ${npub} on ${bot.schedule}`)
    cron.schedule(bot.schedule, () => onSchedule(bot))

    // onSchedule(bot)
  }
}

async function onSchedule(bot) {
  try {
    console.log(bot.name)
    const result = await queryPrice(bot)
  
    if (result.code) {
      console.log(`${bot.name}: code ${result.code} ${result.error}: ${result.error_description}`);
      return;
    }
  
    var price = Function('result', "return " + bot.eval)(result);

    if (bot.multiplier) {
      price *= bot.multiplier
    }
    
    var sats = getSats(price);

    console.log(`${bot.name}: ${sats}`)

    const pubkey = getPublicKey(bot.privkey)

    const metadata = {
      pubkey: pubkey,
      kind: 0,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: JSON.stringify(bot.metadata)
    }
    metadata.id = await calculateId(metadata)
    metadata.sig = await signId(bot.privkey, metadata.id)

    console.log(JSON.stringify(metadata))

    const note = {
      pubkey: pubkey,
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: `${sats} https://hodl.camp/api/img/${bot.name}/${sats}.png`
    }

    note.id = await calculateId(note)
    note.sig = await signId(bot.privkey, note.id)

    console.log(JSON.stringify(note))

    config.relays.forEach(relay => sendNote(relay, [metadata, note]))
  }
  catch (error) {
    console.error(error)
  }
}

function pubkeytonpub(pubkey) {
  let words = bech32.toWords( buffer.Buffer.from( pubkey, 'hex' ) );
  return bech32.encode( "npub", words );
}

function queryPrice(bot) {
  return new Promise(function(resolve, reject) {

    const options = {
      headers : { "accept" : "application/json", "content-type": "application/json" }
    }

    if (bot.method) {
      options.method = bot.method
    }

    const req = https.request(bot.uri, options, res => {
      let body = "";
      res.on("data", data => {
        body += data;
      })
      res.on("end", () => {
        resolve(JSON.parse(body));
      })
    }).on('error', (e) => {
      console.error(e);
    });

    if (bot.payload) {
      req.write(bot.payload)
    }

    req.end()
  });
}

function getSats(price) {
  var sats = 1e8 / price;
  if (sats < 1) {
    return sats.toFixed(3)
  }
  if (sats < 10) {
    return sats.toFixed(2)
  }
  if (sats < 100) {
    return sats.toFixed(1)
  }
  return Math.floor(sats)
}

function sendNote(url, notes) {
  const relay = Relay(url, {reconnect: false})
  
  relay.on('open', async () => {
    for (let note of notes) {
      await relay.send(["EVENT", note])
    }

    setTimeout(() => relay.close(), 5_000)
  });

  relay.on('notice', (notice) => {
    console.log(`Notice ${relay.url}: ${notice}`)
  });

  relay.on('close', (e) => {
    if (e.code !== 1000 && e.code !== 1005) {
      console.log(`Close ${relay.url}: Code ${e.code} ${JSON.stringify(e)}`)
    }
  });
  
  relay.on('error', (e) => {
    console.log(`Error ${relay.url}: ${e.message}`)
  });
  
  relay.on('ok', (id) => {
    // if (id === note.id) {
      console.log(`Note ${id} sent on ${relay.url}`)

      // setImmediate(() => relay.close())
    // }
  });
}