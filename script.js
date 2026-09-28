// ======================================================
// PROJET PARAPLUIE
// Webcam + MobileNet + KNN + OSC
// ======================================================


// ------------------------------------------------------
// 1. Éléments HTML
// ------------------------------------------------------

const video = document.getElementById("webcam");

const statusText = document.getElementById("status");
const predictionText = document.getElementById("prediction");
const confidenceText = document.getElementById("confidence");
const oscStatus = document.getElementById("oscStatus");

const btnClosed = document.getElementById("btnClosed");
const btnOpen = document.getElementById("btnOpen");
const btnNone = document.getElementById("btnNone");
const btnTrain = document.getElementById("btnTrain");


// ------------------------------------------------------
// 2. Variables
// ------------------------------------------------------

let mobilenetModel;
let classifier;

let detecting = false;

// Dernier état envoyé par OSC
let currentState = null;

// Correspondance des classes
const CLASS_NAMES = {
    0: "PARAPLUIE FERMÉ",
    1: "PARAPLUIE OUVERT",
    2: "PAS DE PARAPLUIE"
};


// ------------------------------------------------------
// 3. OSC
// ------------------------------------------------------

// Le navigateur se connecte au serveur OSC Node.js
const osc = new OSC();


// ------------------------------------------------------
// 4. Initialisation
// ------------------------------------------------------

async function init() {

    statusText.innerText = "Chargement du modèle IA...";

    // Création du classifieur KNN
    classifier = knnClassifier.create();

    // Chargement de MobileNet
    mobilenetModel = await mobilenet.load();

    statusText.innerText = "Modèle IA chargé.";

    console.log("MobileNet chargé.");

    // Caméra
    await startCamera();

    // OSC
    connectOSC();
}


// ------------------------------------------------------
// 5. Caméra
// ------------------------------------------------------

async function startCamera() {

    try {

        const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
        });

        video.srcObject = stream;

        await new Promise(resolve => {
            video.onloadedmetadata = resolve;
        });

        statusText.innerText = "Caméra OK — modèle prêt.";

    } catch (error) {

        console.error(error);

        statusText.innerText =
            "Erreur : impossible d'accéder à la caméra.";

    }
}


// ------------------------------------------------------
// 6. Connexion OSC
// ------------------------------------------------------

function connectOSC() {

    try {

        osc.open();

        oscStatus.innerText =
            "OSC : connecté à ws://localhost:8080";

    } catch (error) {

        console.error("Erreur OSC :", error);

        oscStatus.innerText =
            "OSC : non connecté";

    }
}


// ------------------------------------------------------
// 7. Envoyer un message OSC
// ------------------------------------------------------

function sendOSC(state) {

    // Évite d'envoyer 50 fois le même message
    if (state === currentState) {
        return;
    }

    currentState = state;

    console.log("OSC → /umbrella/state", state);

    try {

        const message = new OSC.Message(
            "/umbrella/state",
            state
        );

        osc.send(message);

        oscStatus.innerText =
            "OSC envoyé : /umbrella/state " + state;

    } catch (error) {

        console.error("Erreur envoi OSC :", error);

        oscStatus.innerText =
            "OSC : erreur d'envoi";
    }
}


// ------------------------------------------------------
// 8. Ajouter un exemple au modèle
// ------------------------------------------------------

async function addExample(classId) {

    if (!mobilenetModel) {
        return;
    }

    // Transformer l'image webcam en représentation MobileNet
    const activation =
        mobilenetModel.infer(video, true);

    // Ajouter cette image à notre classe
    classifier.addExample(
        activation,
        classId
    );

    // Libérer la mémoire
    activation.dispose();

    console.log(
        "Exemple ajouté à la classe",
        classId
    );

    statusText.innerText =
        "Exemple ajouté à : " + CLASS_NAMES[classId];

}


// ------------------------------------------------------
// 9. Bouton PARAPLUIE FERMÉ
// ------------------------------------------------------

btnClosed.addEventListener("mousedown", async () => {

    await addExample(0);

});


// ------------------------------------------------------
// 10. Bouton PARAPLUIE OUVERT
// ------------------------------------------------------

btnOpen.addEventListener("mousedown", async () => {

    await addExample(1);

});


// ------------------------------------------------------
// 11. Bouton PAS DE PARAPLUIE
// ------------------------------------------------------

btnNone.addEventListener("mousedown", async () => {

    await addExample(2);

});


// ------------------------------------------------------
// 12. Lancer la détection
// ------------------------------------------------------

btnTrain.addEventListener("click", async () => {

    const count = classifier.getNumClasses();

    if (count < 2) {

        alert(
            "Il faut entraîner au moins 2 classes."
        );

        return;
    }

    detecting = true;

    statusText.innerText =
        "Détection en cours...";

    predictionLoop();

});


// ------------------------------------------------------
// 13. Boucle de détection
// ------------------------------------------------------

async function predictionLoop() {

    if (!detecting) {
        return;
    }

    try {

        const activation =
            mobilenetModel.infer(video, true);

        const result =
            await classifier.predictClass(activation);

        activation.dispose();

        const classId = result.classIndex;

        const confidence = result.confidences[classId];

        const percentage =
            Math.round(confidence * 100);


        // Affichage
        predictionText.innerText =
            "Détection : " + CLASS_NAMES[classId];

        confidenceText.innerText =
            "Confiance : " + percentage + "%";


        console.log(
            CLASS_NAMES[classId],
            percentage + "%"
        );


        // ------------------------------------------------
        // OSC
        // ------------------------------------------------

        if (classId === 1) {

            // Parapluie ouvert
            sendOSC(1);

        } else {

            // Fermé OU absent
            sendOSC(0);

        }

    } catch (error) {

        console.error(
            "Erreur pendant la détection :",
            error
        );

    }

    // Recommencer
    requestAnimationFrame(predictionLoop);
}


// ------------------------------------------------------
// 14. Lancement
// ------------------------------------------------------

init();