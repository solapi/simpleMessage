'use strict'

const express = require('express')
const cookieParser = require('cookie-parser')
const app = express()
const request = require('request-promise')
const bodyParser = require('body-parser')
const nanoId = require('nanoid')
const {
  clientId,
  clientSecret,
  redirectUri,
  appId,
  host
} = require('./config')

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(cookieParser())
app.use(express.static(__dirname + '/public'))
app.set('views', __dirname + '/public/views')
app.set('view engine', 'ejs')
app.engine('html', require('ejs').renderFile)

// 첫 페이지 (인증 정보들 입력) view
app.get('/', (req, res) => {
  const { SimpleMessageInfo } = req.cookies
  const info = { state: nanoId(), appId: '', clientId: '', clientSecret: '', redirectUri: '', scope: 'users:read' }
  if (SimpleMessageInfo) Object.assign(info, SimpleMessageInfo)
  res.render('index', info)
})

// 로그인 버튼 view
app.get('/login', (req, res) => res.render('login'))

// 문자 전송 view
app.get('/send', (req, res) => res.render('send', { result: req.query.result }))

// 설정 저장하고 다시 초기 화면으로 redirect
app.post('/config', async (req, res) => {
  res.cookie('SimpleMessageInfo', req.body, {
    'httpOnly': false,
    'signed': false,
    'encode': String
  })
  return res.redirect('/')
})

// 쿠키 삭제 후 초기 화면으로 redirect
app.post('/init', async (req, res) => {
  res.clearCookie('SimpleMessageInfo')
  return res.redirect('/')
})

// 앱 관련 정보 불러와서 authorize로 redirect 시켜줌
app.get('/auth', (req, res) => {
  const { state, scope } = req.query
  const { clientId, redirectUri } = getAuthInfo(req.cookies)
  return res.redirect(`${host}/oauth2/v1/authorize?client_id=${clientId}&state=${state}&scope=${scope}&response_type=code&redirect_uri=${redirectUri}`)
})

// 앱 관련 정보 불러오는 함수
// 쿠키에 있으면 쿠키의 정보를, 없으면 config의 정보를 RETURN 함
function getAuthInfo (cookies) {
  const { SimpleMessageInfo } = cookies
  const info = { clientId, clientSecret, redirectUri, appId }
  if (SimpleMessageInfo && SimpleMessageInfo.clientId) {
    Object.assign(info, simpleMessageInfo)
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
    res.cookie('TOKEN_COOKIE', access_token, {
      'httpOnly': false,
      'signed': false,
      'encode': String
    })
    res.redirect('/send')
  } catch (err) {
    const { errorCode, errorMessage } = err.error
    return res.redirect(`send?result=${errorCode}-${errorMessage}`)
  }
})

// 문자 전송 API
app.post('/send', async (req, res) => {
  const { body: { text, to, from }, cookies: { TOKEN_COOKIE } } = req
  const { appId } = getAuthInfo(req.cookies)
  try {
    const result = await request({
      method: 'POST',
      uri: `${host}/messages/v4/send`,
      headers: {
        'Authorization': `bearer ${TOKEN_COOKIE}`
      },
      body: {
        message: {text, to, from},
        agent: { appId }
      },
      json: true
    })
    return res.redirect(`send?result=${JSON.stringify(result)}`)
  } catch (err) {
    const { errorCode, errorMessage } = err.error
    return res.redirect(`send?result=${errorCode}-${errorMessage}`)
  }
})

app.listen(80, () => {
  console.log(`Server is running on port : 80`)
})
