// filepath: /workspaces/prueba-concepto-destino-sellado/actions.js
import { GestureRecognizer, FilesetResolver, DrawingUtils } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";

// Cargar la imagen de fuego
const fireImage = new Image();
fireImage.src = 'assets/fire-removebg-preview 1.png';

// Cargar la imagen del ojo
const eyeImage = new Image();
eyeImage.src = 'assets/eye_simbol.png';

// Variables para suavizar el movimiento del fuego
let fireX = 0;
let fireY = 0;
let currentScaleFactor = 0; // Para suavizar cambios en el tamaño

// Variables para suavizar el movimiento del ojo
let eyeX = 0;
let eyeY = 0;
let currentEyeScaleFactor = 0; // Para suavizar cambios en el tamaño del ojo

const smoothingFactor = 0.3; // Factor de suavizado (0-1), más bajo = más suave
const scaleSmoothing = 0.15; // Factor de suavizado para el cambio de tamaño (más lento que el movimiento)

// Variables para la animación con GSAP
let fireTl; // Timeline para la animación del fuego
let fireAnimationActive = false; // Controla si la animación está activa

// Variables para la animación del ojo con GSAP
let eyeTl; // Timeline para la animación del ojo
let eyeAnimationActive = false; // Controla si la animación del ojo está activa
// Array para almacenar propiedades de capas del ojo
let eyeLayersProps = []; // Almacenará propiedades específicas para cada capa del ojo

