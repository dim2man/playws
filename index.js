const express = require('express');
const fs = require('fs');
const crypto = require('crypto');

const {setupWs} = require('./ws');
const [,,port] = process.argv;
const app = express();

setupWs(app);
app.use('/games', express.static('./games'));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Oops!');
});

const server = app.listen(+port, () => {
  console.log(`PlayWS app listening on port ${port}`)
});
