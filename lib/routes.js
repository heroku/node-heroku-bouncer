const qs = require('querystring')
const uuidv4 = require('uuid/v4')
const http = require('http-call').default
const aw = require('./asyncawait')

module.exports = (config, req, res, next) => {
  const login = (req, res) => {
    req.session.herokuBouncerState = uuidv4()
    let params = {
      client_id: config.oAuthClientID,
      response_type: 'code',
      state: req.session.herokuBouncerState
    }
    if (config.scope) params.scopes = config.scope
    res.redirect(`https://id.heroku.com/oauth/authorize?${qs.stringify(params)}`)
  }

  const loginCallback = aw(async (req, res) => {
    // validate csrf token
    if (req.query.state !== req.session.herokuBouncerState) {
      res.status(401).send('Invalid state token')
      return
    }

    delete req.session.herokuBouncerState
    req.session.herokuAuth = await http.post('https://id.heroku.com/oauth/token', {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: qs.stringify({
        grant_type: 'authorization_code',
        code: req.query.code,
        client_secret: config.oAuthClientSecret
      })
    })

    req.session.herokuAccount = await http.get('https://api.heroku.com/account', {
      headers: {
        accept: 'application/vnd.heroku+json; version=3',
        authorization: `Bearer ${req.session.herokuAuth.access_token}`
      }
    })

    let redirectPath = req.session.redirectPath || '/'
    delete req.session.redirectPath
    res.redirect(redirectPath)
  })

  switch (req._parsedUrl.pathname) {
    case '/auth/heroku':
      return login(req, res, next)
    case '/auth/heroku/callback':
      return loginCallback(req, res, next)
    default:
      return next()
  }
}
