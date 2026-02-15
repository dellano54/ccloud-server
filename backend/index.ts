import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import authRoutes from './routes/auth.js';

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8000;

app.use("/auth", authRoutes);

app.listen(PORT, () => {
  console.log(`Backend server started on port: ${PORT}`);
});
