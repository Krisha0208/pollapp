require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

/* =========================
   MongoDB Connection
========================= */

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected ✅"))
  .catch((err) => console.log("MongoDB Error:", err));

/* =========================
   Poll Schema
========================= */

const pollSchema = new mongoose.Schema({
  pollId: { type: String, required: true },
  question: { type: String, required: true },
  options: {
    yes: { type: Number, default: 0 },
    no: { type: Number, default: 0 }
  },
  voters: {
    type: [String],
    default: []
  }
});

const Poll = mongoose.model("Poll", pollSchema);

/* =========================
   Create Poll
========================= */

app.post("/create", async (req, res) => {
  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({ message: "Question required" });
    }

    const newPoll = new Poll({
      pollId: uuidv4(),
      question,
      options: { yes: 0, no: 0 },
      voters: []
    });

    await newPoll.save();

    res.json({ pollId: newPoll.pollId });

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================
   Get Poll
========================= */

app.get("/poll/:id", async (req, res) => {
  try {
    const poll = await Poll.findOne({ pollId: req.params.id });

    if (!poll) {
      return res.status(404).json({ message: "Poll not found" });
    }

    res.json(poll);

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================
   Vote
========================= */

app.post("/vote", async (req, res) => {
  try {
    const { pollId, option, voterId } = req.body;

    const poll = await Poll.findOne({ pollId });

    if (!poll) {
      return res.status(404).json({ message: "Poll not found" });
    }

    if (poll.voters.includes(voterId)) {
      return res.status(400).json({ message: "Already voted" });
    }

    if (option !== "yes" && option !== "no") {
      return res.status(400).json({ message: "Invalid option" });
    }

    poll.options[option] += 1;
    poll.voters.push(voterId);

    await poll.save();

    // 🔥 Real-time update
    io.emit("voteUpdate", {
      pollId: poll.pollId,
      options: poll.options
    });

    res.json({ message: "Vote counted" });

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================
   Socket Connection
========================= */

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);
});

/* =========================
   Start Server
========================= */

server.listen(3000, () => {
  console.log("Server running on port 3000 🚀");
});