'use strict'

const express = require('express')
const cookieParser = require('cookie-parser')
const app = express()
const request = require('request-promise')
const bodyParser = require('body-parser')
const nanoId = require('nanoid')
const { clientId, clientSecret, redirectUri, appId, host } = require('./config')

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(cookieParser())
app.use(express.static(__dirname + '/public'))
app.set('views', __dirname + '/public/views')
app.set('view engine', 'ejs')
app.engine('html', require('ejs').renderFile)

// 첫 페이지 View
app.get('/', (req, res) => {
  const info = { state: nanoId(), redirectUri, scope: 'message:write' }
  return res.render('index', info)
})

// 문자 전송 view
app.get('/send', (req, res) => {
  const { result, type } = req.query
  return res.render('send', { result, type })
})

// 앱 관련 정보 불러와서 authorize로 redirect 시켜줌
app.get('/auth', (req, res) => {
  const { state, scope } = req.query
  return res.redirect(
    `${host}/oauth2/v1/authorize?client_id=${clientId}&state=${state}&scope=${scope}&response_type=code&redirect_uri=${redirectUri}`
  )
})

// 넘겨받은 authorizationCode 값으로 accessToken값을 발급받아,
// Solapi API를 사용하기위해 Cookie에 값을 넣어주는 API
app.get('/authorize', async (req, res) => {
  try {
    const { code } = req.query
    const { access_token } = await request({
      method: 'POST',
      uri: `${host}/oauth2/v1/access_token`,
      body: {
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri
      },
      json: true
    })
    return res
      .cookie('APP_COOKIE', access_token, {
        httpOnly: false,
        signed: false,
        encode: String
      })
      .redirect('/send')
  } catch (err) {
    const { errorCode, errorMessage } = err.error
    return res.redirect(`send?result=${errorCode}-${errorMessage}`)
  }
})

// 문자 전송 API
app.post('/send', async (req, res) => {
  const {
    body: { text, to, from },
    cookies: { APP_COOKIE }
  } = req

  try {
    const result = await request({
      method: 'POST',
      uri: `${host}/messages/v4/send`,
      headers: { Authorization: `bearer ${APP_COOKIE}` },
      body: {
        message: { text, to, from },
        agent: { appId }
      },
      json: true
    })
    return res.redirect(`send?result=${JSON.stringify(result)}&type=success`)
  } catch (err) {
    const { errorCode, errorMessage } = err.error
    let errMsg = errorMessage.split(']')
    errMsg = errMsg[errMsg.length - 1].trim()
    return res.redirect(`send?result=${errorCode}-${errMsg}&type=error`)
  }
})

app.listen(8080, () => {
  console.log(`Server is running on port : 8080`)
})
