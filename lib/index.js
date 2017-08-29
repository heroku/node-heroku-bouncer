module.exports = (opts = {}) => {
  const r = module.exports = require('express').Router()
  const config = {
    oAuthClientID: process.env.HEROKU_OAUTH_ID,
    oAuthClientSecret: process.env.HEROKU_OAUTH_SECRET,
    oAuthServerURL: '',
    oAuthScope: 'identity',
    ...opts
  }
  const encryptor = require('simple-encryptor')
  config.cipher = encryptor(config.encryptionSecret)

  // /auth/heroku* routes
  r.use(require('./routes')(config))

  r.use((req, res, next) => {
    if (req.session.herokuBouncer) {
      let userSession = config.cipher.decrypt(req.session.herokuBouncer)
      // TODO: check userSession for expiration
      // TODO: refresh token

      req['heroku-bouncer'] = {
        token: userSession.accessToken,
        email: userSession.user.email,
        name: userSession.user.name,
        id: userSession.user.id
      }
    }

    if (!req['heroku-bouncer']) {
      req.session.redirectPath = req.url
      return res.redirect(`${req.baseUrl}/auth/heroku`)
    }
    next()
  })

  return r
}
