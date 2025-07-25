const startCallBtn = document.getElementById("startCallBtn");
const hangupBtn = document.getElementById("hangupBtn");
const localAudio = document.getElementById("localAudio");
const remoteAudio = document.getElementById("remoteAudio");

let localStream = null;
let peerConnection = null;
const roomId = "minhaSalaExemplo"; // você pode gerar dinamicamente ou pegar do usuário

// Referências para sinalização no Firebase
const roomRef = db.ref("webrtc/rooms/" + roomId);
const offerCandidatesRef = roomRef.child("offerCandidates");
const answerCandidatesRef = roomRef.child("answerCandidates");

startCallBtn.onclick = async () => {
  startCallBtn.disabled = true;

  // 1. Pega o áudio do microfone
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  localAudio.srcObject = localStream;

  // 2. Cria peerConnection
  peerConnection = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  // 3. Adiciona stream local
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  // 4. Escuta stream remota e mostra no remoteAudio
  peerConnection.ontrack = (event) => {
    if (remoteAudio.srcObject !== event.streams[0]) {
      remoteAudio.srcObject = event.streams[0];
      console.log("Recebendo stream remota");
    }
  };

  // 5. ICE candidates do lado Offer (quem cria a sala)
  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      offerCandidatesRef.push(event.candidate.toJSON());
    }
  };

  // 6. Cria offer SDP
  const offerDescription = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offerDescription);

  // 7. Salva offer no Firebase
await roomRef.child("offer").set(JSON.parse(JSON.stringify(offerDescription)));


  // 8. Escuta answer no Firebase
  roomRef.child("answer").on("value", async snapshot => {
    const answer = snapshot.val();
    if (answer && !peerConnection.currentRemoteDescription) {
      const rtcAnswer = new RTCSessionDescription(answer);
      await peerConnection.setRemoteDescription(rtcAnswer);
    }
  });

  // 9. Escuta candidates da resposta
  answerCandidatesRef.on("child_added", snapshot => {
    const candidate = new RTCIceCandidate(snapshot.val());
    peerConnection.addIceCandidate(candidate);
  });

  hangupBtn.disabled = false;
};

hangupBtn.onclick = async () => {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  roomRef.remove();

  hangupBtn.disabled = true;
  startCallBtn.disabled = false;

  localAudio.srcObject = null;
  remoteAudio.srcObject = null;
};

async function joinCall() {
  const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  localAudio.srcObject = localStream;

  const peerConnection = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = event => {
    if (remoteAudio.srcObject !== event.streams[0]) {
      remoteAudio.srcObject = event.streams[0];
      console.log("Recebendo stream remota");
    }
  };

  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      answerCandidatesRef.push(event.candidate.toJSON());
    }
  };

  // Pega offer do Firebase
  const offerSnapshot = await roomRef.child("offer").get();
  const offer = offerSnapshot.val();

  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

  // Cria answer SDP e envia pro Firebase
  const answerDescription = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answerDescription);
  await roomRef.child("answer").set(answerDescription.toJSON());

  // Escuta candidates do offer
  offerCandidatesRef.on("child_added", snapshot => {
    const candidate = new RTCIceCandidate(snapshot.val());
    peerConnection.addIceCandidate(candidate);
  });

  hangupBtn.disabled = false;
  startCallBtn.disabled = true;
}
