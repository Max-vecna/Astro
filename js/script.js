var userColors = {};

let currentRoom = null;
let nickname = null;

let userIP = null;

async function fetchUserIP()
{
  // Verifica ou cria deviceId único
  if (!localStorage.getItem("userIP")) {
    userIP = crypto.randomUUID(); // Gera um UUID
    localStorage.setItem("userIP", userIP);
  } else {
    userIP = localStorage.getItem("userIP");
  }

}

const loginScreen = document.getElementById("loginScreen");
const btnColor = document.getElementById("btnColor");
const title = document.querySelector(".title");
const rodape = document.querySelector(".rodape");
const containerScree = document.querySelector(".container");

const chatScreen = document.getElementById("chatScreen");
const roomCodeDisplay = document.getElementById("roomCodeDisplay");
const messagesDiv = document.getElementById("messages");
const typingMessagesDiv = document.getElementById("typingMessages");
const messageInput = document.getElementById("messageInput");
typingMessagesDiv.classList.add("message", "other");

let messagesListener = null;
let typingListener = null;
let presenceRef = null;
let typingTimeout = null;
let currentUsers = {};

// Modal de entrada
const entryNotification = document.createElement("div");
entryNotification.id = "entry-notification";
entryNotification.classList.add("entryNotification");
document.body.appendChild(entryNotification);

function isNicknameTaken(roomCode, nick) {
  return db.ref(`conectados/${roomCode}/${nick}`).get().then(snapshot => snapshot.exists());
}

async function createRoom() {
  nickname = document.getElementById("nicknameInput").value.trim();
  if (!nickname) return showAlert("Por favor, digite seu apelido!");

  const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

  if (await isNicknameTaken(roomCode, nickname)) {
    showAlert("Este apelido já está em uso nesta sala, escolha outro.");
    return;
  }

  currentRoom = roomCode;
  localStorage.setItem("nickname", nickname);

  let createdRooms = JSON.parse(localStorage.getItem("createdRooms") || "[]");
  if (!createdRooms.includes(roomCode)) {
    createdRooms.push(roomCode);
    localStorage.setItem("createdRooms", JSON.stringify(createdRooms));
  }

  await db.ref("salas/" + roomCode).set({ createdAt: Date.now(), ultimaAtividade: Date.now(), creator: nickname });
  await fetchUserIP();

  joinRoom(roomCode);
}

async function enterRoom() {
  nickname = document.getElementById("nicknameInput").value.trim();
  const roomCode = document.getElementById("joinCodeInput").value.trim().toUpperCase();

  if (!nickname || !roomCode) return showAlert("Digite seu apelido e o código da sala!");

  const salaSnapshot = await db.ref("salas/" + roomCode).get();
  if (!salaSnapshot.exists()) return showAlert("Sala não encontrada!");

  if (await isNicknameTaken(roomCode, nickname)) {
    showAlert("Este apelido já está em uso nesta sala, escolha outro.");
    return;
  }

  currentRoom = roomCode;
  localStorage.setItem("nickname", nickname);

  await fetchUserIP();

  joinRoom(roomCode);
}

