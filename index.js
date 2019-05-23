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

// 첫 페이지 (인증 정보들 입력) view
app.get('/', (req, res) => {
  const { APP_COOKIE } = req.cookies
  const info = {
    state: nanoId(),
    appId: '',
    clientId: '',
    clientSecret: '',
    redirectUri: '',
    scope: 'users:read'
  }
  if (APP_COOKIE) Object.assign(info, APP_COOKIE)
  return res.render('index', info)
})

// 로그인 버튼 view
app.get('/login', (req, res) => res.render('login'))

// 문자 전송 view
app.get('/send', (req, res) =>
  res.render('send', { result: req.query.result, type: req.query.type })
)

// 설정 저장하고 다시 초기 화면으로 redirect
app.post('/config', async (req, res) => {
  return res
    .cookie('APP_COOKIE', req.body, {
      httpOnly: false,
      signed: false,
      encode: String
    })
    .redirect('/')
})

// 앱 관련 정보 불러와서 authorize로 redirect 시켜줌
app.get('/auth', (req, res) => {
  const { state, scope } = req.query
  const { clientId, redirectUri } = getAuthInfo(req.cookies)
  return res.redirect(
    `${host}/oauth2/v1/authorize?client_id=${clientId}&state=${state}&scope=${scope}&response_type=code&redirect_uri=${redirectUri}`
  )
})

// 앱 관련 정보 불러오는 함수
// 쿠키에 있으면 쿠키의 정보를, 없으면 config의 정보를 RETURN 함
function getAuthInfo(cookies) {
  const { APP_COOKIE } = cookies
  const info = { clientId, clientSecret, redirectUri, appId }
  if (APP_COOKIE && APP_COOKIE.clientId) {
    Object.assign(info, APP_COOKIE)
  }
  return info
}

// 인증 처리 API
app.get('/authorize', async (req, res) => {
  try {
    const { code } = req.query
    const { clientId, clientSecret, redirectUri } = getAuthInfo(req.cookies)
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
  const { appId } = getAuthInfo(req.cookies)
  try {
    const result = await request({
      method: 'POST',
      uri: `${host}/messages/v4/send`,
      headers: {
        Authorization: `bearer ${APP_COOKIE}`
      },
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

app.listen(80, () => {
  console.log(`Server is running on port : 80`)
})
