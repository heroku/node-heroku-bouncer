module.exports = (opts = {}) => {
  const r = module.exports = require('express').Router()
  const config = {
    oAuthClientID: process.env.HEROKU_OAUTH_ID,
    oAuthClientSecret: process.env.HEROKU_OAUTH_SECRET,
    ...opts
  }

  // /auth/heroku* routes
  r.use(require('./routes')(config))

  r.use((req, res, next) => {
    function authenticated () {
      if (!req.session.herokuAccount) return false
      // TODO: check if token is out of date
      return true
    }

    if (!authenticated()) {
      req.session.redirectPath = req.url
      return res.redirect('/auth/heroku')
    }
    next()
  })

  return r
}
