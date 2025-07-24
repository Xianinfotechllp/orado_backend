const express = require("express");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const cors = require('cors');
const socketIo = require("socket.io");
const http = require("http"); // Added missing http import

dotenv.config();

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

const io = socketIo(server, {
  cors: {
    origin: (origin, callback) => {
      console.log("Socket.IO CORS request from:", origin);
      callback(null, origin); // Echo back the request origin
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true
  }
});

// Attach io to app so it can be used in controllers
app.set("io", io);

app.use((req, res, next) => {
  req.io = io;
  next();
});

// Socket.io Connection Handler
io.on("connection", (socket) => {
  console.log("New client connected: " + socket.id);

  // Add your socket event handlers here
  socket.on("disconnect", () => {
    console.log("Client disconnected: " + socket.id);
  });
});

// Routes
const userRouter = require("./routes/userRoutes");
const productRouter = require("./routes/productRoutesRoutes");
const resturantRouter = require("./routes/restaurantRoutes");
const locationRouter = require("./routes/locationRoutes");
const agentRouter = require("./routes/agentRoutes");
const offerRouter = require("./routes/offerRoutes");
const orderRouter = require("./routes/orderRoutes");
const couponRoutes = require("./routes/couponRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const cartRoutes = require("./routes/cartRoutes");

app.use("/user", userRouter);
app.use("/restaurants", productRouter);
app.use("/restaurants", resturantRouter);
app.use("/restaurants", offerRouter);
app.use("/order", orderRouter);
app.use("/coupon", couponRoutes);
app.use("/location", locationRouter);
app.use("/agent", agentRouter);
app.use("/feedback", feedbackRoutes);
app.use("/cart", cartRoutes);

// Dummy test route
const dummyCategories = [
  {
    categoryName: "Fruits",
    categoryId: 1,
    categoryimagerelation: {
      imageName: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTjhcvIlF6I8UzQly7Qzkh2vAHtSGwbgq_XPg&s"
    },
    categoryrelation1: [
      {
        subCategoryId: 101,
        subcategoryName: "Apples",
        subcategoryImagerelation: {
          imageName: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSW-oteAACfNN68JU4E2egKJeaMrL8kdUQuuA&s"
        }
      },
      {
        subCategoryId: 102,
        subcategoryName: "Bananas",
        subcategoryImagerelation: {
          imageName: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT-E3j6WhT2uOrCGqZABI_m8E4fCXNMYdXhmA&s"
        }
      }
    ]
  },
  {
    categoryName: "Vegetables",
    categoryId: 2,
    categoryimagerelation: {
      imageName: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSNULJ6YE0WsLqqBUs3ozHh6rkZDFAJlXzlFw&s"
    },
    categoryrelation1: [
      {
        subCategoryId: 201,
        subcategoryName: "Tomatoes",
        subcategoryImagerelation: {
          imageName: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSsTnN1VYHPxQDMCDKBZWs2mKGXT2bO9arKYfO3g9LjMvjLiuCoVNuCeEA&s"
        }
      },
      {
        subCategoryId: 202,
        subcategoryName: "Spinach",
        subcategoryImagerelation: {
          imageName: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSsTnN1VYHPxQDMCDKBZWs2mKGXT2bO9arKYfO3g9LjMvjLiuCoVNuCeEA&s"
        }
      }
    ]
  }
];

app.get("/", (req, res) => {
  res.send("API is running 🚀");
});

app.get("/test/categories", (req, res) => {
  res.status(200).json(dummyCategories);
});

// Connect to DB and start server
const PORT = process.env.PORT || 5000;
mongoose
  .connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 15000,
  })
  .then(() => {
    console.log("✅ MongoDB connected");
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err);
  });