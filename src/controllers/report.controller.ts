import type { Request, Response } from "express";
import { PrismaClient,Store, BusinessHours, StoreStatus } from "@prisma/client";
import { randomUUID } from "crypto";
import { reportQueue } from "../queues/report.queue.js";
import { fromZonedTime, toZonedTime, format } from 'date-fns-tz';
import { addDays, parse, subDays, subHours, subWeeks } from 'date-fns'
interface ReportRow {
    store_id: string;
    uptime_last_hour: number;
    uptime_last_day: number;
    uptime_last_week: number;
    downtime_last_hour: number;
    downtime_last_day: number;
    downtime_last_week: number;
}

const prisma = new PrismaClient();

const redisConnection = {host:'localhost', port:6379}

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

   if (report.status === 'COMPLETE' && report.reportUrl) {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${report.id}.csv`);
    return res.sendFile(report.reportUrl);
}
    return res.status(200).json({
        status : report.status,
    })

}


export async function generateReport(): Promise<string> {
    console.log('Starting report generation for all stores...');
    
    
    const maxTimestampResult = await prisma.storeStatus.aggregate({ _max: { timestampUtc: true } });
    const now = maxTimestampResult._max.timestampUtc || new Date();

    const oneWeekAgo = subWeeks(now, 1);

    const stores = await prisma.store.findMany({
        include: {
            businessHours: true,
            statusLogs: {
                where: { timestampUtc: { gte: oneWeekAgo } },
                orderBy: { timestampUtc: 'asc' },
            },
        },
    });

    const reportRows: ReportRow[] = [];

    for (const store of stores) {
        const businessIntervalsUTC = getBusinessHoursInUTC(store.businessHours, store.timezoneStr, now);
        const { totalUptimeSeconds, totalDowntimeSeconds } = calculateUptimeDowntime(
            store.statusLogs,
            businessIntervalsUTC,
            now
        );
        const row: ReportRow = {
            store_id: store.id,
            uptime_last_hour: Math.round(totalUptimeSeconds.lastHour / 60),
            uptime_last_day: Math.round(totalUptimeSeconds.lastDay / 3600),
            uptime_last_week: Math.round(totalUptimeSeconds.lastWeek / 3600),
            downtime_last_hour: Math.round(totalDowntimeSeconds.lastHour / 60),
            downtime_last_day: Math.round(totalDowntimeSeconds.lastDay / 3600),
            downtime_last_week: Math.round(totalDowntimeSeconds.lastWeek / 3600),
        };
        reportRows.push(row);
    }
    return convertToCsv(reportRows);
}

function getBusinessHoursInUTC(businessHours: BusinessHours[], timezoneStr: string, now: Date): { start: Date; end: Date }[] {
    const intervals: { start: Date; end: Date }[] = [];
    if (businessHours.length === 0) {
        for (let i = 0; i < 7; i++) {
            const date = subDays(now, i);
            const startOfDay = new Date(date);
            startOfDay.setUTCHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setUTCHours(23, 59, 59, 999);
            intervals.push({ start: startOfDay, end: endOfDay });
        }
        return intervals;
    }

    for (let i = 0; i < 7; i++) {
        const date = subDays(now, i);
        const dayOfWeek = (toZonedTime(date, timezoneStr).getDay() + 6) % 7;

        const hoursForDay = businessHours.find(h => h.dayOfWeek === dayOfWeek);
        if (hoursForDay) {
            const localDateStr = format(toZonedTime(date, timezoneStr), 'yyyy-MM-dd');
            const localStartTime = parse(`${localDateStr} ${hoursForDay.startTimeLocal}`, 'yyyy-MM-dd HH:mm:ss', new Date());
            const localEndTime = parse(`${localDateStr} ${hoursForDay.endTimeLocal}`, 'yyyy-MM-dd HH:mm:ss', new Date());

            const utcStart = fromZonedTime(localStartTime, timezoneStr);
            let utcEnd = fromZonedTime(localEndTime, timezoneStr);

            // Handle overnight shifts (e.g., 10 PM - 2 AM)
            if (utcEnd < utcStart) {
                utcEnd = addDays(utcEnd, 1);
            }
            intervals.push({ start: utcStart, end: utcEnd });
        }
    }
    return intervals;
}

function calculateUptimeDowntime(
    statusLogs: StoreStatus[],
    businessIntervalsUTC: { start: Date; end: Date }[],
    now: Date
) {
    const totals = {
        totalUptimeSeconds: { lastHour: 0, lastDay: 0, lastWeek: 0 },
        totalDowntimeSeconds: { lastHour: 0, lastDay: 0, lastWeek: 0 },
    };

    const oneHourAgo = subHours(now, 1);
    const oneDayAgo = subDays(now, 1);

    for (let i = 0; i < statusLogs.length; i++) {
        const currentLog = statusLogs[i];
        const nextLog = statusLogs[i + 1];
        const intervalStart = currentLog.timestampUtc;
        const intervalEnd = nextLog ? nextLog.timestampUtc : now;

        processLogInterval({
            status: currentLog.status,
            intervalStart,
            intervalEnd,
            businessIntervalsUTC,
            oneHourAgo,
            oneDayAgo,
            now,
            totals
        });
    }
    return totals;
}

function processLogInterval(params: {
    status: string;
    intervalStart: Date;
    intervalEnd: Date;
    businessIntervalsUTC: { start: Date; end: Date }[];
    oneHourAgo: Date;
    oneDayAgo: Date;
    now: Date;
    totals: {
        totalUptimeSeconds: { lastHour: number; lastDay: number; lastWeek: number };
        totalDowntimeSeconds: { lastHour: number; lastDay: number; lastWeek: number };
    };
}) {
    const {
        status,
        intervalStart,
        intervalEnd,
        businessIntervalsUTC,
        oneHourAgo,
        oneDayAgo,
        totals
    } = params;
    for (const businessInterval of businessIntervalsUTC) {
        const { overlapStart, overlapEnd } = getOverlap(intervalStart, intervalEnd, businessInterval.start, businessInterval.end);
        if (overlapStart < overlapEnd) {
            const durationSeconds = (overlapEnd - overlapStart) / 1000;
            updateTotals(status, overlapStart, durationSeconds, oneHourAgo, oneDayAgo, totals);
        }
    }
}

function getOverlap(
    intervalStart: Date,
    intervalEnd: Date,
    businessStart: Date,
    businessEnd: Date
) {
    const overlapStart = Math.max(intervalStart.getTime(), businessStart.getTime());
    const overlapEnd = Math.min(intervalEnd.getTime(), businessEnd.getTime());
    return { overlapStart, overlapEnd };
}

function updateTotals(
    status: string,
    overlapStart: number,
    durationSeconds: number,
    oneHourAgo: Date,
    oneDayAgo: Date,
    totals: {
        totalUptimeSeconds: { lastHour: number; lastDay: number; lastWeek: number };
        totalDowntimeSeconds: { lastHour: number; lastDay: number; lastWeek: number };
    }
) {
    const isLastHour = overlapStart >= oneHourAgo.getTime();
    const isLastDay = overlapStart >= oneDayAgo.getTime();

    if (status === 'active') {
        totals.totalUptimeSeconds.lastWeek += durationSeconds;
        if (isLastDay) totals.totalUptimeSeconds.lastDay += durationSeconds;
        if (isLastHour) totals.totalUptimeSeconds.lastHour += durationSeconds;
    } else {
        totals.totalDowntimeSeconds.lastWeek += durationSeconds;
        if (isLastDay) totals.totalDowntimeSeconds.lastDay += durationSeconds;
        if (isLastHour) totals.totalDowntimeSeconds.lastHour += durationSeconds;
    }
}


function convertToCsv(data: ReportRow[]): string {
    if (data.length === 0) {
        return '';
    }
    const headers = Object.keys(data[0]);
    const csvRows = [
        headers.join(','),
        ...data.map(row => headers.map(header => row[header as keyof ReportRow]).join(','))
    ];
    return csvRows.join('\n');
}
