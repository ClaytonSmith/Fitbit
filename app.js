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

var today                 = new Date((new Date()).getUTCFullYear(), (new Date()).getUTCMonth(), (new Date()).getUTCDate(), 0, 0, 0, 0)

var requestTokenSecrets   = {};

var app                   = module.exports = express();

var redirect              = module.exports = express();

var mongo                 = require('mongoskin'),
    db                    = mongo.db(config.mongo_link, {native_parser: true});

var appData  = {
    serverVersion: 1.01,
    clientVersion: 1.85,
    trackerInfo: {
        startTime:  new Date((new Date()).getUTCFullYear(), (new Date()).getUTCMonth(), (new Date()).getUTCDate(), /*START*/ 5, 0, 0, 0),
	endTime:    new Date((new Date()).getUTCFullYear(), (new Date()).getUTCMonth(), (new Date()).getUTCDate(), /*END*/   19, 0, 0, 0)
    }
}

// save appData to node app and express api.
// saving to the express api allows appData to be shared with the UI
api.locals = appData;
app.locals(appData);

// giv Expess a way to inform users of an update 
api.sendUpdate = function(){ io.emit('db_update', {message: 'An update has been made, please update yourself.'}); };

// Set of tasks to run
var cronJobs = [
    {
        // Every 15 minutes between hours stated in appData object
        // Gets info from Fitbit api every 15 minutes
        name: "Quarter hour update",
        cronStr: "0 */15 "+ appData.trackerInfo.startTime.getHours()+"-"+appData.trackerInfo.endTime.getHours() +" * * * ", 
        job: function(){ updateDB(); }
    },
    {
        // Saves the daily stats to the history records every night at 11:45 pm
        // Gets final, afterhours, stats for the day
        name: "Nightly update",
        cronStr: "0 45 23 * * * ",
        job: function(){ nightlyUpdate(); }
    },
    {
        // Clears all data from the preveious day to prep for the current day.
        name: "Pre-Activity staging",
        cronStr: "0 15 1 * * *",
        job: function(){ dailyReset(); }
    }
]

// Bind db collections
db.bind('info');     // App info
db.bind('keys');     // user keys
db.bind('users');    // user data 
db.bind('history');  // user history

// attach the db
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
// Helps pull update index from time, see `getIndexFromTime`
// 11:56 -> 11:45, 3:04 -> 3:00
function floorTimeToQuarter(time){
    time = new Date(time);
    time.setMilliseconds(Math.floor(time.getMilliseconds() / 1000) * 1000);
    time.setSeconds(Math.floor(time.getSeconds() / 60) * 60);
    time.setMinutes(Math.floor(time.getMinutes() / 15) * 15);
    return time;
}

// The update index can be derived from the current, or any, time
// If the app is to start recording data at 5:00, than 5:00 would be index 0, 5:15 would be index 1,
// 5:30 -> 2, ect...
function getIndexFromTime(time){
    time = floorTimeToQuarter(time);
    var mid =  parseInt(time.getHours() * 4 + (time.getMinutes() / 15));
    var offset = parseInt(appData.trackerInfo.startTime.getHours() * 4 + (appData.trackerInfo.startTime.getMinutes()/15)); // int
    return mid - offset; // midnight, mid, is index 0. Subtract start time from midnight to get update index. 
}

// Uses time to find the index  
function calcLastUpdateIndex() {
    var time = new Date();
    return getIndexFromTime(time);
}

// Calculate time from index 
function getTimeFromIndex(index) {   
    var time = new Date( appData.trackerInfo.startTime);
    time.setMinutes(time.getMinutes() + (index  * 15));
    return time;
}

// get time stamp string of a given time
function getTimeStampFromTime(time){
    return time.getHours() + ':' + time.getMinutes();  // Str
}

// time stamp of currnet time
function getTimeStamp(){
    return getTimeStampFromTime(getTimeFromIndex(calcLastUpdateIndex()));
}

// Bool: checks to see if an update too place with in the last 15 min
function canUpdate(dateX){
    var last     = new Date( dateX ),
        current  = new Date();
    
    return (
        ( last.getFullYear() < current.getFullYear() ||           // on new year
	  last.getMonth()    < current.getMonth()    ||           // on new month
	  last.getDate()     < current.getDate()     ||           // on new day
	  getIndexFromTime(last) < getIndexFromTime(current)) &&  // on new quarter hour( index ) 
	0 <= getIndexFromTime(current)                            // Don't update before start time set in appData   
//        getIndexFromTime(current) <= getIndexFromTime(appData.trackerInfo.endTime)  // or after end time 
    );  
}

// Sends users to Fitbit Oauth page
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


