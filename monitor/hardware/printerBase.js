import EventEmitter from "events";

export class Printer extends EventEmitter {
    constructor(printerConfig) {
        super();
        this.name = printerConfig.name;
        this.status = "OFFLINE";
        this.connected = false;
        this.finishedAt = "";
        this.printProgress = 100;
        this.remainingTimeInSeconds = 0;
        this.remainingTimeFormatted = "N/A";
        this.elapsedFormatted = "N/A";
        this.startedAt = 0;
        this.printerConfig = printerConfig;
        this.currentFile = "";
        this.messagesSince = 0;
        this.photo = null;
    }

    //expected events:
    // "statusUpdate" with payload {oldStatus, status, remainingTimeInSeconds, remainingTimeFormatted}
    // "error" with payload {error}

    getFullState() {
        // To be implemented in subclasses
    }

    async getSnapshot() {
        return null; //only printers with a camera return an image
    }
}