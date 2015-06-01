var express         = require('express'),
    routes          = require('./routes'),
    api             = require('./routes/api'),
    http            = require('http'),
    path            = require('path'),
    passport        = require('passport'),
    FitbitStrategy  = require('passport-fitbit').Strategy;

var config = require('./config.json');

// Dont want API keys floating around on the internet
var FITBIT_CONSUMER_KEY    = config.FITGIT_KEY;
var FITBIT_CONSUMER_SECRET = config.FITGIT_SECRET;

var app = module.exports = express();

var mongo   = require('mongoskin'),
    db      = mongo.db(config.mongo_link, {native_parser:true});

db.bind('keys');
db.bind('users');

app.use(function(req, res, next) {
    req.db = db;
    next();
})


// all the environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');

app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

app.use(express.cookieParser());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.session({secret: 'I like security' }));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, 'public')));
app.use(app.router);

passport.use(new FitbitStrategy({
    consumerKey: FITBIT_CONSUMER_KEY,
    consumerSecret: FITBIT_CONSUMER_SECRET,
    callbackURL: "http://127.0.0.1:3000/auth/fitbit/callback"
},function(token, tokenSecret, profile, done) {
    process.nextTick(function () {
	console.log('test');
	return done(null, profile);
    });
})); 

passport.serializeUser(  function(user, done) { done(null, user);});
passport.deserializeUser(function(obj,  done) { done(null, obj); });


app.get('/auth/fitbit',
	passport.authenticate('fitbit'),
	function(req, res){
	    // Empty 
  });

app.get('/auth/fitbit/callback',
	passport.authenticate('fitbit'),//, { failureRedirect: 'https://google.com' }),
	function(req, res){
	    console.log( req.user.displayName+ " has been added to the team." );
	    res.redirect('/');
//	    db.keys.insert({
//		uID:  req.user.id,/
//	    	keys: req.query,//
//		user: req.user/
//	    }, {w: 0});
	    console.log(req.user);
	    console.log(req.query);
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
app.get('/api/req_update',         api.update);
app.post('/api/add_user',          api.addUser);


// redirect all others to the index (HTML5 history)
// 404 page collector
app.get('*', routes.index);
app.get('/', function(req, res) {
    res.sendFile(__dirname + "/views/index.html"); 
});

// Start Server
http.createServer(app).listen(app.get('port'), function () {
    console.log('Express server listening on port ' + app.get('port'));
});



