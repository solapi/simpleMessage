const express = require('express')
const app = express()
const request = require('request-promise')
const bodyParser = require('body-parser')
const config = require('./config')

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({
  extended: true
}))
app.set('views', __dirname + '/views')
app.set('view engine', 'ejs')
app.engine('html', require('ejs').renderFile)

// 첫 페이지 (인증 정보들 입력) view
app.get('/', (req, res) => {
  res.render('index', {
    redirectUri: config.redirectUri,
    clientId: config.clientId
  })
})

// 문자 전송 view
app.get('/send', (req, res) => {
  res.render('send', {
    redirectUri: config.redirectUri
  })
})

// 인증 처리 API
app.get('/authorize', async (req, res) => {
  const { code } = req.query
  const { access_token } = await request({
    method: 'POST',
    uri: 'https://rest.coolsms.co.kr/oauth2/v1/access_token',
    body: {
      grant_type: 'authorization_code',
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri
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
  const { text, to, from } = req.body
  try {
    await request({
      method: 'POST',
      uri: 'https://rest.coolsms.co.kr/messages/v4/send',
      body: {
        message: {text, to, from, agent: {appId: config.appId}}
      },
      json: true
    })
  } catch (err) {
    console.log(err)
  }
  res.redirect('/send')
})

app.listen(80, () => {
  console.log(`Server is running on port : 80`)
})