// Redirect from Fitbit Oauth
// Adds new user to database(keys, users, history)
app.get("/thankyou", function (req, res) {
    
    var token    = req.query.oauth_token,
	secret   = requestTokenSecrets[token],
        verifier = req.query.oauth_verifier;

    client.getAccessToken(token, secret, verifier).then(function (results) {
        
        var accessToken = results[0],
	    accessTokenSecret = results[1];
        var userId = results[2].encoded_user_id;

        // sends users back to home page
	routes.index(req, res);

        // look to see if a user already exists
	db.keys.findOne(
	    {atc:  accessToken},
	    function(err, user){
		
		if(err){ // Server error
		    console.log( "Server error" );
		    res.status(500).json({error: "Server error."}) ;	     

                } else if(user){ // User already added
		    console.log( "User already in the database." );
		    res.status(403).json({error: "User already in the database."}) ;
		    
		} else { // Insert new user 
		    console.log( "User has been added to the team!" );
		    db.keys.insert({
			atc:  accessToken,
			tokens: {
			    access_token: accessToken,
			    access_token_secret: accessTokenSecret
			}}, {w: 0});	

                    // Add user to `users` collection
		    client.requestResource("/profile.json", "GET", accessToken, accessTokenSecret)
                        .then(function (results) {
                            console.log(err);
			    var response = JSON.parse(results[0]);
                            
                            db.users.insert(
				{
				    "atc":  accessToken,
				    "displayName": response.user.displayName,
                                    "fullName": response.user.fullname,
				    "avatar": response.user.avatar,
				    "distance": 0,
                                    "distances": Array.apply(null,Array(calcLastUpdateIndex())).map(function(el){return null;})
				},
				{w: 0});	
                            
                            db.history.insert({atc: accessToken, records: []});

                            return results;
                        })
                        .then(function(results){

                            // Get the users stats from Fitbit
                            client.requestResource("/activities/date/"+ date +".json", "GET", access_token, access_token_secret)
                                .then(function (results){

                                    var obj = {};
				    var distance = JSON.parse(results[0]).summary.distances[0].distance
		                    obj["distances." + calcLastUpdateIndex().toString()] = distance;
                                    obj["distance"] = distance;

			            db.users.update(
					{atc: user.tokens.access_token },
				        { $set: obj},
				        {multi: false},
                                        function(err, obj){
					    // Tell client to get new data
					    io.emit('db_update', {message: 'A new user has been added. Please update yourself.'}); 
                                        });
                                });
                        });
                }
                
            });
    }, function (error) {
	res.send(error);
        routes.index(req, res); // :(
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

// EXPRESS API
app.get('/api/info',               api.info);
app.get('/api/update',             api.update);
app.get('/api/get_history',        api.getHistory);
app.post('/api/add_user_to_group', api.addUserToGroup);
app.post('/api/update_user_info',  api.updateUserInfo);
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
   
    client.requestResource("/activities/date/"+ date +".json", "GET",  user.tokens.access_token, user.tokens.access_token_secret)
        .then(function (results) {
            
	    var obj = {};
	    var distance = JSON.parse(results[0]).summary.distances[0].distance
	    obj["distances." + calcLastUpdateIndex().toString()] = distance;
            obj["distance"] = distance;
            
	    db.users.update(
		{atc:  user.tokens.access_token },
		{ $set: obj},
		{multi: false},
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
	    if(err){
		console.log('bad server error');
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
		    { "info": "lastUpdateTime"},
		    { $set: { "lastUpdateTime": new Date()}},
		    { multi: false},
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
    
    var scribe = {};

    console.log('Doing nightly recording');

    db.users.find({}).toArray(function(err, results){
        results.forEach( function(obj){
            db.history.update(
	        {atc: obj.atc},
	        {$push: {
                    records: {
                        date: today,
	                distance:  obj.distance,
	                distances: obj.distances,
                        settings: appData}}},
	        {multi: false},
	        function(err, thing){
                    console.log(err, thing);
                });
        });
    });
}

function dailyReset(){

    // Today is a new day, set time to 12 am 
    date = Date((new Date()).getUTCFullYear(), (new Date()).getUTCMonth(), (new Date()).getUTCDate(), 0, 0, 0, 0)

    // Size of diff between start and start time * 4
    var trackSize = (appData.trackerInfo.endTime.getHours() - appData.trackerInfo.startTime.getHours()) * 4 ;

    db.users.update(
	{},
	{ $set: {
	    "distance": 0,
	    "distances": Array.apply(null, Array(trackSize)).map(function(el){return null;})
	}},
	{multi: true},
	function(err, obj){
            io.emit('db_update', {message: 'All data user data hass been reset. Please update yourself.'});
	    console.log(err, obj);
	}
    );
}


/************* START SERVER STUFF :) *************/
// Init update when server first starts
//updateDB();

// Start cron jobs
cronJobs.forEach(function(obj){
    console.log('Launching: ', obj.name);
    cron.job(obj.cronStr, obj.job).start();
});

// Start Server and init socket
var io = require('socket.io').listen(
    http.createServer(app).listen(app.get('port'), function () {
	console.log('Express server listening on port ' + app.get('port'));
	console.log( "Current update time:  ",  getTimeStamp());
	console.log( "Current update index: ",  calcLastUpdateIndex());
    }));

// Fitbit callback puts users on port 6544 on localhost if no redirect is given. Listen on port 6544 and redirect users to port 3000
// so they may make API calls.
// ^^ This only applies if the Fitbit redirect URL has not been set on the Fitbit dev site. ^^ 
http.createServer(redirect).listen(redirect.get('port'), function () {
    console.log('Express server listening on port ' + redirect.get('port'));
});
