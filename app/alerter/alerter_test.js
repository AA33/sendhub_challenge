/**
 * Created by abhishekanurag on 11/16/14.
 */
'use strict';

describe('alerter view', function () {

    var $scope, micListener, messenger, appConstants, viewCtrl, serviceInterval = {};
    beforeEach(module('app'));

    beforeEach(inject(function ($injector) {
        appConstants = $injector.get('appConstants');
        messenger = $injector.get('messenger');
        micListener = jasmine.createSpyObj("micListener", ["startListenService", "stopListenService", "whenDataReceived"]);
    }));

    describe('app controller', function () {

        var vols1 = [0.05, 0.06, 0.1, 0.1, 0.1, 0.2];
        var vols2 = [0.5, 0.5, 0.1, 0.1, 0.1, 0.2, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.5];
        var vols3 = [0.05, 0.05, 0.1, 0.1, 0.1, 0.2];


        var startListenServiceGetter = function (whichVols, serviceInterval, $rootScope) {
            return function (responseDuration) {
                var vols = whichVols;
                var i = 0;
                serviceInterval = setInterval(function () {
                    var vol = vols[i % vols.length];
                    i++;
                    $rootScope.$broadcast(appConstants.VOLUME_DATA_READY_EVENT, vol);
                    console.log("Broadcasted:" + vol);
                }, responseDuration);
            };
        };

        var whenDataReceived = function ($scope, handler) {
            $scope.$on(appConstants.VOLUME_DATA_READY_EVENT, function (event, data) {
                handler(data);
            });
        };


        it('should initialize with fake listener and populate outputs as expected', inject(function ($controller, $rootScope) {
            $scope = $rootScope.$new();
            var stopListenService = function () {
                clearInterval(serviceInterval);
            };

            micListener.startListenService = jasmine.createSpy("startListenService");
            micListener.whenDataReceived = jasmine.createSpy("whenDataReceived");
            micListener.startListenService.andCallFake(startListenServiceGetter(vols2, serviceInterval, $scope));
            micListener.whenDataReceived.andCallFake(whenDataReceived);

            viewCtrl = $controller('AlertCtrl', {
                $scope: $scope,
                micListener: micListener,
                messenger: messenger,
                appConstants: appConstants
            });
            expect(viewCtrl).toBeDefined();
            expect($scope.start).toBeDefined();
            $scope.start();
            expect($scope.highestOutputs.length).toBe(0);
            waitsFor(function () {
                return ($scope.highestOutputs.length === 1);
            }, 1200);
            waitsFor(function () {
                return ($scope.highestOutputs.length === 2);
            }, 1200);
            waitsFor(function () {
                return ($scope.highestOutputs.length === 3);
            }, 1200);
        }));

    });
});
