import config from '../config.json' with { type: "json" };
import { Printer } from "./printerBase.js";
import { PrinterController, P1SCommands, CameraController } from 'bambu-js';
import { formatTimeSeconds } from "./helpers.js";

export class HardwareBambu extends Printer {
    constructor(printerConfig) {
        super(printerConfig);
        this.bambu = PrinterController.create({
            model: printerConfig.model,
            host: printerConfig.host,
            accessCode: printerConfig.accessToken,
            serial: printerConfig.serialNumber,
            options: { autoReconnect: true, reconnectDelay: 60000  },
        });

        // Connection events
        this.bambu.on("connect", () => {
            //console.log("Printer connected");
            this.connected = true;
            this.bambu.sendCommand(P1SCommands.pushAllCommand());
        });

        this.bambu.on("disconnect", () => {
            console.log("Printer disconnected", this.name);
            this.connected = false;
        });

        this.bambu.on("end", () => {
            console.log("Connection ended", this.name);
            this.connected = false;
        });

        // State updates
        this.bambu.on("report", (state) => {
            // Handle printer state updates
            //all values: https://github.com/Doridian/OpenBambuAPI/blob/main/mqtt.md#pushingpushall
            //interesting items
            //state.print.gcode_state "OFFLINE" | "FINISH" | "FAILED" | "RUNNING" | "IDLE" | "PAUSE" | "PREPARE" | "SLICING"
            //state.print.mc_remaining_time
            //state.print.mc_percent
            let stateUpdated = false;
            const oldStatus = this.status;
            if(state.print && state.print.command && state.print.command === 'push_status'){ 
                if(state.print.gcode_state){
                    this.status = normaliseStatus(state.print.gcode_state);
                    if(this.status !== oldStatus){
                        stateUpdated = true;
                        if(oldStatus === "Printing" && (this.status === "Error" || this.status === "Completed" || this.status === "Idle")) {
                            this.remainingTimeInSeconds = 0;
                            this.remainingTimeFormatted = "N/A";
                            this.elapsedFormatted = this.startedAt ? formatTimeSeconds(Math.round((Date.now() - this.startedAt) / 1000)) : "N/A";
                            this.startedAt = 0;
                            this.printProgress = 100;
                            this.finishedAt = new Date().toLocaleString();
                            this.currentFile = "";
                        } else {
                            this.finishedAt = "";
                            if(this.status === "Printing" && !this.startedAt) {
                                this.startedAt = Date.now(); //a pause and resume keeps the original start
                            }
                        }
                    }
                }
                if(state.print.mc_remaining_time !== undefined){
                    if(this.remainingTimeInSeconds !== state.print.mc_remaining_time * 60){
                        stateUpdated = true;
                        this.remainingTimeInSeconds = state.print.mc_remaining_time * 60; //minutes to seconds
                        this.remainingTimeFormatted = formatTimeSeconds(this.remainingTimeInSeconds);
                        //console.log(`Remaining time: ${this.name} ${this.remainingTimeFormatted}`);
                    }
                }
                if(state.print.mc_percent !== undefined){
                    if(this.printProgress !== state.print.mc_percent){
                        stateUpdated = true;
                        this.printProgress = state.print.mc_percent;
                    }
                }
                if(state.print.gcode_file){
                    if(this.currentFile !== state.print.gcode_file) {
                        this.currentFile = state.print.gcode_file;
                        stateUpdated = true;
                    }
                }
            }
            if(stateUpdated){
                this.emit("statusUpdate", {
                    oldStatus: oldStatus,
                    status: this.status,
                    remainingTimeInSeconds: this.remainingTimeInSeconds,
                    remainingTimeFormatted: this.remainingTimeFormatted
                });
            }
            //console.log("Current state:", state);
        });

        // Error handling
        this.bambu.on("error", (error) => {
            if(error.message.includes("EHOSTUNREACH")) {
                this.status = "OFFLINE";
            }
            if(error.message.includes("connack timeout") && error.stack.includes("mqtt")) {
                return; //ignore mqtt connection timeouts, for some reason they don't get swollowed in the try catch
            }
            this.emit("error", error);
        });

        this.bambu.connect().then(() => {
            console.log(`Connected to Bambu printer ${this.name}`);
        }).catch((error) => {
            console.error(`Failed initial connection to Bambu printer ${this.name}:`, error);
        });
    }


    async updateToken(accessToken) {        
        await this.bambu.disconnect();
        this.bambu.setAccessCode(accessToken);
        this.camera = null; //rebuilt on the next photo with the new code
        this.bambu.connect().then(async () => {
            console.log(`reconfiguring HASS for ${this.name} with new token`);
            try {
                const step1 = await hassflowData("", {
                    handler:this.printerConfig.hassHandlerId,
                    show_advanced_options:false
                });
                const flowID = step1.flow_id;
                const oldSettings = await hassflowData(flowID, {printer_mode:"lan"});
                await hassflowData(flowID, {
                    host:this.printerConfig.host,
                    access_code:accessToken,
                    print_cache_count:oldSettings.data_schema.find(x => x.name === "print_cache_count")?.default || "10",
                    timelapse_cache_count:oldSettings.data_schema.find(x => x.name === "timelapse_cache_count")?.default || "1",
                    usage_hours:oldSettings.data_schema.find(x => x.name === "usage_hours")?.default || "0",
                    advanced:{
                        disable_ssl_verify:false,
                        enable_firmware_update:false
                    }
                });
                console.log(`Successfully reconfigured HASS for ${this.name} with new token`);
            } catch (error) {
                console.error(`Failed to start HASS reconfiguration flow for ${this.name} with new token:`, error);
                throw new Error(`Failed to start HASS reconfiguration flow for ${this.name} with new token: ${error.message}`);
            }
        }).catch((error) => {
            this.emit("error", `Failed to reconnect to Bambu printer ${this.name} with new token: ${error.message}`);
            console.error(`Failed to reconnect to Bambu printer ${this.name} with new token:`, error);
        });


    }

    async getSnapshot() {
        if(!this.camera) {
            this.camera = CameraController.create({
                model: this.printerConfig.model,
                host: this.printerConfig.host,
                accessCode: this.bambu.getAccessCode(),
            });
        }
        const frame = await this.camera.captureFrame();
        return frame.imageData;
    }
};

async function hassflowData(flowID, payload){
    return await fetch(`${config.hassUri}/api/config/config_entries/options/flow` + (flowID ? `/${flowID}` : ""),{
        method: "POST",
        headers: {
            "Authorization": `Bearer ${config.hassToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    }).then(response => {
        if(!response.ok){
            throw new Error(`HASS responded with status ${response.status} when trying to reconfigure ${this.name}`);
        }
        return response.json();
    }).catch(error => {
        console.error(`Failed to reconfigure HASS for ${this.name} with new token:`, error);
        throw new Error(`Failed to reconfigure HASS for ${this.name} with new token: ${error.message}`);
    });
}

function normaliseStatus(status) {
    switch (status) {
        case "OFFLINE":
            return "Offline";
        case "FINISH":
            return "Completed";
        case "FAILED":
            return "Error";
        case "RUNNING":
            return "Printing";
        case "IDLE":
            return "Idle";
        case "PAUSE":
            return "Paused";
        case "PREPARE":
            return "Preparing";
        case "SLICING":
            return "Slicing";
        default:
            return status;
    }
}

