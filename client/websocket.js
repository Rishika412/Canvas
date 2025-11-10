window.socket = io();

// ------------------------------
// Connection Events
// ------------------------------

socket.on("connect", () => {
  console.log(`✅ Connected to server with ID: ${socket.id}`);
});

// Assign your user ID when connected
socket.on("user:assigned", (data) => {
  window.myUserId = data.userId;
  console.log(`🆔 Your user ID: ${data.userId}`);
});

// Notify when a new user joins
socket.on("user:joined", (data) => {
  console.log(`👋 User joined: ${data.userId}`);
});

// Notify when a user leaves
socket.on("user:left", (data) => {
  console.log(`🚪 User left: ${data.userId}`);
});

// ------------------------------
// Connection Errors & Recovery
// ------------------------------
socket.on("connect_error", (err) => {
  console.error("❌ Connection error:", err.message);
});

socket.on("disconnect", (reason) => {
  console.warn(`⚠️ Disconnected: ${reason}`);
});

socket.on("reconnect", (attempt) => {
  console.log(`🔁 Reconnected after ${attempt} attempt(s)`);
});