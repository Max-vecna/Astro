// ✅ SUBSTITUA pelos dados do seu Firebase:
const firebaseConfig = {
  apiKey: "AIzaSyAxb2s4tzbtD1arG9UAf7UrzhFqbRrrsl8",
  authDomain: "astro-642b6.firebaseapp.com",
  projectId: "astro-642b6",
  storageBucket: "astro-642b6.firebasestorage.app",
  messagingSenderId: "141832763492",
  appId: "1:141832763492:web:c8f6a529849bab54ee8771"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

window.addEventListener("load", () => {
  const savedNick = localStorage.getItem("nickname");
  if (savedNick) {
    document.getElementById("nicknameInput").value = savedNick;
  }
});