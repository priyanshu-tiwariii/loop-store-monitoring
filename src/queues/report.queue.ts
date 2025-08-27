import { Queue } from "bullmq";


const redisConnection = {
    host : "localhost",
    port : 6379
}


export const reportQueue = new Queue('report_generation',{
    connection: redisConnection
})