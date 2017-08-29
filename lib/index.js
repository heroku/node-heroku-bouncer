module.exports = (opts = {}) => (req, res, next) => {
  const config = {
    oAuthClientID: process.env.HEROKU_OAUTH_ID,
    oAuthClientSecret: process.env.HEROKU_OAUTH_SECRET,
    ...opts
  }

  function authenticated () {
    if (!req.session.herokuAccount) return false
    // TODO: check if token is out of date
    return true
  }

  require('./routes')(config, req, res, err => {
    if (err) return next(err)

    if (!authenticated()) {
      req.session.redirectPath = req.url
      return res.redirect('/auth/heroku')
    }
    next()
  })
}