async function joinRoom(roomCode) {
  loginScreen.style.display = "none";
  btnColor.style.display = "none";
  title.style.display = "none";
  rodape.style.display = "none";

  chatScreen.style.display = "flex";
  containerScree.style.display = "block";
  roomCodeDisplay.textContent = roomCode;

  let recentRooms = JSON.parse(localStorage.getItem("lastRooms") || "[]");

  if (!recentRooms.includes(roomCode)) {
    recentRooms.unshift(roomCode);
    if (recentRooms.length > 10) recentRooms = recentRooms.slice(0, 10);
    localStorage.setItem("lastRooms", JSON.stringify(recentRooms));
  }

  messagesDiv.innerHTML = "";
  typingMessagesDiv.innerHTML = "";

  if (messagesListener) db.ref(`mensagens/${currentRoom}`).off("child_added", messagesListener);
  if (typingListener) db.ref(`digitandoMensagem/${currentRoom}`).off("value", typingListener);
  if (presenceRef) presenceRef.onDisconnect().cancel();

  currentRoom = roomCode;

  // Pega o background salvo para gerar cores contrastantes
  const bgColor = savedBg;

  // Busca usuários conectados e cria o mapa de cores
  const usersSnap = await db.ref(`conectados/${roomCode}`).once("value");
  const users = usersSnap.val() || {};
  userColors = {}; // limpa cores antigas

  // users é um objeto { nick1: {nick, ip}, nick2: {...}, ... }
  Object.keys(users).forEach(user => {
  if (user !== "usuário_fantasma") {
      const ip = users[user]?.ip || null;
      userColors[user] = atribuirCorAoUsuario(ip, bgColor);
    }
  });

  // Atualiza presença do usuário com objeto {nick, ip}
  presenceRef = db.ref(`conectados/${currentRoom}/${nickname}`);
  presenceRef.set({
    nick: nickname,
    ip: userIP
  });
  presenceRef.onDisconnect().remove();

  // Remove o usuário fantasma, se existir
  db.ref(`conectados/${roomCode}/usuário_fantasma`).remove();

  db.ref(`salas/${roomCode}`).on("value", snapshot => {
    if (!snapshot.exists()) {
      showAlert("A sala foi excluída.");
      leaveRoom();
    }
  });

  db.ref(`conectados/${currentRoom}`).on("child_removed", (snapshot) => {
    const user = snapshot.key;
    if (!nickname || !currentRoom) return;
    if (user !== nickname) {
      showExitNotification(user);
    }
  });

  db.ref(`conectados/${currentRoom}`).on("value", snapshot => {
    const usersObj = snapshot.val() || {};
    // usersObj: { nick1: {nick, ip}, nick2: {...} }
    const userKeys = Object.keys(usersObj).filter(u => u !== "usuário_fantasma");
    const userCount = userKeys.length;

    const countDisplay = document.getElementById("userCountDisplay");
    if (countDisplay) {
      countDisplay.textContent = `${userCount}`;
    }

    const leaveBtn = document.getElementById("leaveAloneBtn");
    if (leaveBtn) {
      leaveBtn.style.display = userCount === 1 ? "inline-block" : "none";
    }

    // Detecta novos usuários que ainda não estão em currentUsers
    const newUsers = userKeys.filter(user => !(user in currentUsers));
    newUsers.forEach(user => {
      if (user !== nickname) {
        userColors[user] = atribuirCorAoUsuario(bgColor);
        showEntryNotification(user);
      }
    });

    currentUsers = {};
    // Atualiza currentUsers com os dados atuais
    userKeys.forEach(user => currentUsers[user] = usersObj[user]);
  });

  let lastUser = null;

  messagesListener = db.ref(`mensagens/${currentRoom}`).orderByChild('timestamp').on("child_added", snapshot => {
  const msg = snapshot.val();

  if (!msg || !msg.text) return;
  if (msg.nick === "Sistema") return;

  const container = document.createElement("div");
  const seta = document.createElement("div");
  const isSelf = msg.ip === userIP;
  seta.classList.add(isSelf ? "setaSelf" : "setaOther");
  seta.style.background = "var(--background-color)";

  container.classList.add("message", isSelf ? "self" : "other");

  // Usa IP para pegar cor, se não existir cria
  if (!userColors[msg.ip]) userColors[msg.ip] = atribuirCorAoUsuario(msg.ip, bgColor);

  // Estilo do balão
  if (isSelf) {
    container.style.backgroundColor = "var(--background-color)";
    container.style.border = "1px solid var(--border-color)";
    container.style.boxShadow = "2px 2px var(--border-color)";
    seta.style.boxShadow = "2px 2px var(--border-color)";
  } else {
    container.style.border = "1px solid " + userColors[msg.ip];
    container.style.color = userColors[msg.ip];
    container.style.boxShadow = "-2px 2px " + userColors[msg.ip];
    seta.style.boxShadow = "-2px 2px " + userColors[msg.ip];
  }

  if (msg.ip !== lastUser) {
    const userNameDiv = document.createElement("div");
    userNameDiv.classList.add("message-user", isSelf ? "selff" : "otherr");
    userNameDiv.textContent = msg.nick;
    userNameDiv.style.color = isSelf ? "var(--border-color)" : userColors[msg.ip];
    userNameDiv.appendChild(seta);
    container.appendChild(userNameDiv);
    lastUser = msg.ip;
  } else {
    container.classList.add("plus");
  }

  const messageText = document.createElement("p");
  messageText.style.textAlign = isSelf ? "right" : "left";
  messageText.style.color = isSelf ? "var(--border-color)" : userColors[msg.ip];

  messageText.textContent = msg.text;
  messageText.classList.add("textBalao");
  container.appendChild(messageText);

  messagesDiv.appendChild(container);
  messagesDiv.appendChild(typingMessagesDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
});


  typingListener = db.ref(`digitandoMensagem/${currentRoom}`).on("value", snapshot => {
    const msgs = snapshot.val() || {};
    var userC;
    const othersTyping = Object.entries(msgs)
      .filter(([user, texto]) => user !== nickname && texto.trim() !== "")
      .map(([user, texto]) => {
        userC = user;
        const color = userColors[user];
        userColors[user] = color;
        return `<div class="message-user ${user === nickname ? "selff" : "otherr"}" style="color:${userColors[user]};margin:0; font-size: 12px; margin: 5px -10px; margin-top: -5px;">${user}</div>${texto}<span class="blinking-cursor"></span>`;
      });

    if (othersTyping.length > 0) {
      messagesDiv.appendChild(typingMessagesDiv);
      typingMessagesDiv.innerHTML = othersTyping.join("<br>");
      typingMessagesDiv.style.border = `1px dotted ${userColors[userC]}`;
      typingMessagesDiv.style.color = `${userColors[userC]}`;
      typingMessagesDiv.style.display = "block";
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    } else {
      typingMessagesDiv.style.display = "none";
    }
  });
}

async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || !currentRoom) return;

  db.ref(`salas/${currentRoom}/ultimaAtividade`).set(Date.now());
  db.ref(`digitandoMensagem/${currentRoom}/${nickname}`).remove();
  db.ref(`mensagens/${currentRoom}`).push({
    nick: nickname,
    ip: userIP,
    text: text,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  });

  messageInput.value = "";
}

