console.log("Starting ingestion process ....");

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import csvParser from 'csv-parser';
import fileUrlPath from 'url'
import type { url } from 'inspector';

const __filename = fileUrlPath.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const prisma = new PrismaClient();

// Function to read the CSV file
function readCsvFile(filePath:string): Promise<any[]>{
    return new Promise((resolve,reject)=>{
        const results : any[] = [];
        fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (data)=> results.push(data))
        .on('end',() => resolve(results))
        .on('error',(error)=> reject(error));
    })
}

async function main () {
    console.log("Starting ingestion process ....");
    const hoursPath = path.join(__dirname,'../../data/menu_hours.csv');
    const statusPath = path.join(__dirname,'../../data/store_status.csv');
    const timezonePath = path.join(__dirname,'../../data/timezones.csv');

    console.log("Reading CSV files from the data directory ....")
    const hoursData = await readCsvFile(hoursPath);
    const statusData = await readCsvFile(statusPath);
    const timezoneData = await readCsvFile(timezonePath);

    const allStoreIds = new Set<string>();
    [...hoursData,...statusData,...timezoneData].forEach(record => {
        if(record.store_id){
            allStoreIds.add(record.store_id);
        }
    });

    const storeCreationData = [...allStoreIds].map(id =>({
        id: id
    }));


    console.log('Total unique stores are :', storeCreationData.length);
    await prisma.store.createMany({
        data: storeCreationData,
        skipDuplicates: true
    })

    console.log("Store entry created Successfully ...")

    const hoursCreationData = hoursData.map(record =>({
        storeId : record.store_id,
        dayOfWeek : parseInt(record.dayOfWeek, 10),
        startTimeLocal : record.start_time_local,
        endTimeLocal : record.end_time_local
    }))

    console.log("Total hours entries created :", hoursCreationData.length);
    await prisma.businessHours.createMany({
        data: hoursCreationData,
    })

    console.log("Hours entries created Successfully ...")

    const storeStatusCreationData = statusData.map(record =>({
        storeId: record.store_id,
        timestampUtc: new Date(record.timestamp_utc),
        status: record.status
    }))

    console.log("Total store status entries created :", storeStatusCreationData.length);

    await prisma.storeStatus.createMany({
        data: storeStatusCreationData,
    })

    console.log("Store status entries created Successfully ...")

    for(const record of timezoneData){
        await prisma.store.update({
            where:{id:record.store_id},
            data:{timezoneStr:record.timezone_str}
        });
    }

    console.log("Timezone entries updated Successfully ...")

    console.log("Ingestion process completed successfully.");

    

}
main()
    .catch((error)=>{
        console.error('Error occurred during ingestion process');
        console.error(error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });