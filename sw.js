self.addEventListener("push", event => {
  const data = event.data?.json() || {};

  self.registration.showNotification(data.title || "Nova mensagem", {
    body: data.body || "",
    icon: "https://cdn-icons-png.flaticon.com/512/724/724715.png",
    badge: "https://cdn-icons-png.flaticon.com/512/724/724715.png",
    tag: "chat-msg"
  });
});
