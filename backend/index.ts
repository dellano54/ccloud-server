import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import authRoutes from './routes/auth.js';
import fileOps from './routes/fileOps.js';
import thumbnailOps from "./routes/thumbnails.js"
import albumRoutes from "./routes/albums.js";

const app = express();
app.use(express.static("../templates"));

app.use(cors());
const PORT = process.env.PORT || 8000;

app.use("/auth", express.json(), authRoutes);
app.use("/files", fileOps);
app.use("/files", express.json(), thumbnailOps);
app.use("/albums", albumRoutes);

app.listen(PORT, () => {
  console.log(`Backend server started on port: ${PORT}`);
});
