const fs = require("fs");
const https = require("https");
const express = require("express");
const path = require("path");
const { Server } = require("socket.io");

const app = express();

// Certificados SSL (Let’s Encrypt)
const server = https.createServer({
  key: fs.readFileSync("/etc/letsencrypt/live/jobsconnect.com.br/privkey.pem"),
  cert: fs.readFileSync("/etc/letsencrypt/live/jobsconnect.com.br/fullchain.pem"),
}, app);

// WebSocket com HTTPS
const io = new Server(server);

// View engine + arquivos públicos
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

// Rotas
app.get("/", (req, res) => res.render("reception"));
app.get("/suite/:id", (req, res) => res.render("suite", { id: req.params.id }));
app.get("/lavanderia", (req, res) => res.render("lavanderia"));
app.get("/restaurante", (req, res) => res.render("restaurante"));

// Armazenamento de sockets
const clients = {
  reception: null,
  lavanderia: null,
  restaurante: null,
  suites: {}
};

const activeCalls = {}; // Ex: { suite1: 'reception' }

io.on("connection", (socket) => {
  console.log("✅ Novo socket conectado");

  socket.on("register", (role) => {
    socket.role = role;

    if (role === "reception") clients.reception = socket;
    else if (role === "lavanderia") clients.lavanderia = socket;
    else if (role === "restaurante") clients.restaurante = socket;
    else if (role.startsWith("suite")) clients.suites[role] = socket;

    console.log(`🔗 Registrado: ${role}`);
  });

  socket.on("call", ({ to }) => {
    const from = socket.role;
    const targetSocket = getSocket(to);

    if (activeCalls[from] || activeCalls[to]) {
      socket.emit("signal", { to, data: { busy: true } });
      return;
    }

    if (targetSocket) {
      activeCalls[from] = to;
      activeCalls[to] = from;
      targetSocket.emit("call", { from });
    }
  });

  socket.on("signal", ({ to, data }) => {
    const targetSocket = getSocket(to);
    if (targetSocket) {
      targetSocket.emit("signal", { from: socket.role, data });
    }
  });

  socket.on("end-call", () => {
    const peer = activeCalls[socket.role];
    if (peer) {
      const targetSocket = getSocket(peer);
      if (targetSocket) targetSocket.emit("end-call");
      delete activeCalls[socket.role];
      delete activeCalls[peer];
    }
  });

  socket.on("disconnect", () => {
    console.log(`❌ Desconectado: ${socket.role}`);

    if (socket.role?.startsWith("suite")) delete clients.suites[socket.role];
    else if (socket.role) clients[socket.role] = null;

    const peer = activeCalls[socket.role];
    if (peer) {
      const targetSocket = getSocket(peer);
      if (targetSocket) targetSocket.emit("end-call");
      delete activeCalls[socket.role];
      delete activeCalls[peer];
    }
  });
});

function getSocket(role) {
  if (role === "reception") return clients.reception;
  if (role === "lavanderia") return clients.lavanderia;
  if (role === "restaurante") return clients.restaurante;
  return clients.suites[role];
}

// HTTPS na porta 5000
server.listen(5000, () => {
  console.log("🚀 Servidor HTTPS rodando em https://jobsconnect.com.br:5000");
});
