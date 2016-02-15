/*!
 *
 *  Web Starter Kit
 *  Copyright 2015 Google Inc. All rights reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License
 *
 */
/* eslint-env browser */
(function(document) {
  'use strict';

  var querySelector = document.querySelector.bind(document);

  // Check to make sure service workers are supported in the current browser,
  // and that the current page is accessed from a secure origin. Using a
  // service worker from an insecure origin will trigger JS console errors. See
  // http://www.chromium.org/Home/chromium-security/prefer-secure-origins-for-powerful-new-features
  var isLocalhost = Boolean(window.location.hostname === 'localhost' ||
      // [::1] is the IPv6 localhost address.
      window.location.hostname === '[::1]' ||
      // 127.0.0.1/8 is considered localhost for IPv4.
      window.location.hostname.match(
        /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/
      )
    );

  if ('serviceWorker' in navigator &&
      (window.location.protocol === 'https:' || isLocalhost)) {
    navigator.serviceWorker.register('service-worker.js')
    .then(function(registration) {
      // Check to see if there's an updated version of service-worker.js with
      // new files to cache:
      // https://slightlyoff.github.io/ServiceWorker/spec/service_worker/index.html#service-worker-registration-update-method
      if (typeof registration.update === 'function') {
        registration.update();
      }

      // updatefound is fired if service-worker.js changes.
      registration.onupdatefound = function() {
        // updatefound is also fired the very first time the SW is installed,
        // and there's no need to prompt for a reload at that point.
        // So check here to see if the page is already controlled,
        // i.e. whether there's an existing service worker.
        if (navigator.serviceWorker.controller) {
          // The updatefound event implies that registration.installing is set:
          // https://slightlyoff.github.io/ServiceWorker/spec/service_worker/index.html#service-worker-container-updatefound-event
          var installingWorker = registration.installing;

          installingWorker.onstatechange = function() {
            switch (installingWorker.state) {
              case 'installed':
                // At this point, the old content will have been purged and the
                // fresh content will have been added to the cache.
                // It's the perfect time to display a "New content is
                // available; please refresh." message in the page's interface.
                break;

              case 'redundant':
                throw new Error('The installing ' +
                                'service worker became redundant.');

              default:
                // Ignore
            }
          };
        }
      };
    }).catch(function(e) {
      console.error('Error during service worker registration:', e);
    });
  }

  var now, year, month, today, gameMonday, weekStart, gameObject, fbGameLocation,
    dayIndex;
  var fb = new Firebase('https://jpdy.firebaseio.com');
  var fbJCategories = fb.child('j_categories');
  var fbDJCategories = fb.child('dj_categories');
  var fbFJCategories = fb.child('fj_categories');
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  now = new Date();
  today = now.getDay() > 0 ? now.getDay() - 1 : 6; // 0-6 with 0===Monday
  weekStart = new Date(now.getTime() - (today * 24 + now.getHours()) * 3600000);
  gameMonday = weekStart.getDate();
  console.log(weekStart);
  month = months[weekStart.getMonth()];
  year = weekStart.getFullYear();
  fbGameLocation = fb.child(year).child(month).child(gameMonday);
  fbGameLocation.once('value', function(snapshot) {
    gameObject = snapshot.val();
    if (gameObject) {
      play();
    } else {
      initWeek();
    }
  });

  function initWeek() {
    var i, numCats, catNum;

    dayIndex = 0;
    gameObject = {};
    fb.child('fj_categories').child('number').once('value', function(snapshot) {
      numCats = snapshot.val();
      catNum = Math.floor(Math.random() * numCats);
      setFinal(catNum);
    });
  }

  function setFinal(catNum) {
    var result;

    fb.child('fj_categories').child(catNum).once('value', function(snapshot) {
      result = snapshot.val();
      gameObject['6'] = {};
      gameObject['6'][new String(result.question)] = result.category;
      setupRound();
    });
  }

  function setupRound() {
    var round, numCats;
      
    round = dayIndex < 3 ? 'j_categories' : 'dj_categories';
    fb.child(round).child('number').once('value', function(snapshot) {
      numCats = snapshot.val();
      prepGameData(round, numCats);
    });
  }

  function prepGameData(round, numCats) {
    var catNum, qList, dayObject;
    catNum = Math.floor(Math.random() * numCats);
    fb.child(round).child(catNum).once('value', function(snapshot) {
      var result = snapshot.val();
      dayObject = {};
      dayObject.category = result.category;
      qList = result.questions;
      console.log(qList);
      dayObject.questions = selectQuestions(qList);
      gameObject['' + dayIndex] = dayObject;
      dayIndex += 1;
      dayIndex < 6 ? setupRound() : saveGame();
    });
  }

  function selectQuestions(qList) {
    var i, randomQ, qObject, returnObject, key;
    var initialQs = Object.keys(qList);
    var finalQs = [];

    randomQ = initialQs[Math.floor(Math.random() * initialQs.length)];
    for (i = 0; i < initialQs.length; i++) {
      if (Math.abs(parseInt(initialQs[i]) - parseInt(randomQ)) < 100) {
        qObject = {};
        qObject[initialQs[i]] = qList[initialQs[i]];
        finalQs.push(qObject);
      }
    }
    while (finalQs.length > 3) {
      finalQs.splice(Math.floor(Math.random() * finalQs.length), 1);
    }
    returnObject = {};
    finalQs.forEach(function(obj) {
      key = Object.keys(obj)[0];
      returnObject[key] = obj[key]
    });
    return returnObject;
  }

  function saveGame() {
    fb.child('games').child(year).child(month).child(gameMonday).set(gameObject);
  }

  function play() {

  }
})(document);
