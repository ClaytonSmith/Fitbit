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
	    
	    console.log(user.tokens.access_token, user.tokens.access_token_secret);
	    
	    console.log( client.requestResource("/activities/date/2015-06-01.json", "GET",
						user.tokens.access_token,	  
						user.tokens.access_token_secret).then(function (results) {
						    
						    var response = results[0];

						    
						    console.log(response);
						    
						    db.users.update({atc:  user.tokens.access_token},
								    { $set: { "distance" : response.summary.distances[0].distance }});
						    
						}));
	    
	    
	    
	});
    });
}

updateDB();

			    /*res.json({status: "Avatar Changed" });
						}

						    db.users.findOne(
							{atc:  user.tokens.access_token},
							function(err, user){
							    
							    // Server error
							    if(err){
								console.log( "Server error" );
								res.status(500).json({error: "Server error."}) ;	    
							    }
							    
							    // User does not exist
							    if(!user){
								console.log( "User already in the database." );
								res.status(403).json({error: "User already in the database."}) ;
								
								// Insert new user 
							    } else {
	

						    


						    
							    
						    */
			
//process.exit(1);
