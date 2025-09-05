<!-- Improved compatibility of back to top link: See: https://github.com/othneildrew/Best-README-Template/pull/73 -->
<a id="readme-top"></a>


<!-- ABOUT THE PROJECT -->
## About The Project

Monitors hardware on the network via supported APIs.  Reports status to a designated Discord channel

Currently supports Bambu 3D printers.  

<p align="right">(<a href="#readme-top">back to top</a>)</p>




<!-- GETTING STARTED -->
## Getting Started

Note: this repo contains Docker config, it is optional to use docker.

1. Copy the config.json.template to config.json
2. Clone the repo
   ```sh
   git clone https://github.com/ArchReactor/hardware-monitor.git
   ```
3. If using docker, run ```docker compose up```
4. If not using Docker, ```cd monitor``` and continue
5. Install NPM packages
   ```sh
   npm install
   ```
6. Enter your discord bit info in `config.json`
   See the following URL for how to create a bot and get the values neded
   * https://discordjs.guide/preparations/setting-up-a-bot-application.html
7. Add your Bambu printer information
8. Run the service
   ```sh
   npm start
   ```


<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- USAGE EXAMPLES -->
## Usage

Your discord channel will now how status messages.  Other commands:
* /printstatus {printer name} - supports autocomplete
* /ping - replies Pong if the app is working 

<p align="right">(<a href="#readme-top">back to top</a>)</p>


