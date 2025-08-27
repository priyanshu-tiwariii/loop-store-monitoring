
import { triggerReport, getReport } from "../controllers/report.controller.js";


import { Router } from "express";



const reportRoutes : Router = Router();

reportRoutes.post('/trigger_report', triggerReport);
reportRoutes.get('/get_report', getReport);

export default reportRoutes;

