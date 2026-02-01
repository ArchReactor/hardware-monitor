import { Printer } from "./printerBase.js";
import { MoonrakerClient } from "moonraker-client";
import { formatTimeSeconds, updateStatus } from "./helpers.js";
import { stat } from "fs";

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
                if(oldStatus !== this.status) {
                    stateUpdated = true;
                    if(oldStatus === "Printing" && (this.status === "Failed" || this.status === "Completed" || this.status === "Idle")) {
                        this.remainingTimeInSeconds = 0;
                        this.remainingTimeFormatted = "N/A";
                        this.printProgress = 100;
                        this.finishedAt = new Date().toLocaleString();
                        this.currentFile = "";
                    } else {
                        this.finishedAt = "";
                        this.print_duration = response.data.result.status.print_stats.print_duration;
                        this.currentFile = response.data.result.status.print_stats.filename;
                    }
                }
                if(this.printProgress !== response.data.result.status.display_status.progress) {
                    stateUpdated = true;
                    this.printProgress = response.data.result.status.display_status.progress;
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
        printer.remainingTimeInSeconds = Math.max(0, ((printer.print_duration / printer.printProgress) - printer.print_duration));
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

