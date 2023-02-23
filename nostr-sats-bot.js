const config = require('./config')

const cron = require("node-cron");
const https = require("https");
const { RelayPool, Relay, signId, calculateId, getPublicKey } = require('nostr')

process.on('uncaughtException', (err) => console.log(err))

console.log('start')

for (let bot of config.bots) {
  console.log(`init ${bot.name} on ${bot.schedule}`)
  cron.schedule(bot.schedule, () => onSchedule(bot))
}

async function onSchedule(bot) {
  try {
    if (!bot.privkey) return

    const result = await queryPrice(bot)
  
    if (result.code) {
      console.log(`${bot.name}: code ${result.code} ${result.error}: ${result.error_description}`);
      return;
    }
  
    var price = Function('result', "return " + bot.eval)(result);
    
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

function queryPrice(bot) {
  return new Promise(function(resolve, reject) {
    https.get(bot.uri, { headers : { "accept" : "application/json" }}, res => {
      let body = "";
      res.on("data", data => {
        body += data;
      });
      res.on("end", () => {
        resolve(JSON.parse(body));
      });
    });
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
      console.log(`Zap note ${id} sent on ${relay.url}`)

      // setImmediate(() => relay.close())
    // }
  });
}