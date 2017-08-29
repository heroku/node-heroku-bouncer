module.exports = (opts = {}) => (req, res, next) => {
  const config = {
    oAuthClientID: process.env.HEROKU_OAUTH_ID,
    oAuthClientSecret: process.env.HEROKU_OAUTH_SECRET,
    ...opts
  }

  require('./routes')(config, req, res, next)
}
