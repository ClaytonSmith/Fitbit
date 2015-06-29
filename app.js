// Clayton Smith

// Dont want API keys floating around on the internet

var express               = require('express'),
    routes                = require('./routes'),
    api                   = require('./routes/api'),
    http                  = require('http'),
    path                  = require('path'),
    OAuth                 = require('oauth-1.0a'),
    async                 = require('async'),
    cron                  = require('cron');

var config                = require('./config.json');

var FitbitApiClient       = require("fitbit-node"),
    client                = new FitbitApiClient(config.FITBIT_KEY, config.FITBIT_SECRET);

var today                 = new Date();

var requestTokenSecrets   = {};

var app                   = module.exports = express();

var redirect              = module.exports = express();

var mongo                 = require('mongoskin'),
    db                    = mongo.db(config.mongo_link, {native_parser: true});

// DEPRICATED: update interval
var frequency             = 15,
    the_interval          = frequency * 60 * 1000;

var appData  = {
    serverVersion: 1.01,
    clientVersion: 1.0,
    trackerInfo: {
        startTime: function(){ x = new Date(); return new Date(x.getUTCFullYear(), x.getUTCMonth()+1, x.getUTCDate(), /*START*/ 5, 0, 0, 0); },
        endTime:  function(){  x = new Date(); return new Date(x.getUTCFullYear(), x.getUTCMonth()+1, x.getUTCDate(), /*END*/  19, 0, 0, 0); }
    }
}

var cronJobs = [
    {
        name: "Quarter hour update",
        cronStr: "0 */15 5-19 * * * ", // Every 15 minutes between 5 am and 7 pm
        job: function(){ updateDB(); }
    },
    {
        name: "Nightly update",
        cronStr: "0 45 23 * * * ",
        job: function(){ nightlyUpdate(); }
    },
    {
        name: "Pre-Activity staging",
        cronStr: "0 15 0 * * *",
        job: function(){ dailyReset(); }
    }
]

db.bind('info');
db.bind('keys');
db.bind('users');

api.locals = appData
app.locals(appData);

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


// (TIME.HOURS * 4 ) + TIME.MINUTES - OFFSET
function getIndexFromTime(time){
    time = floorTimeToQuarter(time);
    return parseInt(time.getHours() * (60 + time.getMinutes()) / 15)
        - appData.trackerInfo.startTime().getHours() * 4; // int
}


// Uses time to find the index  
function calcLastUpdateIndex() {
    var time = new Date();    
    return getIndexFromTime(time);
}


function getTimeFromIndex(index) {   
    var time = appData.trackerInfo.startTime()
    time.setMinutes(time.getMinutes() + (index  * 15));
    return time;  // Date obj
}


function getTimeStampFromTime(time){
    return time.getHours() + ':' + time.getMinutes();  // Str
}

function getTimeStamp(){
    return getTimeStampFromTime(getTimeFromIndex(calcLastUpdateIndex()));
}

