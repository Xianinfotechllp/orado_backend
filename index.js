const express = require("express");
const dotenv = require("dotenv");
const db = require("./config/dbConfig");
const userRouter = require("./routes/userRoutes");

const productRouter = require("./routes/productRoutesRoutes");

const resturantRouter = require("./routes/restaurantRoutes"); 
const locationRouter = require("./routes/locationRoutes")

const agentRouter = require("./routes/agentRoutes")
dotenv.config();
db()
  
const app = express();

app.use(express.json());

// routes using
app.use("/user", userRouter);

app.use("/restaurants",productRouter);

app.use("/resturants",resturantRouter)
app.use("/location",locationRouter)
app.use("/agent",agentRouter)


app.get("/", (req, res) => {
  res.send("API is running 🚀");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
