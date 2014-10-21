# v4.0.1

- Bump to v4.0.1, as NPM claims I published v4.0.0 two weeks ago!?

# v4.0.0

- Exposes a *single* middleware
- Changes to options:
  - `herokuOAuthID` becomes `oAuthClientID`
  - `herokuOAuthSecret` becomes `oAuthClientSecret`
  - `herokuBouncerSecret` becomes `encryptionSecret`
  - `herokuAuthURL` becomes `oAuthServerURL`
  - `herokaiOnly` and `herokaiOnlyRedirect` replaced by `herokaiOnlyHandler`
  - `ignoreRoutes` becomes `ignoredRoutes`
  - Adds `herokuAPIHost` option
  - Adds `oAuthScope` option (defaults to `"identity"` instead of Heroku OAuth default `"global"`)
- Check session object for user and user email to verify user presence
- Require cookie-parser and client-sessions middlewares
