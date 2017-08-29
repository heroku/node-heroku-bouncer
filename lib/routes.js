
module.exports = config => {
  const r = module.exports = require('express').Router()
  const qs = require('querystring')
  const uuidv4 = require('uuid/v4')
  const http = require('http-call').default
  const aw = require('./asyncawait')
  const path = require('path')

  r.get('/auth/heroku', (req, res) => {
    req.session.herokuBouncerState = uuidv4()
    let params = {
      client_id: config.oAuthClientID,
      response_type: 'code',
      state: req.session.herokuBouncerState
    }
    if (config.oAuthScope) params.scope = config.oAuthScope
    res.redirect(`https://id.heroku.com/oauth/authorize?${qs.stringify(params)}`)
  })

  r.get('/auth/heroku/callback', aw(async (req, res) => {
    // validate csrf token
    if (req.query.state !== req.session.herokuBouncerState) {
      res.status(401).send('Invalid state token')
      return
    }

    delete req.session.herokuBouncerState
    let auth = await http.post('https://id.heroku.com/oauth/token', {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: qs.stringify({
        grant_type: 'authorization_code',
        code: req.query.code,
        client_secret: config.oAuthClientSecret
      })
    })

    let account = await http.get('https://api.heroku.com/account', {
      headers: {
        accept: 'application/vnd.heroku+json; version=3',
        authorization: `Bearer ${auth.access_token}`
      }
    })

    req.session.herokuBouncer = config.cipher.encrypt({
      accessToken: auth.access_token,
      refreshToken: auth.refresh_token,
      createdAt: (new Date()).toISOString(),
      expiresIn: auth.expires_in,
      user: {
        name: account.name,
        email: account.email,
        id: account.id
      }
    })

    let redirectPath = req.session.redirectPath
    if (!redirectPath || redirectPath === '/auth/heroku') redirectPath = '/'
    delete req.session.redirectPath
    res.redirect(path.join(req.baseUrl, redirectPath))
  }))

  r.get('/auth/heroku/logout', (req, res, next) => {
    req.session.destroy(err => {
      if (err) return next(err)
      res.send('logged out')
    })
  })

  return r
}
