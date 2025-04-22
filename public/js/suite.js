// Exemplo: public/js/suite.js
const socket = io();
const localAudio = document.getElementById("localAudio");
const remoteAudio = document.getElementById("remoteAudio");

const pc = new RTCPeerConnection({
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
});

navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
  stream.getTracks().forEach((track) => pc.addTrack(track, stream));
  localAudio.srcObject = stream;
});

socket.emit("register", "suite1"); // ou recepcao, lavanderia, etc.

pc.ontrack = (event) => {
  remoteAudio.srcObject = event.streams[0];
};

pc.onicecandidate = (event) => {
  if (event.candidate) {
    socket.emit("signal", { to: target, data: { candidate: event.candidate } });
  }
};

socket.on("signal", async ({ from, data }) => {
  if (data.offer) {
    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit("signal", { to: from, data: { answer } });
  } else if (data.answer) {
    await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
  } else if (data.candidate) {
    await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
  }
});

// Quando for fazer uma chamada
async function startCall(to) {
  target = to;
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit("call", { to });
  socket.emit("signal", { to, data: { offer } });
}

// Encerrar chamada
function endCall() {
  socket.emit("end-call");
  pc.close();
}
