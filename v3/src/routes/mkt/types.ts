export type View = "resumen" | "asistentes" | "stands" | "ranking" | "sorteo" | "configuracion";

export type Metricas = {
  total: number;
  ingresados: number;
  aptos: number;
  umbralBoletos: number;
  registroAbierto: boolean;
  sorteoAbierto: boolean;
  ranking: { nombre: string; tier: string; panelSponsor: boolean; visitas: number; ultimaVisita: string | null }[];
};

export type Asistente = {
  id: string;
  nombre: string;
  email: string;
  celular: string;
  empresa: string;
  ruc: string;
  ingresado: boolean;
  boletosTotal: number;
  participaSorteo: boolean;
};

export type StandRow = {
  id: string;
  nombre: string;
  codigo: string;
  codigo_sponsor: string | null;
  tier: "diamante" | "oro" | "complementario";
  panel_sponsor: boolean;
  activo: boolean;
  orden: number;
};

export type EventConfig = {
  id: number;
  registro_abierto: boolean;
  sorteo_abierto: boolean;
  umbral_boletos: number;
  cronograma_sheet_url: string | null;
};

export type CronogramaRow = {
  id: number;
  hora: string;
  actividad: string;
  expositor: string | null;
  orden: number;
};
