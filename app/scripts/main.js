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

  // constants
  var CORRECT_ANSWER_TEXT = 'Good job!';
  var CORRECT_ANSWER_SYM = 'check';
  var WRONG_ANSWER_TEXT = 'Oooo, no. Sorry!';
  var WRONG_ANSWER_SYM = 'close';
  var PASS_TEXT = 'You passed!';
  var PASS_SYM = 'sentiment_neutral';
  var NEW = 'new';
  var LIMBO = 'limbo';
  var LOCKED = 'locked';
  // initially undefined vars
  var now, today, gameMonday, weekStart, gameArray;
  var gameResultsObject, userResultsObject;
  var fbGameLocation, dayIndex, connection, userId, connected, qIndex;  
  // firebase vars
  var fb = new Firebase('https://jpdy.firebaseio.com');
  var fbJCategories = fb.child('j_categories');
  var fbDJCategories = fb.child('dj_categories');
  var fbFJCategories = fb.child('fj_categories');
  // elements in index.html
  var categoryElement = querySelector('#category');
  var loginWindow = querySelector('#loginWindow');
  var googleLogin = querySelector('#googleLogin');
  var authButton = querySelector('#authButton');
  var answerInput = querySelector('#answerInput');
  // general initialized vars
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var loggedIn = false;
  //var gameInProgress = false;
  var todaysQs = [];
  
  /*** INITIALIZE ***/

  now = new Date();
  today = now.getDay() > 0 ? now.getDay() - 1 : 6; // 0-6 with 0===Monday
  querySelector('#jpdy-round').textContent = today < 3 ? 'first' : today < 6 ? 'second' : 'final';
  weekStart = new Date(now.getTime() - (today * 24 + now.getHours()) * 3600000);
  gameMonday = String(weekStart.getDate());
  // console.log(weekStart);
  gameMonday = months[weekStart.getMonth()] + gameMonday;
  gameMonday = weekStart.getFullYear() + gameMonday;
  fbGameLocation = fb.child('games').child(gameMonday);
  fbGameLocation.once('value', function(snapshot) {
    gameArray = snapshot.val();
    if (gameArray) {
      // console.log(gameArray);
      play();
    } else {
      initWeek();
    }
  });

  /*** ADD LISTENERS ***/

  // Enter an entry to start turn or add to current turn *
  querySelector('#jpdy-user-input').addEventListener('keyup', function(e) {
    if (e.keyCode === 13) {
      enterAnswer();
    }
  });

  querySelector('#jpdy-user-input').addEventListener('focus', function() {
    if (!loggedIn) {
      loginWindow.style.display = 'flex';
    }
  });

  querySelector('#jpdy-dd-wager').addEventListener('keyup', function(e) {
    if (e.keyCode === 13) {
      enterWager();
    }
  });

  querySelector('#jpdy-dd-wager').addEventListener('focus', function() {
    if (!loggedIn) {
      loginWindow.style.display = 'flex';
    }
  });

  querySelector('#jpdy-button-prev').addEventListener('click', prevQ);

  querySelector('#jpdy-button-pass').addEventListener('click', passQ);

  querySelector('#jpdy-button-next').addEventListener('click', nextQ);

  authButton.addEventListener('click', function() {
    if (loggedIn) {
      fb.unauth();
    } else {
      loginWindow.style.display = 'flex';
    }
  });

  googleLogin.addEventListener('click', login);

  /*** EVENT RESPONSE FUNCTIONS ***/

  function login() {
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
  }

  function enterAnswer() {
    var entry, answerObject;
    var jpdyUserInput = querySelector('#jpdy-user-input');
    var jpdyResultFeedback = querySelector('#jpdy-result-feedback');
    var jpdyResultButtons = querySelector('#jpdy-result-buttons');

    entry = jpdyUserInput.value;
    if (entry.toLowerCase() === todaysQs[qIndex].a.toLowerCase()) {
      jpdyResultFeedback.classList.remove('jpdy-hide');
      tallyScore(true, entry);
    } else {
      jpdyResultButtons.classList.remove('jpdy-hide');
      userResultsObject.answers[today][qIndex] = userResultsObject.answers[today][qIndex] || {};
      userResultsObject.answers[today][qIndex].status = LIMBO;
      userResultsObject.answers[today][qIndex].answer = entry;
      fb.child('results').child(gameMonday).child(userId).set(userResultsObject);
    }
    showAnswer(entry);
  }

  function showAnswer(entry) {
    var status, score;
    var jpdyUserAnswer = querySelector('#jpdy-user-answer');
    var jpdyUserInputDisplay = querySelector('#jpdy-user-input-display');
    var jpdyAnswer = querySelector('#jpdy-answer');
    var jpdyResult = querySelector('#jpdy-result');
    var jpdyResultButtons = querySelector('#jpdy-result-buttons');
    var jpdyResultFeedback = querySelector('#jpdy-result-feedback');
    var jpdyResultSymbol = querySelector('#jpdy-result-symbol');
    var jpdyResultText = querySelector('#jpdy-result-text');
    
    jpdyUserInputDisplay.classList.add('jpdy-hide');
    jpdyUserAnswer.textContent = 'your answer: ' + entry;
    jpdyAnswer.classList.remove('jpdy-hide');
    jpdyAnswer.textContent = 'correct answer: ' + todaysQs[qIndex].a;
    jpdyUserAnswer.classList.remove('jpdy-hide');
    jpdyResult.classList.remove('jpdy-hide');
    if (today !== 6) {
      status = userResultsObject.answers[today][qIndex].status;
    } else {
      status = userResultsObject.answers[6].status;
    }
    if (status === LIMBO) {
      jpdyResultFeedback.classList.add('jpdy-hide');
      jpdyResultButtons.classList.remove('jpdy-hide');
      return;     
    } 
    if (today !== 6) {
      score = userResultsObject.answers[today][qIndex].score;
    } else {
      score = userResultsObject.answers[6].score;
    }
    jpdyResultButtons.classList.add('jpdy-hide');
    jpdyResultFeedback.classList.remove('jpdy-hide');
    if (score < 0) {
      jpdyResultSymbol.textContent = WRONG_ANSWER_SYM;
      jpdyResultText.textContent = WRONG_ANSWER_TEXT;
      jpdyResultSymbol.classList.remove('mdl-color-text--green');
      jpdyResultSymbol.classList.add('mdl-color-text--red');
    } else if (score > 0) {
      jpdyResultSymbol.textContent = CORRECT_ANSWER_SYM;
      jpdyResultText.textContent = CORRECT_ANSWER_TEXT;
      jpdyResultSymbol.classList.remove('mdl-color-text--red');
      jpdyResultSymbol.classList.add('mdl-color-text--green');
    } else {
      jpdyResultSymbol.textContent = PASS_SYM;
      jpdyResultText.textContent = PASS_TEXT;
      jpdyResultSymbol.classList.remove('mdl-color-text--green');
      jpdyResultSymbol.classList.remove('mdl-color-text--red');
    }
  }

  function hideAnswer() {
    var jpdyUserAnswer = querySelector('#jpdy-user-answer');
    var jpdyUserInputDisplay = querySelector('#jpdy-user-input-display');
    var jpdyAnswer = querySelector('#jpdy-answer');
    var jpdyResult = querySelector('#jpdy-result');
    
    jpdyUserInputDisplay.classList.remove('jpdy-hide');
    jpdyUserAnswer.textContent = 'your answer';
    jpdyAnswer.classList.add('jpdy-hide');
    jpdyAnswer.textContent = 'the correct answer';
    jpdyUserAnswer.classList.add('jpdy-hide');
    jpdyResult.classList.add('jpdy-hide');
  }

  function tallyScore(isCorrect, entry) {
    var score, scoreText, totalScore, answerObject;
    var jpdyValue = querySelector('#jpdy-value');
    var jpdyDDWager = querySelector('#jpdy-dd-wager');
    var jpdyScore = querySelector('#jpdy-score');
    var value = gameArray[today].questions[qIndex].value;

    answerObject = userResultsObject.answers[today][qIndex] || {};
    answerObject.answer = entry;
    scoreText = jpdyValue.textContent; // value === 'DD' ? jpdyDDWager.textContent : jpdyValue.textContent;
    score = isCorrect ? parseInt(scoreText) : -parseInt(scoreText);
    answerObject.score = score;
    answerObject.status = LOCKED;
    userResultsObject.answers[today][qIndex] = answerObject;
    totalScore = parseInt(jpdyScore.textContent) + score;
    jpdyScore.textContent = totalScore;
    userResultsObject.totalScore = totalScore;
    fb.child('results').child(gameMonday).child(userId).set(userResultsObject);
  }

  function prevQ() {
    var jpdyButtonPrev = querySelector('#jpdy-button-prev');
    var jpdyButtonNext = querySelector('#jpdy-button-next');
    var jpdyUserInputDisplay = querySelector('#jpdy-user-input-display');
    var jpdyUserAnswer = querySelector('#jpdy-user-answer');
    var jpdyAnswer = querySelector('#jpdy-answer');
    var jpdyUserResult = querySelector('#jpdy-result');

    qIndex -= 1;
    if (qIndex === 0) {
      jpdyButtonPrev.disabled = true;
    }
    jpdyButtonNext.disabled = false;
    getQ();
  }

  function passQ() {

  }

  function nextQ() {
    var jpdyButtonPrev = querySelector('#jpdy-button-prev');
    var jpdyButtonNext = querySelector('#jpdy-button-next');
    var jpdyUserInputDisplay = querySelector('#jpdy-user-input-display');
    var jpdyUserAnswer = querySelector('#jpdy-user-answer');
    var jpdyAnswer = querySelector('#jpdy-answer');
    var jpdyUserResult = querySelector('#jpdy-result');

    qIndex += 1;
    if (qIndex === gameArray[today].questions.length - 1) {
      jpdyButtonNext.disabled = true;
    }
    jpdyButtonPrev.disabled = false;
    getQ();
  }

  function enterWager() {
    var wager, totalScore, illegalWagerMessage;
    var jpdyDDWager = querySelector('#jpdy-dd-wager');
    var jpdyResultFeedback = querySelector('#jpdy-result-feedback');
    var jpdyResultButtons = querySelector('#jpdy-result-buttons');
    var jpdyValue = querySelector('#jpdy-value');
    var jpdyValueDisplay = querySelector('#jpdy-value-display');
    var jpdyDDValue = querySelector('#jpdy-dd-value');
    var jpdyUserInputDisplay = querySelector('#jpdy-user-input-display');
    var jpdyClue = querySelector('#jpdy-clue');

    wager = parseInt(jpdyDDWager.value);
    totalScore = userResultsObject.totalScore;
    if (wager < 0) {
      alert('Negative wagers are not allowed!');
      jpdyDDWager.value = '';
      return;
    }
    if (today < 3 && totalScore <= 1000 && wager > 1000) {
      alert('Wager can\'t be greater than 1000!');
      jpdyDDWager.value = '';
      return;
    } else if (today < 3 && totalScore > 1000 && wager > totalScore) {
      alert('Wager can\'t be greater than ' + userResultsObject.totalScore + '!');
      jpdyDDWager.value = '';
      return;
    }
    if (today < 6 && totalScore <= 2000 && wager > 2000) {
      alert('Wager can\'t be greater than 2000!');
      jpdyDDWager.value = '';
      return;
    } else if (today < 6 && totalScore > 2000 && wager > totalScore) {
      alert('Wager can\'t be greater than ' + userResultsObject.totalScore + '!');
      jpdyDDWager.value = '';
      return;
    }
    if (today !== 6) {
      userResultsObject.answers[today][qIndex] = userResultsObject.answers[today][qIndex] || {};
      userResultsObject.answers[today][qIndex].wager = wager;
      userResultsObject.answers[today][qIndex].status = NEW; //LIMBO;
    } else {
      userResultsObject.answers[6] = userResultsObject.answers[6] || {};
      userResultsObject.answers[6].wager = wager;
      userResultsObject.answers[6].status = NEW; // LIMBO;
    }
    jpdyValue.textContent = wager;
    jpdyValueDisplay.classList.remove('jpdy-hide');
    jpdyDDValue.classList.add('jpdy-hide');
    jpdyClue.textContent = todaysQs[qIndex].q;
    jpdyClue.classList.remove('mdl-color-text--deep-orange');
    jpdyUserInputDisplay.classList.remove('jpdy-hide');
    fb.child('results').child(gameMonday).child(userId).set(userResultsObject);
  }

  /*** PLAY GAME ***/

  function play() {
    if (!(userResultsObject && gameArray)) return; //gameInProgress) return;
    //gameInProgress = true;
    if (today === 6) {
      finalPlay();
      return;
    }
    qIndex = 0;
    getQ();
  }

  function getQ() {
    if (todaysQs[qIndex]) {
      updateDisplay();
      return;
    }
    fb.child('questions').child(gameArray[today].questions[qIndex].question).once('value', function(snapshot) {
      todaysQs[qIndex] = snapshot.val();
      updateDisplay();
    });
  }

  function updateDisplay() {
    var val, wager, result;
    var jpdyDDValue = querySelector('#jpdy-dd-value');
    var jpdyValueDisplay = querySelector('#jpdy-value-display')
    var jpdyUserInput = querySelector('#jpdy-user-input');
    var jpdyUserInputDisplay = querySelector('#jpdy-user-input-display');
    var jpdyValue = querySelector('#jpdy-value');
    var jpdyClue = querySelector('#jpdy-clue');

    if (today !== 6) {
      val = gameArray[today].questions[qIndex].value;
    } else {
      val = 'DD';
    }
    categoryElement.textContent = gameArray[today].category;
    try {
      if (today !== 6) {
        result = userResultsObject.answers[today][qIndex];
      } else {
        result = userResultsObject.answers[6];
      }
      wager = result.wager;
    } catch(e) {}
    if (result && (result.status === LOCKED || result.status === LIMBO)) {
      showAnswer(result.answer);
    } else {
      jpdyUserInput.value = null;
      hideAnswer();
    }
    // if (wager) {
    //   jpdyValue.textContent = wager;
    //   jpdyValueDisplay.classList.remove('jpdy-hide');
    //   jpdyDDValue.classList.add('jpdy-hide');
    //   jpdyClue.textContent = todaysQs[qIndex].q;
    //   jpdyClue.classList.remove('mdl-color-text--deep-orange');
    //   jpdyUserInputDisplay.classList.remove('jpdy-hide');
    // }
    if (val !== 'DD' || wager) {
      jpdyValue.textContent = wager || val.slice(1);      
      jpdyValueDisplay.classList.remove('jpdy-hide');
      jpdyDDValue.classList.add('jpdy-hide');
      jpdyClue.textContent = todaysQs[qIndex].q;
      jpdyClue.classList.remove('mdl-color-text--deep-orange');
    } else {
      jpdyDDValue.classList.remove('jpdy-hide');
      jpdyValueDisplay.classList.add('jpdy-hide');
      jpdyClue.textContent = 'Enter a wager to reveal the clue!';
      jpdyClue.classList.add('mdl-color-text--deep-orange');
      jpdyUserInputDisplay.classList.add('jpdy-hide');
    }
  }

  function finalPlay() {
    var jpdyNavigateButtons = querySelector('#jpdy-navigate-buttons');

    jpdyNavigateButtons.classList.add('jpdy-hide');
    if (todaysQs[qIndex]) {
      updateDisplay();
      return;
    }
    fb.child('questions').child(gameArray[6].question).once('value', function(snapshot) {
      todaysQs[qIndex] = snapshot.val();
      updateDisplay();
    });
  }

  /*** SET UP GAME FOR WEEK ***/

  function initWeek() {
    var i, numCats, catNum;

    dayIndex = 0;
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
      gameArray = [];
      gameArray[6] = {};
      gameArray[6].question = String(result.question);
      gameArray[6].category = result.category;
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
      gameArray[String(dayIndex)] = dayObject;
      dayIndex += 1;
      dayIndex < 6 ? setupRound() : saveGame();
    });
  }

  function selectQuestions(qList) {
    var i, randomQ, qObject, returnObject;
    var initialQs = Object.keys(qList);
    var finalQs = [];

    randomQ = initialQs[Math.floor(Math.random() * initialQs.length)];
    for (i = 0; i < initialQs.length; i++) {
      if (Math.abs(parseInt(initialQs[i]) - parseInt(randomQ)) < 100) {
        qObject = {};
        qObject.question = initialQs[i]
        qObject.value = qList[initialQs[i]];
        finalQs.push(qObject);
      }
    }
    while (finalQs.length > 3) {
      finalQs.splice(Math.floor(Math.random() * finalQs.length), 1);
    }
    return finalQs; // returnObject;
  }

  function saveGame() {
    fb.child('games').child(gameMonday).set(gameArray);
    play();
  }

  /*** LOGIN AND AUTH ***/

  fb.child('.info/connected').on('value', function(snap) {
    connected = snap.val();
    setOnlineStatus();
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
      var userObject = snapshot.val();

      if (!userObject) {
      //   querySelector('#jpdy-score').textContent = userObject.game === gameMonday ? userObject.gameScore : 0;
      // } else {
        // Use update instead of set in case there is a race condition with
        // currentStory: storyId
        fbUser.update({
          'userName': authData.google.displayName,
          'provider': 'google'
        });
      }
    });
  }

  function setOnlineStatus() {
    if (connected && userId) {
      // We're connected and the user is authorized
      // add this device to the users connections list
      connection = fb.child('people').child(userId).child('online').push(true);
      connection.onDisconnect().remove();
      getGameStatus();
    } else if (connection) {
      connection.remove();
    }
  }

  function getGameStatus() {
    var jpdyScore = querySelector('#jpdy-score');

    fb.child('results').child(gameMonday).once('value', function(snapshot) {
      gameResultsObject = snapshot.val();
      if (gameResultsObject) {
        snapshot.forEach(function(childSnapshot) {
          if (userId === childSnapshot.key()) {
            userResultsObject = childSnapshot.val();
            jpdyScore.textContent = userResultsObject.totalScore;
          }
        });
      }
      userResultsObject = userResultsObject || {};
      userResultsObject.totalScore = userResultsObject.totalScore || 0;
      userResultsObject.answers = userResultsObject.answers || [];
      userResultsObject.answers[today] = userResultsObject.answers[today] || [];
      play();
    });
  }

})(document);
