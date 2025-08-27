import type { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { reportQueue } from "../queues/report.queue.js";

const prisma = new PrismaClient();
export const triggerReport = async (req : Request, res: Response)=>{
    console.log("Received request to trigger report");
 const newReport = await prisma.report.create({
    data:{
        id:randomUUID(),
        status:'PENDING'
    }
 })

 await reportQueue.add('generate_report', {reportId:newReport.id});

    console.log('Created report and added for the job with reportId : ', newReport.id);
    return res.status(202).json({report_id: newReport.id});
}

export const getReport = async (req : Request, res: Response)=>{
    const reportId = req.query.report_id as string;
    if(!reportId){
        return res.status(400).json({
            error: "Report ID is required"

        })
    }

    console.log(`Fetching report with Report ID : ${reportId}`);
    const report = await prisma.report.findUnique({
        where: { id: reportId }
    })
    if(!report){
        return res.status(404).json({
            error: "Report not found"
        })
    }

    if (report.status === 'COMPLETE') {
        res.setHeader('Content-Type','text/csv')
        res.setHeader('Content-Disposition', `attachment; filename=${reportId}.csv`);
        return res.status(200).send(`Dummy CSV content for report ${reportId}`);
    }
    return res.status(200).json({
        status : report.status,
    })

}