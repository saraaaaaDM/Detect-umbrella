const dgram = require("dgram");
const http = require("http");
const OSC = require("osc-js");

const socket = dgram.createSocket("udp4");

socket.on("message", async (data) => {

    const message = new OSC.Message();
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    message.unpack(view);

    if (message.address !== "/umbrella/state") {
        return;
    }

    const state = message.args[0];

    console.log("☂️ PARAPLUIE →", state);

    try {
        await fetch("http://127.0.0.1:8000/umbrella", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                state: state
            })
        });

        console.log("→ envoyé au serveur Python");

    } catch (error) {
        console.log("❌ Serveur Python inaccessible");
    }
});

socket.on("listening", () => {
    console.log("=================================");
    console.log(" PONT CHATAIGNE → SERVEUR PYTHON");
    console.log("=================================");
    console.log("OSC UDP : 127.0.0.1:41234");
    console.log("Serveur Python : http://127.0.0.1:8000");
    console.log("En attente...");
});

socket.on("error", (error) => {
    console.log("❌ ERREUR UDP :", error.message);
});

socket.bind(41234, "127.0.0.1");

const httpServer = http.createServer(async (req, res) => {

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method !== "POST" || req.url !== "/umbrella") {
        res.writeHead(404);
        res.end();
        return;
    }

    let body = "";

    req.on("data", chunk => {
        body += chunk;
    });

    req.on("end", async () => {

        try {
            const data = JSON.parse(body);
            const state = Number(data.state);

            console.log("🌐 RECONNAISSANCE →", state);

            await fetch("http://127.0.0.1:8000/umbrella", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    state: state
                })
            });

            res.writeHead(204);
            res.end();

        } catch (error) {
            console.log("❌ Erreur reconnaissance :", error.message);
            res.writeHead(500);
            res.end();
        }
    });
});

httpServer.listen(8080, "127.0.0.1", () => {
    console.log("🌐 Reconnaissance HTTP : http://127.0.0.1:8080/umbrella");
});