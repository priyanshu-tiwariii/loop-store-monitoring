import type { Request, Response } from "express";

export const triggerReport = async (req : Request, res: Response)=>{
    console.log("Received request to trigger report");
    const reportId = `report_${Math.random().toString(36).substring(2,8)}`;
    console.log(`Report generation started with Report ID : ${reportId}`);
    return res.status(202).json({reportId, message: "Report generation started"});
}

export const getReport = async (req : Request, res: Response)=>{
    const reportId = req.query.report_id as string;
    if(!reportId){
        return res.status(400).json({
            error: "Report ID is required"

        })
    }

    console.log(`Fetching report with Report ID : ${reportId}`);
    return res.status(200).json({
        status : "Running"
    })

}