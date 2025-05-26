const express = require("express");
const dotenv = require("dotenv");
const socketIo = require('socket.io')
const app = express();
const http = require("http");
const server = http.createServer(app);
const cors = require('cors');


const io = socketIo(server, {
  cors: { origin: "*" }
});

// Attach io to app

io.on("connection", (socket) => {
  console.log("New client connected: " + socket.id);

  // Restaurant joins their room by restaurantId
  socket.on("join-restaurant", (restaurantId) => {
    if (mongoose.Types.ObjectId.isValid(restaurantId)) {
      socket.join(restaurantId);
      console.log(`Socket ${socket.id} joined restaurant room: ${restaurantId}`);
    } else {
      console.log(`Invalid restaurantId ${restaurantId} from socket ${socket.id}`);
    }
  });

  // User joins their personal room by userId
  socket.on("join-user", (userId) => {
    if (mongoose.Types.ObjectId.isValid(userId)) {
      socket.join(userId);
      console.log(`Socket ${socket.id} joined user room: ${userId}`);
    } else {
      console.log(`Invalid userId ${userId} from socket ${socket.id}`);
    }
  });

  // Driver joins their personal room by driverId
  socket.on("join-driver", (driverId) => {
    if (mongoose.Types.ObjectId.isValid(driverId)) {
      socket.join(driverId);
      console.log(`Socket ${socket.id} joined driver room: ${driverId}`);
    } else {
      console.log(`Invalid driverId ${driverId} from socket ${socket.id}`);
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected: " + socket.id);
  });
});

// Attach io instance to app so controllers can access it
app.set("io", io);



const db = require("./config/dbConfig");
// router imports
const userRouter = require("./routes/userRoutes");
const productRouter = require("./routes/productRoutesRoutes");
const resturantRouter = require("./routes/restaurantRoutes"); 
const locationRouter = require("./routes/locationRoutes")
const agentRouter = require("./routes/agentRoutes")
const offerRouter = require("./routes/offerRoutes"); 
const orderRouter = require("./routes/orderRoutes");
const couponRoutes = require("./routes/couponRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes"); 
const cartRoutes = require("./routes/cartRoutes"); 

const chatRouter  = require("./routes/chatRoutes")
const faqRouter  = require("./routes/faqRoutes")

const adninRouter = require("./routes/adminRoutes");

const ticketRouter = require("./routes/ticketRoutes");


dotenv.config();
db()
  


app.use(express.json());
app.use(cors());

// routes using
app.use("/admin", adninRouter);

app.use("/user", userRouter);
app.use("/restaurants",productRouter);
app.use("/restaurants",resturantRouter)
app.use("/restaurants",offerRouter)
app.use("/order",orderRouter)
app.use("/coupon",couponRoutes)
app.use("/chat",chatRouter)




app.use("/location",locationRouter)
app.use("/agent",agentRouter)
app.use("/feedback",feedbackRoutes)
app.use("/cart",cartRoutes)
app.use("/faq",faqRouter)
app.use("/ticket",ticketRouter)



app.get("/", (req, res) => {
  res.send("API is running 🚀");
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

