import { Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";

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
            await new Promise(resolve => setTimeout(resolve, 15000));
            console.log('Calculation Finished')

            await prisma.report.update({
                where: { id: reportId },
                data: { status: 'COMPLETE', reportUrl: `/reports/${reportId}.csv` }
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