const express = require('express')
const cookieParser = require('cookie-parser')
const app = express()
const request = require('request-promise')
const bodyParser = require('body-parser')
const nanoid = require('nanoid')

app.use(bodyParser.json())
app.use(cookieParser())
app.use(bodyParser.urlencoded({
  extended: true
}))
app.set('views', __dirname + '/public/views')
app.use(express.static(__dirname + '/public'))
app.set('view engine', 'ejs')
app.engine('html', require('ejs').renderFile)

// 첫 페이지 (인증 정보들 입력) view
app.get('/', (req, res) => {
  const { SimpleMessageInfo } = req.cookies
  const state = nanoid()
  if (SimpleMessageInfo) {
    return res.render('index', {
      appId: SimpleMessageInfo.appId,
      clientId: SimpleMessageInfo.clientId,
      clientSecret: SimpleMessageInfo.clientSecret,
      redirectUri: SimpleMessageInfo.redirectUri,
      state
    })
  }
  res.render('index', {
    appId: '',
    clientId: '',
    clientSecret: '',
    redirectUri: '',
    state
  })
})

// 문자 전송 view
app.get('/send', (req, res) => {
  res.render('send', {
    result: req.query.result
  })
})

// 설정 저장하고 oauth 로그인으로 redirect
app.get('/config', async (req, res) => {
  const {
    app_id: appId,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    state,
    scope,
    response_type
  } = req.query
  res.cookie('SimpleMessageInfo', {
    appId,
    clientId,
    clientSecret,
    redirectUri
  }, {
    'domain': '',
    'httpOnly': false,
    'signed': false,
    'encode': String
  })
  return res.redirect(`https://rest.test.coolsms.co.kr/oauth2/v1/authorize?client_id=${clientId}&state=${state}&scope=${scope}&response_type=${response_type}&redirect_uri=${redirectUri}`)
})

// 인증 처리 API
app.get('/authorize', async (req, res) => {
  const { code } = req.query
  const { SimpleMessageInfo: { clientId, clientSecret, redirectUri } } = req.cookies
  const { access_token } = await request({
    method: 'POST',
    uri: 'https://rest.test.coolsms.co.kr/oauth2/v1/access_token',
    body: {
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri
    },
    json: true
  })
  res.cookie('CSAK', access_token, {
    'domain': '',
    'httpOnly': false,
    'signed': false,
    'encode': String
  })
  res.redirect('/send')
})

// 문자 전송 API
app.post('/send', async (req, res) => {
  const { body: { text, to, from }, cookies: { CSAK, SimpleMessageInfo } } = req
  try {
    const result = await request({
      method: 'POST',
      uri: 'https://rest.test.coolsms.co.kr/messages/v4/send',
      headers: {
        'Authorization': `bearer ${CSAK}`
      },
      body: {
        message: {text, to, from},
        agent: {appId: SimpleMessageInfo.appId}
      },
      json: true
    })
    return res.redirect(`send?result=${JSON.stringify(result)}`)
  } catch (err) {
    console.log(err)
  }
})

app.listen(80, () => {
  console.log(`Server is running on port : 80`)
})
