import EventEmitter from "events";

export class Printer extends EventEmitter {
    constructor(printerConfig) {
        super();
        this.name = printerConfig.name;
        this.status = "OFFLINE";
        this.connected = false;
        this.remainingTimeInSeconds = 0;
        this.remainingTimeFormatted = "N/A";
        this.printerConfig = printerConfig;
    }

    //expected events:
    // "statusUpdate" with payload {oldStatus, status, remainingTimeInSeconds, remainingTimeFormatted}
    // "error" with payload {error}

    getFullState() {
        // To be implemented in subclasses
    }
}