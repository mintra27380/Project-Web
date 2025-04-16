import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import axios from 'axios';
import cors from 'cors';

const app = express();

const DRONE_CONFIG_SERVER = "https://script.google.com/macros/s/AKfycbzwclqJRodyVjzYyY-NTQDb9cWG6Hoc5vGAABVtr5-jPA_ET_2IasrAJK4aeo5XoONiaA/exec";
const DRONE_LOG_SERVER = "https://app-tracking.pockethost.io/api/collections/drone_logs/records";

app.use(cors());
app.use(express.json());

app.get('/api/hello', (req, res) => {
  res.json({ name: 'John Doe' });
});


async function fetchDroneData(droneId) {
  try {
    const response = await axios.get(`${DRONE_CONFIG_SERVER}?id=${droneId}`);
    if (!response.data || !response.data.data) return null;
    return response.data.data.find(drone => drone.drone_id == droneId);
  } catch (error) {
    console.error("Fetch drone error:", error.message);
    return null;
  }
}

// GET /configs/:droneId
app.get("/configs/:droneId", async (req, res) => {
  const { droneId } = req.params;
  const droneConfig = await fetchDroneData(droneId);

  if (!droneConfig) {
    return res.status(404).json({ error: "Drone config not found" });
  }

  const { drone_id, drone_name, light, country, weight } = droneConfig;
  res.json({ drone_id, drone_name, light, country, weight });
});

// GET /status/:droneId
app.get("/status/:droneId", async (req, res) => {
  const { droneId } = req.params;
  const droneStatus = await fetchDroneData(droneId);

  if (!droneStatus || !droneStatus.condition) {
    return res.status(404).json({ error: "Condition not found" });
  }

  res.json({ condition: droneStatus.condition });
});


app.get("/logs/:droneId", async (req, res) => {
  try {
    const { droneId } = req.params;
    const response = await axios.get(
      `${DRONE_LOG_SERVER}?filter=(drone_id='${droneId}')&sort=-created&limit=25`
    );

    if (!response.data || !response.data.items) {
      return res.status(404).json({ error: "Logs not found" });
    }

    const logs = response.data.items.map(log => ({
      drone_id: log.drone_id,
      drone_name: log.drone_name,
      created: log.created,
      country: log.country,
      celsius: log.celsius,
    }));

    res.json(logs);
  } catch (error) {
    console.error("Error fetching logs:", error.message);
    res.status(500).json({ error: "Failed to fetch logs" });
  }
});

app.post("/logs", async (req, res) => {
  const { drone_id, drone_name, country, celsius } = req.body;

  if (!drone_id || !drone_name || !country || celsius === undefined) {
    return res.status(400).json({ error: "Missing required log details" });
  }

  try {
    const response = await axios.post(
      DRONE_LOG_SERVER,
      { drone_id, drone_name, country, celsius },
      {
        headers: {
          Authorization: `Bearer ${process.env.POCKET_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.status(201).json(response.data);
  } catch (err) {
    console.error("Log creation error:", err.message);
    res.status(500).json({ error: "Could not create log entry" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
