// Acepta tanto el link completo del QR del gafete (".../#/pase/CQ0427FX")
// como el código plano, y siempre devuelve el código en mayúsculas.
// Compartido entre Selector (ver tu pase) y Certificado (descargar
// certificado) — mismo QR físico, dos puntos de entrada distintos.
export function extraerCodigoPase(textoEscaneado: string): string {
  const limpio = textoEscaneado.trim();
  const match = limpio.match(/\/pase\/([A-Za-z0-9]+)/);
  return (match ? match[1] : limpio).toUpperCase();
}
