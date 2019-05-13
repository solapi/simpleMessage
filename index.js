const express = require('express')
const app = express()
const request = require('request-promise')
const bodyParser = require('body-parser')

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({
  extended: true
}))
app.set('views', __dirname + '/views')
app.set('view engine', 'ejs')
app.engine('html', require('ejs').renderFile)
app.get('/', (req, res) => {
  res.render('index', {})
})
app.get('/send', (req, res) => {
  res.render('send', {})
})
app.get('/authorize', async (req, res) => {
  const { code, state } = req.query
  const result = await request({
    method: 'POST',
    uri: 'https://rest.coolsms.co.kr/oauth2/v1/access_token',
    body: {
      grant_type: 'authorization_code',
      code,
      client_id: 'CIDRWEKR9TSFDKO2',
      client_secret: '25EZ4NUATZAU8GOX4JMEPNSSNEFBXSID',
      redirect_uri: 'http://192.168.31.128/authorize'
    },
    json: true
  })
  res.cookie('CSAK', result.access_token, {
    'domain': '',
    'httpOnly': false,
    'signed': false,
    'encode': String
  })
  res.redirect('/send')
})
app.post('/send', async (req, res) => {
  console.log('CHECK REQ !')
  console.log(req.body)
  const { text, to, from } = req.body
  console.log('check PARAMS', text, to, from)
  const result = await request({
    method: 'POST',
    uri: 'https://rest.coolsms.co.kr/messages/v4/send',
    body: {
      message: { text, to, from, agent: { appId: 'qWTkwjeGBtj5' } }
    },
    json: true
  })
  console.log(result)
  res.redirect('/send')
})
app.listen(80, () => {
  console.log(`Server is running on port : 80`)
})