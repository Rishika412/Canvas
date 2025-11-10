// =============================
// 🎨 Collaborative Canvas Logic
// =============================

const canvas = document.getElementById("drawing-board");
const ctx = canvas.getContext("2d");

let drawing = false;
let color = document.getElementById("colorPicker").value;
let brushSize = document.getElementById("brushSize").value;
let isEraser = false;
let currentStroke = [];
let strokes = [];

// ------------------------------
// Brush & UI Controls
// ------------------------------
document.getElementById("colorPicker").addEventListener("input", (e) => {
  color = e.target.value;
});

document.getElementById("brushSize").addEventListener("input", (e) => {
  brushSize = e.target.value;
});

const eraserBtn = document.getElementById("eraserBtn");
eraserBtn.addEventListener("click", () => {
  isEraser = !isEraser;
  eraserBtn.classList.toggle("active");
  document.getElementById("colorPicker").disabled = isEraser;
});

const clearAllBtn = document.getElementById("clearAllBtn");
clearAllBtn.addEventListener("click", () => {
  if (!confirm("Clear entire canvas for everyone?")) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  socket.emit("clear:all", { userId: socket.id });
});

const undoBtn = document.getElementById("undoBtn");
undoBtn.addEventListener("click", () => {
  // ↩️ Send GLOBAL UNDO command
  socket.emit("undo");
});

const redoBtn = document.getElementById("redoBtn");
redoBtn.addEventListener("click", () => {
  // ↪️ Send GLOBAL REDO command
  socket.emit("redo");
});

// ------------------------------
// Drawing Events (Stroke-Based)
// ------------------------------
canvas.addEventListener("pointerdown", (e) => {
  drawing = true;
  canvas.setPointerCapture(e.pointerId);

  currentStroke = [{ x: e.offsetX, y: e.offsetY }];

  // 🔹 Emit draw:start for others to see live
  socket.emit("draw:start", {
    userId: socket.id,
    color,
    width: brushSize,
    x: e.offsetX,
    y: e.offsetY,
    isEraser,
  });
});

canvas.addEventListener("pointermove", (e) => {
  const x = e.offsetX;
  const y = e.offsetY;

  // Always emit cursor position
  socket.emit("cursor:move", { userId: socket.id, x, y, color });

  if (!drawing) return;

  const lastPoint = currentStroke[currentStroke.length - 1];
  if (!lastPoint) return;

  // --- ISOLATE DRAWING SEGMENT ---
  ctx.save();

  ctx.lineWidth = brushSize;
  ctx.lineCap = "round";

  if (isEraser) {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = color;
  }

  // Draw the segment atomically
  ctx.beginPath();
  ctx.moveTo(lastPoint.x, lastPoint.y);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.closePath();

  ctx.restore();

  // Record points for stroke replay
  currentStroke.push({ x, y });

  socket.emit("draw:move", {
    userId: socket.id,
    color,
    width: brushSize,
    x,
    y,
    isEraser,
  });
});

canvas.addEventListener("pointerup", () => {
  if (!drawing) return;
  drawing = false;

  ctx.globalCompositeOperation = "source-over";

  // Build and send completed stroke
  const stroke = {
    id: crypto.randomUUID(),
    userId: socket.id,
    color,
    width: brushSize,
    points: currentStroke,
    isEraser,
    timestamp: Date.now(),
  };

  // Add locally & emit
  strokes.push(stroke);
  socket.emit("stroke:commit", stroke);

  currentStroke = [];
  socket.emit("draw:end", { userId: socket.id });
});

canvas.addEventListener("pointerleave", (e) => {
  if (e.buttons === 1) return; // if still holding mouse, don’t stop
  drawing = false;
  ctx.globalCompositeOperation = "source-over";
});

// ------------------------------
// Redraw Utilities
// ------------------------------
function redrawCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const stroke of strokes) drawStroke(stroke);
}

function drawStroke(stroke) {
  const { color, width, points, isEraser } = stroke;
  if (!points || points.length < 2) return;

  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.globalCompositeOperation = isEraser ? "destination-out" : "source-over";
  ctx.strokeStyle = color;

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
  ctx.globalCompositeOperation = "source-over";
}

// ------------------------------
// Socket Events (Sync)
// ------------------------------

// Clear
socket.on("clear:all", (data) => {
  console.log(`🧹 Canvas cleared by ${data.userId}`);
  strokes = [];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

// Initial full state
socket.on("state:init", (serverStrokes) => {
  strokes = serverStrokes;
  redrawCanvas();
});

// On undo, redo, or global state change
socket.on("state:update", (serverStrokes) => {
  strokes = serverStrokes;
  redrawCanvas();
});

// When a user finishes a stroke
socket.on("stroke:commit", (stroke) => {
  strokes.push(stroke);
  drawStroke(stroke);
});

// ------------------------------
// Cursor Overlay (Remote Users)
// ------------------------------
const cursorCanvas = document.getElementById("cursor-layer");
const cursorCtx = cursorCanvas.getContext("2d");
const cursors = {};

socket.on("cursor:move", (data) => {
  cursors[data.userId] = {
    x: data.x,
    y: data.y,
    color: data.color,
    lastSeen: Date.now(),
  };
});

function drawCursors() {
  cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
  const now = Date.now();

  Object.entries(cursors).forEach(([id, cursor]) => {
    if (id === socket.id) return;
    if (now - cursor.lastSeen > 2000) return;

    const text = id.slice(0, 6);
    cursorCtx.beginPath();
    cursorCtx.arc(cursor.x, cursor.y, 5, 0, 2 * Math.PI);
    cursorCtx.fillStyle = cursor.color + "88";
    cursorCtx.fill();

    cursorCtx.font = "12px sans-serif";
    const textWidth = cursorCtx.measureText(text).width;

    const boxX = cursor.x + 12;
    const boxY = cursor.y - 12;
    const boxWidth = textWidth + 8;
    const boxHeight = 16;

    cursorCtx.fillStyle = "rgba(255,255,255,0.8)";
    cursorCtx.beginPath();
    cursorCtx.roundRect(boxX, boxY, boxWidth, boxHeight, 4);
    cursorCtx.fill();

    cursorCtx.fillStyle = "#000";
    cursorCtx.fillText(text, boxX + 4, boxY + 12);
  });
}

function renderLoop() {
  requestAnimationFrame(renderLoop);
  drawCursors();
}
renderLoop();

const remotePaths = Object.create(null); // per-user temp state

socket.on("draw:start", (data) => {
  // Just remember the first point — do NOT call any ctx functions here.
  remotePaths[data.userId] = {
    lastX: data.x,
    lastY: data.y,
    color: data.color,
    width: data.width,
    isEraser: !!data.isEraser,
  };
});

socket.on("draw:move", (data) => {
  const path = remotePaths[data.userId];
  if (!path) return; // ignore if user didn't send start first

  // --- isolate this user's draw state completely ---
  ctx.save();

  ctx.lineWidth = path.width;
  ctx.lineCap = "round";
  ctx.globalCompositeOperation = path.isEraser
    ? "destination-out"
    : "source-over";
  ctx.strokeStyle = path.color;

  // open a *fresh path* for this segment only
  ctx.beginPath();
  ctx.moveTo(path.lastX, path.lastY);
  ctx.lineTo(data.x, data.y);
  ctx.stroke();
  ctx.closePath();

  ctx.restore();
  // -------------------------------------------------

  // update this user's last point for next segment
  path.lastX = data.x;
  path.lastY = data.y;
});

socket.on("draw:end", (data) => {
  delete remotePaths[data.userId];
});
