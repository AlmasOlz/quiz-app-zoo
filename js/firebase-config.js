// ================================================================
// FIREBASE CONFIGURATION
// ================================================================
// 1. Перейди на https://console.firebase.google.com
// 2. Создай новый проект (или используй существующий)
// 3. Добавь Web app: Project Settings → Your apps → </>
// 4. Скопируй config и замени значения ниже
// 5. Включи: Authentication → Email/Password
// 6. Включи: Firestore Database → Start in production mode
// ================================================================

const firebaseConfig = {
  apiKey: "AIzaSyDomDQIXjN5RmJ-0kW9U2VPmw7Z6FB9sz8",
  authDomain: "quizqpp-f88e6.firebaseapp.com",
  projectId: "quizqpp-f88e6",
  storageBucket: "quizqpp-f88e6.firebasestorage.app",
  messagingSenderId: "1060489682981",
  appId: "1:1060489682981:web:8ea5f0f685c570b9a59fcc",
  measurementId: "G-7RZ0SRHCV3"
};


firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// ================================================================
// FIRESTORE SECURITY RULES
// Вставь в Firebase Console → Firestore → Rules
// ================================================================
/*
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuth() { return request.auth != null; }
    function isAdmin() {
      return isAuth() &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    match /users/{uid} {
      allow read: if request.auth.uid == uid || isAdmin();
      allow create: if isAuth() && request.auth.uid == uid;
      allow update: if request.auth.uid == uid || isAdmin();
    }

    match /quizzes/{quizId} {
      allow read: if isAuth();
      allow write: if isAdmin();
      match /questions/{questionId} {
        allow read: if isAuth();
        allow write: if isAdmin();
      }
    }

    match /results/{resultId} {
      allow read: if isAuth() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuth() && request.resource.data.userId == request.auth.uid;
      allow update, delete: if isAdmin();
    }

    match /leaderboard/{entryId} {
      allow read: if isAuth();
      allow write: if isAuth();
    }

    match /groups/{groupId} {
      allow read: if isAuth() && (isAdmin() || resource.data.members.hasAny([request.auth.uid]));
      allow write: if isAdmin();
    }
  }
}
*/

// ================================================================
// ПЕРВЫЙ ADMIN — инструкция
// ================================================================
// 1. Зарегистрируйся как обычный пользователь
// 2. Firebase Console → Firestore → users → найди свой документ
// 3. Поменяй поле role: "user" → "admin"
// 4. Перезайди в систему → попадёшь в admin панель
// ================================================================
