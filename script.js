// ======================================================
// PROJET PARAPLUIE
// Webcam + MobileNet + KNN
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

// Dernier état envoyé
let currentState = null;
// ------------------------------------------------------
// SON DE PLUIE
// ------------------------------------------------------

const rainSound = new Audio("rain-on-an-umbrella.mp3");
rainSound.loop = true;
rainSound.preload = "auto";

function playRainSound() {
    rainSound.play().catch(error => {
        console.error("Erreur lecture pluie :", error);
    });
}

function stopRainSound() {
    rainSound.pause();
    rainSound.currentTime = 0;
}

// Correspondance des classes
const CLASS_NAMES = {
    0: "PARAPLUIE FERMÉ",
    1: "PARAPLUIE OUVERT",
    2: "PAS DE PARAPLUIE"
};


// ------------------------------------------------------
// 3. Connexion au pont Node.js
// ------------------------------------------------------

// Le navigateur envoie l'état au Node.js
const OSC_BRIDGE_URL = "http://localhost:8080/umbrella";


// ------------------------------------------------------
// 4. Initialisation
// ------------------------------------------------------

async function init() {

    statusText.innerText =
        "Chargement du modèle IA...";

    // Création du classifieur KNN
    classifier = knnClassifier.create();

    // Chargement de MobileNet
    mobilenetModel = await mobilenet.load();

    statusText.innerText =
        "Modèle IA chargé.";

    console.log("MobileNet chargé.");

    // Caméra
    await startCamera();

    // Connexion au pont Node.js
    connectOSC();
}


// ------------------------------------------------------
// 5. Caméra
// ------------------------------------------------------

async function startCamera() {

    try {

        const stream =
            await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false
            });

        video.srcObject = stream;

        await new Promise(resolve => {
            video.onloadedmetadata = resolve;
        });

        statusText.innerText =
            "Caméra OK — modèle prêt.";

    } catch (error) {

        console.error(error);

        statusText.innerText =
            "Erreur : impossible d'accéder à la caméra.";
    }
}


// ------------------------------------------------------
// 6. Connexion au pont
// ------------------------------------------------------

function connectOSC() {

    oscStatus.innerText =
        "Pont connecté : localhost:8080";

    console.log(
        "🌐 Pont reconnaissance → Node.js"
    );
}


// ------------------------------------------------------
// 7. Envoyer l'état au pont Node.js
// ------------------------------------------------------

async function sendOSC(state) {

    // Évite d'envoyer 50 fois le même état
    if (state === currentState) {
        return;
    }

    currentState = state;

    console.log(
        "☂️ RECONNAISSANCE → /umbrella/state",
        state
    );

    try {

        await fetch(OSC_BRIDGE_URL, {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                state: state
            })
        });

        oscStatus.innerText =
            "Parapluie envoyé : " + state;

    } catch (error) {

        console.error(
            "Erreur connexion Node.js :",
            error
        );

        oscStatus.innerText =
            "Erreur : Node.js inaccessible";
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
        "Exemple ajouté à : " +
        CLASS_NAMES[classId];
}


// ------------------------------------------------------
// 9. Bouton PARAPLUIE FERMÉ
// ------------------------------------------------------

btnClosed.addEventListener(
    "mousedown",
    async () => {

        await addExample(0);

    }
);


// ------------------------------------------------------
// 10. Bouton PARAPLUIE OUVERT
// ------------------------------------------------------

btnOpen.addEventListener(
    "mousedown",
    async () => {

        await addExample(1);

    }
);


// ------------------------------------------------------
// 11. Bouton PAS DE PARAPLUIE
// ------------------------------------------------------

btnNone.addEventListener(
    "mousedown",
    async () => {

        await addExample(2);

    }
);


// ------------------------------------------------------
// 12. Lancer la détection
// ------------------------------------------------------

btnTrain.addEventListener(
    "click",
    async () => {
        rainSound.play()
            .then(() => {
                rainSound.pause();
                rainSound.currentTime = 0;
                console.log("Audio débloqué");
            })
            .catch(error => {
                console.error("Audio bloqué :", error);
            });

        const count =
            classifier.getNumClasses();

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
    }
);


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
            await classifier.predictClass(
                activation
            );

        activation.dispose();

        const classId =
            result.classIndex;

        const confidence =
            result.confidences[classId];

        const percentage =
            Math.round(confidence * 100);


        // ------------------------------------------------
        // Affichage
        // ------------------------------------------------

        predictionText.innerText =
            "Détection : " +
            CLASS_NAMES[classId];

        confidenceText.innerText =
            "Confiance : " +
            percentage +
            "%";


        console.log(
            CLASS_NAMES[classId],
            percentage + "%"
        );


        // ------------------------------------------------
        // État du parapluie
        // ------------------------------------------------

        if (classId === 1) {

    // Parapluie ouvert
    sendOSC(1);
    playRainSound();

} else {

    // Parapluie fermé OU absent
    sendOSC(0);
    stopRainSound();

}

    } catch (error) {

        console.error(
            "Erreur pendant la détection :",
            error
        );
    }

    // Recommencer
    requestAnimationFrame(
        predictionLoop
    );
}


// ------------------------------------------------------
// 14. Lancement
// ------------------------------------------------------

init();