messageInput.addEventListener("input", () => {
  if (!currentRoom || !nickname) return;
  const texto = messageInput.value;
  if (texto.trim() === "") {
    db.ref(`digitandoMensagem/${currentRoom}/${nickname}`).remove();
  } else {
    db.ref(`digitandoMensagem/${currentRoom}/${nickname}`).set(texto);
  }

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    db.ref(`digitandoMensagem/${currentRoom}/${nickname}`).remove();
  }, 3000);
});

function deleteRoom() {
  if (!currentRoom) return;
  showConfirm("Tem certeza que deseja excluir?", function(confirmado) {
    if (confirmado) {
      deleteRoomByCreator(currentRoom);
    }
  });
}

function deleteRoomByCreator(roomCode) {
  db.ref(`salas/${roomCode}`).remove();
  db.ref(`mensagens/${roomCode}`).remove();
  db.ref(`digitandoMensagem/${roomCode}`).remove();
  db.ref(`conectados/${roomCode}`).remove();

  if (currentRoom === roomCode) {
    leaveRoom();
  }

  showAlert(`Sala ${roomCode} excluída pelo criador.`);

  let createdRooms = JSON.parse(localStorage.getItem("createdRooms") || "[]");
  createdRooms = createdRooms.filter(r => r !== roomCode);
  localStorage.setItem("createdRooms", JSON.stringify(createdRooms));
}

function leaveRoom() {
  if (messagesListener) db.ref(`mensagens/${currentRoom}`).off("child_added", messagesListener);
  if (typingListener) db.ref(`digitandoMensagem/${currentRoom}`).off("value", typingListener);
  if (presenceRef) {
    presenceRef.remove();
    presenceRef.onDisconnect().cancel();
  }

  currentRoom = null;
  nickname = null;

  chatScreen.style.display = "none";
  containerScree.style.display = "flex";
  loginScreen.style.display = "block";
  btnColor.style.display = "block";
  rodape.style.display = "block";
  title.style.display = "block";

  messagesDiv.innerHTML = "";
  messagesDiv.appendChild(typingMessagesDiv);
  typingMessagesDiv.innerHTML = "";
  messageInput.value = "";
  document.getElementById("joinCodeInput").value = "";
}

function leaveRoomWithoutDeleting() {
  if (!nickname || !currentRoom) return;

  const userRef = db.ref(`conectados/${currentRoom}/${nickname}`);
  const roomUsersRef = db.ref(`conectados/${currentRoom}`);

  userRef.remove().then(async () => {
    const snapshot = await roomUsersRef.once("value");
    const remainingUsers = snapshot.val() || {};
    const otherUsers = Object.keys(remainingUsers).filter(user => user !== "usuário_fantasma");

    if (otherUsers.length === 0) {
      await roomUsersRef.child("usuário_fantasma").set({ placeholder: true });
    }

    db.ref(`conectados/${currentRoom}`).off();
    db.ref(`salas/${currentRoom}`).off();

    nickname = null;
    currentRoom = null;

    showScreen("loginScreen");
  });

  db.ref(`conectados/${currentRoom}`).off();
  db.ref(`salas/${currentRoom}`).off();

  nickname = null;
  currentRoom = null;

  showScreen("loginScreen");
}

