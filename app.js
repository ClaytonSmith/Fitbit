/**
 * File: app.js
 * Written By: Clayton Smith
 * Project name: Visono
 *
 * http://pastebin.com/12wzWV3e
 */

var express = require('express'),
    routes  = require('./routes'),
    api     = require('./routes/api'),
    http    = require('http'),
    path    = require('path');

var mongo   = require('mongoskin');
var db      = mongo.db("mongodb://localhost:27017/visono", {native_parser:true});

db.bind('keys');
db.bind('users');

var app = module.exports = express();

app.use(function(req, res, next) {
    req.db = db;
    next();
})

// all environments
app.set('port', process.env.PORT || 3000);

app.set('views', __dirname + '/views');

app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());

app.use(express.static(path.join(__dirname, 'public')));

app.use(app.router);

// development only
if (app.get('env') === 'development') {
   app.use(express.errorHandler());
};

// production only
if (app.get('env') === 'production') {
  // TODO
}; 

// Routes
app.get('/partials/:name', routes.partial );

// JSON API
app.get( '/api/info',               api.info);
app.get( '/api/update',             api.update);
app.post('/api/add_user',          api.addUser);


// redirect all others to the index (HTML5 history)
app.get('*', routes.index );


app.get('/', function(req, res) {
    res.sendFile(__dirname + "/views/index.html"); 
});

/**
 * Start Server
 */

http.createServer(app).listen(app.get('port'), function () {
    console.log('Express server listening on port ' + app.get('port'));
});
