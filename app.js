// Clayton Smith

// Dont want API keys floating around on the internet
var config                = require('./config.json');

var express               = require('express'),
    routes                = require('./routes'),
    api                   = require('./routes/api'),
    http                  = require('http'),
    path                  = require('path'),
    OAuth                 = require('oauth-1.0a');

// update interval
var frequency = 15, the_interval = frequency * 60 * 1000;

var FitbitApiClient       = require("fitbit-node"),
    client                = new FitbitApiClient(config.FITBIT_KEY, config.FITBIT_SECRET);

var requestTokenSecrets   = {};

//var client = new FitbitApiClient(config.FITGIT_KEY, config.FITGIT_SECRET );
var app                   = module.exports = express();

var redirect              = module.exports = express();

var mongo                 = require('mongoskin'),
    db                    = mongo.db(config.mongo_link, {native_parser: true});

db.bind('keys');
db.bind('users');

app.use(function(req, res, next) {
    req.db = db;
    next();
})

/* EXPRESS SETUP */
app.set('port', process.env.PORT || 3000);
redirect.set('port', 6544);

app.set('views', __dirname + '/views');

// Template engine
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

// Stuff
//app.use(express.cookieParser());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.static(path.join(__dirname, 'public')));
app.use(app.router);

// Floors time to the preveous quarter hour
function floorTimeToQuarter(time){
    time.setMilliseconds(Math.floor(time.getMilliseconds() / 1000) * 1000);
    time.setSeconds(Math.floor(time.getSeconds() / 60) * 60);
    time.setMinutes(Math.floor(time.getMinutes() / 15) * 15);
    return time;
}

// Uses time to find the index  
function calcLastUpdateIndex() {
    var time = new Date();
    time = floorTimeToQuarter(time);
    return  parseInt(time.getHours() * 60 + time.getMinutes()) / 15; // int
}

function getTimeFromIndex(index) {   
    var time = new Date(0);
    time.setHours(0,0,0,0); // Set to midnigt of this morning
    time.setMinutes(time.getMinutes() + (index  * 15));
    return time;  // Date obj
}

function getTimeStampFromTime(time){
    return time.getHours() + ':' + time.getMinutes();  // Str
}

function getTimeStamp(){
    return getTimeStampFromTime(getTimeFromIndex(calcLastUpdateIndex()));
}

app.get("/authorize", function (req, res) {
    client.getRequestToken().then(function (results) {
	console.log('Getting token and redirect');
	
	var token  = results[0],
	    secret = results[1];
	requestTokenSecrets[token] = secret;
	console.log(token);
	res.redirect("http://www.fitbit.com/oauth/authorize?oauth_token=" + token);
    }, function (error) {
	res.send(error);
    });
});


app.get("/thankyou", function (req, res) {
    
    var token    = req.query.oauth_token,
	secret   = requestTokenSecrets[token],
        verifier = req.query.oauth_verifier;

    console.log('Got the token', requestTokenSecrets, token);
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
		    
                    console.log('Cool beans!');
                    
		    console.log(client.requestResource("/profile.json", "GET",
					               accessToken,	  
					               accessTokenSecret).then(function (results) {
                                                           console.log(err);
					                   var response = JSON.parse(results[0]);
                                                           
                                                           db.users.insert({
						               "atc":  accessToken,
						               "displayName": response.user.displayName,
						               "avatar": response.user.avatar,
						               "distance": .001,
                                                               "distances": Array.apply(null, {length: (1440 / frequency)}).map(Number.call, function(index){        
                                                                   return {
                                                                       "time": getTimeStampFromTime(getTimeFromIndex(index)),
                                                                       "distance": 0
                                                                   };
                                                               })
					                   }, {w: 0});	
					               }));
		}
	    });
	
	routes.index(req, res);
    }, function (error) {
	res.send(error);
    });
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

//May not be needed
app.get('/', function(req, res) {
    routes.index(req, res);
});

app.get('*', function(req, res) {
    routes.index(req, res);
});

redirect.get('*', function(req, res) {
    console.log('*', req.url);
    res.writeHead(302, {'Location': 'http://localhost:3000' + req.url});
    res.end();
});

// Start Server
http.createServer(app).listen(app.get('port'), function () {
    console.log('Express server listening on port ' + app.get('port'));
    console.log( "Current update time:  ",  getTimeStamp());
    console.log( "Current update index: ",  calcLastUpdateIndex());
    
});

// Fitbit callback puts users on port 6544. Listen on port 6544 and redirect users to port 3000
// so they may make API calls.
http.createServer(redirect).listen(redirect.get('port'), function () {
    console.log('Express server listening on port ' + redirect.get('port'));
});


/******* BACKGROUND STUFF *******/

// Update DB every X minutes

setInterval(function() {
    var today = new Date();

    // Get index into activity array 
    var currentIndex  = calcLastUpdateIndex(); 

    // Date string. Find better way.
    date = 'Y-m-d'
        .replace('Y', today.getFullYear())
        .replace('m', today.getMonth()+1)
        .replace('d', today.getDate());
    
    console.log("I am doing my "+ frequency +" minutes check");
    
    if( currentIndex == 0 ){
        
        db.users.update(
            {},
	    { $set: {"distance": 0,
                     "distances": Array.apply(null, {length: (1440 / frequency)}).map(Number.call, function(index){        
                         return {
                             "time": getTimeStampFromTime(getTimeFromIndex(index)),
                             "distance": 0
                         };
                     })
                    }},
            {multi: true},
            function(err, obj){
            }
        );	
    }
    
    
    db.keys.find({}).each(function(err, user) {
        console.log('Doing something for'+ user);
        if( !user ) return ;
	client.requestResource("/activities/date/"+ date +".json", "GET",
			       user.tokens.access_token,	  
			       user.tokens.access_token_secret).then(function (results) {
			           var quere = {};
                                   var key = 'distances.' + currentIndex + '.distance';
                                   quere[key] = JSON.parse(results[0]).summary.distances[0].distance;
                                   quere['distance'] = quere[key];
				   db.users.update(
                                       {atc:  user.tokens.access_token },
				       {$set: quere,  },
                                       {multi: true},
                                       function(err, obj){
                                       });				   
			       });        
    });    
}, the_interval);
