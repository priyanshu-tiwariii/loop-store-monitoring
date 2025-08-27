import express from 'express'   
import { PrismaClient } from '@prisma/client'
import reportRoutes from './routes/report.routes.js';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/api/v1',reportRoutes);

app.listen(PORT,()=>
console.log(`Server is running on port ${PORT}`)
);
