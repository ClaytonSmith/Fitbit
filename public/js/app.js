'use strict';



// Declare app level module which depends on filters, and services                                          
var app = angular.module('myApp', [
    'ngResource',
    'ngRoute',
    'myApp.filters',
    'myApp.services',
    'myApp.directives',
    'leaflet-directive',
    'nvd3ChartDirectives',
    'isteven-omni-bar',
    'myModal'
]);

// Configure angular client side routing
app.config(['$routeProvider', '$locationProvider', function($routeProvider, $locationProvider) {
    $routeProvider.when('/home',     {templateUrl: 'partials/home',     controller:      mapCtrl});

    //	//Default path
    $routeProvider.otherwise({redirectTo: '/home'});
    $locationProvider.html5Mode(true);
}]);