function canUpdate(dateX){
    var last     = new Date( dateX ),
        current  = new Date();
    
    return (
        ( last.getFullYear() < current.getFullYear() ||      // on new year
	  last.getMonth()    < current.getMonth()    ||      // on new month
	  last.getDate()     < current.getDate()     ||      // on new day
	  getIndexFromTime(last) < getIndexFromTime(current)) &&  // on new quarter hour
	0 <= getIndexFromTime(current)); // Don't update before time slot   
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
	console.log(accessToken, accessTokenSecret, userID);
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
		    
		    client.requestResource("/profile.json", "GET",
					   accessToken,	  
					   accessTokenSecret).then(function (results) {
                                               console.log(err);
					       var response = JSON.parse(results[0]);
                                               
                                               db.users.insert(
						   {
						       "atc":  accessToken,
						       "displayName": response.user.displayName,
						       "avatar": response.user.avatar,
						       "distance": 0,
                                                       "distances": Array.apply(null,Array(calcLastUpdateIndex())).map(function(el){return null;})
						   },
						   {w: 0});	
					       
                                               client.requestResource("/activities/date/"+ date +".json", "GET",
			                                              access_token,	  
			                                              access_token_secret).then(function (results){ 
									  var distance = JSON.parse(results[0]).summary.distances[0].distance
									  db.users.update(
									      {atc:  user.tokens.access_token },
									      {
										  $push: {
										      "distances": { 
											  $each: [ distance ],
											  $position: calcLastUpdateIndex()
										      }},
										  $set:  {"distance":  distance}
									      },
									      {multi: true},
                                                                              function(err, obj){
										  // Tell client to get new data
										  io.emit('db_update', {message: 'A new user has been added. Please update yourself.'}); 
									      });
								      });
                                           });
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
app.get('/api/info',         api.info);
app.get('/api/req_update',   api.update);
app.post('/api/add_user',    api.addUser);

// redirect all others to the index (HTML5 history)

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
    var date = 'Y-m-d'
	.replace('Y', today.getFullYear())
	.replace('m', today.getMonth()+1)
	.replace('d', today.getDate());
    
    var currentIndex  = calcLastUpdateIndex(); 
   
    client.requestResource("/activities/date/"+ date +".json", "GET", 
			   user.tokens.access_token,
			   user.tokens.access_token_secret
			  ).then(function (results) {
			      var query = {};			      
			      var distance = JSON.parse(results[0]).summary.distances[0].distance
			      db.users.update(
				  {atc:  user.tokens.access_token },
				  {
				      $push: {
					  "distances": { 
					      $each: [ distance ],
					      $position: calcLastUpdateIndex()
					  }},
				      $set:  {"distance":  distance}
				  },
				  {multi: true},
                                  function(err, obj){
				      hackyThing -= 1;
				      console.log(hackyThing);
			              if( hackyThing === 1 ){ // off by one because extra user in keys set
					  console.log('*********************** DB updated.');
					  io.emit('db_update', {message: 'New data from Fitbit. Please update yourself.'});
					  done();
				      }
				  });
			  });   
}

var hackyThing = 0;

function updateDB() {  
    db.info.findOne(  
	{info: "lastUpdateTime"},
	function(err, lastUpdate){  // lastUpdateTime will prevent multiple servers from updating a sing database. 
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
		    lastUpdateTime: currentUpdateTime
		}, {w: 0});
		
		lastUpdateTime = currentUpdateTime;
	    } else {
		console.log( 'Last updated: ', lastUpdate.lastUpdateTime);
		lastUpdateTime = lastUpdate.lastUpdateTime;
	    }
	    
	    // Do not update if already updated
	    if( canUpdate(lastUpdateTime) ){ 
		console.log('The database is updating.');
		
		db.keys.find({}).toArray(function(err, result){
		    hackyThing = result.length;
		    async.forEach(result, getFitbitData, function(err){
			console.log(err);
		    });
		})
		
		db.info.update(
		    { "info": "lastUpdateTime",},
		    { $set: { "lastUpdateTime": new Date()}},
		    { multi: true},
		    function(err, obj){ 
			console.log(err, obj);
		    });
		
	    } else {
		console.log('No updates needed at this time');
		
		// THIS server might not have updated the DB but someone did.
		// Lets let the clients know there is an update
		io.emit('db_update', {message: 'New data might exist from Fitbit. Please update yourself.'});
	    }
	});
}  

function nightlyUpdate(){
};

function morningReset(){
    
    db.users.update(
	{},
	{ $set: {
	    "distance": 0,
	    "distances": Array.apply(null, Array(48)).map(function(el){return null;})
	}},
	{multi: true},
	function(err, obj){ 
	    console.log(err, obj);
	}
    );
}

/************* START SERVER STUFF :) *************/
// Init update
//
updateDB();

// Start monitors
cronJobs.forEach(function(obj){
    console.log('Launching tast', obj.name);
    cron.job(obj.cronStr, obj.job).start();
});

// Start Server and init socket
var io = require('socket.io').listen(
    http.createServer(app).listen(app.get('port'), function () {
	console.log('Express server listening on port ' + app.get('port'));
	console.log( "Current update time:  ",  getTimeStamp());
	console.log( "Current update index: ",  calcLastUpdateIndex());
    }));

// Fitbit callback puts users on port 6544 on localhost. Listen on port 6544 and redirect users to port 3000
// so they may make API calls.
// ^^ This only applies if the Fitbit redirect URL has not been set. ^^ 
http.createServer(redirect).listen(redirect.get('port'), function () {
    console.log('Express server listening on port ' + redirect.get('port'));
});
