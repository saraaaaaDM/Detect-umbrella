const OSC = require("osc-js");

const osc = new OSC({
    plugin: new OSC.DatagramPlugin()
});

osc.open({
    host: "127.0.0.1",
    port: 9130
});

setTimeout(() => {

    console.log("Envoi : parapluie OUVERT");

    const message = new OSC.Message(
        "/umbrella/state",
        1
    );

    osc.send(message, {
        host: "127.0.0.1",
        port: 9129
    });

}, 1000);