// Array para almacenar propiedades de capas múltiples del fuego
let fireLayersProps = []; // Almacenará propiedades específicas para cada capa del fuego
// Variables para el cálculo estable de la cercanía
let lastDistanceFactors = []; // Array para almacenar los últimos valores de distancia
const distanceHistorySize = 10; // Cantidad de valores históricos a mantener
let stableDistanceFactor = 1.0; // Factor de distancia estabilizado

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
        
        // Detener animaciones cuando se detiene la cámara
        if (fireAnimationActive) {
            fireAnimationActive = false;
            if (fireTl) {
                fireTl.kill();
                fireTl = null;
            }
            window.fireLayersProps = null;
            fireLayersProps = [];
        }
        
        // Detener animaciones del ojo cuando se detiene la cámara
        if (eyeAnimationActive) {
            eyeAnimationActive = false;
            if (eyeTl) {
                eyeTl.kill();
                eyeTl = null;
            }
            window.eyeLayersProps = null;
            eyeLayersProps = [];
        }
        
        // Reiniciar mediciones de distancia cuando se apaga la cámara
        lastDistanceFactors = [];
        stableDistanceFactor = 1.0;
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

    // Ocultamos los indicadores de puntos de referencia pero mantenemos la detección
    if (results.landmarks) {
        // El código que dibuja los landmarks ha sido comentado para mostrar solo las imágenes PNG
        // for (const landmarks of results.landmarks) {
        //     drawingUtils.drawConnectors(landmarks, GestureRecognizer.HAND_CONNECTIONS, {
        //         color: "#00FF00",
        //         lineWidth: 5
        //     });
        //     drawingUtils.drawLandmarks(landmarks, {
        //         color: "#FF0000",
        //         lineWidth: 2
        //     });
        // }
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
            
            // Usar puntos de referencia más estables en la palma que no varían tanto con los gestos
            // Usaremos múltiples medidas para mayor estabilidad
            
            // 1. Distancia entre base del índice (5) y base del meñique (17)
            const indexBase = landmarks[5];
            const pinkyBase = landmarks[17];
            const palmWidth = Math.sqrt(
                Math.pow(indexBase.x - pinkyBase.x, 2) +
                Math.pow(indexBase.y - pinkyBase.y, 2)
            );
            
            // 2. Distancia entre base de la palma (0) y base del dedo medio (9)
            const wristPoint = landmarks[0];
            const middleFingerBase = landmarks[9];
            const palmHeight = Math.sqrt(
                Math.pow(wristPoint.x - middleFingerBase.x, 2) +
                Math.pow(wristPoint.y - middleFingerBase.y, 2)
            );
            
            // 3. Calcular un factor de área de la palma (más estable entre gestos)
            const palmArea = palmWidth * palmHeight * 3.14; // Aproximación del área
            
            // Calcular el factor de distancia usando el área de la palma
            // 0.025 es un valor de referencia calibrado para esta medida
            const rawDistanceFactor = palmArea / 0.025;
            
            // Añadir el nuevo factor al historial
            lastDistanceFactors.push(rawDistanceFactor);
            
            // Mantener solo los últimos N valores
            if (lastDistanceFactors.length > distanceHistorySize) {
                lastDistanceFactors.shift(); // Eliminar el valor más antiguo
            }
            
            // Calcular la media de los valores recientes para suavizar cambios bruscos
            let sum = 0;
            for (let i = 0; i < lastDistanceFactors.length; i++) {
                sum += lastDistanceFactors[i];
            }
            
            // Actualizar el factor de distancia estable
            stableDistanceFactor = sum / lastDistanceFactors.length;
            
            // Usar el factor estable como el factor de distancia actual
            distanceFactor = stableDistanceFactor;
            
            // Información para mostrar
            handDistanceInfo = `\nCercanía: ${distanceFactor.toFixed(2)}`;
        }
        
        gestureOutput.innerText = `Gesto: ${categoryName}\nConfianza: ${categoryScore} %\nMano: ${handedness}${handDistanceInfo}`;
        
        // Si el gesto es "Pointing_Up" (o cualquiera de sus variantes directas), mostrar la imagen de fuego
        if ((categoryName === "Pointing_Up" || 
             categoryName === "Index_Up" || 
             categoryName === "Pointing_Up_Finger") && 
             results.landmarks && results.landmarks[0]) {
            // Desactivar animación del ojo si estaba activa, ya que ahora mostramos el fuego
            if (eyeAnimationActive) {
                eyeAnimationActive = false;
                if (eyeTl) {
                    eyeTl.kill();
                    eyeTl = null;
                }
                window.eyeLayersProps = null;
                eyeLayersProps = [];
            }
            
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
            
            // Mostrar información de depuración sobre el tamaño y distancia estable
            console.log(`Escala: ${currentScaleFactor.toFixed(2)}, Objetivo: ${clampedTargetScale.toFixed(2)}, Cercanía estable: ${stableDistanceFactor.toFixed(2)}`);
            
            if (fireImage.complete && fireImage.naturalHeight !== 0) {
                canvasCtx.save();
                
                // Crear o actualizar la animación GSAP para el fuego
                if (!fireAnimationActive) {
                    // Si no hay animación activa, crear una nueva
                    fireAnimationActive = true;
                    
                    // Primero eliminamos cualquier animación anterior si existe
                    if (fireTl) {
                        fireTl.kill();
                    }
                    
                    // Inicializamos el array de propiedades para las capas
                    fireLayersProps = [
                        // Capa principal (más cercana/nítida)
                        {
                            wobble: 0,
                            scaleBoost: 0,
                            rotation: 0,
                            glowIntensity: 0,
                            opacity: 1,
                            offsetY: 0,
                            offsetX: 0
                        },
                        // Capa media (fondo semi-transparente)
                        {
                            wobble: 0,
                            scaleBoost: 0,
                            rotation: 0,
                            glowIntensity: 0,
                            opacity: 0.7,
                            offsetY: -5,
                            offsetX: 5
                        },
                        // Capa trasera (más transparente y grande)
                        {
                            wobble: 0,
                            scaleBoost: 0,
                            rotation: 0,
                            glowIntensity: 0,
                            opacity: 0.4,
                            offsetY: -10,
                            offsetX: -10
                        }
                    ];
                    
                    // Crear nueva timeline con repetición infinita
                    fireTl = gsap.timeline({
                        repeat: -1
                    });
                    
                    // Animaciones para la capa principal
                    fireTl.to(fireLayersProps[0], {
                        wobble: 15 * currentScaleFactor, // Vaivén más pronunciado
                        duration: 0.7,  // Duración más corta para más velocidad
                        ease: "sine.inOut",
                        yoyo: true,
                        repeat: -1
                    }, 0);
                    
                    fireTl.to(fireLayersProps[0], {
                        scaleBoost: 0.12, // Más pulsación
                        duration: 1.1,
                        ease: "sine.inOut",
                        yoyo: true,
                        repeat: -1
                    }, 0);
                    
                    fireTl.to(fireLayersProps[0], {
                        rotation: 4,
                        duration: 2.2,
                        ease: "sine.inOut",
                        yoyo: true,
                        repeat: -1
                    }, 0);
                    
                    fireTl.to(fireLayersProps[0], {
                        glowIntensity: 0.9,
                        duration: 1.3,
                        ease: "sine.inOut",
                        yoyo: true,
                        repeat: -1
                    }, 0);
                    
                    // Animaciones para la capa media (con ligero retraso)
                    fireTl.to(fireLayersProps[1], {
                        wobble: 20 * currentScaleFactor, // Vaivén más amplio para capa secundaria
                        duration: 0.9,
                        ease: "sine.inOut",
                        yoyo: true,
                        repeat: -1
                    }, 0.1); // Retraso de 0.1s
                    
                    fireTl.to(fireLayersProps[1], {
                        scaleBoost: 0.15,
                        duration: 1.4,
                        ease: "sine.inOut",
                        yoyo: true,
                        repeat: -1
                    }, 0.1);
                    
                    fireTl.to(fireLayersProps[1], {
                        rotation: -5, // Rotación en dirección opuesta
                        duration: 2.7,
                        ease: "sine.inOut",
                        yoyo: true,
                        repeat: -1
                    }, 0.1);
                    
                    fireTl.to(fireLayersProps[1], {
                        glowIntensity: 0.7,
                        duration: 1.7,
                        ease: "power1.inOut", // Efecto de intensidad diferente
                        yoyo: true,
                        repeat: -1
                    }, 0.1);
                    
                    // Animaciones para la capa trasera (con mayor retraso)
                    fireTl.to(fireLayersProps[2], {
                        wobble: 25 * currentScaleFactor, // Vaivén aún más amplio
                        duration: 1.1,
                        ease: "sine.inOut",
                        yoyo: true,
                        repeat: -1
                    }, 0.2); // Retraso de 0.2s
                    
                    fireTl.to(fireLayersProps[2], {
                        scaleBoost: 0.18,
                        duration: 1.6,
                        ease: "sine.inOut",
                        yoyo: true,
                        repeat: -1
                    }, 0.2);
                    
                    fireTl.to(fireLayersProps[2], {
                        rotation: 6, // Rotación más amplia
                        duration: 3.0,
                        ease: "sine.inOut",
                        yoyo: true,
                        repeat: -1
                    }, 0.2);
                    
                    fireTl.to(fireLayersProps[2], {
                        glowIntensity: 0.5,
                        duration: 2.0,
                        ease: "power2.inOut", // Otro efecto de suavizado
                        yoyo: true,
                        repeat: -1
                    }, 0.2);
                    
                    // Guardar referencia global
                    window.fireLayersProps = fireLayersProps;
                }
                
                // Verificar que tenemos las propiedades de las capas
                const layersProps = window.fireLayersProps || fireLayersProps;
                
                // Calcular valores base para todas las capas
                const baseWidth = fireWidth;
                const baseHeight = fireHeight;
                
                // Dibujar las capas en orden inverso (de atrás hacia adelante)
                for (let i = layersProps.length - 1; i >= 0; i--) {
                    const layer = layersProps[i];
                    
                    // Calcular valores específicos para esta capa
                    const wobble = layer.wobble || 0;
                    const scaleBoost = (layer.scaleBoost || 0) + (i * 0.05); // Aumentar tamaño para capas traseras
                    const rotation = layer.rotation || 0;
                    const opacity = layer.opacity || 1;
                    const offsetX = layer.offsetX || 0;
                    const offsetY = layer.offsetY || 0;
                    
                    // Ajustar tamaño según la capa y el factor de escala
                    const layerScale = currentScaleFactor * (1 + scaleBoost);
                    const layerWidth = baseWidth * layerScale * (1 + (i * 0.1)); // Capas traseras más grandes
                    const layerHeight = baseHeight * layerScale * (1 + (i * 0.05));
                    
                    canvasCtx.save();
                    
                    // Configurar transparencia
                    canvasCtx.globalAlpha = opacity;
                    
                    // Añadir sombra solo para la capa principal
                    if (i === 0) {
                        canvasCtx.shadowColor = 'rgba(255, 100, 20, 0.5)';
                        canvasCtx.shadowBlur = 15 * layerScale;
                        canvasCtx.shadowOffsetX = 0;
                        canvasCtx.shadowOffsetY = 0;
                    }
                    
                    // Aplicar rotación
                    if (rotation) {
                        canvasCtx.translate(fireX + offsetX, fireY - layerHeight/2 + offsetY);
                        canvasCtx.rotate((rotation * Math.PI) / 180);
                        canvasCtx.translate(-(fireX + offsetX), -(fireY - layerHeight/2 + offsetY));
                    }
                    
                    // Dibujar capa de fuego
                    canvasCtx.drawImage(
                        fireImage,
                        fireX - layerWidth/2 + wobble + offsetX,
                        fireY - layerHeight + offsetY,
                        layerWidth,
                        layerHeight
                    );
                    
                    // Efecto de resplandor para cada capa si corresponde
                    const glowIntensity = layer.glowIntensity || 0;
                    const distanceGlowFactor = currentScaleFactor > 1.3 ? 
                        Math.min((currentScaleFactor - 1.3) * (1.5 - i * 0.3), 0.6) : 0;
                    
                    if (glowIntensity > 0.4 || distanceGlowFactor > 0) {
                        const finalGlowIntensity = Math.max(glowIntensity * 0.3, distanceGlowFactor) * opacity;
                        
                        if (finalGlowIntensity > 0.1) {
                            canvasCtx.globalAlpha = finalGlowIntensity;
                            canvasCtx.globalCompositeOperation = 'lighter';
                            
                            const glowExtra = (10 + i * 5) * layerScale;
                            canvasCtx.drawImage(
                                fireImage,
                                fireX - layerWidth/2 + wobble - glowExtra/2 + offsetX,
                                fireY - layerHeight - glowExtra/4 + offsetY,
                                layerWidth + glowExtra,
                                layerHeight + glowExtra/2
                            );
                            
                            canvasCtx.globalCompositeOperation = 'source-over';
                        }
                    }
                    
                    canvasCtx.restore();
                }
                
                canvasCtx.shadowColor = 'transparent';
                canvasCtx.restore();
            }
        }
        // Si el gesto es "Open_Palm", mostrar la imagen del ojo en el centro de la palma
        else if (categoryName === "Open_Palm" && results.landmarks && results.landmarks[0]) {
            // Desactivar animación del fuego si estaba activa, ya que ahora mostramos el ojo
            if (fireAnimationActive) {
                fireAnimationActive = false;
                if (fireTl) {
                    fireTl.kill();
                    fireTl = null;
                }
                window.fireLayersProps = null;
                fireLayersProps = [];
            }
            
            const landmarks = results.landmarks[0];
            
            // Calcular el centro de la palma usando puntos de la palma
            // Promediamos varios puntos para obtener un centro más estable
            // Usamos landmarks 0 (muñeca), 5, 9, 13, 17 (bases de los dedos)
            const centerPoints = [landmarks[0], landmarks[5], landmarks[9], landmarks[13], landmarks[17]];
            let sumX = 0, sumY = 0;
            
            for (const point of centerPoints) {
                sumX += point.x;
                sumY += point.y;
            }
            
            // Posición normalizada a coordenadas del canvas
            const targetX = (sumX / centerPoints.length) * canvasElement.width;
            const targetY = (sumY / centerPoints.length) * canvasElement.height;
            
            // Aplicar suavizado al movimiento del ojo
            if (eyeX === 0 && eyeY === 0) {
                // Primera detección, inicializar posición
                eyeX = targetX;
                eyeY = targetY;
            } else {
                // Interpolar suavemente la posición
                eyeX = eyeX + (targetX - eyeX) * smoothingFactor;
                eyeY = eyeY + (targetY - eyeY) * smoothingFactor;
            }
            
            // Usar el distanceFactor que ya calculamos anteriormente
            // Ajustes básicos para el tamaño del ojo
            const baseEyeWidth = 100;
            const baseEyeHeight = 100;
            
            // Factor de escala para el ojo basado en la distancia
            const targetEyeScaleFactor = distanceFactor * 1.2; // Ajustar según se necesite
            const clampedEyeTargetScale = Math.min(Math.max(targetEyeScaleFactor, 0.5), 2.5);
            
            // Aplicar suavizado al cambio de escala
            if (currentEyeScaleFactor === 0) {
                // Primera detección, inicializar tamaño
                currentEyeScaleFactor = clampedEyeTargetScale;
            } else {
                // Suavizar cambios de tamaño para evitar saltos
                currentEyeScaleFactor = currentEyeScaleFactor + (clampedEyeTargetScale - currentEyeScaleFactor) * scaleSmoothing;
            }
            
            // Calcular dimensiones finales
            const eyeWidth = baseEyeWidth * currentEyeScaleFactor;
            const eyeHeight = baseEyeHeight * currentEyeScaleFactor;
            
            // Mostrar información de depuración
            console.log(`Ojo - Escala: ${currentEyeScaleFactor.toFixed(2)}, Cercanía: ${distanceFactor.toFixed(2)}`);
            
            if (eyeImage.complete && eyeImage.naturalHeight !== 0) {
                canvasCtx.save();
                
                // Crear o actualizar la animación GSAP para el ojo
                if (!eyeAnimationActive) {
                    // Si no hay animación activa, crear una nueva
                    eyeAnimationActive = true;
                    
                    // Eliminar cualquier animación anterior
                    if (eyeTl) {
                        eyeTl.kill();
                    }
                    
                    // Inicializar array de propiedades para las capas del ojo
                    eyeLayersProps = [
                        // Capa principal (más nítida)
                        {
                            rotation: 0,
                            pulsation: 0,
                            glowIntensity: 0,
                            opacity: 1,
                            offsetX: 0,
                            offsetY: 0
                        },
                        // Capa de aura (efecto de energía)
                        {
                            rotation: 0,
                            pulsation: 0,
                            glowIntensity: 0,
                            opacity: 0.6,
                            offsetX: 0,
                            offsetY: 0
                        }
                    ];
                    
                    // Crear nueva timeline con repetición infinita
                    eyeTl = gsap.timeline({
                        repeat: -1
                    });
                    
                    // Animación para la capa principal
                    eyeTl.to(eyeLayersProps[0], {
                        rotation: 360,  // Rotación completa
                        duration: 20,   // Rotación lenta
                        ease: "none",
                        repeat: -1
                    }, 0);
                    
                    eyeTl.to(eyeLayersProps[0], {
                        pulsation: 0.15,  // Efecto de latido
                        duration: 1.5,
                        ease: "sine.inOut",
                        yoyo: true,
                        repeat: -1
                    }, 0);
                    
                    eyeTl.to(eyeLayersProps[0], {
                        glowIntensity: 0.8,
                        duration: 2.1,
                        ease: "sine.inOut",
                        yoyo: true,
                        repeat: -1
                    }, 0);
                    
                    // Animación para la capa de aura (en dirección contraria)
                    eyeTl.to(eyeLayersProps[1], {
                        rotation: -360,  // Rotación en sentido opuesto
                        duration: 25,    // Más lenta que la capa principal
                        ease: "none",
                        repeat: -1
                    }, 0);
                    
                    eyeTl.to(eyeLayersProps[1], {
                        pulsation: 0.25,  // Pulsación más pronunciada
                        duration: 2.2,
                        ease: "sine.inOut",
                        yoyo: true,
                        repeat: -1
                    }, 0);
                    
                    eyeTl.to(eyeLayersProps[1], {
                        glowIntensity: 0.9,
                        duration: 1.8,
                        ease: "sine.inOut",
                        yoyo: true,
                        repeat: -1
                    }, 0);
                    
                    // Guardar referencia global
                    window.eyeLayersProps = eyeLayersProps;
                }
                
                // Verificar que tenemos las propiedades de las capas
                const layersProps = window.eyeLayersProps || eyeLayersProps;
                
                // Dibujar las capas del ojo en orden inverso (atrás hacia adelante)
                for (let i = layersProps.length - 1; i >= 0; i--) {
                    const layer = layersProps[i];
                    
                    // Obtener propiedades de la capa
                    const rotation = layer.rotation || 0;
                    const pulsation = layer.pulsation || 0;
                    const glowIntensity = layer.glowIntensity || 0;
                    const opacity = layer.opacity || 1;
                    const offsetX = layer.offsetX || 0;
                    const offsetY = layer.offsetY || 0;
                    
                    // Ajustar escala según la capa y efecto de pulsación
                    const layerScale = currentEyeScaleFactor * (1 + pulsation) * (i === 1 ? 1.3 : 1); // Capa de aura más grande
                    const layerWidth = eyeWidth * layerScale;
                    const layerHeight = eyeHeight * layerScale;
                    
                    canvasCtx.save();
                    
                    // Configurar opacidad
                    canvasCtx.globalAlpha = opacity;
                    
                    // Efectos de resplandor para la capa principal
                    if (i === 0) {
                        canvasCtx.shadowColor = 'rgba(0, 150, 255, 0.5)';
                        canvasCtx.shadowBlur = 15 * layerScale;
                    }
                    
                    // Aplicar rotación desde el centro del ojo
                    canvasCtx.translate(eyeX + offsetX, eyeY + offsetY);
                    canvasCtx.rotate((rotation * Math.PI) / 180);
                    canvasCtx.translate(-(eyeX + offsetX), -(eyeY + offsetY));
                    
                    // Dibujar la capa del ojo
                    canvasCtx.drawImage(
                        eyeImage,
                        eyeX - layerWidth/2 + offsetX,
                        eyeY - layerHeight/2 + offsetY,
                        layerWidth,
                        layerHeight
                    );
                    
                    // Efecto de resplandor adicional si corresponde
                    if (glowIntensity > 0.4) {
                        canvasCtx.globalAlpha = glowIntensity * opacity * 0.6;
                        canvasCtx.globalCompositeOperation = 'lighter';
                        
                        const glowExtra = 20 * layerScale;
                        canvasCtx.drawImage(
                            eyeImage,
                            eyeX - (layerWidth + glowExtra)/2 + offsetX,
                            eyeY - (layerHeight + glowExtra)/2 + offsetY,
                            layerWidth + glowExtra,
                            layerHeight + glowExtra
                        );
                        
                        canvasCtx.globalCompositeOperation = 'source-over';
                    }
                    
                    canvasCtx.restore();
                }
                
                canvasCtx.shadowColor = 'transparent';
                canvasCtx.restore();
            }
        }
    }
    else {
        gestureOutput.style.display = "none";
        
        // Si no hay gestos detectados pero hay una animación activa, detenerla
        if (fireAnimationActive) {
            fireAnimationActive = false;
            if (fireTl) {
                fireTl.kill();
                fireTl = null;
            }
            window.fireLayersProps = null;
            fireLayersProps = [];
        }
        
        // Si no hay gestos detectados pero hay una animación de ojo activa, detenerla
        if (eyeAnimationActive) {
            eyeAnimationActive = false;
            if (eyeTl) {
                eyeTl.kill();
                eyeTl = null;
            }
            window.eyeLayersProps = null;
            eyeLayersProps = [];
        }
        
        // No reiniciamos lastDistanceFactors aquí para mantener la estabilidad
        // de la medición de distancia incluso cuando temporalmente no se detecta un gesto
    }
    
    // Call this function again to keep predicting when the browser is ready.
    if (webcamRunning === true) {
        window.requestAnimationFrame(predictWebcam);
    }
}
