'use strict';

/* Services */


// Demonstrate how to register services
// In this case it is a simple value service.
angular.module('myApp.services', []).
    value('version', '0.1');

app.service('getInfo', function($http){
    var infoData = null;
    
    var promise = $http.get('api/info')
	.success(function(data, status, headers, config) {
	    infoData = data;
	    console.log('Hi', data.trackerInfo.startTime);
	});
    
    return {
	promise: promise,
	setData: function(data){ /*No idea what this does*/},
	getData: function(){
	    console.log("start", infoData.trackerInfo.startTime,infoData.trackerInfo.startTime = new Date(infoData.trackerInfo.startTime));
	    console.log("End",   infoData.trackerInfo.endTime = new Date(infoData.trackerInfo.endTime));
	    ;return infoData; }
    };
});

