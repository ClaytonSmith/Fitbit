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



/******** CONTROLLERS ********/
function appCtrl($scope, $http, $location, $rootScope){
    console.log('Hello from app controller.');
}


/* Controllers */
function mapCtrl($scope, $http, $location, $rootScope, $filter, getInfo){
    $rootScope.appData = getInfo.getData();
    console.log("Hello from map controller.", $rootScope.appData);
    

    var cloudLockLogo = "https://pbs.twimg.com/profile_images/517321674471923712/bFqGdWJL_400x400.jpeg";
    var startDest = {lat: 42.3680275, lng: -71.2421328};  // CloudLock HQ
    var endDest   = {lat: 37.7924224, lng: -122.3931885}; // Salesforce HQ
    
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
    $scope.graphLabels  = Array.apply(null, {length: ($rootScope.appData.trackerInfo.endTime.getHours() 
						  - $rootScope.appData.trackerInfo.startTime.getHours()) *4}).map(Number.call, function(index){ return getTimeStampFromTime(getTimeFromIndex(index)); });
    console.log( $scope.graphLabels);
    $scope.graphDataSet = [];    
    $scope.exampleData  = []; //NN
    $scope.paths        = {};
    $scope.markers      = {};
    
    $scope.center       = {
        lat: 37.5960374,
        lng: -97.0452066,
	zoom: 10
    };
    
    $scope.defaults      = {
        scrollWheelZoom: false
    };
         
    $scope.userData = [];
    
    function update(){
        $http.get('api/update')
	    .success(function(data, status, headers, config) {
                $scope.paths        = {};
                $scope.markers      = {};
                
		$scope.userData = $filter('orderBy')(data, '-distance');

                console.log('last update index', calcLastUpdateIndex());
		console.log("Fitbit users added to dataset.", $scope.userData);
		
		$scope.userData.map(function(obj){ obj.color = randomColor(obj.name + obj.avatar); });
		totalDistance = $scope.userData.reduce(function(a,b){ return a + b.distance; }, 0) * 1.60934 ;
		console.log("Users assigned color", $scope.userData);

		// adds a path field to userData
		$scope.userData = calcPaths($scope.userData);
		createPaths($scope.userData);
		console.log("Paths added");
		
		var calculatedDist = getDistanceFromLatLonInM($scope.userData[$scope.userData.length - 1].path.start.lat,
                                                              $scope.userData[$scope.userData.length - 1].path.end.lng,
                                                              startDest.lat, startDest.lng);
		
		console.log('DISTACNE', totalDistance, calculatedDist);
		
		$scope.percentageValue = calculatedDist / getDistanceFromLatLonInM( startDest.lat, startDest.lng, endDest.lat, endDest.lng);
		
		var centerCoords       =  getMidpoint($scope.userData[$scope.userData.length - 1].path.start, $scope.userData[0].path.end);
		
		$scope.center.lat      =  centerCoords.lat;
		$scope.center.lng      =  centerCoords.lng;
		
		$scope.graphSeries     = $scope.userData.map(function(obj){return obj.displayName; });
                $scope.graphDataSet    = $scope.userData.map(function(obj){return !obj.distance ? [] : obj.distances });  // .map(function(dist){return dist.distance ;}); });
                
                console.log($scope.graphDataSet);
                
            }).error(function(data){
                console.log('Unable to get data', data); // Cry
	    });
    }
    
    
    $scope.$watch( 'userData', function(){
    });        
    
    // init update 
    update();
    
    // Listen for server update. Socket.io knows what domain to listen to
    var socket = io('');
    socket.on('db_update', function (data) {
	console.log(data.message);
	update();
    });
    
    function radians(deg){
	return deg * (Math.PI / 180);
    };

    function degrees(rad){
	return rad * (180 / Math.PI);
    };

    
    function getDistanceFromLatLonInM(lat1,lon1,lat2,lon2) {
	Number.prototype.toRad = function() {
	    return this * Math.PI / 180;
	}
	var R = 6371; // km 
	//has a problem with the .toRad() method below.
	var x1 = lat2-lat1;
	var dLat = x1.toRad();  
	var x2 = lon2-lon1;
	var dLon = x2.toRad();  
	var a = Math.sin(dLat/2) * Math.sin(dLat/2) + 
            Math.cos(lat1.toRad()) * Math.cos(lat2.toRad()) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);  
	var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
	var d = R * c; 
	console.log('THERE', d);
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
		    iconUrl: user.avatar || cloudLockLogo,
		    iconSize:     [40, 40],
		    iconAnchor:   [20, 40],
		    popupAnchor:  [3, -32],
		    shadowSize:   [40, 40],
		    shadowAnchor: [0,   0]
		}
	    };
	});       
    }
    
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
            - $rootScope.appData.trackerInfo.startTime.getHours() * 4; // int
    }


    // Uses time to find the index  
    function calcLastUpdateIndex() {
	var time = new Date();    
	return getIndexFromTime(time);
    }


    function getTimeFromIndex(index) {   
	var time = new Date($rootScope.appData.trackerInfo.startTime);
	time.setMinutes(time.getMinutes() + (index  * 15));
	return time;  // Date obj
    }


    function getTimeStampFromTime(time){
	return time.getHours() + ':' + time.getMinutes();  // Str
    }
    
    function getTimeStamp(){
	return getTimeStampFromTime(getTimeFromIndex(calcLastUpdateIndex()));
    }

}

mapCtrl.$inject  =  ['$scope', '$http', '$location', '$rootScope', '$filter', 'getInfo'];
appCtrl.$inject  =  ['$scope', '$http', '$location', '$rootScope'];