function showScreen(screenId) {
  loginScreen.style.display = screenId === "loginScreen" ? "block" : "none";
  chatScreen.style.display = screenId === "chatScreen" ? "flex" : "none";
}

async function showLastRooms() {
  const list = document.getElementById("recentRoomsList");
  const modal = document.getElementById("recentRoomsModal");

  if (!list || !modal) return;

  let recentRooms = JSON.parse(localStorage.getItem("lastRooms") || "[]");
  list.innerHTML = "";

  if (recentRooms.length === 0) {
    list.innerHTML = "<li>Nenhuma sala recente</li>";
    modal.style.display = "flex";
    return;
  }

  const validRooms = [];
  var i = 0;
  for (const room of recentRooms) {
    const salaSnapshot = await db.ref(`salas/${room}`).get();
    if (salaSnapshot.exists()) {
      const usersSnap = await db.ref(`conectados/${room}`).get();
      const users = usersSnap.val() || {};
      const realUsers = Object.keys(users).filter(u => u !== "usuário_fantasma");

      validRooms.push(room);

      const li = document.createElement("li");
      var setaR = document.createElement("div");
      setaR.style.background = "var(--background-color)";

      // Estilo do balão
      if (i % 2 === 0) {
        li.style.backgroundColor = "var(--background-color)";
        li.style.border = "1px solid var(--border-color)";
        li.style.boxShadow = "2px 2px var(--border-color)";
        setaR.style.boxShadow = "2px 2px var(--border-color)";
        li.classList.add("message", "self");
        setaR.classList.add("setaSelf");
      } else {
        li.style.boxShadow = "-2px 2px var(--border-color)";
        setaR.style.boxShadow = "-2px 2px var(--border-color)";
        li.classList.add("message", "other");
        setaR.classList.add("setaOther");
      }
      li.style.marginRight = i % 2 === 0 ? "10px" : "";
      i++;

      const userCountSpan = document.createElement("span");
      userCountSpan.textContent = ` (${realUsers.length} on)`;
      userCountSpan.style.marginLeft = "8px";
      userCountSpan.style.fontSize = "12px";
      userCountSpan.style.color = "#aaa";

      li.textContent = `${room}`;
      li.style.cursor = "pointer";
      li.style.padding = "10px";
      li.onclick = () => {
        document.getElementById("joinCodeInput").value = room;
        modal.style.display = "none";
      };
      li.appendChild(userCountSpan);
      li.appendChild(setaR);
      list.appendChild(li);
    }
  }

  localStorage.setItem("lastRooms", JSON.stringify(validRooms));

  if (validRooms.length === 0) {
    list.innerHTML = "<li>Nenhuma sala recente</li>";
  }

  modal.style.display = "flex";
}

function closeRecentRooms() {
  const modal = document.getElementById("recentRoomsModal");
  if (modal) modal.style.display = "none";
}

