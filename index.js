const express = require("express");
const dotenv = require("dotenv");
const socketIo = require('socket.io')
const app = express();
const http = require("http");
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*" }
});

// Attach io to app

io.on("connection", (socket) => {
  console.log("New client connected: " + socket.id);

  socket.on("join-restaurant", (restaurantId) => {
    socket.join(restaurantId);
    console.log(`Socket ${socket.id} joined restaurant ${restaurantId}`);
  });
});
app.set("io", io);



const db = require("./config/dbConfig");
const userRouter = require("./routes/userRoutes");

const productRouter = require("./routes/productRoutesRoutes");

const resturantRouter = require("./routes/restaurantRoutes"); 
const locationRouter = require("./routes/locationRoutes")


const agentRouter = require("./routes/agentRoutes")
const offerRouter = require("./routes/offerRoutes"); 

const orderRouter = require("./routes/orderRoutes");

const couponRoutes = require("./routes/couponRoutes"); 



dotenv.config();
db()
  


app.use(express.json());

// routes using
app.use("/user", userRouter);
app.use("/restaurants",productRouter);
app.use("/restaurants",resturantRouter)
app.use("/restaurants",offerRouter)
app.use("/order",orderRouter)
app.use("/coupon",couponRoutes)



app.use("/resturants",resturantRouter)
app.use("/location",locationRouter)
app.use("/agent",agentRouter)



app.get("/", (req, res) => {
  res.send("API is running 🚀");
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
