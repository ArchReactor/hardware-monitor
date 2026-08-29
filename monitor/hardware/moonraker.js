import { Printer } from "./printerBase.js";
import { MoonrakerClient } from "moonraker-client";
import { formatTimeSeconds } from "./helpers.js";
import { Jimp } from "jimp";

export class HardwareMoonraker extends Printer {

    constructor(printerConfig) {
        super(printerConfig);

        this.moonraker = new MoonrakerClient({
            moonrakerUrl: printerConfig.url,
        });

        this.fetchStatus();
        this.setupTimer();
    }

    setupTimer() {
        setInterval(async () => {
            this.fetchStatus();
        }, 60000);
    }

    fetchStatus() {
        this.moonraker.httpRequest({
            method: 'get',
            url: '/printer/objects/query?display_status&print_stats',
        }).then(
            (response) => {
                //console.log(`Status event for ${this.name}:`, JSON.stringify(response.data.result.status, null, 2));
                let stateUpdated = false;
                const oldStatus = this.status;

                this.status = normaliseStatus(response.data.result.status.print_stats.state);
                this.print_duration = response.data.result.status.print_stats.print_duration;
                if(oldStatus !== this.status) {
                    stateUpdated = true;
                    if(oldStatus === "Printing" && (this.status === "Error" || this.status === "Cancelled" || this.status === "Completed" || this.status === "Idle")) {
                        this.remainingTimeInSeconds = 0;
                        this.remainingTimeFormatted = "N/A";
                        this.elapsedFormatted = formatTimeSeconds(Math.round(response.data.result.status.print_stats.total_duration));
                        this.printProgress = 100;
                        this.finishedAt = new Date().toLocaleString();
                        this.currentFile = "";
                    } else {
                        this.finishedAt = "";
                        this.currentFile = response.data.result.status.print_stats.filename;
                    }
                }
                const progress = Math.round(response.data.result.status.display_status.progress * 100);
                if(this.printProgress !== progress) {
                    stateUpdated = true;
                    this.printProgress = progress;
                    setTimeRemaining({printer: this});
                }
                if(stateUpdated) {
                    this.emit("statusUpdate", {
                        oldStatus: oldStatus,
                        status: this.status,
                        remainingTimeInSeconds: this.remainingTimeInSeconds,
                        remainingTimeFormatted: this.remainingTimeFormatted
                    });
                }
            },
        ).catch((error)=> {
            this.emit("error", error);
        }); 
    }

    async getSnapshot() {
        if(!this.snapshotUrl) {
            const response = await this.moonraker.httpRequest({
                method: 'get',
                url: '/server/webcams/list',
            });
            const webcam = response.data.result.webcams.find(cam => cam.enabled);
            if(!webcam) {
                return null; //no camera on this printer
            }
            this.snapshotUrl = new URL(webcam.snapshot_url, this.printerConfig.url).href; //moonraker gives it relative to itself
        }
        const image = await fetch(this.snapshotUrl);
        if(!image.ok) {
            throw new Error(`webcam returned ${image.status}`);
        }
        if(this.printerConfig.rotateSnapshot) {
            const j = await Jimp.read(await image.arrayBuffer());
            j.rotate(this.printerConfig.rotateSnapshot);
            return await j.getBufferAsync(Jimp.MIME_JPEG);
        } else{
            return Buffer.from(await image.arrayBuffer());
        }
    }

    // connect() {
    //     try {
    //         this.moonraker.subscribeToPrinterObjectStatusWithListener({"display_status": ["progress"], print_stats: ["filename", "state", "print_duration"]}, (data) => {
    //             //standby, printing, paused, complete, error, cancelled
                
    //             let stateUpdated = false;
    //             const oldStatus = this.status;
    //             if("display_status" in data.objectNotification) {
    //                 if(this.printProgress !== data.objectNotification.display_status.progress) {
    //                     stateUpdated = true;
    //                     this.printProgress = data.objectNotification.display_status.progress;
    //                     setTimeRemaining({printer: this});
    //                 }
    //             }
    //             if("print_stats" in data.objectNotification){
    //                 this.print_duration = data.objectNotification.print_stats.print_duration;
    //                 this.currentFile = data.objectNotification.print_stats.filename;
    //                 var newstatus = normaliseStatus(data.objectNotification.print_stats.state);
    //                 if(this.status !== newstatus) {
    //                     stateUpdated = true;
    //                     this.status = newstatus;
    //                     if(oldStatus === "Printing" && (this.status === "Failed" || this.status === "Completed" || this.status === "Idle")) {
    //                         this.remainingTimeInSeconds = 0;
    //                         this.remainingTimeFormatted = "N/A";
    //                         this.printProgress = 100;
    //                         this.finishedAt = new Date().toLocaleString();
    //                         this.currentFile = "";
    //                     } else {
    //                         this.finishedAt = "";
    //                     }
    //                 }
    //                 //console.log(`${this.name} status has changed to ${this.status}!`, data);
    //             }
    //             if(stateUpdated) {
    //                 this.emit("statusUpdate", {
    //                     oldStatus: oldStatus,
    //                     status: this.status,
    //                     remainingTimeInSeconds: this.remainingTimeInSeconds,
    //                     remainingTimeFormatted: this.remainingTimeFormatted
    //                 });
    //             }
    //         });
    //     } catch (error) {
    //         console.error(`Failed to connect to Moonraker printer ${this.name}:`, error);
    //         if(this.autoReconnect) {
    //             console.error(`Scheduling reconnect in ${this.reconnectDelay / 1000} seconds...`);
    //             this.scheduleReconnect();
    //         }
    //     }
    // }

    // scheduleReconnect() {
    //     if(this.reconnectTimeout) {
    //         return; // Reconnect already scheduled
	// 	}

    //     this.reconnectTimeout = setTimeout(() => {
    //         this.reconnectTimeout = null;

    //         this.connect();
    //     }, this.reconnectDelay);
    // }
};

function setTimeRemaining({printer}) {
    if(printer.print_duration && printer.printProgress) {
        const totalSeconds = printer.print_duration / (printer.printProgress / 100); //printProgress is a percentage
        printer.remainingTimeInSeconds = Math.round(Math.max(0, totalSeconds - printer.print_duration));
        printer.remainingTimeFormatted = formatTimeSeconds(printer.remainingTimeInSeconds);
        console.log(`${printer.name} Remaining time: ${printer.remainingTimeFormatted}`, {
            printProgress: printer.printProgress,
            print_duration: printer.print_duration,
            remainingTimeInSeconds: printer.remainingTimeInSeconds
        });
    }

}

function normaliseStatus(status) {
    switch (status) {
        case "standby":
            return "Idle";
        case "printing":
            return "Printing";
        case "paused":
            return "Paused";
        case "complete":
            return "Completed";
        case "error":
            return "Error";
        case "cancelled":
            return "Cancelled";
        default:
            return status;
    }
}