async function showMyRooms() {
  const list = document.getElementById("myRoomsList");
  const modal = document.getElementById("myRoomsModal");

  list.innerHTML = "";
  let createdRooms = JSON.parse(localStorage.getItem("createdRooms") || "[]");

  if (createdRooms.length === 0) {
    list.innerHTML = "<li>Você não criou nenhuma sala.</li>";
    modal.style.display = "flex";
    return;
  }

  var i = 0;
  for (const roomCode of createdRooms) {
    const salaSnap = await db.ref(`salas/${roomCode}`).get();
    if (salaSnap.exists()) {
      const usersSnap = await db.ref(`conectados/${roomCode}`).get();
      const users = usersSnap.val() || {};
      const realUsers = Object.keys(users).filter(u => u !== "usuário_fantasma");

      const div = document.createElement("div");
      div.style.display = "flex";

      const li = document.createElement("li");
      const seta = document.createElement("div");
      seta.style.background = "var(--background-color)";
      li.appendChild(seta);

        // Estilo do balão
      if (i % 2 === 0) {
        li.style.backgroundColor = "var(--background-color)";
        li.style.border = "1px solid var(--border-color)";
        li.style.boxShadow ="2px 2px var(--border-color)";
        seta.style.boxShadow ="2px 2px var(--border-color)";
        li.classList.add("message", "self" );
          
        seta.classList.add("setaSelf");
      } else {
        
        li.style.boxShadow ="-2px 2px var(--border-color)" ;
        seta.style.boxShadow ="-2px 2px var(--border-color)" ;
        li.classList.add("message", "other");
          
        seta.classList.add("setaOther");
      }

      li.style.marginRight = i % 2 === 0 ? "10px" : "";
      i++;

      const divSala = document.createElement("div");
      divSala.textContent = roomCode;

      const userCountSpan = document.createElement("span");
      userCountSpan.textContent = ` (${realUsers.length} on)`;
      userCountSpan.style.marginLeft = "8px";
      userCountSpan.style.fontSize = "12px";
      userCountSpan.style.color = "#aaa";
      divSala.appendChild(userCountSpan);

      li.c = roomCode;
      li.appendChild(divSala);

      const enterBtn = document.createElement("button");
      enterBtn.textContent = "Entrar";
      enterBtn.style.border = "0";
      enterBtn.style.margin = "5px 5px 0px 0";
      enterBtn.style.marginLeft = "-10px";

      enterBtn.onclick = () => {
        document.getElementById("joinCodeInput").value = roomCode;
        modal.style.display = "none";
        enterRoom();
      };
      div.appendChild(enterBtn);

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Excluir";
      deleteBtn.style.border = "0";
      deleteBtn.style.margin = "5px 0 0px 5px";
      deleteBtn.style.marginRight = "-10px";

      deleteBtn.onclick = () => {
        showConfirm(`Deseja excluir a sala ${roomCode}?`, function(confirmado) {
          if (confirmado) {
            deleteRoomByCreator(roomCode);
            createdRooms = createdRooms.filter(r => r !== roomCode);
            localStorage.setItem("createdRooms", JSON.stringify(createdRooms));
            li.remove();
          }
        });
      };
      div.appendChild(deleteBtn);

      divSala.onclick = () => {
        navigator.clipboard.writeText(roomCode)
          .then(() => {
            showAlert("Código da sala copiado!");
          })
          .catch(() => alert("Erro ao copiar código!"));
      };
      li.appendChild(div);
      list.appendChild(li);
    } else {
      createdRooms = createdRooms.filter(r => r !== roomCode);
      localStorage.setItem("createdRooms", JSON.stringify(createdRooms));
    }
  }

  modal.style.display = "flex";
}

function closeMyRooms() {
  const modal = document.getElementById("myRoomsModal");
  if (modal) modal.style.display = "none";
}

function showAlert(message) {
  alert(message);
}

function showConfirm(message, callback) {
  const confirmed = confirm(message);
  callback(confirmed);
}

function atribuirCorAoUsuario(bgColor) {
  // Gere uma cor pastel ou uma cor contrastante aleatória
  // Aqui, exemplo simples: gera uma cor aleatória pastel
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 70%, 70%)`;
}

function showEntryNotification(user) {
  entryNotification.textContent = `${user} entrou na sala`;
  entryNotification.style.opacity = 1;
  setTimeout(() => {
    entryNotification.style.opacity = 0;
  }, 2500);
}

function showExitNotification(user) {
  entryNotification.textContent = `${user} saiu da sala`;
  entryNotification.style.opacity = 1;
  setTimeout(() => {
    entryNotification.style.opacity = 0;
  }, 2500);
}

// Inicialização
fetchUserIP();

// Eventos dos botões
document.getElementById("createRoomBtn").onclick = createRoom;
document.getElementById("enterRoomBtn").onclick = enterRoom;
document.getElementById("sendMessageBtn").onclick = sendMessage;
document.getElementById("leaveRoomBtn").onclick = leaveRoomWithoutDeleting;
document.getElementById("showLastRoomsBtn").onclick = showLastRooms;
document.getElementById("closeRecentRooms").onclick = closeRecentRooms;
document.getElementById("showMyRoomsBtn").onclick = showMyRooms;
document.getElementById("closeMyRoomsBtn").onclick = closeMyRooms;

// Aqui você pode colocar sua configuração do Firebase
// Certifique-se de importar e configurar o Firebase antes

