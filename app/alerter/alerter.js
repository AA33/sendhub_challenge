/**
 * Created by abhishekanurag on 11/15/14.
 */
(function () {
    'use strict';

    var app = angular.module('app', []);

    app.constant('appConstants', {
        DEFAULT_THRESHOLD: 0.05,
        DEFAULT_CONTACT: 6086094946,
        DEFAULT_MESSSAGE: "Quiet please!",

        RESPONSE_DURATION: 200,
        THRESHOLD_DURATION: 1000,
        NUMBER_OF_CUMULATIVE_OUTPUTS_TO_SHOW: 3,

        VOLUME_DATA_READY_EVENT: "VOLUME_DATA_READY",

        API_KEY: "b75409abea9550616ed31c627952fff9efe585c6",
        CORS_API_URL: "https://cors-anywhere.herokuapp.com/",
        SENDHUB_API_URL: "https://api.sendhub.com/v1/messages/"
    });

    app.controller('AlertCtrl', ['$scope', 'micListener', 'messenger', 'appConstants',
        function ($scope, micListener, messenger, appConstants) {

            var RESPONSE_DURATION = appConstants.RESPONSE_DURATION,
                THRESHOLD_DURATION = appConstants.THRESHOLD_DURATION,
                DATA_POINTS_FOR_CROSSING_THRESHOLD = THRESHOLD_DURATION / RESPONSE_DURATION,
                DEFAULT_THRESHOLD = appConstants.DEFAULT_THRESHOLD,
                DEFAULT_CONTACT = appConstants.DEFAULT_CONTACT,
                DEFAULT_MSG = appConstants.DEFAULT_MESSSAGE,
                NUMBER_OF_CUMULATIVE_OUTPUTS_TO_SHOW = appConstants.NUMBER_OF_CUMULATIVE_OUTPUTS_TO_SHOW;

            $scope.highestOutputs = [];
            $scope.contact = DEFAULT_CONTACT;
            $scope.threshold = DEFAULT_THRESHOLD;
            $scope.phonePattern = /^\d{10}$/;
            $scope.volumeData = [];

            var highestOutputs = $scope.highestOutputs,
                volumeData = $scope.volumeData;

            function volumeDataHandler(data) {
                var threshold = parseFloat($scope.threshold);
                if (isNaN(threshold)) {
                    threshold = DEFAULT_THRESHOLD;
                }
                volumeData.push({
                    volume: data,
                    timestamp: new Date().getTime()
                });

                var needsAlert = true,
                    dataPoints = volumeData.length,
                    loudDataPoints = 0,
                    output = 0;
                //Has volume been too loud for over a second in the current period

                //Do we have data for more than a second yet
                if (dataPoints > DATA_POINTS_FOR_CROSSING_THRESHOLD) {
                    for (var i = dataPoints - 1; i >= 0; i--) {
                        if (volumeData[i].volume > threshold) {
                            loudDataPoints++;
                        }
                        output += (volumeData[i].volume * RESPONSE_DURATION);
                    }
                    if (loudDataPoints <= DATA_POINTS_FOR_CROSSING_THRESHOLD)
                        needsAlert = false;
                } else {
                    needsAlert = false;
                }

                if (needsAlert) {
                    var outputDetails = {
                        output: output,
                        start: new Date(volumeData[0].timestamp).toLocaleTimeString(),
                        end: new Date(volumeData[dataPoints - 1].timestamp).toLocaleTimeString()
                    };
                    //Is the current output louder than at least one of the 3 loudest periods
                    var cmp = function (a, b) {
                        return b.output - a.output;
                    };

                    if (highestOutputs.length < NUMBER_OF_CUMULATIVE_OUTPUTS_TO_SHOW) {
                        highestOutputs.push(outputDetails);
                        highestOutputs.sort(cmp);
                    } else if (highestOutputs[NUMBER_OF_CUMULATIVE_OUTPUTS_TO_SHOW - 1].output < outputDetails.output) {
                        highestOutputs[NUMBER_OF_CUMULATIVE_OUTPUTS_TO_SHOW - 1] = outputDetails;
                        highestOutputs.sort(cmp);
                    } else {
                        needsAlert = false;
                    }

                }

                if (needsAlert) {
                    messenger.sendMessage(DEFAULT_MSG, ["+1" + $scope.contact]);
                    console.log("Sending message");
                    volumeData = $scope.volumeData = [];
                }
            }

            micListener.whenDataReceived($scope, volumeDataHandler);
            $scope.start = function () {
                micListener.startListenService(RESPONSE_DURATION);
            };

            $scope.stop = function () {
                micListener.stopListenService();
            };


        }
    ]);

    app.factory('micListener', ['$window', '$rootScope', 'appConstants',
        function ($window, $rootScope, appConstants) {
            var VOLUME_DATA_READY_EVENT = appConstants.VOLUME_DATA_READY_EVENT;

            try {
                window.AudioContext = window.AudioContext || window.webkitAudioContext;
                window.audioContext = new AudioContext();
            } catch (e) {
                alert('Web Audio API not supported.');
            }
            var soundMeter = window.soundMeter = new SoundMeter(window.audioContext);
            var constraints = $window.constraints = {
                audio: true,
                video: false
            };
            var navigator = $window.navigator;
            navigator.getUserMedia = navigator.getUserMedia ||
                navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

            function successCallback(stream) {
                soundMeter.connectToSource(stream);
            }

            function errorCallback(error) {
                console.log('navigator.getUserMedia error: ', error);
            }

            navigator.getUserMedia(constraints, successCallback, errorCallback);

            var serviceInterval;

            function startListenService(responseDuration) {
                serviceInterval = setInterval(function () {
                    var vol = soundMeter.instant.toFixed(2);
                    $rootScope.$broadcast(VOLUME_DATA_READY_EVENT, vol);
                }, responseDuration);
            }

            function stopListenService() {
                clearInterval(serviceInterval);
            }

            function whenDataReceived($scope, handler) {
                $scope.$on(VOLUME_DATA_READY_EVENT, function (event, data) {
                    handler(data);
                });
            }

            var services = {
                startListenService: startListenService,
                stopListenService: stopListenService,
                whenDataReceived: whenDataReceived
            };
            return services;
        }
    ]);

    app.factory('messenger', ['$http', 'appConstants',
        function ($http, appConstants) {
            var USERNAME = "" + appConstants.DEFAULT_CONTACT,
                API_KEY = appConstants.API_KEY,
                CORS_API_URL = appConstants.CORS_API_URL,
                SENDHUB_API_URL = appConstants.SENDHUB_API_URL + "?username=" + USERNAME + "&api_key=" + API_KEY;

            function sendMessage(msgtext, contacts) {
                var msg = {};
                msg.contacts = contacts;
                msg.text = msgtext;
                $http.post(CORS_API_URL + SENDHUB_API_URL, msg)
                    .success(function (data) {
                        console.log("Sent: " + data.acknowledgment);
                    })
                    .error(function () {
                        console.log("Msg sending failed!");
                    });
            }

            var services = {
                sendMessage: sendMessage
            };
            return services;
        }
    ]);

}());