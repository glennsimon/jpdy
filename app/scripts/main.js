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

  // initially undefined vars
  var now, year, month, today, gameMonday, weekStart, gameObject;
  var fbGameLocation, dayIndex, connection, userId, connected, todaysRound;  
  // firebase vars
  var fb = new Firebase('https://jpdy.firebaseio.com');
  var fbConnected = fb.child('.info/connected');
  var fbJCategories = fb.child('j_categories');
  var fbDJCategories = fb.child('dj_categories');
  var fbFJCategories = fb.child('fj_categories');
  // elements in index.html
  var value = querySelector('#value');
  var categoryElement = querySelector('#category');
  var clue = querySelector('#clue');
  var loginWindow = querySelector('#loginWindow');
  var googleLogin = querySelector('#googleLogin');
  var authButton = querySelector('#authButton');
  var userAnswer = querySelector('#userAnswer');
  var answerInput = querySelector('#answerInput');
  // general initialized vars
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var userAnswerElement = querySelector('#userAnswer');
  var loggedIn = false;
  var todaysQs = [];
  
  /*** ADD LISTENERS ***/

  // Enter an entry to start turn or add to current turn *
  userAnswer.addEventListener('keyup', function(e) {
    var entry, firstProVote;

    if (e.keyCode === 13) {
      enterAnswer();
    }
  });

  /*** PLAY GAME ***/

  function play() {
    if (today === 6) {
      finalPlay();
      return;
    }
    todaysRound = gameObject[today];
    getQ(0, Object.keys(todaysRound.questions));
  }

  function play() {         do this when you first get the object from firebase so gameobject is already in the right format
    var i, tempArray, rObject;

    todaysRound = gameObject[today];
    if (today < 6) {
      tempArray = Object.keys(todaysRound.questions);
      for (i = 0; i < tempArray.length; i++) {
        rObject = {};
        rObject[tempArray[i]] = todaysRound.questions[tempArray[i]];
        tempArray[i] = rObject;
      }
      todaysRound.questions = tempArray;
    }
  }

  function getQ(index, keys) {
    if (todaysQs[index]) {
      updateDisplay(index, keys[index]);
      return;
    }
    fb.child('questions').child(keys[index]).once('value', function(snapshot) {
      todaysQs[index] = snapshot.val();
      updateDisplay(index, keys[index]);
    });
  }

  function updateDisplay(index, key) {
    var val = todaysRound.questions[key];
    if (val !== 'DD') {
      querySelector('#jpdy-value').classList.remove('jpdy-hide');
      querySelector('#jpdy-dj-value').classList.add('jpdy-hide');
      clue.textContent = todaysQs[index].q;
      value.textContent = val.slice(1);
    } else {
      querySelector('#jpdy-dj-value').classList.remove('jpdy-hide');
      querySelector('#jpdy-value').classList.add('jpdy-hide');
      clue.textContent = 'Enter a wager to reveal the clue!';
      clue.style.color = 'mdl-color--deep-orange';
    }
    categoryElement.textContent = gameObject[today].category;
  }

  function finalPlay() {

  }

  /*** SET UP GAME FOR WEEK ***/

  now = new Date();
  today = now.getDay() > 0 ? now.getDay() - 1 : 6; // 0-6 with 0===Monday
  weekStart = new Date(now.getTime() - (today * 24 + now.getHours()) * 3600000);
  gameMonday = weekStart.getDate();
  // console.log(weekStart);
  month = months[weekStart.getMonth()];
  year = weekStart.getFullYear();
  fbGameLocation = fb.child('games').child(year).child(month).child(gameMonday);
  fbGameLocation.once('value', function(snapshot) {
    gameObject = snapshot.val();
    if (gameObject) {
      // console.log(gameObject);
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
      gameObject['6']['' + result.question] = result.category;
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
      // console.log(qList);
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
      returnObject[key] = obj[key];
    });
    return returnObject;
  }

  function saveGame() {
    fb.child('games').child(year).child(month).child(gameMonday).set(gameObject);
    play();
  }

  /*** LOGIN AND AUTH ***/
  fbConnected.on('value', function(snap) {
    connected = snap.val();
    setOnlineStatus();
  });

  function setOnlineStatus() {
    if (connected && userId) {
      // We're connected and the user is authorized
      // add this device to the users connections list
      connection = fb.child('people').child(userId).child('online').push(true);
      connection.onDisconnect().remove();
    } else if (connection) {
      connection.remove();
    }
  }

  userAnswerElement.addEventListener('focus', function() {
    if (!loggedIn) {
      loginWindow.style.display = 'flex';
    }
  });

  authButton.addEventListener('click', function() {
    if (loggedIn) {
      fb.unauth();
    } else {
      loginWindow.style.display = 'flex';
    }
  });

  googleLogin.addEventListener('click', function() {
    loginWindow.style.display = 'none';
    // prefer pop-ups, so we don't navigate away from the page
    fb.authWithOAuthPopup('google', function(error, authData) {
      if (error) {
        if (error.code === 'TRANSPORT_UNAVAILABLE') {
          // fall-back to browser redirects, and pick up the session
          // automatically when we come back to the origin page
          fb.authWithOAuthRedirect('google', function(error) {
            console.log('Auth failure with error: ' + error);
          });
        }
      } else if (authData) {
        console.log(authData);
      }
    });
  });

  fb.onAuth(function(authData) {
    if (authData) {
      loggedIn = true;
      authButton.textContent = 'Logout';
      userId = authData.uid;
      showProfile(true, authData);
      recordAuth(authData);
    } else {
      authButton.textContent = 'Login';
      if (loggedIn) {
        showProfile(false);
      }
      loggedIn = false;
      userId = undefined;
    }
    setOnlineStatus();
  });

  function showProfile(makeVisible, authData) {
    var profilePic = querySelector('#profilePic');
    var profileName = querySelector('#profileName');

    if (makeVisible) {
      profileName.textContent = authData.google.displayName.split(' ')[0];
      profilePic.setAttribute('src', authData.google.profileImageURL);
      profilePic.style.display = 'block';
    } else {
      profilePic.style.display = 'none';
    }
  }

  function recordAuth(authData) {
    var fbUser = fb.child('people').child(userId);

    fbUser.once('value', function(snapshot) {
      if (!snapshot.val()) {
        // Use update instead of set in case there is a race condition with
        // currentStory: storyId
        fbUser.update({
          'userName': authData.google.displayName,
          'provider': 'google',
          'gameScore': 0
        });
      }
    });
  }

})(document);
