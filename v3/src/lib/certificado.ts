// Generación del certificado de participación: dibuja el nombre sobre
// la plantilla (public/plantilla-certificado.webp) con un <canvas>, igual
// técnica que la herramienta standalone de certificados ya usada en otros
// eventos Fiberlux — mismo archivo de plantilla, misma calibración de la
// línea (verificada acá con análisis de píxeles, no a ojo).
const PLANTILLA_URL = "/plantilla-certificado.webp";

// Posición de la línea "___" bajo "CERTIFICADO DE PARTICIPACIÓN", como
// fracción del tamaño de la imagen. Si cambia el diseño de la plantilla,
// hay que remedir estos 5 valores sobre la imagen nueva.
const LINEA = {
  xInicio: 0.2035,
  xFin: 0.7953,
  y: 0.5488,
  offsetTexto: 0.014,
  tamanoFuente: 0.048,
};

let plantillaImg: HTMLImageElement | null = null;

function cargarPlantilla(): Promise<HTMLImageElement> {
  if (plantillaImg) return Promise.resolve(plantillaImg);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { plantillaImg = img; resolve(img); };
    img.onerror = reject;
    img.src = PLANTILLA_URL;
  });
}

async function asegurarFuentePoppins() {
  // El canvas necesita la fuente ya descargada, no basta con el <link>
  // de Google Fonts del documento.
  await Promise.all([
    document.fonts.load("600 60px Poppins"),
    document.fonts.load("700 60px Poppins"),
  ]);
  await document.fonts.ready;
}

export async function generarCertificadoPNG(nombre: string): Promise<Blob> {
  const [img] = await Promise.all([cargarPlantilla(), asegurarFuentePoppins()]);

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no soportado");
  ctx.drawImage(img, 0, 0);

  const xInicio = LINEA.xInicio * canvas.width;
  const xFin = LINEA.xFin * canvas.width;
  const centroX = (xInicio + xFin) / 2;
  const maxAncho = (xFin - xInicio) * 0.92;
  const baseY = (LINEA.y - LINEA.offsetTexto) * canvas.height;

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#5c0d48";

  let fontSize = LINEA.tamanoFuente * canvas.height;
  let ancho: number;
  do {
    ctx.font = `600 ${fontSize}px Poppins, sans-serif`;
    ancho = ctx.measureText(nombre).width;
    if (ancho <= maxAncho) break;
    fontSize -= 1;
  } while (fontSize > 14);

  ctx.fillText(nombre, centroX, baseY);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("No se pudo generar el PNG"))), "image/png", 1);
  });
}

export function nombreArchivoCertificado(nombre: string): string {
  const limpio = nombre
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim().replace(/\s+/g, "-");
  return `Certificado-${limpio || "Fiberlux-ISP"}.png`;
}
