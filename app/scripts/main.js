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
  var RIGHT = 'right';
  var WRONG = 'wrong';
  var PASS_TEXT = 'You passed!';
  var PASS_SYM = 'sentiment_neutral';
  var NEW = 'new';
  var LIMBO = 'limbo';
  var LOCKED = 'locked';
  var NUM_J_CATS = 14209;
  var NUM_DJ_CATS = 13631;
  var NUM_FJ_CATS = 3593;
  // initially undefined vars
  var now;
  var today;
  var gameMonday;
  var weekStart;
  var gameArray;
  var gameResultsObject;
  var userResultsObject;
  var fbGameLocation;
  var dayIndex;
  var connection;
  var userId;
  var connected;
  var qIndex;
  var practiceQ;
  // firebase vars
  var fb = new Firebase('https://jpdy.firebaseio.com');
  var fbUserResults;
  // elements in index.html
  var loginWindow = querySelector('#loginWindow');
  var googleLogin = querySelector('#googleLogin');
  var authButton = querySelector('#authButton');
  var jpdyUserInput = querySelector('#jpdy-user-input');
  var jpdyResultFeedback = querySelector('#jpdy-result-feedback');
  var jpdyResultButtons = querySelector('#jpdy-result-buttons');
  var jpdyUserAnswer = querySelector('#jpdy-user-answer');
  var jpdyUserInputDisplay = querySelector('#jpdy-user-input-display');
  var jpdyAnswer = querySelector('#jpdy-answer');
  var jpdyResult = querySelector('#jpdy-result');
  var jpdyValue = querySelector('#jpdy-value');
  var jpdyScore = querySelector('#jpdy-score');
  var jpdyDDWager = querySelector('#jpdy-dd-wager');
  var jpdyValueDisplay = querySelector('#jpdy-value-display');
  var jpdyButtonPrev = querySelector('#jpdy-button-prev');
  var jpdyDDValue = querySelector('#jpdy-dd-value');
  var jpdyClue = querySelector('#jpdy-clue');
  var jpdyButtonNext = querySelector('#jpdy-button-next');
  var jpdySpinner = querySelector('#jpdy-spinner');
  var jpdyButtonPass = querySelector('#jpdy-button-pass');
  var jpdyNavigateButtons = querySelector('#jpdy-navigate-buttons');
  var jpdyHistoryTable = querySelector('#jpdy-history-table');
  // general initialized vars
  var loggedIn = false;
  var todaysQs = [];

  /* ** INITIALIZE ** */

  init();

  function init() {
    now = new Date();
    today = now.getDay() > 0 ? now.getDay() - 1 : 6;
    setRound();
    weekStart = new Date(now.getTime() -
        (today * 24 + now.getHours()) * 3600000);
    gameMonday = String(weekStart.getDate());
    gameMonday = gameMonday.length === 1 ? '0' + gameMonday : gameMonday;
    gameMonday = weekStart.getMonth() + gameMonday;
    gameMonday = gameMonday.length === 3 ? '0' + gameMonday : gameMonday;
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
    location.hash = '#jpdy-game';
    setTimeout(refreshPage, 3600000);
  }

  function refreshPage() {
    window.location.reload();
    setTimeout(refreshPage, 3600000);
  }

  /* ** ADD LISTENERS ** */

  window.addEventListener('hashchange', navigate);

  // Enter an entry to start turn or add to current turn *
  jpdyUserInput.addEventListener('keyup', function(e) {
    if (e.keyCode === 13) {
      enterAnswer();
    }
  });

  jpdyUserInput.addEventListener('focus', function() {
    if (!loggedIn) {
      loginWindow.style.display = 'flex';
    }
  });

  jpdyDDWager.addEventListener('keyup', function(e) {
    if (e.keyCode === 13) {
      enterWager();
    }
  });

  jpdyDDWager.addEventListener('focus', function() {
    if (!loggedIn) {
      loginWindow.style.display = 'flex';
    }
  });

  jpdyButtonPrev.addEventListener('click', prevQ);

  jpdyButtonPass.addEventListener('click', passQ);

  jpdyButtonNext.addEventListener('click', nextQ);

  querySelector('#jpdy-button-right').addEventListener('click', function() {
    showResultSymbol(true);
  });

  querySelector('#jpdy-button-wrong').addEventListener('click', function() {
    showResultSymbol(false);
  });

  querySelector('#jpdy-button-practice').addEventListener('click', function() {
    jpdyResultFeedback.classList.add('jpdy-hide');
    practice();
  });

  authButton.addEventListener('click', function() {
    if (loggedIn) {
      fb.unauth();
    } else {
      loginWindow.style.display = 'flex';
      closeDrawer();
    }
  });

  googleLogin.addEventListener('click', login);

  /* ** EVENT RESPONSE FUNCTIONS ** */

  function login() {
    loginWindow.style.display = 'none';
    // prefer pop-ups, so we don't navigate away from the page
    fb.authWithOAuthPopup('google', function(error) {
      if (error) {
        if (error.code === 'TRANSPORT_UNAVAILABLE') {
          // fall-back to browser redirects, and pick up the session
          // automatically when we come back to the origin page
          fb.authWithOAuthRedirect('google', function(error) {
            console.log('Auth failure with error: ' + error);
          });
        }
      }
    });
  }

  function navigate() {
    var jpdyGame = querySelector('#jpdy-game');
    var jpdyScores = querySelector('#jpdy-scores');
    var jpdyPrevGames = querySelector('#jpdy-prev-games');
    var jpdyPracticeNav = querySelector('#jpdy-practice-nav');

    jpdyResultFeedback.classList.add('jpdy-hide');
    if (location.hash === '#jpdy-game') {
      jpdyGame.classList.remove('jpdy-hide');
      jpdyNavigateButtons.classList.remove('jpdy-hide');
      jpdyScores.classList.add('jpdy-hide');
      jpdyPrevGames.classList.add('jpdy-hide');
      jpdyPracticeNav.classList.add('jpdy-hide');
      setRound();
      play();
      closeDrawer();
    } else if (location.hash === '#jpdy-scores') {
      jpdyGame.classList.add('jpdy-hide');
      jpdyNavigateButtons.classList.add('jpdy-hide');
      jpdyScores.classList.remove('jpdy-hide');
      jpdyPrevGames.classList.add('jpdy-hide');
      jpdyPracticeNav.classList.add('jpdy-hide');
      compareScores();
    } else if (location.hash === '#jpdy-prev-games') {
      getPrevGames();
      jpdyGame.classList.add('jpdy-hide');
      jpdyNavigateButtons.classList.add('jpdy-hide');
      jpdyScores.classList.add('jpdy-hide');
      jpdyPrevGames.classList.remove('jpdy-hide');
      jpdyPracticeNav.classList.add('jpdy-hide');
    } else if (location.hash === '#jpdy-practice-nav') {
      jpdyGame.classList.remove('jpdy-hide');
      jpdyNavigateButtons.classList.add('jpdy-hide');
      jpdyScores.classList.add('jpdy-hide');
      jpdyPrevGames.classList.add('jpdy-hide');
      jpdyPracticeNav.classList.remove('jpdy-hide');
      querySelector('#jpdy-round').textContent = 'practice';
      practice();
    }
  }

  function compareScores() {
    var uid;
    var userName;
    var score;
    var sundayScore;
    var name;
    var tdName;
    var tdScore;
    var tr;
    var tbody;
    var fbUser = fb.child('people');
    var jpdyScoreTable = querySelector('#jpdy-score-table');

    tbody = querySelector('#jpdy-score-table tbody');
    while (tbody) {
      jpdyScoreTable.removeChild(tbody);
      tbody = querySelector('#jpdy-score-table tbody');
    }
    fbUser.once('value', function(snapshot) {
      snapshot.forEach(function(childSnapshot) {
        uid = childSnapshot.key();
        if (gameResultsObject[uid]) {
          sundayScore = gameResultsObject[uid].answers &&
              gameResultsObject[uid].answers[6] &&
              gameResultsObject[uid].answers[6].score;
          score = uid === userId ? userResultsObject.totalScore :
              gameResultsObject[uid].totalScore;
          if (sundayScore) {
            score -= sundayScore;
          }
          userName = childSnapshot.val().userName;
          name = userName ? userName.split(' ')[0] : 'anonymous';
          tdName = document.createElement('td');
          tdName.appendChild(document.createTextNode(name));
          tdScore = document.createElement('td');
          tdScore.appendChild(document.createTextNode(score));
          tr = document.createElement('tr');
          tr.appendChild(tdName);
          tr.appendChild(tdScore);
          tbody = document.createElement('tbody');
          tbody.appendChild(tr);
          jpdyScoreTable.appendChild(tbody);
        }
      });
      closeDrawer();
    });
  }

  function getPrevGames() {
    var uid;
    var userName;
    var name;
    var tbody;
    var userObject;
    var userArray = [];
    var fbUser = fb.child('people');

    tbody = querySelector('#jpdy-history-table tbody');
    while (tbody) {
      jpdyHistoryTable.removeChild(tbody);
      tbody = querySelector('#jpdy-history-table tbody');
    }
    fbUser.once('value', function(snapshot) {
      snapshot.forEach(function(childSnapshot) {
        uid = childSnapshot.key();
        userName = childSnapshot.val().userName;
        name = userName ? userName.split(' ')[0] : 'anonymous';
        userObject = {};
        userObject[uid] = name;
        userArray.push(userObject);
      });
      populateHistoryTable(userArray);
    });
  }

  function populateHistoryTable(playerArray) {
    var score;
    var tdName;
    var tdScore0;
    var tdScore1;
    var star;
    var winningScore0 = 0;
    var winningScore1 = 0;
    var tr;
    var tbody;
    var player;
    var lastGames = [];
    var fbResults = fb.child('results');

    fbResults.orderByKey().limitToLast(3).once('value', function(snapshot) {
      snapshot.forEach(function(childSnapshot) {
        lastGames.push(childSnapshot.val());
      });
      lastGames = lastGames.slice(0, 2);
      playerArray.forEach(function(playerObject) {
        player = Object.keys(playerObject)[0];
        if (lastGames[1][player] && 
            lastGames[1][player].totalScore > winningScore0) {
          winningScore0 = lastGames[1][player].totalScore;
        }
        if (lastGames[0][player] && 
            lastGames[0][player].totalScore > winningScore1) {
          winningScore1 = lastGames[0][player].totalScore;
        }
      });
      playerArray.forEach(function(playerObject) {
        player = Object.keys(playerObject)[0];
        tdName = document.createElement('td');
        tdName.appendChild(document.createTextNode(playerObject[player]));
        tdScore0 = document.createElement('td');
        tdScore0.classList.add('jpdy-cell-width');
        score = lastGames[1][player] ? lastGames[1][player].totalScore : '-';
        if (score === winningScore0) {
          tdScore0.classList.add('jpdy-winner');
          star = document.createElement('i');
          star.classList.add('mdl-color-text--amber', 'material-icons', 'jpdy-star');
          star.appendChild(document.createTextNode('star'));
          tdScore0.appendChild(star);
        }
        tdScore0.appendChild(document.createTextNode(score));
        tdScore1 = document.createElement('td');
        tdScore1.classList.add('jpdy-cell-width');
        score = lastGames[0][player] ? lastGames[0][player].totalScore : '-';
        if (score === winningScore1) {
          tdScore1.classList.add('jpdy-winner');
          star = document.createElement('i');
          star.classList.add('mdl-color-text--amber', 'material-icons', 'jpdy-star');
          star.appendChild(document.createTextNode('star'));
          tdScore1.appendChild(star);
        }
        tdScore1.appendChild(document.createTextNode(score));
        tr = document.createElement('tr');
        tr.appendChild(tdName);
        tr.appendChild(tdScore0);
        tr.appendChild(tdScore1);
        tbody = document.createElement('tbody');
        tbody.appendChild(tr);
        jpdyHistoryTable.appendChild(tbody);
      });
      closeDrawer();
    });
  }

  function practice() {
    var round;
    var roundIndex;
    var catNum;
    var qNum;
    var catObject;
    var keys;
    var keyIndex;
    var numKeys = 0;
    var category;
    var result;

    roundIndex = Math.floor(Math.random() * 3);
    round = ['j_categories', 'dj_categories', 'fj_categories'][roundIndex];
    fb.child(round).child('number').once('value', function(snapshot) {
      var number = snapshot.val();

      catNum = Math.floor(Math.random() * number);
      fb.child(round).child(catNum).once('value', function(catSnapshot) {
        var value;

        catObject = catSnapshot.val();
        category = catObject.category;
        if (round === 'fj_categories') {
          qNum = catObject.question;
          value = '$1000';
        } else {
          keys = Object.keys(catObject.questions);
          keys.forEach(function(key) {
            if (catObject.questions.hasOwnProperty(key)) {
              numKeys++;
            }
          });
          keyIndex = Math.floor(Math.random() * numKeys);
          qNum = keys[keyIndex];
          value = catObject.questions[qNum];
          value = value === 'DD' ? '$1000' : value;
        }
        fb.child('questions').child(qNum).once('value', function(qSnapshot) {
          practiceQ = qSnapshot.val();
          result = {};
          result.status = NEW;
          result.score = 0;
          updateDisplay(category, practiceQ.q, result, value);
        });
      });
    });
    closeDrawer();
  }

  function closeDrawer() {
    var drawer = querySelector('.mdl-layout__drawer');
    var obfuscator = querySelector('.mdl-layout__obfuscator');

    if (drawer) {
      drawer.classList.remove('is-visible');
    }
    if (obfuscator) {
      obfuscator.classList.remove('is-visible');
    }
  }

  function enterAnswer() {
    var entry;
    var answer;
    var answerObject;

    entry = jpdyUserInput.value;
    if (location.hash === '#jpdy-practice-nav') {
      answer = practiceQ.a;
      if (entry.toLowerCase().trim() === answer.toLowerCase().trim()) {
        jpdyResultFeedback.classList.remove('jpdy-hide');
        displayResultFeedback(RIGHT);
      } else {
        jpdyResultButtons.classList.remove('jpdy-hide');
      }
      showAnswer(entry);
      return;
    }
    answer = todaysQs[qIndex].a;
    answerObject = today === 6 ? userResultsObject.answers[6] :
        userResultsObject.answers[today][qIndex];
    answerObject = answerObject || {};
    if (entry.toLowerCase().trim() === answer.toLowerCase().trim()) {
      jpdyResultFeedback.classList.remove('jpdy-hide');
      tallyScore(true, entry);
    } else {
      jpdyResultButtons.classList.remove('jpdy-hide');
      answerObject.status = LIMBO;
      answerObject.answer = entry;
      if (today === 6) {
        userResultsObject.answers[6] = answerObject;
      } else {
        userResultsObject.answers[today][qIndex] = answerObject;
      }
      fbUserResults.set(userResultsObject);
    }
    showAnswer();
  }

  function showAnswer(userEntry) {
    var status;
    var result;
    var entry;

    if (location.hash === '#jpdy-practice-nav') {
      jpdyUserInputDisplay.classList.add('jpdy-hide');
      jpdyUserAnswer.textContent = 'your answer: ' + userEntry;
      jpdyAnswer.classList.remove('jpdy-hide');
      jpdyAnswer.textContent = 'correct answer: ' + practiceQ.a;
      jpdyUserAnswer.classList.remove('jpdy-hide');
      jpdyResult.classList.remove('jpdy-hide');
      return;
    }
    if (today === 6) {
      entry = userResultsObject.answers[6].answer;
    } else {
      entry = userResultsObject.answers[today][qIndex].answer;
    }
    jpdyUserInputDisplay.classList.add('jpdy-hide');
    jpdyUserAnswer.textContent = 'your answer: ' + entry;
    jpdyAnswer.classList.remove('jpdy-hide');
    jpdyAnswer.textContent = 'correct answer: ' + todaysQs[qIndex].a;
    jpdyUserAnswer.classList.remove('jpdy-hide');
    jpdyResult.classList.remove('jpdy-hide');
    if (today === 6) {
      status = userResultsObject.answers[6].status;
    } else {
      status = userResultsObject.answers[today][qIndex].status;
    }
    if (status === LIMBO) {
      jpdyResultFeedback.classList.add('jpdy-hide');
      jpdyResultButtons.classList.remove('jpdy-hide');
      return;
    }
    if (today === 6) {
      result = userResultsObject.answers[6].result;
    } else {
      result = userResultsObject.answers[today][qIndex].result;
    }
    displayResultFeedback(result);
  }

  function displayResultFeedback(result) {
    var jpdyResultText = querySelector('#jpdy-result-text');
    var jpdyResultSymbol = querySelector('#jpdy-result-symbol');

    jpdyResultButtons.classList.add('jpdy-hide');
    jpdyResultFeedback.classList.remove('jpdy-hide');
    if (result === WRONG) {
      jpdyResultSymbol.textContent = WRONG_ANSWER_SYM;
      jpdyResultText.textContent = WRONG_ANSWER_TEXT;
      jpdyResultSymbol.classList.remove('mdl-color-text--green');
      jpdyResultSymbol.classList.add('mdl-color-text--red');
    } else if (result === RIGHT) {
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
    jpdyUserInputDisplay.classList.remove('jpdy-hide');
    jpdyUserAnswer.textContent = 'your answer';
    jpdyAnswer.classList.add('jpdy-hide');
    jpdyAnswer.textContent = 'the correct answer';
    jpdyUserAnswer.classList.add('jpdy-hide');
    jpdyResult.classList.add('jpdy-hide');
  }

  function tallyScore(isCorrect, entry) {
    var score;
    var scoreText;
    var totalScore;
    var answerObject;

    jpdyResultButtons.classList.add('jpdy-hide');
    if (today === 6) {
      answerObject = userResultsObject.answers[6] || {};
      answerObject.answer = answerObject.answer || entry;
    } else {
      answerObject = userResultsObject.answers[today][qIndex] || {};
      answerObject.answer = answerObject.answer || entry;
    }
    scoreText = jpdyValue.textContent;
    score = isCorrect ? parseInt(scoreText, 10) : -parseInt(scoreText, 10);
    answerObject.score = score;
    answerObject.status = LOCKED;
    answerObject.result = isCorrect ? RIGHT : WRONG;
    if (today === 6) {
      userResultsObject.answers[6] = answerObject;
    } else {
      userResultsObject.answers[today][qIndex] = answerObject;
    }
    totalScore = parseInt(jpdyScore.textContent, 10) + score;
    jpdyScore.textContent = totalScore;
    userResultsObject.totalScore = totalScore;
    fbUserResults.set(userResultsObject);
  }

  function prevQ() {
    qIndex -= 1;
    getQ();
  }

  function nextQ() {
    qIndex += 1;
    getQ();
  }

  function passQ() {
    var status = userResultsObject.answers[today][qIndex].status;

    if (status !== LOCKED && status !== LIMBO) {
      userResultsObject.answers[today][qIndex] =
          userResultsObject.answers[today][qIndex] || {};
      userResultsObject.answers[today][qIndex].status = LOCKED;
      userResultsObject.answers[today][qIndex].answer = 'passed';
      userResultsObject.answers[today][qIndex].score = 0;
      fbUserResults.set(userResultsObject);
      showAnswer();
    }
  }

  function enterWager() {
    var wager;
    var totalScore;

    wager = parseInt(jpdyDDWager.value, 10);
    if (location.hash === '#jpdy-practice-nav') {
      wagerDisplay(wager, practiceQ);
      return;
    }
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
      alert('Wager can\'t be greater than ' + totalScore + '!');
      jpdyDDWager.value = '';
      return;
    }
    if (today < 6 && totalScore <= 2000 && wager > 2000) {
      alert('Wager can\'t be greater than 2000!');
      jpdyDDWager.value = '';
      return;
    } else if (today < 6 && totalScore > 2000 && wager > totalScore) {
      alert('Wager can\'t be greater than ' + totalScore + '!');
      jpdyDDWager.value = '';
      return;
    }
    if (today === 6 && wager > totalScore) {
      alert('Wager can\'t be greater than ' + totalScore + '!');
      jpdyDDWager.value = '';
      return;
    }
    if (today === 6 && totalScore < 0) {
      wager = 0;
    }
    if (today === 6) {
      userResultsObject.answers[6] = userResultsObject.answers[6] || {};
      userResultsObject.answers[6].wager = wager;
      userResultsObject.answers[6].status = NEW;
    } else {
      userResultsObject.answers[today][qIndex] =
          userResultsObject.answers[today][qIndex] || {};
      userResultsObject.answers[today][qIndex].wager = wager;
      userResultsObject.answers[today][qIndex].status = NEW;
    }
    wagerDisplay(wager, todaysQs[qIndex].q);
    fbUserResults.set(userResultsObject);
  }

  function wagerDisplay(wager, question) {
    jpdyValue.textContent = wager;
    jpdyValueDisplay.classList.remove('jpdy-hide');
    jpdyDDValue.classList.add('jpdy-hide');
    jpdyClue.textContent = question;
    jpdyClue.classList.remove('mdl-color-text--deep-orange');
    jpdyUserInputDisplay.classList.remove('jpdy-hide');
  }

  function showResultSymbol(isCorrect) {
    var result;

    if (location.hash !== '#jpdy-practice-nav') {
      tallyScore(isCorrect);
    }
    jpdyResultFeedback.classList.remove('jpdy-hide');
    jpdyResultButtons.classList.add('jpdy-hide');
    result = isCorrect ? RIGHT : WRONG;
    displayResultFeedback(result);
  }

  /* ** PLAY GAME ** */

  function setRound() {
    if (today < 3) {
      querySelector('#jpdy-round').textContent = 'first';
    } else if (today < 6) {
      querySelector('#jpdy-round').textContent = 'second';
    } else {
      querySelector('#jpdy-round').textContent = 'final';
    }
  }

  function play() {
    if (!gameArray) {
      return;
    }
    qIndex = 0;
    if (today === 6) {
      finalPlay();
      return;
    }
    getQ();
  }

  function getQ() {
    var question;

    jpdySpinner.classList.add('is-active');
    jpdyButtonPrev.disabled = true;
    jpdyButtonNext.disabled = true;
    if (todaysQs[qIndex]) {
      prepForDisplay();
      return;
    }
    question = today === 6 ?
        gameArray[6].question : gameArray[today].questions[qIndex].question;
    fb.child('questions').child(question).once('value', function(snapshot) {
      todaysQs[qIndex] = snapshot.val();
      prepForDisplay();
    });
  }

  function finalPlay() {
    jpdyNavigateButtons.classList.add('jpdy-hide');
    if (todaysQs[qIndex]) {
      prepForDisplay();
      return;
    }
    fb.child('questions').child(gameArray[6].question).once('value',
      function(snapshot) {
        todaysQs[qIndex] = snapshot.val();
        prepForDisplay();
      });
  }

  function prepForDisplay() {
    var value;
    var result;

    value = today === 6 ? 'DD' : gameArray[today].questions[qIndex].value;
    if (today === 6) {
      result = userResultsObject.answers[6] || {};
      result.status = result.status || NEW;
      result.score = result.score || 0;
      if (userResultsObject.totalScore && userResultsObject.totalScore < 0) {
        result.wager = 0;
      }
      userResultsObject.answers[6] = result;
    } else {
      result = userResultsObject.answers[today][qIndex] || {};
      result.status = result.status || NEW;
      result.score = result.score || 0;
      userResultsObject.answers[today][qIndex] = result;
    }
    updateDisplay(gameArray[today].category, todaysQs[qIndex].q, result, value);
  }

  function updateDisplay(category, question, result, value) {
    var wager;
    var questions;
    var jpdyCategory = querySelector('#jpdy-category');

    jpdyCategory.textContent = category;
    wager = result.wager;
    if (result.status === LOCKED || result.status === LIMBO) {
      showAnswer();
    } else {
      jpdyUserInput.value = null;
      hideAnswer();
    }
    if (value !== 'DD' || wager || wager === 0) {
      if (wager === 0) {
        wager = '0';
      }
      jpdyValue.textContent = wager || value.slice(1);
      jpdyValueDisplay.classList.remove('jpdy-hide');
      jpdyDDValue.classList.add('jpdy-hide');
      jpdyClue.textContent = question;
      jpdyClue.classList.remove('mdl-color-text--deep-orange');
    } else {
      jpdyDDValue.classList.remove('jpdy-hide');
      jpdyValueDisplay.classList.add('jpdy-hide');
      jpdyClue.textContent = 'Enter a wager to reveal the clue!';
      jpdyClue.classList.add('mdl-color-text--deep-orange');
      jpdyUserInputDisplay.classList.add('jpdy-hide');
    }
    jpdySpinner.classList.remove('is-active');
    jpdyButtonPass.disabled = wager;
    questions = gameArray[today].questions;
    if (questions && qIndex !== questions.length - 1) {
      jpdyButtonNext.disabled = false;
    }
    if (qIndex !== 0) {
      jpdyButtonPrev.disabled = false;
    }
  }

  /* ** SET UP GAME FOR WEEK ** */

  function initWeek() {
    var catNum;

    dayIndex = 0;
    catNum = Math.floor(Math.random() * NUM_FJ_CATS);
    setFinal(catNum);
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
    if (dayIndex < 3) {
      prepGameData('j_categories', NUM_J_CATS);
    } else {
      prepGameData('dj_categories', NUM_DJ_CATS);
    }
  }

  function prepGameData(round, numCats) {
    var catNum;
    var qList;
    var dayObject;

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
      if (dayIndex < 6) {
        setupRound();
      } else {
        saveGame();
      }
    });
  }

  function selectQuestions(qList) {
    var i;
    var randomQ;
    var qObject;
    var initialQs = Object.keys(qList);
    var finalQs = [];

    randomQ = initialQs[Math.floor(Math.random() * initialQs.length)];
    for (i = 0; i < initialQs.length; i++) {
      if (Math.abs(parseInt(initialQs[i], 10) - parseInt(randomQ, 10)) < 100) {
        qObject = {};
        qObject.question = initialQs[i];
        qObject.value = qList[initialQs[i]];
        finalQs.push(qObject);
      }
    }
    return finalQs;
  }

  function saveGame() {
    fb.child('games').child(gameMonday).set(gameArray);
    play();
  }

  /* ** LOGIN AND AUTH ** */

  fb.child('.info/connected').on('value', function(snap) {
    connected = snap.val();
  });

  fb.onAuth(function(authData) {
    if (authData) {
      loggedIn = true;
      authButton.textContent = 'Logout';
      userId = authData.uid;
      fbUserResults = fb.child('results').child(gameMonday).child(userId);
      showProfile(true, authData);
      recordAuth(authData);
    } else {
      authButton.textContent = 'Login';
      if (loggedIn) {
        showProfile(false);
      }
      loggedIn = false;
      userId = undefined;
      getGameStatus();
      jpdyScore.textContent = 0;
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
      profileName.textContent = '';
      profilePic.style.display = 'none';
    }
    closeDrawer();
  }

  function recordAuth(authData) {
    var fbUser = fb.child('people').child(userId);

    fbUser.once('value', function(snapshot) {
      var userObject = snapshot.val();

      if (!userObject) {
        // Use update instead of set in case there is a race condition
        fbUser.update({
          userName: authData.google.displayName,
          provider: 'google'
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
    } else if (connection) {
      connection.remove();
    }
    getGameStatus();
  }

  function getGameStatus() {
    fb.child('results').child(gameMonday).once('value', function(snapshot) {
      gameResultsObject = snapshot.val();
      if (gameResultsObject && userId) {
        snapshot.forEach(function(childSnapshot) {
          if (userId === childSnapshot.key()) {
            userResultsObject = childSnapshot.val();
            jpdyScore.textContent = userResultsObject.totalScore;
          }
        });
      } else {
        userResultsObject = undefined;
      }
      userResultsObject = userResultsObject || {};
      userResultsObject.totalScore = userResultsObject.totalScore || 0;
      userResultsObject.answers = userResultsObject.answers || [];
      userResultsObject.answers[today] = userResultsObject.answers[today] || [];
      play();
    });
  }
})(document);
