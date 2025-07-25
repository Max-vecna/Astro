nicknameInput.addEventListener("focus", () => {
  title.style.display = "none";
  rodape.style.display = "none";
  btnColor.style.display = "none";
});

nicknameInput.addEventListener("blur", () => {
  title.style.display = "block";
  rodape.style.display = "block";
  btnColor.style.display = "block";
});

joinCodeInput.addEventListener("focus", () => {
  title.style.display = "none";
  rodape.style.display = "none";
  btnColor.style.display = "none";
});

joinCodeInput.addEventListener("blur", () => {
  title.style.display = "block";
  rodape.style.display = "block";
  btnColor.style.display = "block";
});

function showConfirm(message = "Tem certeza?", callback) {
  const modal = document.getElementById("confirmModal");
  const msg = document.getElementById("confirmMessage");
  const btnYes = document.getElementById("confirmYes");
  const btnNo = document.getElementById("confirmNo");

  msg.textContent = message;
  modal.style.display = "flex";

  // Remover eventos antigos
  const cloneYes = btnYes.cloneNode(true);
  const cloneNo = btnNo.cloneNode(true);
  btnYes.parentNode.replaceChild(cloneYes, btnYes);
  btnNo.parentNode.replaceChild(cloneNo, btnNo);

  // Confirmar
  cloneYes.addEventListener("click", () => {
    modal.style.display = "none";
    callback(true);
  });

  // Cancelar
  cloneNo.addEventListener("click", () => {
    modal.style.display = "none";
    callback(false);
  });
}

function showAlert(message = "Alerta!", callback) {
  const modal = document.getElementById("alertModal");
  const msg = document.getElementById("alertMessage");
  const btnOk = document.getElementById("alertOk");

  msg.textContent = message;
  modal.style.display = "flex";

  const cloneOk = btnOk.cloneNode(true);
  btnOk.parentNode.replaceChild(cloneOk, btnOk);

  cloneOk.addEventListener("click", () => {
    modal.style.display = "none";
    if (callback) callback();
  });
}

function showExitNotification(user) {
  entryNotification.textContent = `${user} saiu`;
  entryNotification.style.display = "block";
  entryNotification.style.opacity = "1";
  setTimeout(() => {
    entryNotification.style.opacity = "0";
    setTimeout(() => {
      entryNotification.style.display = "none";
    }, 300);
  }, 3000);
}

function showEntryNotification(user) {
  entryNotification.textContent = `${user} entrou`;
  entryNotification.style.display = "block";
  entryNotification.style.opacity = "1";
  setTimeout(() => {
    entryNotification.style.opacity = "0";
    setTimeout(() => {
      entryNotification.style.display = "none";
    }, 300);
  }, 3000);
}