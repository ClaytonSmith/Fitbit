/**
 * File: app.js
 * Written By: Clayton Smith
 * Project name: Visono
 *
 * http://pastebin.com/12wzWV3e
 */

var express  = require('express'),
    routes   = require('./routes'),
    api      = require('./routes/api'),
    http     = require('http'),
    path     = require('path'),
    passport = require('passport');
var FitbitStrategy = require('passport-fitbit').Strategy;

var mongo   = require('mongoskin');
var db      = mongo.db("mongodb://localhost:27017/fitbit", {native_parser:true});

db.bind('keys');
db.bind('users');
 
// Dont want API keys floating around on the internet
var config = require('./config.json');

var FITBIT_CONSUMER_KEY    = config.FITGIT_KEY;
var FITBIT_CONSUMER_SECRET = config.FITGIT_SECRET;

var app = module.exports = express();

app.use(function(req, res, next) {
    req.db = db;
    next();
})

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});


// all the environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');

app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

app.use(express.cookieParser());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.session({ secret: 'I like security' }));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, 'public')));
app.use(app.router);


passport.use(new FitbitStrategy({
    consumerKey: FITBIT_CONSUMER_KEY,
    consumerSecret: FITBIT_CONSUMER_SECRET,
    callbackURL: "http://clayton-smith.com/auth/fitbit/callback"
},function(token, tokenSecret, profile, done) {
    process.nextTick(function () {
	console.log('New fitbit thing');
	return done(null, profile);
    });
})); 

app.get('/auth/fitbit',
	passport.authenticate('fitbit'),
	function(req, res){
	    console.log("We were lied to");
	    // The request will be redirected to Fitbit for authentication, so this
	    // function will not be called.
  });

app.get('/auth/fitbit/callback',
	passport.authenticate('fitbit'),
	function(req, res){
	    console.log( req.user.displayName+ " has been added to the team." );
	    db.keys.insert({
		keys: req.query
	    }, {w: 0});
	
	    res.redirect('/');
	});

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
app.get('/api/info',               api.info);
app.get('/api/update',             api.update);
app.post('/api/add_user',          api.addUser);

// redirect all others to the index (HTML5 history)

// 404 page collector
app.get('*', routes.index);


app.get('/', function(req, res) {
    res.sendFile(__dirname + "/views/index.html"); 
});

/**
 * Start Server
 */

http.createServer(app).listen(app.get('port'), function () {
    console.log('Express server listening on port ' + app.get('port'));
});
