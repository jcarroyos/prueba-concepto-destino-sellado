// filepath: /workspaces/prueba-concepto-destino-sellado/actions.js
import { GestureRecognizer, FilesetResolver, DrawingUtils } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";

// Cargar la imagen de fuego
const fireImage = new Image();
fireImage.src = 'assets/fire-removebg-preview 1.png';
// Variables para suavizar el movimiento del fuego
let fireX = 0;
let fireY = 0;
let currentScaleFactor = 0; // Para suavizar cambios en el tamaño
const smoothingFactor = 0.3; // Factor de suavizado (0-1), más bajo = más suave
const scaleSmoothing = 0.15; // Factor de suavizado para el cambio de tamaño (más lento que el movimiento)

const demosSection = document.getElementById("demos");
let gestureRecognizer;
let runningMode = "VIDEO";
let enableWebcamButton;
let webcamRunning = false;
const videoHeight = "360px";
const videoWidth = "480px";

// Before we can use HandLandmarker class we must wait for it to finish
// loading. Machine Learning models can be large and take a moment to
// get everything needed to run.
const createGestureRecognizer = async () => {
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
    gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
            delegate: "GPU"
        },
        runningMode: runningMode
    });
    demosSection.classList.remove("invisible");
};
createGestureRecognizer();

/********************************************************************
// Continuously grab image from webcam stream and detect it.
********************************************************************/
const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const gestureOutput = document.getElementById("gesture_output");

// Check if webcam access is supported.
function hasGetUserMedia() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

// If webcam supported, add event listener to button for when user
// wants to activate it.
if (hasGetUserMedia()) {
    enableWebcamButton = document.getElementById("webcamButton");
    enableWebcamButton.addEventListener("click", enableCam);
}
else {
    console.warn("getUserMedia() is not supported by your browser");
}

// Enable the live webcam view and start detection.
function enableCam(event) {
    if (!gestureRecognizer) {
        alert("Por favor espere a que se cargue el reconocedor de gestos");
        return;
    }

    if (webcamRunning === true) {
        webcamRunning = false;
        enableWebcamButton.innerText = "INICIAR CÁMARA";
    }
    else {
        webcamRunning = true;
        enableWebcamButton.innerText = "DETENER CÁMARA";
    }

    // getUsermedia parameters.
    const constraints = {
        video: true
    };

    // Activate the webcam stream.
    navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
        video.srcObject = stream;
        video.addEventListener("loadeddata", predictWebcam);
    });
}

