\# 📄 Resumen Ejecutivo: Web App de Control de Asistencia y Métricas en Vivo



\## 📌 Visión General del Proyecto

La \*\*Web App de Asistencia\*\* es una solución ligera desarrollada para el evento corporativo \*Fiberlux ISP Cajamarca\*, concebida para reemplazar el registro tradicional en papel/Excel por un sistema digitalizado de captación de datos, control de flujo y generación de métricas en tiempo real. 



El sistema permitió registrar asistentes, evitar duplicados, mapear el recorrido de los participantes por los distintos \*stands\* del evento y visualizar un ranking de concurrencia en tiempo real.



\---



\## 🛠️ Arquitectura Tecnológica \& Stack



El proyecto fue construido bajo un enfoque de \*\*desarrollo ágil / vibe coding\*\*, priorizando la velocidad de despliegue, el bajo costo de infraestructura y la alta accesibilidad:



\* \*\*Frontend:\*\* HTML5, CSS3, JavaScript (Vanilla JS).

\* \*\*Hosting Frontend:\*\* \*\*Netlify\*\* (Despliegue continuo y entrega rápida de contenido).

\* \*\*Backend \& Lógica de Negocio:\*\* \*\*Google Apps Script (GAS)\*\* ejecutado mediante endpoints HTTP (`doGet` / `doPost`).

\* \*\*Base de Datos \& Almacenamiento:\*\* \*\*Google Sheets\*\* (Persistencia de datos relacional/tabular).

\* \*\*Servicios Externos (APIs):\*\* API dinámica para generación e inyección de códigos QR en caliente.



\---



\## 🔄 Flujo de Integración y Conexiones (Ecosistema)

\[ Usuario / Staff ]

│

▼ (Interfaz Web en Netlify)

\[ Frontend HTML/JS ]

│

├── HTTP Request (GET/POST)

▼

\[ Google Apps Script (Código.gs) ] ── (Llamada API Externa) ──► \[ Creador de QRs ]

│

├── Lectura / Escritura de Celdas

▼

\[ Google Sheets (Base de Datos) ]



\### 1. Conexión Frontend ↔ Backend (Netlify to Apps Script)

\* El cliente realiza peticiones asíncronas (`fetch` / `AJAX`) enviando parámetros estructurados (ID de asistente, código de stand, datos de nuevos registros).

\* El script desplegado como Web App procesa los datos y devuelve respuestas en formato JSON.



\### 2. Conexión Backend ↔ Base de Datos (Apps Script to Google Sheets)

\* \*\*Gestión de Asistencia:\*\* Escribe directamente en la hoja correspondiente buscando al asistente por ID y marcando la columna del \*stand\* visitado (por ejemplo, Columna S: \*Planex\*, \*Fiberlux\*, etc.).

\* \*\*Validación de Duplicados:\*\* Realiza lecturas del rango activo (`getDataRange()`) para corroborar que el asistente no haya sido marcado previamente en el mismo punto.

\* \*\*Métricas en Vivo:\*\* Recopila el conteo de marcaciones por cada pilar/stand y consolida la información para alimentar los paneles de resumen de marketing.



\### 3. Registro Manual \& Módulo MKT

\* En caso de participantes no pre-registrados, el módulo permite el ingreso de datos en caliente (\*Nombre, Correo, Teléfono, Empresa\*), los añade como una nueva fila en el Sheet y genera una vista previa de la etiqueta lista para impresión térmica.



\---



\## ⚠️ Lecciones Técnicas \& Puntos de Mejora (Versión 2.0)



A partir de la auditoría de ejecución y el estrés del sistema en campo durante el evento, se identificaron los siguientes cuellos de botella para la siguiente iteración:



| Desafío en Campo | Causa Raíz | Solución Estratégica para v2.0 |

| :--- | :--- | :--- |

| \*\*Picos de latencia (hasta 13s)\*\* | Llamadas síncronas a la API externa de QRs en el registro manual de puerta. | \*\*Generación Asíncrona:\*\* Generar el QR en segundo plano (triggers) o renderizarlo directamente con librerías en el cliente (JS local). |

| \*\*Lectura fallida en iPhones\*\* | Conflicto del autoenfoque (macro) de la cámara de Apple con el tamaño/distancia de los QRs impresos. | \*\*Ajuste de Ergonomía UI:\*\* Incrementar el área del código QR y optimizar el contraste de impresión. |

| \*\*Lentitud por densidad de red\*\* | Saturación del espectro WiFi/Móvil del recinto + consultas de celdas en tiempo real. | \*\*Optimización de Payload \& Cache:\*\* Implementar almacenamiento local (`localStorage`) temporal para operar en modo offline/concurrente. |



\---



\## 📊 Impacto y Resultados



\* \*\*Digitalización Total:\*\* Eliminación completa del registro manual en papel.

\* \*\*Trazabilidad:\*\* Cobertura de datos del 100% de los asistentes registrados.

\* \*\*Métricas de Valor:\*\* Identificación precisa de los \*stands\* más concurridos, permitiendo entregar reportes de retorno de inversión (ROI) a las marcas participantes.

