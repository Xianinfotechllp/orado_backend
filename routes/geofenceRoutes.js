const express = require("express");
const router = express.Router();
const { createGeofence, getGeofences ,deleteGeofence} = require("../controllers/geofenceController");

router.post("/", createGeofence);
router.get("/",getGeofences);
router.delete("/:id", deleteGeofence);

module.exports = router;
