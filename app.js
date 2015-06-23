// Clayton Smith

// Dont want API keys floating around on the internet

var express               = require('express'),
    routes                = require('./routes'),
    api                   = require('./routes/api'),
    http                  = require('http'),
    path                  = require('path'),
    OAuth                 = require('oauth-1.0a'),
    http                  = require('http'),
    async                 = require('async');

var config                = require('./config.json');

var FitbitApiClient       = require("fitbit-node"),
    client                = new FitbitApiClient(config.FITBIT_KEY, config.FITBIT_SECRET);

var requestTokenSecrets   = {};

// update interval
var frequency = 15, the_interval = frequency * 60 * 1000;

//var client = new FitbitApiClient(config.FITGIT_KEY, config.FITGIT_SECRET );
var app                   = module.exports = express();

var redirect              = module.exports = express();

var mongo                 = require('mongoskin'),
    db                    = mongo.db(config.mongo_link, {native_parser: true});

db.bind('keys');
db.bind('users');
db.bind('info');

app.use(function(req, res, next) {
    req.db = db;
    next();
});

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

function getIndexFromTime(time){
    time = floorTimeToQuarter(time);
    return  parseInt(time.getHours() * 60 + time.getMinutes()) / 15; // int
}


// Uses time to find the index  
function calcLastUpdateIndex() {
    var time = new Date();
    return getIndexFromTime(time);
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

    client.getAccessToken(token, secret, verifier).then(function (results) {
	var accessToken = results[0],
	    accessTokenSecret = results[1],
	    userId = results[2].encoded_user_id;
	
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
		    
		    console.log(client.requestResource("/profile.json", "GET",
					               accessToken,	  
					               accessTokenSecret).then(function (results) {
                                                           console.log(err);
					                   var response = JSON.parse(results[0]);
                                                           
                                                           db.users.insert({
						               "atc":  accessToken,
						               "displayName": response.user.displayName,
						               "avatar": response.user.avatar,
						               "distance": 0,
                                                               "distances": Array.apply(null, Array(calcLastUpdateIndex())).map(Number.prototype.valueOf,0)
							   },                       
						           {w: 0});	

                                                           client.requestResource("/activities/date/"+ date +".json", "GET",
			                                                          access_token,	  
			                                                          access_token_secret).then(function (results) {
			                                                              var query = {};
                                                                                      var key = 'distances.' + currentIndex + '.distance';
                                                                                      query[key] = JSON.parse(results[0]).summary.distances[0].distance;
                                                                                      query['distance'] = query[key];
				                                                      
										      
										      var distance = JSON.parse(results[0]).summary.distances[0].distance
										      db.users.update(
											  {atc:  user.tokens.access_token },
											  {$push: {"distances": distance }},
											  {$set:  {"distance":  distance}},
											   {multi: true},
                                                                                           function(err, obj){
                                                                                          });
											  /*db.users.update(
                                                                                          {atc:  user.tokens.access_token },
				                                                          {$set:  },
                                                                                          {multi: true},
                                                                                           function(err, obj){
                                                                                          });
											  */
			                                                              
										      // Tell client to get new data
										      io.emit('db_update', {message: 'A new user has been added. Please update yourself.'});
										  });
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
    console.log('*', req.url);
    routes.index(req, res);
    res.end();
});

redirect.get('*', function(req, res) {
    console.log('*', req.url);
    res.writeHead(302, {'Location': 'http://localhost:3000' + req.url});
    res.end();
});

// Start Server
var io = require('socket.io').listen(
    http.createServer(app).listen(app.get('port'), function () {
	console.log('Express server listening on port ' + app.get('port'));
	console.log( "Current update time:  ",  getTimeStamp());
	console.log( "Current update index: ",  calcLastUpdateIndex());
    }));

// Fitbit callback puts users on port 6544. Listen on port 6544 and redirect users to port 3000
// so they may make API calls.
http.createServer(redirect).listen(redirect.get('port'), function () {
    console.log('Express server listening on port ' + redirect.get('port'));
});

// Socket setup

/******* BACKGROUND STUFF *******/

// Update DB every X minutes

var updateChain = []

function getFitbitData( user, done){
     if( !user ) {
	 console.log('Im out');
	 //done();
	 return ;
     }
    
     var today = new Date();

    // Date string. Find better way.
    date = 'Y-m-d'
	.replace('Y', today.getFullYear())
	.replace('m', today.getMonth()+1)
	.replace('d', today.getDate());
    
    var currentIndex  = calcLastUpdateIndex(); 
   
    client.requestResource("/activities/date/"+ date +".json", "GET", 
			   user.tokens.access_token,
			   user.tokens.access_token_secret
			  ).then(function (results) {
			      var query = {};
			      //var key = 'distances.' + currentIndex + '.distance';
			      
			      //query[key] = JSON.parse(results[0]).summary.distances[0].distance;
			      //query['distance'] = query[key];
			      
			      var distance = JSON.parse(results[0]).summary.distances[0].distance
			      db.users.update(
                                  {atc:  user.tokens.access_token },
				  {$push: {"distances": distance }},
				  {multi: true},
                                  function(err, obj){    
				  });
			      db.users.update(
                                  {atc:  user.tokens.access_token },
                                  {$set:  {"distance":  distance }},
				  {multi: true},
                                  function(err, obj){    
				      hackyThing -= 1;
				      console.log(hackyThing);
				      if( hackyThing === 1 ){
					  console.log('*********************** DB updated.');
					  io.emit('db_update', {message: 'New data from Fitbit. Please update yourself.'});
					  done();
				      }
				  });
			  });   
}

var hackyThing = 0;
function updateDB() {
    console.log("I am doing my "+ frequency +" minute check");
    db.info.findOne(
	{ info: "lastUpdateTime",},
	function(err, lastUpdate){
	    console.log('looking for last update time'); 
	    if(err){
		condole.log('bad server error');
	    }
	    
	    var currentUpdateTime = new Date();
	    var lastUpdateTime    = 0;
	   
	    if(!lastUpdate){
		console.log('Set first update time');
		db.info.insert({
		    info: "lastUpdateTime",
		    "lastUpdateTime": currentUpdateTime
		}, {w: 0});
		
		lastUpdateTime = currentUpdateTime;
	    } else {
		console.log( 'using last update time.', lastUpdate.lastUpdateTime);
		lastUpdateTime = lastUpdate.lastUpdateTime;
	    }
	    
	    // Dont update too often!
	    if( getIndexFromTime(lastUpdateTime) == getIndexFromTime(currentUpdateTime)){ 
		console.log('The database is updating.');
		
		if( calcLastUpdateIndex() !== 0 ){
		    console.log( 'RESET');
		    db.users.update(
			{},
			{ $set: {"distance": 0,  
				 "distances": Array.apply(null, Array(calcLastUpdateIndex())).map(Number.prototype.valueOf,0)
				}},
			{multi: true},
			function(err, obj){ 
			});	
		}
		
		db.keys.find({}).toArray(function(err, result){
		    console.log( 'Builing reqest chain.' );
		    hackyThing = result.length;
		    async.forEach(result, getFitbitData, function(err){
			console.log(err);
		    });
		});
		
		// update time
		db.info.update(
		    { "info": "lastUpdateTime",},
		    { $set: { "lastUpdateTime": new Date()}},
		    { multi: true},
		    function(err, obj){ 
			console.log(err, obj);
		    });
		
	    } else {
		console.log('No updates needed at this time');
	    }
	});
}	

updateDB();
setInterval( updateDB, the_interval);

/*
Array.apply(null, {length: (1440 / frequency)}).map(Number.call, function(index){        
                                                                   return {
                                                                       "time": getTimeStampFromTime(getTimeFromIndex(index)),
                                                                       "distance": 0
                                                                   };*/
