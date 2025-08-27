import { Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { generateReport } from "../controllers/report.controller.js";
import * as fs from 'fs/promises'
import * as path from 'path'
import fileUrlPath from 'url'


const __filename = fileUrlPath.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();


const redisConnection = {
    host : 'localhost',
    port : 6379
}


const worker = new Worker(
    'report_generation',
    async (job) => {
        console.log("Processing job for reportId : ", job.data.reportId);
        const { reportId } = job.data

        try {
            await prisma.report.update({
                where : {id : reportId},
                data: { status: 'RUNNING' }
            })

            console.log("Simulating heavy report  calculation .... ");
            const csvData = await generateReport();
            const reportDir = path.join(__dirname, `../../reports`);
            await fs.mkdir(reportDir, { recursive: true });
            const reportPath = path.join(reportDir, `${reportId}.csv`);
            await fs.writeFile(reportPath, csvData);

            await new Promise(resolve => setTimeout(resolve, 15000));
            console.log('Calculation Finished')

            await prisma.report.update({
                where: { id: reportId },
                data: { status: 'COMPLETE', reportUrl: reportPath }
            })

            console.log(`Job for reportId : ${reportId} completed successfully`);
        } catch (error) {
            console.log(`Job for reportId : ${reportId} failed`, error);
            await prisma.report.update({
                where: { id: reportId },
                data: { status: 'FAILED' }
            });
        }
    },
    {
        connection: redisConnection
    }
)

console.log("Report Worker is running ...")