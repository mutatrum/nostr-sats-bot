module.exports = {
  relays: [],
  bots: [
    {
      name: 'sats_per_dollar',
      privkey: '',
      schedule: '0 */4 * * *',
      uri: 'https://api-pub.bitfinex.com/v2/ticker/tBTCUSD',
      eval: 'result[6]',
      metadata: {
        name: 'sats per dollar',
        display_name: 'sats per dollar',
        about: 'https://hodl.camp/',
        website: 'https://hodl.camp/',
        picture: 'https://hodl.camp/nostr-profile.jpg',
        banner: 'https://hodl.camp/nostr-banner.jpg',
        nip05: 'sats_per_dollar@hodl.camp',
        nip05valid: true,
        lud16: 'mutatrum@hodl.camp',
      }
    },
  ]
}
