/**
 * LinguaWalk — auth.js
 * 모든 페이지에서 nav 로그인 상태를 반영하는 공통 스크립트
 * <script src="/auth.js" defer></script> 로 포함
 */
(function () {
  'use strict';

  var FB_CONFIG = {
    apiKey:            "AIzaSyB3OWQRy6AgDSrtjDXBclFxfV4mqhzWp-w",
    authDomain:        "linguawalk.firebaseapp.com",
    projectId:         "linguawalk",
    storageBucket:     "linguawalk.firebasestorage.app",
    messagingSenderId: "558390764757",
    appId:             "1:558390764757:web:e6b26210045669dc686e5c"
  };

  // nav 버튼 반영 함수
  function applyNavUser(user) {
    var btn = document.querySelector('.nav-signin');
    if (!btn) return;

    // 로그인 상태
    if (user) {
      // 이름 표시 (최대 6자)
      var display = (user.name || user.email || '').substring(0, 6) || '내정보';
      btn.textContent = display;
      btn.classList.add('nav-signed-in');
      var dest = window.location.pathname.split('/').length > 2
        ? '../../mypage.html'   // 2depth 하위
        : (window.location.pathname.includes('/')
          ? '../mypage.html'    // 1depth 하위
          : 'mypage.html');     // 루트
      // 절대 경로로 통일
      btn.href = '/mypage.html';
    } else {
      // 비로그인 — 기본값 복원
      btn.classList.remove('nav-signed-in');
      btn.href = '/login.html';
    }
  }

  // localStorage 캐시로 즉시 반영 (Firebase 로딩 전)
  try {
    var cached = JSON.parse(localStorage.getItem('lw-user'));
    if (cached && cached.uid) applyNavUser(cached);
  } catch (e) {}

  // Firebase로 실시간 확인
  Promise.all([
    import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js')
  ]).then(function (mods) {
    var initializeApp  = mods[0].initializeApp;
    var getAuth        = mods[1].getAuth;
    var onAuthStateChanged = mods[1].onAuthStateChanged;

    var app  = initializeApp(FB_CONFIG, 'lw-auth-shared');
    var auth = getAuth(app);

    onAuthStateChanged(auth, function (fbUser) {
      if (fbUser) {
        var cached2 = null;
        try { cached2 = JSON.parse(localStorage.getItem('lw-user')); } catch(e) {}
        var user = cached2 && cached2.uid === fbUser.uid
          ? cached2
          : { uid: fbUser.uid, email: fbUser.email, name: fbUser.displayName || '', role: 'user', plan: 'free' };
        localStorage.setItem('lw-user', JSON.stringify(user));
        applyNavUser(user);
      } else {
        localStorage.removeItem('lw-user');
        applyNavUser(null);
      }
    });
  }).catch(function () {
    // Firebase 실패해도 캐시 기반 유지
  });
})();
