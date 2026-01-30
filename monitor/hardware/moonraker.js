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

        this.moonraker.subscribeToPrinterObjectStatusWithListener({"display_status": ["progress"], print_stats: ["filename", "state", "print_duration"]}, (data) => {
            //standby, printing, paused, complete, error, cancelled
            
            let stateUpdated = false;
            const oldStatus = this.status;
            if("display_status" in data.objectNotification) {
                if(this.printProgress !== data.objectNotification.display_status.progress) {
                    stateUpdated = true;
                    this.printProgress = data.objectNotification.display_status.progress;
                    setTimeRemaining({printer: this});
                }

            }
            if("print_stats" in data.objectNotification){
                this.print_duration = data.objectNotification.print_stats.print_duration;
                this.currentFile = data.objectNotification.print_stats.filename;
                var newstatus = normaliseStatus(data.objectNotification.print_stats.state);
                if(this.status !== newstatus) {
                    stateUpdated = true;
                    this.status = newstatus;
                    if(oldStatus === "Printing" && (this.status === "Failed" || this.status === "Completed" || this.status === "Idle")) {
                        this.remainingTimeInSeconds = 0;
                        this.remainingTimeFormatted = "N/A";
                        this.printProgress = 100;
                        this.finishedAt = new Date().toLocaleString();
                        this.currentFile = "";
                    } else {
                        this.finishedAt = "";
                    }
                }
                //console.log(`${this.name} status has changed to ${this.status}!`, data);
            }
            if(stateUpdated) {
                this.emit("statusUpdate", {
                    oldStatus: oldStatus,
                    status: this.status,
                    remainingTimeInSeconds: this.remainingTimeInSeconds,
                    remainingTimeFormatted: this.remainingTimeFormatted
                });
            }
        });
    }
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

