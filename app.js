var express         = require('express'),
    routes          = require('./routes'),
    api             = require('./routes/api'),
    http            = require('http'),
    path            = require('path'),
    passport        = require('passport');
//    FitbitStrategy  = require('passport-fitbit').Strategy;
//    Fitbit          = require("fitbit-node");

var config = require('./config.json');

// Dont want API keys floating around on the internet
var FITBIT_CONSUMER_KEY    = config.FITBIT_KEY;
var FITBIT_CONSUMER_SECRET = config.FITBIT_SECRET;


//var client = new FitbitApiClient(config.FITGIT_KEY, config.FITGIT_SECRET );

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

var requestTokenSecrets = {};

var session = {};

var FitbitApiClient = require("fitbit-node"),
    client = new FitbitApiClient(config.FITBIT_KEY, config.FITBIT_SECRET);

var requestTokenSecrets = {};

app.get("/authorize", function (req, res) {
    client.getRequestToken().then(function (results) {
	var token = results[0],
	    secret = results[1];
	requestTokenSecrets[token] = secret;
	console.log(requestTokenSecrets, token);
	console.log(token);
	res.redirect("http://www.fitbit.com/oauth/authorize?oauth_token=" + token);
    }, function (error) {
	res.send(error);
    });
});


app.get("/thankyou", function (req, res) {

    var token = req.query.oauth_token,
	secret = requestTokenSecrets[token],

	verifier = req.query.oauth_verifier;
    console.log(requestTokenSecrets, token);
    client.getAccessToken(token, secret, verifier).then(function (results) {
	var accessToken = results[0],
	    accessTokenSecret = results[1],
	    userId = results[2].encoded_user_id;
	console.log( accessToken, accessTokenSecret);
	
	routes.index(req, res);
	
	db.keys.findOne(
	    {atc:  accessToken},
	    function(err, user){
		
		// Server error
		if(err){
		    console.log( "Server error" );
		    res.status(500).json({error: "Server error."}) ;	    
		}
		
		// User already added
		if(user){
		    console.log( "User already in the database." );
		    res.status(403).json({error: "User already in the database."}) ;
		    
		    // Insert new user 
		} else {
		    console.log( "User has been added to the team." );
		    db.keys.insert({
			atc:  accessToken,
			tokens: {
			    access_token: accessToken,
			    access_token_secret: accessTokenSecret
			}}, {w: 0});	
		    
		    routes.index(req, res);
		    
/*		    client.requestResource("/profile.json", "GET",
					   accessToken,	  
					   accessTokenSecret).then(function (results) {
					       var response = results[0];
					       
					       
					       
					       } );*/
		}
		
	    });
	

	routes.index(req, res);
    }, function (error) {
	res.send(error);
    });
});


/*
  
 */
app.listen(6544);

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

app.get('/', function(req, res) {
    routes.index(req, res);
    //res.sendFile(__dirname + "/views/index.html"); );
});
var set = false ;
app.get('*', function(req, res) {
    routes.index(req, res);
});

// Start Server
http.createServer(app).listen(app.get('port'), function () {
    console.log('Express server listening on port ' + app.get('port'));
});

var minutes = .5, the_interval = minutes * 60 * 1000;
setInterval(function() {
    console.log("I am doing my 5 minutes check");
        db.keys.find({}, function(err, result) {
	result.each(function(err, user) {
	    if( !user ) return ;
	    
/*	    console.log( client.requestResource("/activities/distance.json", "GET",
						user.tokens.access_token,	  
						user.tokens.access_token_secret).then(function (results) {
						    
						    var response = results[0];
						    
						    console.log(response);	    
						}));*/
	    
	    
	});
    });

    
    // do your stuff here
}, the_interval);

/*
db.keys.find({}, function(err, result) {
    result.each(function(err, user) {
	if( !user ) return ;
	
	console.log( client.requestResource("/activities/date/2015-6-1.json", "GET",
					    user.tokens.access_token,	  
					    user.tokens.access_token_secret).then(function (results) {


						
						var response = results[0];
						
						console.log(response);	    
					    }));
	
	
    });
});
*/
