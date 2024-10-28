const express = require('express');
const fs = require('fs');
const crypto = require('crypto');

const {setupWs} = require('./ws');
// console.log(JSON.stringify(process.argv));
const [,,port] = process.argv;
const app = express();

// router.get('/seabattle', (req, res) => {
//   const file = fs.readFileSync('./static/seabattle.html', {encoding: 'utf-8'});
//   res.setHeader('Content-Type', 'text/html; charset=utf-8');
//   // res.setHeader('ETag', crypto.createHash("md5").update(file).digest("hex"));
//   res.end(file, 'utf-8');
// });

setupWs(app);
app.use('/games', express.static('./games'));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Oops!');
});

const server = app.listen(+port, () => {
  console.log(`Example app listening on port ${port}`)
});

// server.on('upgrade', (request, socket, head) => {
//   wsServer.handleUpgrade(request, socket, head, socket => {
//     wsServer.emit('connection', socket, request);
//   });
// });