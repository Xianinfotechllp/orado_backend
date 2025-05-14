const express = require("express");
const dotenv = require("dotenv");
const db = require("./config/dbConfig");
const userRouter = require("./routes/userRoutes");

const productRouter = require("./routes/productRoutesRoutes");

const resturantRouter = require("./routes/restaurantRoutes"); 

const offerRouter = require("./routes/offerRoutes"); 

dotenv.config();
db()
  
const app = express();

app.use(express.json());

// routes using
app.use("/user", userRouter);
app.use("/restaurants",productRouter);
app.use("/restaurants",resturantRouter)
app.use("/restaurants",offerRouter)


app.get("/", (req, res) => {
  res.send("API is running 🚀");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