let lastVideoTime = -1;
let results = undefined;
async function predictWebcam() {
    const webcamElement = document.getElementById("webcam");
    
    let nowInMs = Date.now();
    if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        results = gestureRecognizer.recognizeForVideo(video, nowInMs);
    }

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    const drawingUtils = new DrawingUtils(canvasCtx);

    canvasElement.style.height = videoHeight;
    webcamElement.style.height = videoHeight;
    canvasElement.style.width = videoWidth;
    webcamElement.style.width = videoWidth;

    if (results.landmarks) {
        for (const landmarks of results.landmarks) {
            drawingUtils.drawConnectors(landmarks, GestureRecognizer.HAND_CONNECTIONS, {
                color: "#00FF00",
                lineWidth: 5
            });
            drawingUtils.drawLandmarks(landmarks, {
                color: "#FF0000",
                lineWidth: 2
            });
        }
    }
    canvasCtx.restore();
    
    if (results.gestures.length > 0) {
        gestureOutput.style.display = "block";
        gestureOutput.style.width = videoWidth;
        const categoryName = results.gestures[0][0].categoryName;
        const categoryScore = parseFloat(results.gestures[0][0].score * 100).toFixed(2);
        const handedness = results.handednesses[0][0].displayName;
        
        // Mostrar el nombre del gesto en la consola para depuración
        console.log("Gesto detectado:", categoryName);
        
        // Calcular distancia de la mano si hay landmarks disponibles
        let handDistanceInfo = "";
        // Valor que usaremos tanto para mostrar información como para escalar la imagen
        let distanceFactor = 1.0;
        
        if (results.landmarks && results.landmarks[0]) {
            const landmarks = results.landmarks[0];
            const palmBase = landmarks[0]; // Base de la palma
            const middleFinger = landmarks[12]; // Punta del dedo medio
            
            // Distancia entre la base de la palma y la punta del dedo medio
            const handWidth = Math.sqrt(
                Math.pow(palmBase.x - middleFinger.x, 2) +
                Math.pow(palmBase.y - middleFinger.y, 2)
            );
            
            // Calcular el factor de distancia basándonos en un valor de referencia ajustado
            // 0.15 es un valor de referencia más sensible que el anterior 0.2
            distanceFactor = handWidth / 0.15;
            
            handDistanceInfo = `\nCercanía: ${distanceFactor.toFixed(2)}`;
        }
        
        gestureOutput.innerText = `Gesto: ${categoryName}\nConfianza: ${categoryScore} %\nMano: ${handedness}${handDistanceInfo}`;
        
        // Si el gesto es "Pointing_Up" (o cualquiera de sus variantes), mostrar la imagen de fuego
        if ((categoryName === "Pointing_Up" || 
             categoryName === "Index_Up" || 
             categoryName === "Pointing_Up_Finger" || 
             categoryName === "Open_Palm" || 
             categoryName === "One") && 
             results.landmarks && results.landmarks[0]) {
            const landmarks = results.landmarks[0];
            // Obtener la posición del dedo índice (landmark 8)
            const indexFinger = landmarks[8];
            
            // Posición normalizada a coordenadas del canvas
            const targetX = indexFinger.x * canvasElement.width;
            const targetY = indexFinger.y * canvasElement.height;
            
            // Aplicar suavizado al movimiento
            if (fireX === 0 && fireY === 0) {
                // Primera detección, inicializar posición
                fireX = targetX;
                fireY = targetY;
            } else {
                // Interpolar suavemente la posición
                fireX = fireX + (targetX - fireX) * smoothingFactor;
                fireY = fireY + (targetY - fireY) * smoothingFactor;
            }
            
            // Usar el distanceFactor que ya calculamos anteriormente
            // Ajustes básicos para el tamaño del fuego
            const baseFireWidth = 80;
            const baseFireHeight = 120;
            
            // Factor vertical: fuego más grande cuando la mano está más arriba
            const verticalFactor = 1.0 - (indexFinger.y * 0.5);
            
            // Combinar el factor de distancia con el factor vertical
            const targetScaleFactor = distanceFactor * verticalFactor;
            
            // Aplicar limitaciones más amplias para permitir más variación
            const clampedTargetScale = Math.min(Math.max(targetScaleFactor, 0.4), 2.5);
            
            // Aplicar suavizado al cambio de escala (similar al suavizado de posición)
            if (currentScaleFactor === 0) {
                // Primera detección, inicializar tamaño
                currentScaleFactor = clampedTargetScale;
            } else {
                // Suavizar cambios de tamaño para evitar saltos
                currentScaleFactor = currentScaleFactor + (clampedTargetScale - currentScaleFactor) * scaleSmoothing;
            }
            
            // Usar el factor de escala suavizado para calcular las dimensiones
            const fireWidth = baseFireWidth * currentScaleFactor;
            const fireHeight = baseFireHeight * currentScaleFactor;
            
            // Mostrar información de depuración sobre el tamaño
            console.log(`Escala: ${currentScaleFactor.toFixed(2)}, Objetivo: ${clampedTargetScale.toFixed(2)}`);
            
            if (fireImage.complete && fireImage.naturalHeight !== 0) {
                canvasCtx.save();
                
                // Añadir un ligero efecto de oscilación para simular el fuego
                // Hacer que la oscilación sea proporcional al tamaño del fuego
                const wobble = Math.sin(Date.now() / 200) * 5 * currentScaleFactor;
                
                // Dibujar una sombra sutil para dar sensación de profundidad
                canvasCtx.shadowColor = 'rgba(255, 100, 20, 0.5)';
                canvasCtx.shadowBlur = 15 * currentScaleFactor;
                canvasCtx.shadowOffsetX = 0;
                canvasCtx.shadowOffsetY = 0;
                
                canvasCtx.drawImage(
                    fireImage, 
                    fireX - fireWidth / 2 + wobble, // Centrar en X con oscilación
                    fireY - fireHeight, // Colocar encima del dedo
                    fireWidth,
                    fireHeight
                );
                
                // Si la mano está cerca (fuego grande), añadir un efecto de resplandor
                // Bajamos el umbral a 1.3 para que el efecto de resplandor aparezca antes
                if (currentScaleFactor > 1.3) {
                    // Transparencia basada en la cercanía, con mayor intensidad
                    canvasCtx.globalAlpha = Math.min((currentScaleFactor - 1.3) * 2.5, 0.8); 
                    canvasCtx.globalCompositeOperation = 'lighter';
                    
                    // El tamaño del resplandor ahora es más proporcional al tamaño del fuego
                    const glowExtra = 10 * currentScaleFactor;
                    canvasCtx.drawImage(
                        fireImage,
                        fireX - fireWidth / 2 + wobble - glowExtra/2,
                        fireY - fireHeight - glowExtra/2,
                        fireWidth + glowExtra,
                        fireHeight + glowExtra
                    );
                    canvasCtx.globalAlpha = 1.0;
                    canvasCtx.globalCompositeOperation = 'source-over';
                }
                
                canvasCtx.shadowColor = 'transparent';
                canvasCtx.restore();
            }
        }
    }
    else {
        gestureOutput.style.display = "none";
    }
    
    // Call this function again to keep predicting when the browser is ready.
    if (webcamRunning === true) {
        window.requestAnimationFrame(predictWebcam);
    }
}
