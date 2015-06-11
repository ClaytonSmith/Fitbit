var express         = require('express'),
    FitbitApiClient = require("fitbit-node");

var config          = require('./config.json');

var mongo   = require('mongoskin'),
    db      = mongo.db(config.mongo_link, {native_parser:true});


db.bind('keys');
db.bind('users');

var client = new FitbitApiClient(config.FITBIT_KEY, config.FITBIT_SECRET );


/*
db.keys.find().each( function( err, doc){
    if( err ) return ;
    console.log( doc );
    });*/

function updateDB(){
    db.keys.find({}, function(err, result) {
	result.each(function(err, user) {
	    if( !user ) return ;
	    console.log("Here is a user key", user.keys);	    
//	    console.log( user );

	     
	    console.log( client.requestResource("/.json", "GET",
						user.keys.oauth_token,	  
						user.keys.oauth_verifier).then(function (results) {
						    
						    var response = results[0];
						    // res.send(response);
						    console.log(response);	    
						}));
	    
	    
	});
    });
}

updateDB();

//process.exit(1);
