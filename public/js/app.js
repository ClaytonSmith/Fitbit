'use strict';



// Declare app level module which depends on filters, and services                                          
var app = angular.module('myApp', [
    'ngResource',
    'ngRoute',
    'myApp.filters',
    'myApp.services',
    'myApp.directives',
    'leaflet-directive',
    'chart.js',
    'isteven-omni-bar',
    'myModal'
]);

// Configure angular client side routing
app.config(['$routeProvider', '$locationProvider', function($routeProvider, $locationProvider) {
    $routeProvider.when('/home',     {templateUrl: 'partials/home',
				      controller: mapCtrl,
				      resolve: ['getInfo', function(getInfo){	
					  return getInfo.promise;
				      }]
				     });
    
    //	//Default path
    $routeProvider.otherwise({redirectTo: '/home'});
    $locationProvider.html5Mode(true);
}]);




