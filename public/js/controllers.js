'use strict';

// Helper function 
// Tests to see if an object is empty.
function isEmptyObject(obj){
    for(var propName in obj){
        if(obj.hasOwnProperty(propName)){
            return false;
        }
    }
    return true;
}

// Helper function
// Returns a true if a list contains an element.
function include(arr,obj) {
    return (arr.indexOf(obj) != -1);
}
function appCtrl($scope, $http, $location, $rootScope) {
    console.log('Hello from app controller.');
}


/* Controllers */
function mapCtrl($scope, $http, $location, $rootScope, $filter) {
    console.log("Hello from map controller.");
    
    var startDest = {lat: 42.3699388, lng: -71.2458321}; // CloudLock HQ
    var endDest   = {lat: 37.790599,  lng: -71.2458321};
    $scope.gotStuff = false;

    function randomColor(seed){
	var letters = '0123456789ABCDEF'.split('');
	var color = '#';
	for (var i = 0; i < 6; i++ ) {   
	    color += letters[Math.floor((seed = Math.random(seed)) * 16)]; // Sooooo goood
	}
	return color;
    }

    var totalDistance = 0;
    $scope.exampleData = [];
    $scope.paths       = {};
    $scope.markers     = {};
    $scope.center      = {
        lat: 37.5960374,
        lng: -97.0452066,
	zoom: 4
    };
    $scope.defaults    = {
        scrollWheelZoom: false
    };
    
    var usersDistance = [
	{name: 'Tom',      distance: 10.2, avatar: "https://pbs.twimg.com/profile_images/517321674471923712/bFqGdWJL_400x400.jpeg"},
	{name: 'Jan',      distance: 20.3, avatar: "http://zohararad.github.io/presentations/falling-in-love-with-ruby/presentation/images/ruby.png"},
	{name: 'Mike',     distance: 50.1, avatar: "https://flyingonemptythoughts.files.wordpress.com/2013/06/neutral-its-something-l.png"},
	{name: 'Jane',     distance: 40.5, avatar: "http://img3.wikia.nocookie.net/__cb20120826123355/vssaxtonhale/images/c/c2/Troll-face.png"},
	{name: 'Bobbert',  distance: 40.3, avatar: "http://images4.fanpop.com/image/photos/19700000/Horton-hears-a-who-pics-horton-hears-a-who-19717311-1109-529.jpg"},
	{name: 'Sarah',    distance: 10.3, avatar: "https://pbs.twimg.com/profile_images/447460759329460224/mt2UmwGG_400x400.jpeg"},
	{name: 'Tedison',  distance: 30.2, avatar: "https://www.petfinder.com/wp-content/uploads/2012/11/122163343-conditioning-dog-loud-noises-632x475.jpg"} 
    ];
    
    
    //$http.get('http://localhost:/distance')
    //  .success(function(data, status, headers, config) {
    //    console.log( data );
    $scope.gotStuff = true;
    
    //  data.forEach(function(obj){ usersDistance.push(obj); });
    usersDistance = $filter('orderBy')(usersDistance, '-distance', 'reverse');
    console.log("Real Fitbit users added to user list.");
    
    usersDistance.map(function(obj){ obj.color = randomColor(obj.name + obj.avatar); });
    totalDistance = usersDistance.reduce(function(a,b){ console.log(a) ; return a + b.distance  ; }, 0);
    console.log("Users assigned color", usersDistance);
    
    $scope.percentageValue = totalDistance /  getDistanceFromLatLonInKm(startDest.lat, startDest.lng, endDest.lat, endDest.lng);


    usersDistance = calcPaths(usersDistance);
    createPaths(usersDistance);
    console.log("Paths added");
    
    var centerCoords   =  getMidpoint(usersDistance[usersDistance.length - 1].path.start, usersDistance[0].path.end);
    $scope.center.lat  =  centerCoords.lat;
    $scope.center.lng  =  centerCoords.lng;
    $scope.center.zoom = 11 ;
    
    $scope.colorFunction = function() {   
	return function(d, i) {
	    return userDistance[i].color;
	};
    };
    
    // Map user distance to D3 compliant data object.
    $scope.exampleData =
	($filter('orderBy')(usersDistance, '-distance')).map(function(obj){
	    return   {
		key: obj.name,
		values: [[obj.name, obj.distance]],
		color: obj.color
	    };
	});
    //}).error(function(data){
    // Cry
    //}); 
    
    
    function radians(deg){
	return deg * (Math.PI / 180);
    };

    function degrees(rad){
	return rad * (180 / Math.PI);
    };

    
    function getDistanceFromLatLonInKm(lat1,lon1,lat2,lon2) {
	var R = 6378.1; // Radius of the earth in km
	var dLat = deg2rad(lat2-lat1);  // deg2rad below
	var dLon = deg2rad(lon2-lon1); 
	var a = 
	    Math.sin(dLat/2) * Math.sin(dLat/2) +
	    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
	    Math.sin(dLon/2) * Math.sin(dLon/2)
	; 
	var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
	var d = R * c; // Distance in km
	return d;
    }

    function deg2rad(deg) {
	return deg * (Math.PI/180)
    }

    function getMidpoint( p1, p2) {
	var dLon = radians(p2.lng - p1.lng);

	//convert to radians
	var lat1 = radians(p1.lat);
	var lat2 = radians(p2.lat);
	var lon1 = radians(p1.lng);
	
	var Bx = Math.cos(lat2) * Math.cos(dLon);
	var By = Math.cos(lat2) * Math.sin(dLon);
	
	var lat3 = Math.atan2(Math.sin(lat1) + Math.sin(lat2), Math.sqrt((Math.cos(lat1) + Bx) * (Math.cos(lat1) + Bx) + By * By));
	var lon3 = lon1 + Math.atan2(By, Math.cos(lat1) + Bx);


	return {lat: lat3 * 180 / Math.PI, lng: lon3 * 180 / Math.PI};
	lat3_OUT = lat3;
	lon3_OUT = lon3;
    }
    
    function getBearing(startLat,startLong,endLat,endLong){
	startLat   = radians(startLat);
	startLong  = radians(startLong);
	endLat     = radians(endLat);
	endLong    = radians(endLong);

	var dLong = endLong - startLong;

	var dPhi = Math.log(Math.tan(endLat/2.0+Math.PI/4.0)/Math.tan(startLat/2.0+Math.PI/4.0));
	if (Math.abs(dLong) > Math.PI){
	    if (dLong > 0.0)
		dLong = -(2.0 * Math.PI - dLong);
	    else
		dLong =  (2.0 * Math.PI + dLong);
	}

	return (degrees(Math.atan2(dLong, dPhi)) + 360.0) % 360.0;
    }
    
    function calcCoords(from, dist){
	//http://janmatuschek.de/LatitudeLongitudeBoundingCoordinates
	var startDest = {lat: 42.3699388, lng: -71.2458321}; // CloudLock HQ
	var endDest   = {lat: 45.5168567, lng: -122.6725146}; // Salesforce HQ

	var brng = getBearing(startDest.lat, startDest.lng, endDest.lat, endDest.lng);// geo.bearing(startDest, endDest);
	
	var R  = 6378.1;
	var km = dist * 1.60934;

	var lat1 = from.lat * Math.PI / 180;
	var lng1 = from.lng * Math.PI / 180;

	var lat2 = Math.asin( Math.sin(lat1) * Math.cos(km/R) +
			      Math.cos(lat1) * Math.sin(km/R) * Math.cos(brng));

	var lng2 = lng1 + Math.atan2(Math.sin(brng)*Math.sin(km/R)*Math.cos(lat1),
				     Math.cos(km/R)-Math.sin(lat1)*Math.sin(lat2));

	return {lat: lat2 * 180 / Math.PI, lng: lng2 * 180 / Math.PI};
    };
    
    function calcPaths(users){
	var prevCoords =  {lat: 42.3699388, lng: -71.2458321} //Cloudlock HQ;
	var nextCoords = {lat: 0, lng: 0}; // Temp value
	
	for( var i = 0; i < users.length ; i++ ){
	    users[i].path = {start: prevCoords, end: prevCoords = calcCoords( prevCoords, users[i].distance )};
	}
	return users;
    }
    
    function createPaths(users){
	
	users.forEach( function(user){
	    $scope.paths[user.color]= {    
		color: user.color,
		weight: 6,
		latlngs: [
		    user.path.start,
		    user.path.end
		]
	    };
	    
	    $scope.markers[user.color] = {
		lat: user.path.end.lat,
		lng: user.path.end.lng,
		focus: true,
		draggable: false,
		title:   user.name,
		message: user.name,
		icon: {
		    iconUrl: user.avatar,
		    iconSize:     [40, 40],
		    iconAnchor:   [20, 40],
		    popupAnchor:  [3, -32],
		    shadowSize:   [40, 40],
		    shadowAnchor: [0,   0]
		}
	    };
	});       
    }
}

mapCtrl.$inject  =  ['$scope', '$http', '$location', '$rootScope', '$filter'];
appCtrl.$inject  =  ['$scope', '$http', '$location', '$rootScope'];





