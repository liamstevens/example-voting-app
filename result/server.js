var express = require('express'),
    async = require('async'),
    { Pool } = require('pg'),
    cookieParser = require('cookie-parser'),
    app = express(),
    server = require('http').Server(app),
    io = require('socket.io')(server);

const path = require('path');


app.set('trust proxy', 1); // trust first proxy

// Set views directory and view engine
app.set('views', path.join(__dirname, 'views')); // <--- Set views directory
app.set('view engine', 'ejs');

// Read the base path from environment variable, default to empty string if not set
const basePath = process.env.BASE_PATH || '';

// Make basePath available globally to your template engine
// Example for EJS, Handlebars, Pug (check specific engine docs if needed)
app.locals.basePath = basePath;

var port = process.env.PORT || 4000;

io.on('connection', function (socket) {

  socket.emit('message', { text : 'Welcome!' });

  socket.on('subscribe', function (data) {
    socket.join(data.channel);
  });
});

var pool = new Pool({
  connectionString: 'postgres://postgres:postgres@db/postgres'
});

async.retry(
  {times: 1000, interval: 1000},
  function(callback) {
    pool.connect(function(err, client, done) {
      if (err) {
        console.error("Waiting for db");
      }
      callback(err, client);
    });
  },
  function(err, client) {
    if (err) {
      return console.error("Giving up");
    }
    console.log("Connected to db");
    getVotes(client);
  }
);

function getVotes(client) {
  client.query('SELECT vote, COUNT(id) AS count FROM votes GROUP BY vote', [], function(err, result) {
    if (err) {
      console.error("Error performing query: " + err);
    } else {
      var votes = collectVotesFromResult(result);
      io.sockets.emit("scores", JSON.stringify(votes));
    }

    setTimeout(function() {getVotes(client) }, 1000);
  });
}

function collectVotesFromResult(result) {
  var votes = {a: 0, b: 0};

  result.rows.forEach(function (row) {
    votes[row.vote] = parseInt(row.count);
  });

  return votes;
}

app.use(cookieParser());
app.use(express.urlencoded());
//app.use(express.static(__dirname + '/views'));
app.use('/static', express.static(path.join(__dirname, 'public')));

app.get('/', function (req, res) {
  res.render('index');
});

server.listen(port, function () {
  var port = server.address().port;
  console.log('App running on port ' + port);
});
