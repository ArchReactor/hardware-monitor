<!-- Improved compatibility of back to top link: See: https://github.com/othneildrew/Best-README-Template/pull/73 -->
<a id="readme-top"></a>


<!-- ABOUT THE PROJECT -->
## About The Project

Monitors hardware on the network via supported APIs.  Reports status to a designated Discord channel

Currently supports Bambu P1s and H2D printers and anything running Moonraker.

<p align="right">(<a href="#readme-top">back to top</a>)</p>




<!-- GETTING STARTED -->
## Getting Started

Note: this repo contains Docker config, it is optional to use docker.

1. Clone the repo
   ```sh
   git clone https://github.com/ArchReactor/hardware-monitor.git
   ```
2. Copy the config.json.template to config.json
3. If not using Docker, install NPM packages.  Docker compose will install the packages in the container for you
   ```sh
   npm install
   ```
4. Copy `config.json.template` to `config.json` Enter your discord bot info
   See the following URL for how to create a bot and get the values neded
   * https://discordjs.guide/preparations/setting-up-a-bot-application.html
5. Add your printer information to `config.json`
6. If using docker, run ```docker compose up``` to follow the console or ```docker compose up -d``` to background it
7. If not using Docker, ```cd monitor``` and run the service
   ```sh
   npm start
   ```


<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- USAGE EXAMPLES -->
## Usage

Your discord channel will now show status messages.  Other commands:
* /printstatus {printer name} - supports autocomplete
* /machine-ping - replies Pong if the app is working 

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- Other features -->
## Other Features

A local web interface is accessable at `http://{your local IP address}:3043/` that shows printer status as well as allowing updating the Banbu printer access codes without having to edit the config file and restart the service.